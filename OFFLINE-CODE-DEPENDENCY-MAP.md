# OFFLINE CODE DEPENDENCY MAP

**Created:** 2026-08-12
**Phase:** Step 1 â€” Complete offline code audit (**NO DELETIONS**)
**Purpose:** Inventory every offline / SQLite / sync-related surface before any removal work.

---

## 0. Executive verdict

| Finding | Detail |
|---------|--------|
| Dedicated offline packages | `@electronic-erp/offline`, `@electronic-erp/sync` |
| Native SQLite | `better-sqlite3` only (Electron main). **No** `sql.js`, WASM SQLite, OPFS, or IndexedDB POS DB |
| Primary offline runtime | `apps/desktop` (Electron) â†’ SQLite file `offline.db` |
| Web offline POS DB | **None.** Web had customer `localStorage` cache (disabled in Phase 1 online-only) |
| Server sync tables | Supabase migration `20260810000010_offline_sync_engine.sql` |
| Current product gate | `ONLINE_ONLY = true` in `packages/contracts/src/runtime-mode.ts` (Phase 1) â€” code still present |

---

## 1. Architecture dependency graph (pre-removal)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ apps/web                                                                 â”‚
â”‚  PosPage (navigator.onLine)                                              â”‚
â”‚  pos-customer-runtime PosCustomerOfflineCache (localStorage; unused path)â”‚
â”‚  features/sync/{SyncCenterPage, OfflinePosStatusPage, sync-api}          â”‚
â”‚  router /modules /AppShell hide /offline-pos /sync when ONLINE_ONLY      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚ HTTP /api/v1/pos/*  (online path â€” KEEP)
                â”‚ HTTP /api/v1/sync/* (sync path â€” gated 503 when ONLINE_ONLY)
                â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ apps/api                                                                 â”‚
â”‚  routes/sync.ts â†’ SyncRepository (@electronic-erp/db)                    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Supabase PostgreSQL                                                      â”‚
â”‚  devices, sync_operation_acks, sync_conflicts, sync_change_log           â”‚
â”‚  sales/payments/stock columns: offline_transaction_id, sync_state, â€¦     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ apps/desktop (Electron)                                                  â”‚
â”‚  main.ts â†’ bootstrapOfflineDatabase (better-sqlite3)                     â”‚
â”‚  sync-runtime.ts â†’ SyncCoordinator + SyncEngine (currently not started)  â”‚
â”‚  ipc: postOfflineSale / syncNow / listPendingSales (throw / empty)       â”‚
â”‚  paths: â€¦/offline.db                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚
                â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ packages/offline                                                         â”‚
â”‚  LocalDatabase, OfflinePosEngine, SyncCoordinator, SQLite schemas/stores â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚ uses
                â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ packages/sync                                                            â”‚
â”‚  SyncEngine, *Sync helpers, conflict-resolver, HttpCloudTransport        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 2. Package inventory â€” `@electronic-erp/offline`

**Root:** `packages/offline/`
**Depends on:** `@electronic-erp/sync`, contracts/domain (via stores), `better-sqlite3` at desktop boundary

| File | Role | Deletion risk class |
|------|------|---------------------|
| `package.json` | Package manifest | PACKAGE |
| `tsconfig.json` / `vitest.config.ts` | Build/test | PACKAGE |
| `src/index.ts` | Public exports | PACKAGE |
| `src/sqlite-schema.ts` | Foundation SQLite DDL | SQLITE_SCHEMA |
| `src/catalog-schema.ts` | Catalog SQLite DDL | SQLITE_SCHEMA |
| `src/inventory-schema.ts` | Inventory SQLite DDL + sync columns | SQLITE_SCHEMA |
| `src/parties-schema.ts` | Parties/payments SQLite DDL | SQLITE_SCHEMA |
| `src/pos-schema.ts` | Sales/holds/returns/mutations SQLite | SQLITE_SCHEMA |
| `src/warehouse-ops-schema.ts` | Purchases/warehouse SQLite | SQLITE_SCHEMA |
| `src/sync-schema.ts` | Outbox/inbox/conflicts/local entities | SQLITE_SCHEMA / OUTBOX |
| `src/durable-storage.ts` | Storage interface for LocalDatabase | CORE_OFFLINE |
| `src/sqlite-kv-storage.ts` | better-sqlite3 KV adapter | SQLITE_ADAPTER |
| `src/sqlite-migrations.ts` | Apply offline DDL migrations | SQLITE_MIGRATION |
| `src/sqlite-migrations.test.ts` | Migration tests | TEST |
| `src/local-database.ts` | Local DB + outbox API | CORE_OFFLINE |
| `src/offline-pos-engine.ts` | Offline sale/return/payment writer | CORE_OFFLINE |
| `src/sync-coordinator.ts` | Outbox push / inbox pull orchestration | SYNC |
| `src/product-store.ts` | Offline product projection | STORE |
| `src/customer-store.ts` | Offline customer + enqueue | STORE |
| `src/pos-store.ts` | Legacy in-memory OfflinePosStore | STORE (legacy) |
| `src/stock-mutation-store.ts` | Offline stock mutations | STORE |
| `src/payment-mutation-store.ts` | Offline payments | STORE |
| `src/warehouse-ops-store.ts` | Offline purchases | STORE |
| `*.test.ts` (8+ files) | Offline/sync engine tests | TEST |

**Exported surface (from `index.ts`):** all schemas, stores, LocalDatabase, OfflinePosEngine, SyncCoordinator, migrations, durable storage.

---

## 3. Package inventory â€” `@electronic-erp/sync`

**Root:** `packages/sync/`

| File | Role | Class |
|------|------|-------|
| `src/engine.ts` | `SyncEngine` online gate + push/pull | SYNC_CORE |
| `src/conflict-resolver.ts` | Conflict strategies | SYNC_CORE |
| `src/conflict-resolver.test.ts` | Tests | TEST |
| `src/http-cloud.ts` | HTTP transport to `/api/v1/sync` | SYNC_TRANSPORT |
| `src/memory-cloud.ts` | In-memory transport for tests | TEST_SUPPORT |
| `src/sale-sync.ts` | `enqueueSale` | SYNC_ENTITY |
| `src/stock-sync.ts` | `enqueueStockMovement` | SYNC_ENTITY |
| `src/payment-sync.ts` | `enqueuePayment` | SYNC_ENTITY |
| `src/customer-sync.ts` | `enqueueCustomerUpsert` | SYNC_ENTITY |
| `src/product-sync.ts` | Product row shaping / apply | SYNC_ENTITY |
| `src/purchase-sync.ts` | `enqueuePurchase` | SYNC_ENTITY |
| `src/product-sync.test.ts` / `stock-sync.test.ts` | Tests | TEST |
| `package.json` / configs | Package | PACKAGE |

**Consumers of `@electronic-erp/sync`:**
`packages/offline/*` (stores + coordinator + tests), `apps/desktop/src/sync-runtime.ts`.

**Not imported by `apps/web` POS business path** (web uses `sync-api.ts` HTTP only).

---

## 4. Desktop app inventory â€” `apps/desktop`

| File | Offline-related responsibility | Notes |
|------|-------------------------------|-------|
| `src/db/bootstrap.ts` | Opens `better-sqlite3`, migrations, `LocalDatabase`, `OfflinePosEngine` | **Hard SQLite dependency** |
| `src/paths.ts` | `databaseFile: â€¦/offline.db` | Offline DB path |
| `src/main.ts` | Bootstraps offline DB; Phase 1 does **not** start SyncCoordinator | Still opens SQLite |
| `src/sync-runtime.ts` | Builds SyncCoordinator + HttpCloudTransport + SyncEngine | Still compiled; unused at boot |
| `src/ipc.ts` | `postOfflineSale`, `listPendingSales`, `syncNow`, `syncStatus`, provision | Phase 1 throws/empty |
| `src/first-run.ts` | Device provision into LocalDatabase | Offline package types |
| `src/readiness.ts` | Requires `better-sqlite3` resolve | Blocker if missing |
| `src/constants.ts` | IPC channel names for offline/sync | |
| `preload.cjs` | Exposes `electronicErpDesktop.postOfflineSale`, `syncNow`, â€¦ | Bridge to renderer |
| `renderer/app.js` | Desktop shell UI (status/sync mentions) | |
| `scripts/prepare-check.cjs` | Checks better-sqlite3 | |
| `package.json` | Description mentions SQLite; asarUnpack better-sqlite3 | |
| `README.md` / docs refs | Offline shell docs | DOC |

**Desktop still initializes SQLite even in ONLINE_ONLY mode** â€” only sale/sync IPC is disabled.

---

## 5. Web app inventory â€” `apps/web`

| File | Offline-related | Keep vs offline-only |
|------|-----------------|----------------------|
| `src/features/sync/SyncCenterPage.tsx` | Sync UI (disabled notice) | OFFLINE_UI |
| `src/features/sync/OfflinePosStatusPage.tsx` | Offline POS status (disabled notice) | OFFLINE_UI |
| `src/features/sync/sync-api.ts` | Client for `/api/v1/sync` | OFFLINE_API_CLIENT |
| `src/app/router.tsx` | Routes `/offline-pos`, `/sync` | ROUTE |
| `src/app/modules.ts` | Module entries for those routes | NAV |
| `src/app/shell/AppShell.tsx` | Hides paths via `ONLINE_ONLY_HIDDEN_MODULE_PATHS` | NAV_FILTER |
| `src/features/pos/PosPage.tsx` | `navigator.onLine` + online/offline listeners; blocks ops when offline | **HYBRID** â€” connectivity UX for online-only, not SQLite |
| `src/features/pos/design-system/POSTopbar.tsx` | Online / Offline / Cloud only badge | UX |
| `src/features/pos/session/pos-customer-runtime.ts` | `PosCustomerOfflineCache` class | LEGACY_CACHE (tests still use) |
| `src/features/pos/session/pos-customer-repository.ts` | Online-only API; rejects when `!online` | ONLINE (uses connectivity flag) |
| `src/features/pos/session/pos-customer.test.ts` | Uses `PosCustomerOfflineCache` as fixture | TEST |
| `src/features/pos/session/pos-repository.ts` | Name only â€” online API wrapper (verify not SQLite) | ONLINE |
| `tsconfig.json` / `vite.config.ts` | Path alias `@electronic-erp/offline` | BUILD_WIRE (web may not import offline at runtime) |

### Web localStorage (related but **not** SQLite POS DB)

| Key / usage | Purpose | Classification |
|-------------|---------|----------------|
| `erp-pos-favorites*` / `erp-pos-recent*` | UX recent/favorites | **NOT offline DB** â€” UI preference cache |
| Auth tokens / branch | Session | **NOT offline DB** |
| `erp_pending_ops`, `erp_registered_device_id`, `erp_device_id`, `erp_device_key` | Sync center leftovers | OFFLINE_SYNC_UI_STATE |
| Hardware print job log key | Hardware | NOT offline DB |

### Not found in web

- IndexedDB / Dexie / idb
- sql.js / WASM SQLite / OPFS
- Direct `better-sqlite3` imports

---

## 6. API inventory â€” `apps/api`

| File | Role | Class |
|------|------|-------|
| `src/routes/sync.ts` | `/api/v1/sync/*` â€” register, push, pull, conflicts, status; **503 when ONLINE_ONLY** | OFFLINE_API |
| `src/app.ts` | Mounts `app.use("/api/v1/sync", syncRouter)` | WIRE |
| `src/migrations.test.ts` | Asserts offline sync migration SQL content | TEST |

Online POS routes (`routes/pos.ts`) accept `deviceId` / `offlineTransactionId` / `idempotencyKey` for compatibility â€” **shared with online idempotency**, not desktop-only.

---

## 7. DB package â€” sync server side

| File | Role | Class |
|------|------|-------|
| `packages/db/src/repositories/sync-repository.ts` | Devices, push, pull, conflicts, status against Supabase | OFFLINE_SERVER |
| `packages/db/src/index.ts` | Exports SyncRepository | WIRE |

**Also writes sync metadata columns (online path still sets them):**

| Repository | Fields | Class |
|------------|--------|-------|
| `pos-repository.ts` | `offline_transaction_id`, `sync_state`, device fields on sales | SHARED_SCHEMA_USAGE |
| `parties-repository.ts` | same on payments | SHARED_SCHEMA_USAGE |
| `purchases-repository.ts` | same on purchases/transfers | SHARED_SCHEMA_USAGE |
| `inventory-repository.ts` | sync-related columns (if present) | SHARED_SCHEMA_USAGE |

---

## 8. Contracts / domain â€” offline-capable types (shared)

### Contracts

| File | Offline-related symbols | Class |
|------|-------------------------|-------|
| `packages/contracts/src/sync.ts` | Device, SyncPush/Pull, conflicts, queue schemas | OFFLINE_CONTRACT |
| `packages/contracts/src/runtime-mode.ts` | `ONLINE_ONLY`, messages, hidden paths | GATE |
| `packages/contracts/src/sale.ts` | `offlineTransactionId`, `syncState`, `deviceId` | SHARED |
| `packages/contracts/src/payment.ts` | same | SHARED |
| `packages/contracts/src/stock.ts` | same + OfflineStockMutation shapes | SHARED / OFFLINE |
| `packages/contracts/src/purchase.ts` | offline transaction fields | SHARED |

### Domain

| File | Notes | Class |
|------|-------|-------|
| `sale-transaction.ts` | Sets `sync_state` / `offline_transaction_id` on post; comments mention OfflinePosEngine | SHARED + COMMENT |
| `purchase-transaction.ts` | Same pattern | SHARED |

**Important:** Removing offline must **not** casually delete `idempotencyKey` â€” it is required for **online** duplicate protection.

---

## 9. Supabase migrations / cloud tables

| Migration | Offline content | Class |
|-----------|-----------------|-------|
| `20260810000010_offline_sync_engine.sql` | `sync_operation_acks`, `sync_conflicts`, `sync_change_log`, devices columns, sync permissions | OFFLINE_CLOUD_SCHEMA |
| `20260810000005_pos_sales.sql` | `offline_transaction_id`, `sync_state` on sales (+ related) | SHARED_COLUMNS |
| `20260810000003_inventory_engine.sql` | sync_state / offline fields on movements (as applicable) | SHARED_COLUMNS |
| `20260810000004_parties_payments.sql` | payment sync fields | SHARED_COLUMNS |
| `20260810000006_purchases_warehouse_ops.sql` | purchase sync fields | SHARED_COLUMNS |
| Foundation | `devices` table (used by sync) | SHARED / DEVICE |

**DO NOT DROP cloud columns/tables in an app-only cleanup without an explicit schema phase** â€” online rows already use `sync_state='synced'`.

---

## 10. Dependencies & build wiring

| Location | Reference | Class |
|----------|-----------|-------|
| Root `package.json` | `better-sqlite3`, `@types/better-sqlite3`; `build:packages` builds sync+offline; many `test:phase*` include offline/sync | DEP / SCRIPT |
| `package-lock.json` | Locked better-sqlite3 | DEP |
| `scripts/link-workspaces.cjs` | Stubs `@electronic-erp/sync`, `@electronic-erp/offline` | BUILD |
| `apps/web/vite.config.ts` | Alias to `packages/offline` | BUILD |
| `apps/web/tsconfig.json` | Path to offline package | BUILD |
| `apps/desktop/package.json` | electron-builder unpack `better-sqlite3` | DEP |
| Root `test:foundation` | Includes `packages/offline` tests | SCRIPT |

**Not present:** `sqlite3` (node-sqlite3), `sql.js`, WASM SQLite packages.

---

## 11. Keyword search results

| Pattern | Result |
|---------|--------|
| `better-sqlite3` | Root dep; desktop bootstrap/readiness/prepare-check; offline sqlite-kv comments |
| `sqlite3` / `sql.js` / WASM / OPFS | **Not used** as POS DB |
| `IndexedDB` | **Not used** |
| `navigator.onLine` | `PosPage.tsx` (and previously Sync/Offline pages before disable) |
| `online` / `offline` listeners | `PosPage.tsx` |
| `outbox` | `local-database.ts`, `sync-schema.ts`, `OfflinePosEngine`, SyncCoordinator, docs |
| `SyncCoordinator` | offline package + desktop sync-runtime |
| `OfflinePosEngine` | offline package + desktop bootstrap + tests |
| `syncQueue` / `pendingSync` | Contracts SyncQueue*; localStorage `erp_pending_ops` (web sync UI) |
| `isOnline` / `isOffline` / `offlineMode` | Desktop `getOnline`/`setOnline`; contracts `ONLINE_ONLY`; no single `offlineMode` flag beyond that |

---

## 12. Documentation (offline-specific)

| Doc | Class |
|-----|-------|
| `docs/OFFLINE_ARCHITECTURE.md` | DOC |
| `docs/PHASE10_OFFLINE_SYNC.md` | DOC |
| `docs/DATABASE_ARCHITECTURE.md` | DOC (mentions dual DB) |
| `docs/POS_ARCHITECTURE.md` / `POS_AUDIT.md` / others | DOC mentions |
| `apps/desktop/README.md` | DOC |
| `CURRENT-POS-SYSTEM-AUDIT.md` | DOC (Phase 1 note) |
| Various PHASE*/DEPLOYMENT reports | DOC |

