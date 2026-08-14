# STEP 4 â€” OFFLINE DATABASE REMOVAL REPORT

**Date:** 2026-08-12
**Scope:** Remove SQLite / offline database layer only. Online Supabase path preserved.

## Deleted (Class A â€” offline-only)

| Item | Notes |
|------|-------|
| Entire `packages/offline/` | SQLite schemas, migrations, LocalDatabase, OfflinePosEngine, SyncCoordinator, stores, tests |
| `apps/desktop/src/db/bootstrap.ts` | better-sqlite3 init |
| `apps/desktop/src/sync-runtime.ts` | depended on offline LocalDatabase |
| Root deps `better-sqlite3`, `@types/better-sqlite3` | Removed from `package.json` / lockfile |
| Build/test references to `packages/offline` | Root scripts + `link-workspaces.cjs` |
| Web aliases `@electronic-erp/offline` | vite + tsconfig |

## Refactored (Class C â€” kept online path)

| File | Change |
|------|--------|
| `apps/desktop/src/main.ts` | Boots without SQLite |
| `apps/desktop/src/ipc.ts` | Uses `DesktopConfigStore` (JSON); offline sale/sync still rejected |
| `apps/desktop/src/first-run.ts` | Device provision via JSON config; sync register optional |
| `apps/desktop/src/paths.ts` | No `offline.db` |
| `apps/desktop/src/readiness.ts` | No better-sqlite3 check |
| `apps/desktop/src/config-store.ts` | **New** â€” terminal identity + encrypted settings only |
| `apps/desktop/scripts/prepare-check.cjs` | Dropped sqlite check |
| `apps/desktop/package.json` / renderer | Online-only messaging |
| `pos-customer-runtime.ts` | Removed `PosCustomerOfflineCache`; re-exports domain helper |
| `pos-customer.test.ts` | In-memory Customer fixtures (no offline cache) |
| `packages/contracts/src/runtime-mode.ts` | Message updated (SQLite removed) |

## Intentionally NOT removed (Step 4)

| Item | Why |
|------|-----|
| `packages/sync` | Not SQLite DB â€” cloud sync protocol (later step) |
| `apps/api/src/routes/sync.ts` / `SyncRepository` | Cloud sync API (later step) |
| Supabase `sync_*` tables / migrations | Class D schema â€” no DROP |
| Shared columns `sync_state`, `offline_transaction_id` | Class B â€” online still writes `synced` |
| Online `PosRepository` / `SaleTransactionService` | Protected online architecture |
| `idempotencyKey` | Online duplicate protection |

## Validation

- `apps/desktop` typecheck â€” pass
- `apps/web` typecheck â€” pass
- `apps/web` tests â€” pass
- `apps/desktop` prepare:check â€” pass
- `better-sqlite3` absent from lockfile

## Resulting data architecture

```
Desktop shell (optional) â†’ config JSON only
Web / POS â†’ API â†’ PosRepository â†’ Supabase â†’ PostgreSQL
```

No local SQLite business database remains.
