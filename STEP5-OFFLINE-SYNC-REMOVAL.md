# STEP 5 â€” OFFLINE SYNC SYSTEM REMOVAL REPORT

**Date:** 2026-08-12
**Scope:** Remove offline synchronization infrastructure only.
**Verified first:** Online POS (`posApi` â†’ `/api/v1/pos` â†’ `PosRepository` â†’ `SaleTransactionService`) does **not** import `@electronic-erp/sync`, `SyncRepository`, or `/api/v1/sync`.

---

## Verification (before delete)

| Online concern | Depends on sync package/API? | Kept |
|----------------|------------------------------|------|
| Sale posting / idempotency | No | Yes |
| PaymentAttemptGate / payments | No | Yes |
| Stock deduction / reverse | No | Yes |
| Audit logs | No | Yes |
| Draftâ†’finalize sale safety | No | Yes |
| `sync_state='synced'` column writes | Column only (B) â€” not SyncEngine | Yes (column left) |

---

## Removed (offline sync exclusive)

| Item | Notes |
|------|-------|
| Entire `packages/sync/` | SyncEngine, conflict-resolver, enqueue* helpers, HttpCloudTransport, tests |
| `apps/api/src/routes/sync.ts` | `/api/v1/sync/*` push/pull/conflicts/register |
| Mount in `apps/api/src/app.ts` | Unmounted |
| `packages/db/.../sync-repository.ts` | Server sync apply layer |
| `packages/contracts/src/sync.ts` | Device/SyncPush/Pull/Conflict Zod schemas |
| Export from `packages/contracts` / `packages/db` index | Removed |
| `apps/web/src/features/sync/**` | SyncCenter, OfflinePosStatus, sync-api |
| Routes `/sync`, `/offline-pos` | Removed from router + modules |
| Desktop sync IPC (`syncNow`, `syncStatus`, offline sale/pending) | Removed from constants/preload/ipc |
| Desktop `registerDeviceWithApi` â†’ sync register | Removed; local JSON provision only |
| Build/test/link references to `packages/sync` | Cleared |

---

## Intentionally preserved

| Item | Why |
|------|-----|
| `idempotencyKey` on sales/payments | Online duplicate protection |
| `SaleTransactionService` draft/finalize/compensate | Online transaction safety |
| Audit trail / `audit_logs` | Online audit |
| Payment prep + PaymentAttemptGate | Online payment protection |
| Stock movement posting | Online stock protection |
| Optional fields `syncState` / `offlineTransactionId` on contracts | Shared schema fields; online sets `synced` |
| Permission keys `sync.*` in authz catalog | Harmless RBAC strings; not a runtime sync engine |
| Supabase migration `â€¦010_offline_sync_engine.sql` + tables | Class D â€” historical schema; **no DROP** in this step |
| `migrations.test.ts` assertion that migration SQL exists | Documents applied schema history |
| Infrastructure `RegisterSecurityDeviceSchema` | Unrelated security devices |

---

## Validation

- packages: `contracts` rebuilt; `offline`/`sync` packages absent from `packages/`
- typecheck: db, api, web, desktop â€” **pass**
- tests: api + web â€” **pass** (from Step 5 validation run)

---

## Note

`api/handler.cjs` (Vercel bundle) may still contain stale sync routes until `npm run build:vercel` / `bundle-vercel-api` is re-run. Source of truth is `apps/api` â€” rebuild before deploy.

---

## Resulting architecture

```
React POS/UI
  â†’ domain
  â†’ online API (/api/v1/pos, parties, â€¦)
  â†’ PosRepository / â€¦
  â†’ Supabase PostgreSQL
```

No sync coordinator, outbox queue, conflict resolver, or sync worker remains in the application runtime.
