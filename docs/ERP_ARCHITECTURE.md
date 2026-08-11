# Electrical Store ERP — System Architecture

**Phase:** 0 — Architecture Audit (no business module implementation)  
**Status:** Greenfield — repository contains no application code  
**Source of Truth:** Master functional specification (Phase 0 prompt module tree + transaction rules)  
**Date:** 2026-08-10  

---

## 0. Codebase Audit Summary

### 0.1 Current state

| Area | Finding |
|------|---------|
| Repository root | `Electronic - ERP/` exists; **0 application files** |
| `package.json` | Missing |
| TypeScript / Vite / Tailwind | Missing |
| React structure / routing | Missing |
| Backend / API | Missing |
| Supabase (client, migrations, RLS) | Missing |
| Electron / SQLite offline | Missing |
| Auth / RBAC | Missing |
| Tests / CI / deploy | Missing |
| Separate functional-spec file | **Not found** in workspace (master prompt used as SoT) |

### 0.2 Reusable code

**None inside this workspace.** Future work is greenfield scaffold + domain implementation.

Nearby unrelated projects must **not** be treated as this ERP’s codebase.

### 0.3 Problems found

1. Empty project — no scaffold, lockfile, or git history for this product.
2. No checked-in functional specification document (PDF/MD) besides the master prompt.
3. No package manager configured yet (pnpm recommended once scaffold starts).
4. Risk of inventing a second data model if online and offline are built separately — architecture below forbids this.

### 0.4 Target stack (locked)

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript (strict) |
| Styling | Tailwind CSS |
| Backend / API | Node.js + TypeScript (REST/service-based) |
| Online DB | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Files | Supabase Storage |
| Realtime | Supabase Realtime (selective) |
| Offline POS | Electron + React + Node.js |
| Offline DB | SQLite |
| Sync | Custom bidirectional sync engine |
| Validation | Shared TypeScript schemas (Zod) |
| Package manager | Detect existing; if none → **pnpm** |

### 0.5 Architectural principle (non-negotiable)

> **ONE MASTER BUSINESS DATA MODEL.**  
> Supabase PostgreSQL and SQLite are two persistence layers of the same business system.  
> Same entities, UUIDs, relationships, transaction rules, and domain logic online and offline.

---

## 1. Frontend Architecture

### 1.1 Application shells

| App | Runtime | Purpose |
|-----|---------|---------|
| `apps/web` | Browser (Vite) | Full ERP (HQ, branch, back-office) |
| `apps/pos-electron` | Electron | Offline-capable POS + operational subset |
| `apps/admin` (optional later) | Browser | Platform ops / multi-tenant admin |

### 1.2 Feature-based structure

```
apps/web/src/
  app/                 # providers, router, layouts
  features/            # one folder per module domain
    pos/
    products/
    inventory/
    purchases/
    customers/
    accounts/
    ...
  shared/              # UI primitives, hooks, utils (no domain rules)
  lib/                 # API client, supabase browser client
```

Rules:

- Features own screens, hooks, and feature-local components.
- Domain rules live in `packages/domain` (not only in React).
- UI authorization is UX-only; server/API enforces truth.
- Bilingual-ready: `i18n` keys for English / Urdu from day one (no hard-coded user strings in features).

### 1.3 Routing

- React Router (or TanStack Router) with route modules per feature.
- Route guards: session + permission + branch context.
- POS routes optimized for keyboard + touch (large hit targets, F-keys).

### 1.4 State management

| Concern | Approach |
|---------|----------|
| Server/cache state | TanStack Query |
| Auth/session/branch | Auth context + persisted branch selection |
| POS cart / held sales | Feature store (Zustand or equivalent) + durable local draft |
| Sync status | Sync engine observables → UI banner |
| Forms | React Hook Form + shared Zod schemas |

### 1.5 Design system

- Tailwind tokens as CSS variables (brand, surface, danger, success).
- Shared primitives in `packages/ui` (Button, DataTable, Dialog, Toast, FormField).
- POS theme: high contrast, dense but touch-friendly, printer-preview components.
- Avoid mock-data-driven UI as architecture substitute — screens bind to real services/adapters (fakes only in tests).

### 1.6 Error / loading / empty UX

Every list/detail/mutation screen must define:

- loading skeleton/spinner  
- empty state + primary action  
- error state + retry  
- destructive confirmations  

---

## 2. Backend Architecture

### 2.1 Role of the API