---

## 13. Tests tied to offline/sync

| Suite | Location |
|-------|----------|
| Offline package vitest | `packages/offline/src/*.test.ts` |
| Sync package vitest | `packages/sync/src/*.test.ts` |
| API migrations offline SQL | `apps/api/src/migrations.test.ts` |
| Web customer test using OfflineCache | `pos-customer.test.ts` (cache as fixture only) |
| Root scripts | `test:foundation`, `test:phase2`â€“`10`, `17`, `18` include offline and/or sync |

---

## 14. Classification for future deletion (DO NOT DELETE YET)

### A â€” Safe to remove later as a unit (offline product surface)

- Entire `packages/offline/` (after desktop decouple)
- Entire `packages/sync/` (after desktop/API decouple)
- Web `features/sync/*` UI + `sync-api.ts`
- Routes/modules `/offline-pos`, `/sync`
- Desktop `sync-runtime.ts`, offline IPC channels, OfflinePosEngine usage
- Root scripts that only exist to test offline/sync (adjust carefully)
- Docs that only describe offline architecture

### B â€” Must stay for online ERP (or migrate carefully)

- `idempotencyKey` on sales/payments
- `SaleTransactionService` / PosRepository online path
- Supabase business tables (`sales`, `payments`, â€¦)
- `deviceId` optional fields (harmless on online posts)
- Auth localStorage, favorites/recent localStorage
- `navigator.onLine` **as connectivity guard** for online-only POS (optional UX; not SQLite)

