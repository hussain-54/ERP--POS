# Electrical Store ERP — Offline & Sync Architecture

**Phase:** 0  
**Offline runtime:** Electron + React + Node (main)  
**Offline DB:** SQLite  
**Online DB:** Supabase PostgreSQL  
**Rule:** Same master business model; SQLite is a persistence projection, not a second ERP  

---

## 1. Goals

1. POS and core operations continue **without internet**.  
2. Bidirectional sync restores a single consistent organization ledger.  
3. No duplicate sales, stock double-decrements, or split-brain balances.  
4. Conflicts are detectable, explainable, and resolvable.  

---

## 2. Offline Capability Matrix (Minimum)

| Module area | Offline required | Notes |
|-------------|------------------|-------|
| Sales / POS | Yes | Full post cart → invoice |
| Purchases | Yes | Receive / purchase invoice subset |
| Stock | Yes | Movements + on-hand reads |
| Customers | Yes | Create/select; credit checks with cached limits |
| Suppliers | Yes | Select + basic create |
| Invoices | Yes | Local print + reprint |
| Payments | Yes | Cash/bank/credit tenders |
| Installments | Yes | Collect dues; create plans on sale |
| Returns | Yes | Sale returns / exchange |
| Expenses | Yes | Record expenses |
| Product search / barcodes | Yes | Cached catalog |
| Accounts journals | Partial | Local simplified posting; full COA sync |
| BI / CRM campaigns / online store | No | Online-only |
| Multi-branch transfer to remote WH | Limited | Home branch warehouses only offline |

---

## 3. Process Architecture (Electron)

```text
Renderer (React POS UI)
    │ typed IPC
    ▼
Main Process Services
    ├── LocalDb (SQLite)
    ├── Domain Services (shared package)
    ├── Sync Engine
    ├── Hardware Adapters
    └── Secure Storage (tokens, device key)
```

- Renderer never opens SQLite directly.  
- Domain posting code lives in `packages/domain` and runs in main (or shared node context).  
- UI shows sync state from engine events.  

---

## 4. SQLite Schema Strategy

### 4.1 Mirror, don’t fork

- Table names and UUID keys match Postgres.  
- Column subsets allowed (omit unused online-only columns).  
- Schema version table: `schema_migrations`.  
- Migrations shipped with the Electron app; applied on startup.  

### 4.2 Generation approach (recommended)

1. Maintain canonical entity definitions in `packages/db`.  
2. Emit Postgres SQL **and** SQLite DDL from the same source (or hand-maintain SQLite subset with CI diff checks).  
3. Never invent offline-only business tables except pure local helpers (`local_drafts`, `local_printer_settings`).  

### 4.3 Local helper tables (allowed)

| Table | Purpose |
|-------|---------|
| `local_settings` | Device UI prefs |
| `local_drafts` | Unposted cart autosave |
| `local_sequence_counters` | Invoice number ranges |
| `connectivity_events` | Diagnostics |

These are not master business entities.

---

## 5. Keys & Identifiers

| ID type | Rule |
|---------|------|
| Canonical UUID | Primary business identity online & offline |
| SQLite `rowid` | Physical only; never sync as business key |
| `device_id` | From `device_registry`; stored locally after approval |
| Offline transaction IDs | Sale UUID created at post time (before sync) |
| Idempotency key | UUID/string unique per post command; persisted |
| Document numbers | `BRANCHCODE-DEVICECODE-SEQ` to avoid collisions |

---

## 6. Sync Metadata Model

### 6.1 Cursors

Per device + table (or logical stream):

- `server_cursor` — last successfully pulled server change stamp/version  
- `client_cursor` — last successfully pushed local change  

Stored in `sync_metadata`.

### 6.2 Versions

- Every syncable row has `version` incremented on mutation.  
- Conflict if server.version ≠ expected base version when applying client change (for LWW-eligible masters).  

### 6.3 Tombstones

- Soft delete: sync `deleted_at`.  
- Purge job online after retention; offline removes only after ack.  

### 6.4 Queue

`sync_queue` locally:

- enqueue on every committed local mutation  
- payload = entity snapshot or command envelope  
- status: pending → sending → acked | failed  

---

## 7. Sync Engine Flows

### 7.1 Push (local → server)

```text
1. Claim pending queue batch (ordered)
2. For each item, POST /api/v1/sync/push with idempotency_key
3. Server validates authz + applies command/row policy
4. Ack → mark done; on retryable error → backoff; on conflict → sync_conflicts
```

Prefer **command sync** for transactions (sale post, payment, return) and **row sync** for masters (products, customers).

### 7.2 Pull (server → local)