Supabase can host Auth/DB/Storage; an explicit **Node TypeScript API** remains required for:

- multi-table transactional posting (sale → stock → ledger → journal)
- authorization beyond simple RLS
- sync conflict adjudication
- hardware bridge orchestration (Electron local; cloud print jobs optional)
- FBR/tax document generation hooks
- webhook / external integrations
- service-role operations (never exposed to browser)

### 2.2 Service layout

```
apps/api/src/
  modules/             # feature modules (sales, inventory, ...)
  shared/
    db/                # postgres client / repositories
    auth/              # JWT validation, permission checks
    audit/
    errors/
  sync/                # sync ingest / push endpoints
  jobs/                # scheduled: backup reminders, installment dues
```

### 2.3 API style

- REST + JSON, versioned: `/api/v1/...`
- Command endpoints for transactions: `POST /sales`, `POST /sales/:id/payments`
- Idempotency-Key header on all posting endpoints
- OpenAPI generated from Zod/contract package

### 2.4 Transaction services (domain)

All posting flows go through **application services** that:

1. Validate input (shared schemas)
2. Check permissions + branch scope
3. Open DB transaction
4. Apply domain rules (inventory, credit limits, tax)
5. Write audit log
6. Emit outbox / realtime events
7. Commit or roll back atomically

React components never call multiple write endpoints to “assemble” a sale.

---

## 3. Database Architecture

Canonical model documented in [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md).

### 3.1 Tenancy & scope

- `organization_id` on all business rows
- `branch_id` on operational/transactional rows
- Soft delete via `deleted_at` where history must be preserved
- `version` (optimistic concurrency) on mutable operational entities
- Sync columns: `updated_at`, `version`, `origin_device_id`, `last_synced_at` (as applicable)

### 3.2 Persistence duality

| Environment | Engine | Schema source |
|-------------|--------|---------------|
| Online | PostgreSQL (Supabase) | SQL migrations in `supabase/migrations` |
| Offline | SQLite | Generated / mirrored subset from same entity definitions |

Entity names, UUIDs, and FK semantics are identical. SQLite may omit HQ-only tables (BI aggregates, marketing campaigns) but must include the offline operational subset.

### 3.3 Migrations

- Forward-only SQL migrations
- Shared TypeScript types generated from schema (or schema-as-code → SQL)
- Seed scripts for roles, permissions, tax templates (Pakistan), unit templates

---

## 4. Offline Architecture

Documented in [`OFFLINE_ARCHITECTURE.md`](./OFFLINE_ARCHITECTURE.md).

Minimum offline capabilities:

Sales · Purchases · Stock · Customers · Suppliers · Invoices · Payments · Installments · Returns · Expenses

Electron main process owns SQLite + hardware adapters. Renderer talks via typed IPC, never raw SQL.

---

## 5. Sync Architecture

### 5.1 Goals

- Bidirectional sync of operational data
- Idempotent apply
- Conflict detection + resolution policies
- Partial sync and retry
- No duplicate postings of financial/stock transactions

### 5.2 Components

| Component | Responsibility |
|-----------|----------------|
| `device_registry` | Registered POS/device identity |
| `sync_metadata` | Per-entity / per-table cursors, last pull/push |
| `sync_queue` | Outbound local changes awaiting push |
| `sync_conflicts` | Divergent records needing policy/user resolution |
| Sync Engine | Pull → transform → apply → push → ack |
| Outbox (server) | Reliable event log for pull consumers |

### 5.3 Identity

- Canonical primary key: **UUID v7** (preferred) or UUID v4 — generated offline-capable
- Local rowid only as SQLite physical key if needed; business key remains UUID
- Client-generated `idempotency_key` on every transaction posting

### 5.4 Conflict policy (default)

| Entity class | Policy |
|--------------|--------|
| Master data (product name, prices) | Last-write-wins by `updated_at` + `version`, with audit |
| Stock quantity | **Never LWW on absolute qty** — sync **movements**; recompute stock |
| Sales / payments / journals | Append-only; reject duplicates by idempotency key |
| Customer credit balance | Recompute from ledger lines, not sync absolute balance |
| Held sales | Device-owned until resumed/posted |

### 5.5 Connectivity

- Online detector in Electron + web
- Background sync when online
- Manual “Sync Now”
- Failed queue with exponential backoff
- UI surfaces sync lag / conflict count

---

## 6. Authentication Architecture