### C â€” Shared schema â€” do **not** drop without migration plan

- Columns: `sync_state`, `offline_transaction_id`, `operation_id` on cloud tables
- Tables: `devices`, `sync_operation_acks`, `sync_conflicts`, `sync_change_log`
- Contracts sync types (if API route removed, types may become dead)

### D â€” Currently disabled but still loaded

- Desktop still **opens SQLite** via `bootstrapOfflineDatabase`
- `ONLINE_ONLY` gate in contracts/API/UI
- `PosCustomerOfflineCache` class retained for tests

---

## 15. Consumer matrix (who imports whom)

| Consumer | Imports offline? | Imports sync? | Uses SyncRepository/API? |
|----------|------------------|---------------|---------------------------|
| `apps/desktop` | **Yes** | **Yes** (via sync-runtime) | Via HttpCloudTransport |
| `apps/web` POS | No (alias only) | No package | sync-api â†’ API (UI disabled) |
| `apps/api` | No | No | **Yes** SyncRepository |
| `packages/offline` | â€” | **Yes** | Indirect via transport |
| `packages/domain` | No | No | No |
| `packages/db` PosRepository | No | No | Separate SyncRepository |

---

## 16. Recommended removal order (preview only â€” not executing)

1. Confirm online POS works without desktop offline IPC.
2. Stop desktop SQLite bootstrap **or** replace with online-only Electron shell.
3. Remove web sync routes/UI/client.
4. Gate or remove API `/api/v1/sync`.
5. Remove `packages/offline` + `packages/sync` from build/test scripts.
6. Remove `better-sqlite3` when desktop no longer needs it.
7. **Separate later schema phase** for cloud sync tables/columns if desired.

---

## 17. Step 1 status

- [x] Full-repo scan for SQLite / offline / sync / outbox / connectivity patterns
- [x] Dependency map written
- [ ] **No files deleted**
- [ ] Awaiting approval for Step 2 (actual removal plan / execution)

---

*End of offline code dependency map.*