```text
1. Request changes since server_cursor (filtered by org + branch scope)
2. Apply in dependency order (masters before transactions)
3. Advance cursor only after successful local TX apply
```

### 7.3 Background vs manual

- Background: when connectivity detected, idle intervals  
- Manual: “Sync Now”  
- Initial hydrate: bulk pull catalog + open balances + recent transactions window  

### 7.4 Partial synchronization

- Priority channels: (1) payments/sales (2) stock movements (3) masters (4) media metadata  
- Large media: lazy download  
- Failed subset does not block unrelated channels if dependencies allow  

---

## 8. Conflict Resolution

### 8.1 Detection

- Version mismatch on master updates  
- Duplicate idempotency keys (treat as success replay)  
- Business rule violations (credit limit exceeded after concurrent posts)  

### 8.2 Policies

| Class | Resolution |
|-------|------------|
| Posted sale/payment/stock movement | Idempotent append; never overwrite |
| Product/customer field edits | LWW by `updated_at`/`version` + audit; optional manual review if flagged critical |
| Price changes | LWW with optional approval flag; POS uses price-at-sale snapshot |
| Stock qty | Recompute from movements only |
| Ledger balances | Recompute from lines |
| Held sales | Last device writer wins; cannot post two holds into conflicting stock without reservation check |

### 8.3 Manual conflicts

UI list from `sync_conflicts` with server vs client diff; roles with `sync.resolve` permission.

---

## 9. Idempotency & Duplicate Prevention

1. Every post command carries `idempotency_key`.  
2. Server unique constraint `(organization_id, idempotency_key)`.  
3. Re-push of same key returns original result (200/201 equivalent).  
4. Serial numbers: unique sale binding; reject double-sell.  
5. Document numbers unique per org/branch scheme.  

---

## 10. Connectivity Detection

- Electron `online`/`offline` events + active health ping to API  
- States: `online`, `degraded`, `offline`  
- Degraded: read-only pull ok, push failing → surface banner  
- Auto-resume sync on transition to online  

---

## 11. Data Integrity

- All local posts in SQLite transactions  
- Foreign keys enabled  
- Periodic `PRAGMA integrity_check`  
- Domain invariants shared with online (credit, stock availability)  
- Offline credit: enforce against last synced ledger + local unpushed ledger  

---

## 12. Encryption & Security

| Item | Approach |
|------|----------|
| SQLite at rest | SQLCipher or OS disk encryption + app lock |
| Secrets | OS keychain / safeStorage for tokens & device keys |
| Device binding | Registered device required for offline login |
| Offline users | Cached auth material for allowed cashiers only; short offline TTL policy |
| Service role | Never embedded in Electron build |

---

## 13. Local Backup & Recovery

1. Scheduled copy of encrypted DB to user-selected folder.  
2. Optional encrypted backup upload to Supabase Storage `backups` bucket when online.  
3. Recovery: restore file → verify schema version → force full pull reconcile.  
4. Disaster: server remains source of truth for acked transactions; unacked local queue must be preserved from backup.  

---

## 14. Failed Synchronization Handling

| Failure | Behavior |
|---------|----------|
| Network | Retry with exponential backoff + jitter |
| 401/403 | Stop sync; re-auth; quarantine queue |
| 409 conflict | Write `sync_conflicts`; continue other items |
| 422 business rule | Mark failed; alert user; do not spin forever |
| Partial batch | Ack successes; retry failures individually |

Dead-letter after N attempts with admin visibility.

---

## 15. Initial Sync & Hydration Packs

On device approval:

1. Org + branch settings  
2. Permissions for user roles  
3. Products, units, barcodes, prices (branch)  
4. Customers/suppliers active set  
5. Stock for home warehouses  
6. Open installment schedules  
7. Recent sales window (configurable, e.g. 30–90 days)  

Media thumbnails optional/lazy.

---

## 16. Realtime (Online Only)

Supabase Realtime may notify web clients of:

- stock changes  
- approval updates  
- notification feed  

Electron sync remains cursor/queue based (Realtime can trigger pull earlier).

---

## 17. Testing Strategy (Offline)

- Unit: reducers, conflict policies, idempotency  
- Integration: post sale offline → push → verify Postgres side effects once  
- Chaos: kill mid-push; ensure no double stock out  
- Clock skew tests for LWW  
- Multi-device concurrent sell of last serial  

---

## 18. Implementation Sequence (when Phase 9–10 approved)

1. SQLite schema subset + local posting for sales  
2. Device registry + offline auth cache  
3. Outbox queue  
4. Push commands for sales/payments  
5. Pull masters + movements  
6. Conflict UI  
7. Backup/restore  
8. Expand to purchases/expenses/returns/installments  

**Not started in Phase 0.**  