| Concern | Design |
|---------|--------|
| Identity provider | Supabase Auth (email/password; optional phone later) |
| Session | JWT access + refresh; secure storage (httpOnly cookie via API preferred for web; safe storage for Electron) |
| Device login | Device must be registered; POS can pin/lock session per cashier |
| Failed logins | Rate limit + lockout policy; audit |
| Offline auth | Cached user credential hash / session token vault for approved devices only; limited offline roles |
| Service role | **API/server only** — never in Vite env for browser |

---

## 7. Authorization Architecture

### 7.1 Model

RBAC + optional user permission overrides + branch scope.

Entities: `roles`, `permissions`, `role_permissions`, `user_roles`, `user_permissions`, `branch_memberships`.

### 7.2 Permission style

`module.action` examples:

- `products.read`, `products.write`
- `pos.sell`, `pos.discount`, `pos.hold`, `pos.return`
- `inventory.adjust`, `inventory.transfer`
- `accounts.post`, `reports.finance`
- `settings.manage`, `users.manage`

### 7.3 Enforcement layers

1. **API / RPC** — mandatory  
2. **Postgres RLS** — defense in depth (org + branch)  
3. **UI** — hide/disable only  

### 7.4 Branch-level

Users assigned to one or many branches. Default branch selected at login. Cross-branch actions require explicit permission.

---

## 8. Module Architecture

Full inventory: [`ERP_MODULE_CHECKLIST.md`](./ERP_MODULE_CHECKLIST.md).

### 8.1 Module dependency graph (high level)

```
Users/Roles/Permissions/Security
        ↓
Organizations / Branches / Warehouses / Settings
        ↓
Units · Categories · Brands · Companies · Products · Barcodes · Pricing
        ↓
Suppliers ←→ Purchases ←→ Inventory/Stock/Batches/Serials
        ↓
Customers · Credit · Loyalty
        ↓
POS/Sales · Quotations · Deliveries · Returns · Installments · Payments
        ↓
Accounts/Finance · Banking · Expenses · Commissions
        ↓
Warranty · Service/Repair · Documents · Approvals · Audit · Notifications
        ↓
BI · Reports · AI Smart Business · CRM · B2B · Online Store · Mobile
        ↓
Offline POS · Sync · Hardware · Backup · Integrations · Tax/FBR
```

### 8.2 Cross-cutting modules

Master Business Architecture · Automatic Transaction Linking · Device Support · Audit · Notifications · Import/Export · Printing

---

## 9. Transaction Architecture

### 9.1 Canonical sale posting pipeline

A completed sale is **one atomic business transaction** that updates:

```
POS Cart
  → Sale + Sale Items (invoice)
  → Stock Movements (−qty / serials / batches)
  → Customer Ledger (if credit / partial)
  → Sale Payments → Cash / Bank / Mixed
  → Accounting Journal (AR / Cash / Sales / Tax / COGS / Inventory)
  → Profit snapshot fields (for BI)
  → Warranty records (eligible items)
  → Installment schedule (if plan selected)
  → Commission / Reference entries
  → Audit log + Notifications
  → Analytics outbox
```

No duplicate manual entry across modules.

### 9.2 Atomicity

- Online: single Postgres transaction (or saga with compensating actions only if split is unavoidable — prefer single TX).
- Offline: SQLite transaction; sync pushes the **posted aggregate** as one idempotent command.
- Failure mid-pipeline → full rollback; user sees error; no partial stock/ledger drift.

### 9.3 Document numbering

- Branch-scoped sequences: invoice, purchase, voucher, job card.
- Offline: allocate from local sequence ranges or UUID-visible numbers + later formal number on sync if policy requires (prefer offline-capable unique numbers: `BRANCH-DEVICE-SEQ`).

### 9.4 Automatic Transaction Linking

Every derived record stores `source_type` + `source_id` (e.g. `sale`, `sale_payment`) for traceability and reverse (return/void) flows.

---

## 10. Accounting Architecture

### 10.1 Model

Double-entry via `accounting_accounts`, `journal_entries`, `journal_entry_lines`.

Vouchers: receipt, payment, transfer — each posts journals.

### 10.2 Chart of accounts

Organization-level COA with branch dimensions on lines where needed.

Default Pakistan retail electrical store template (Sales, COGS, Inventory, Cash, Bank, AR, AP, Tax payable, Discounts, Expenses).

### 10.3 Subledgers

