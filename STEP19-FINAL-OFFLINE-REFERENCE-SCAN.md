# STEP 19 â€” Final offline reference scan

## Goal

Full-repository scan for SQLite / offline / sync / outbox symbols after the online-only conversion. Classify every remaining hit. Confirm **no active SQLite/offline execution path**.

## Method

1. Disk presence checks (`Test-Path`) for deleted packages and entrypoints (authoritative over IDE/index ghosts).
2. Keyword scan of live source under `apps/*/src` and `packages/{contracts,db,domain,hardware,ui,ai}/src`.
3. Package manifests / lockfile for `better-sqlite3`, `sqlite3`, `sql.js`.
4. Bundles: `api/handler.cjs`, `apps/api/dist`, contracts `dist`.
5. Cleanup of leftover contracts sync emit artifacts found during the scan.

IDE/grep indexes may still list deleted paths (`packages/offline`, `features/sync`, `db/bootstrap.ts`, etc.). **Disk = source of truth.**

## Absent on disk (execution path gone)

| Path / artifact | Present? |
|-----------------|----------|
| `packages/offline` | **No** |
| `packages/sync` | **No** |
| `packages/contracts/src/sync.ts` / `sync.js` / `sync.d.ts` | **No** (orphan `.js`/`.d.ts`/`.map` deleted this step) |
| `packages/db/.../sync-repository.ts` | **No** |
| `apps/api/src/routes/sync.ts` | **No** |
| `apps/api/dist/routes/sync.js` | **No** |
| `apps/web/src/features/sync` | **No** |
| `apps/desktop/src/db` / `bootstrap.ts` | **No** |
| `apps/desktop/src/sync-runtime.ts` | **No** |
| `node_modules/better-sqlite3` | **No** |
| `node_modules/@electronic-erp/offline` | **No** |
| `node_modules/@electronic-erp/sync` | **No** |
| Root lockfile deps `better-sqlite3` / `sql.js` / `sqlite3` | **None** |
| `api/handler.cjs` `/api/v1/sync` / `syncRouter` / `better-sqlite` | **0 matches** |
| Router/modules/`app.ts` mounts for sync/offline UI | **None** |

**No** `OPFS`, `sql.js`, WASM SQLite, `OfflinePosEngine`, `SyncCoordinator`, `enqueueOutbox`, `isOffline`, `offlineMode`, or `syncQueue` symbols in live application source.

## Cleanup performed this step

| Action | Reason |
|--------|--------|
| Deleted `packages/contracts/src/sync.js`, `sync.d.ts`, `sync.js.map` | Orphan emit after `sync.ts` removal â€” not in `dist/`, but broken if resolved from `src/` |
| Removed `export * from "./sync.js"` from `packages/contracts/src/index.js` and `index.d.ts` | Stale re-export of deleted module |

Canonical package entry remains `packages/contracts/dist` (already clean â€” no sync). Note: many other `.js`/`.d.ts` pairs still sit under `contracts/src` from accidental emit-into-src; they are not offline execution paths. Prefer `npm run build --prefix packages/contracts` for published types.

## Classification of remaining references

### A â€” Allowed: harmless browser connectivity (not offline mode selection)

| Location | What | Why allowed |
|----------|------|-------------|
| `apps/web/src/lib/online-required.ts` | `navigator.onLine` + connection-required messaging | Gate only; comments forbid SQLite/queue success |
| `apps/web/src/lib/api.ts` | Network / offline check before fetch | Maps failures to online-required errors |
| `apps/web/src/features/pos/PosPage.tsx` | `navigator.onLine` + `online`/`offline` listeners | Connection banner UX |
| `apps/web/src/features/pos/ReturnsPage.tsx` | Same pattern | Same |

These do **not** choose a local DB, enqueue outbox, or fake sale success.

### B â€” Allowed: schema / contracts fields (Class B â€” keep)

| Location | What | Why allowed |
|----------|------|-------------|
| Domain + db repos (`sale-transaction`, `purchase-transaction`, pos/parties/inventory/purchases repos) | Columns `offline_transaction_id`, `sync_state` | Postgres/Supabase columns; online writers set `synced` / optional id |
| `packages/contracts` `sale` / `payment` / `stock` / `purchase` | Zod fields `offlineTransactionId`, `syncState` | Contract mirror of DB |
| `packages/contracts/src/authz.ts` | Permission keys `sync.manage`, `sync.resolve`, `sync.push`, `sync.pull` | RBAC strings; no sync API mounted |
| `supabase/migrations/20260810000010_offline_sync_engine.sql` | Historical sync tables | Class D â€” **no DROP**; schema retained |
| `apps/api/src/migrations.test.ts` | Asserts that migration file exists | Schema regression test only |

### C â€” Allowed: generic comments / online-only wording

| Location | What |
|----------|------|
| `packages/domain/src/sale-transaction.ts` | Comment: SQLite removed; online API only |
| `apps/desktop/src/config-store.ts` | Comment: replaces SQLite LocalDatabase for device config |
| `apps/desktop/src/paths.ts` | Deprecated `database` path alias; message that there is no local SQLite |
| `apps/desktop/README.md` | States online-only / no SQLite outbox |
| `api/handler.cjs` MIME map | `application/vnd.sqlite3` / geopackage â€” **unrelated** mime database, not app SQLite |

### D â€” Allowed: documentation (historical / conversion reports)

| Category | Examples |
|----------|----------|
| Conversion reports | `STEP4`â€“`STEP18`, this file, `OFFLINE-CODE-*.md`, `ONLINE-ARCHITECTURE-PROTECTION.md` |
| Pre-conversion audits | `CURRENT-POS-SYSTEM-AUDIT.md`, `docs/POS_*.md`, `docs/PHASE10_OFFLINE_SYNC.md`, `docs/DESKTOP_RELEASE.md`, etc. |

These describe **past** dual-runtime architecture or the removal work. They are not executable.

### E â€” Not allowed (must be zero) â€” verified empty

| Pattern | Live execution? |
|---------|-----------------|
| Import `@electronic-erp/offline` / `@electronic-erp/sync` | **None** |
| `better-sqlite3` / `Database(` local open | **None** |
| `/api/v1/sync` router | **None** |
| Sync Center / Offline POS pages | **Directory absent** |
| Outbox enqueue / SyncCoordinator start | **None** |
| Desktop SQLite bootstrap | **Absent** |

## Verdict

**PASS â€” no active SQLite/offline execution path.**

Remaining keyword hits are documentation, connectivity UX, Supabase column/RBAC mirrors, migration retention, or unrelated MIME strings. Application runtime path is:

```
React â†’ POS/UI â†’ API â†’ PosRepository / domain â†’ Supabase â†’ PostgreSQL
```

Desktop stores only device/config JSON (`config-store.ts`); POS business data is online-only.