- Customer ledger ↔ AR control  
- Supplier ledger ↔ AP control  
- Cash/bank accounts reconciled to GL  

Balances are **derived** from movements/journals; UI may cache computed balances with version checks.

---

## 11. Inventory Architecture

### 11.1 Stock truth

`stock` is a projection; `stock_movements` are the ledger of truth.

Movement types: purchase_in, sale_out, return_in, return_out, transfer_in/out, adjustment, count, reservation consume, repair issue, etc.

### 11.2 Tracking modes (per product)

- Quantity only  
- Batch / expiry  
- Serial  
- Warranty linkage  
- Combinations as configured  

### 11.3 Warehouses

`warehouses` + `warehouse_locations`; branch has one or more warehouses. Transfers are first-class documents with in/out movements.

### 11.4 Reservations

Quotations / sales orders / held sales may reserve stock with expiry; POS checks available = on_hand − reserved.

---

## 12. Multi-Branch Architecture

- Organization → Branches → Warehouses  
- Products/prices: org-level master with branch price overrides / price levels  
- Stock: per warehouse (branch-scoped)  
- Customers/suppliers: org-level with branch preferences  
- Users: branch memberships  
- Reports: filter by branch or consolidated (permissioned)  
- Sync: device bound to home branch; limited cross-branch offline  

---

## 13. Audit Architecture

`audit_logs` immutable append-only:

- actor, org, branch, action, entity_type, entity_id  
- before/after JSON (sensitive fields redacted)  
- IP / device id  
- correlation / transaction id  

Critical actions always audited: login failures, price overrides, discount above limit, stock adjust, void/return, permission changes, sync conflict resolutions.

---

## 14. Notification Architecture

Channels: in-app, email (later), SMS (later), WhatsApp (integration later), device push (mobile later).

Triggers: low stock, credit limit, installment due, approval pending, sync failure, warranty expiry.

`notifications` table + optional Realtime subscription for online clients.

---

## 15. Integration Architecture

| Integration | Pattern |
|-------------|---------|
| Payment gateways | Adapter interface |
| SMS / WhatsApp | Adapter + templates |
| FBR / tax | Tax document service + export |
| Accounting export | CSV/Excel/API |
| Online store / B2B portal | Same API + scoped tokens |
| Hardware | Local adapters (see §17) |

All external systems behind ports/adapters in `packages/integrations`.

---

## 16. Backup Architecture

| Layer | Strategy |
|-------|----------|
| Supabase Postgres | Platform PITR + scheduled logical dumps to secure storage |
| Supabase Storage | Bucket versioning / replication policy |
| SQLite offline | Encrypted local backup copy + optional push of backup blob when online |
| Config / secrets | Separate secret manager; never in DB dumps shared insecurely |
| DR | Documented RPO/RTO; restore drills in test plan |

---

## 17. Hardware Architecture

Hardware isolated behind adapters; React never talks to devices directly.

```
UI → HardwareService (port)
        → Electron IPC
            → BarcodeScannerAdapter
            → CameraAdapter
            → PrinterAdapter (58mm / 80mm / A4 / label / barcode)
            → CashDrawerAdapter
```

| Device | Interface notes |
|--------|-----------------|
| Barcode scanner | Keyboard wedge + optional serial; normalize to scan events |
| QR scanner | Camera or dedicated scanner |
| USB / device camera | MediaDevices + Electron permissions; AI recognition pipeline |
| Thermal 58/80mm | ESC/POS profiles |
| A4 | System print / PDF |
| Barcode / label printers | Template engine → printer language |
| Cash drawer | ESC/POS pulse via receipt printer |

---

## 18. Security Architecture

| Control | Design |
|---------|--------|
| Auth | Supabase Auth |
| RBAC | Server + RLS |
| Secrets | `.env` server-only; Vite only public anon key + URL |
| API | JWT, rate limits, idempotency, input validation |
| RLS | `organization_id` (+ branch) isolation |
| Device registry | Approve/revoke devices; offline token binding |
| Audit | Mandatory for sensitive actions |
| Encryption | TLS in transit; SQLite SQLCipher or OS-encrypted volume for offline |
| XSS/CSRF | Standard web hardening; cookie SameSite if cookie sessions |

---

## 19. Testing Architecture

| Layer | Scope |
|-------|-------|
| Unit | Domain services, tax, pricing, credit checks, sync reducers |
| Integration | API + Postgres testcontainer / Supabase local |
| Offline | SQLite posting + sync conflict cases |
| E2E | Critical POS paths (Playwright) |
| Hardware | Adapter contract tests with fakes |
| Load | Sale posting & sync queue under burst |

No production reliance on mock business data without real schemas.

---

## 20. Proposed Monorepo Folder Structure

```
Electronic - ERP/
├── apps/
│   ├── web/                 # React ERP (Vite)
│   ├── pos-electron/        # Electron POS shell
│   └── api/                 # Node TypeScript API
├── packages/
│   ├── domain/              # business rules, transaction pipelines
│   ├── contracts/           # Zod schemas, DTO types, OpenAPI fragments
│   ├── db/                  # shared entity definitions / mappers
│   ├── sync/                # sync engine core (isomorphic where possible)
│   ├── ui/                  # design system
│   ├── i18n/                # en / ur dictionaries
│   ├── hardware/            # ports + electron adapters
│   └── integrations/        # external adapters
├── supabase/
│   ├── migrations/
│   ├── seed/
│   └── config.toml
├── docs/
│   ├── ERP_ARCHITECTURE.md
│   ├── ERP_MODULE_CHECKLIST.md
│   ├── DATABASE_ARCHITECTURE.md
│   └── OFFLINE_ARCHITECTURE.md
├── scripts/
├── .env.example
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

---

## 21. API Design (Phase 0 outline)

### 21.1 Resource groups

`/api/v1/auth/*` · `/organizations` · `/branches` · `/users` · `/roles` · `/products` · `/inventory` · `/customers` · `/suppliers` · `/purchases` · `/sales` · `/payments` · `/installments` · `/returns` · `/quotations` · `/deliveries` · `/repairs` · `/warranties` · `/accounts` · `/banking` · `/expenses` · `/reports` · `/approvals` · `/documents` · `/notifications` · `/sync` · `/devices` · `/settings` · `/tax`

### 21.2 Command examples

- `POST /sales` — post sale aggregate  
- `POST /sales/:id/returns` — return/exchange  
- `POST /purchases/:id/receive` — stock-in  
- `POST /inventory/transfers`  
- `POST /inventory/adjustments`  
- `POST /sync/push` · `POST /sync/pull`  

All commands: authz + idempotency + audit.

---

## 22. Implementation Roadmap (stop after Phase 0)

| Phase | Focus | Exit criteria |
|-------|-------|---------------|
| **0** | Audit + architecture docs | This document set complete — **STOP** |
| **1** | Monorepo scaffold, tooling, CI baseline | Apps boot; lint/test scripts |
| **2** | Supabase schema migrations + RLS + seed permissions | Canonical DB live locally |
| **3** | Auth, users, roles, branches, settings shell | Secure login + RBAC |
| **4** | Products, units, categories, brands, barcodes, pricing | Master data CRUD |
| **5** | Suppliers, purchases, stock movements | Stock-in correct |
| **6** | Customers, credit, POS sale posting pipeline | Atomic sale end-to-end online |
| **7** | Payments, returns, invoices, printing | Store operations usable |
| **8** | Accounts, expenses, banking | Financial close loop |
| **9** | Electron + SQLite offline subset | Offline sales work |
| **10** | Sync engine + conflicts + device registry | Bidirectional sync proven |
| **11** | Installments, warranty, service, quotations, delivery | Extended ops |
| **12** | Approvals, documents, notifications, audit hardening | Governance |
| **13** | Reports, BI, AI assists, CRM/loyalty | Insights |
| **14** | B2B portal, online store APIs, mobile | Channels |
| **15** | Tax/FBR readiness, backup/DR, integrations | Compliance & resilience |

**Do not auto-start Phase 1.** Await explicit approval.

---

## 23. Development Rules (ongoing)

- TypeScript strict; no `any` without justification comment  
- Feature-based architecture; shared types + validation  
- Transactional writes; server-side authorization  
- Comprehensive error/loading/empty/confirm UX  
- Audit logging on sensitive actions  
- Responsive + keyboard accessible + touch-friendly POS  
- English / Urdu bilingual-ready  
- Hardware behind adapters  
- Never expose service-role keys to frontend  

---

## 24. Related Documents

- [`ERP_MODULE_CHECKLIST.md`](./ERP_MODULE_CHECKLIST.md)  
- [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md)  
- [`OFFLINE_ARCHITECTURE.md`](./OFFLINE_ARCHITECTURE.md)  
