# OFFLINE CODE CLASSIFICATION (STEP 2)

**Created:** 2026-08-12
**Based on:** `OFFLINE-CODE-DEPENDENCY-MAP.md`
**Rule:** **No deletions in this step.** Classification only.

## Legend

| Code | Meaning | Action later |
|------|---------|--------------|
| **A** | OFFLINE-ONLY | Normally deletable once consumers are unwired |
| **B** | SHARED BY ONLINE + OFFLINE | **Must NOT be deleted** |
| **C** | ONLINE CODE WITH OFFLINE FALLBACK | Convert carefully to online-only (edit, donâ€™t wipe) |
| **D** | UNKNOWN / NEEDS MANUAL REVIEW | Untouched until dependency understood |

---

## Summary counts (approx.)

| Class | Count (files/artifacts) | Notes |
|-------|-------------------------|-------|
| A | ~55 | Offline packages, sync package, sync UI/API client, desktop SQLite/sync runtime pieces |
| B | ~25+ | Contracts fields, domain sale/purchase posting, PosRepository online path, shared DB columns, idempotency |
| C | ~15 | PosPage connectivity, customer repo/runtime, AppShell/modules/router gates, desktop main/ipc/first-run/bootstrap |
| D | ~15 | Docs, migrations (schema policy), devices table, root scripts, desktop shell that mixes hardware+offline |

---

# A â€” OFFLINE-ONLY

Pure offline/SQLite/sync product surface. Safe deletion candidates **after** C files stop importing them.

## A1. Package `@electronic-erp/offline`

| Path | Why A |
|------|-------|
| `packages/offline/package.json` | Offline package only |
| `packages/offline/tsconfig.json` | |
| `packages/offline/vitest.config.ts` | |
| `packages/offline/src/index.ts` | Offline public API |
| `packages/offline/src/sqlite-schema.ts` | SQLite DDL |
| `packages/offline/src/catalog-schema.ts` | SQLite DDL |
| `packages/offline/src/inventory-schema.ts` | SQLite DDL |
| `packages/offline/src/parties-schema.ts` | SQLite DDL |
| `packages/offline/src/pos-schema.ts` | SQLite DDL |
| `packages/offline/src/warehouse-ops-schema.ts` | SQLite DDL |
| `packages/offline/src/sync-schema.ts` | Outbox/inbox SQLite |
| `packages/offline/src/durable-storage.ts` | Local storage abstraction for offline DB |
| `packages/offline/src/sqlite-kv-storage.ts` | better-sqlite3 adapter |
| `packages/offline/src/sqlite-migrations.ts` | Offline migrations |
| `packages/offline/src/sqlite-migrations.test.ts` | |
| `packages/offline/src/local-database.ts` | Local DB + outbox |
| `packages/offline/src/offline-pos-engine.ts` | Offline POS writer |
| `packages/offline/src/sync-coordinator.ts` | Sync orchestration |
| `packages/offline/src/product-store.ts` | Offline product store |
| `packages/offline/src/customer-store.ts` | Offline customer store |
| `packages/offline/src/pos-store.ts` | Legacy OfflinePosStore |
| `packages/offline/src/stock-mutation-store.ts` | Offline stock |
| `packages/offline/src/payment-mutation-store.ts` | Offline payments |
| `packages/offline/src/warehouse-ops-store.ts` | Offline purchases |
| `packages/offline/src/product-store.test.ts` | |
| `packages/offline/src/customer-store.test.ts` | |
| `packages/offline/src/pos-store.test.ts` | |
| `packages/offline/src/stock-mutation-store.test.ts` | |
| `packages/offline/src/payment-mutation-store.test.ts` | |
| `packages/offline/src/warehouse-ops-store.test.ts` | |
| `packages/offline/src/offline-sync.engine.test.ts` | |

## A2. Package `@electronic-erp/sync`

| Path | Why A |
|------|-------|
| `packages/sync/package.json` | Sync client package (desktop/offline outbox transport) |
| `packages/sync/tsconfig.json` | |
| `packages/sync/vitest.config.ts` | |
| `packages/sync/src/index.ts` | |
| `packages/sync/src/engine.ts` | SyncEngine |
| `packages/sync/src/conflict-resolver.ts` | Conflict policy for offline sync |
| `packages/sync/src/conflict-resolver.test.ts` | |
| `packages/sync/src/http-cloud.ts` | HTTP push/pull to sync API |
| `packages/sync/src/memory-cloud.ts` | Test transport |
| `packages/sync/src/sale-sync.ts` | enqueueSale |
| `packages/sync/src/stock-sync.ts` | enqueueStockMovement |
| `packages/sync/src/payment-sync.ts` | enqueuePayment |
| `packages/sync/src/customer-sync.ts` | enqueueCustomer |
| `packages/sync/src/product-sync.ts` | Offline product shape helpers |
| `packages/sync/src/purchase-sync.ts` | enqueuePurchase |
| `packages/sync/src/product-sync.test.ts` | |
| `packages/sync/src/stock-sync.test.ts` | |

## A3. Web sync / offline status UI + client

| Path | Why A |
|------|-------|
| `apps/web/src/features/sync/SyncCenterPage.tsx` | Sync center UI (offline product) |
| `apps/web/src/features/sync/OfflinePosStatusPage.tsx` | Offline POS status UI |
| `apps/web/src/features/sync/sync-api.ts` | Only talks to `/api/v1/sync` |

## A4. Desktop offline/sync-only modules

| Path | Why A |
|------|-------|
| `apps/desktop/src/sync-runtime.ts` | Builds SyncCoordinator; no online POS role |
| `apps/desktop/src/db/bootstrap.ts` | **Primarily A** â€” only purpose is SQLite offline runtime (see also C note: main still calls it) |

> Note on `bootstrap.ts`: File content is offline-only (A). **Caller** `main.ts` is C (must stop calling it before deleting A).

## A5. Docs that are offline-only product docs

| Path | Why A |
|------|-------|
| `docs/OFFLINE_ARCHITECTURE.md` | Offline architecture only |
| `docs/PHASE10_OFFLINE_SYNC.md` | Offline sync phase doc |

## A6. Dependency artifacts (offline-native)

| Path | Why A |
|------|-------|
| Root `package.json` dependency `better-sqlite3` | Native SQLite â€” removable when desktop offline removed (**edit package.json = C-style change**, dep itself is A) |
| Root `package.json` `@types/better-sqlite3` | Same |
| `package-lock.json` entries for better-sqlite3 | Lockfile follow-on |
| `apps/desktop/package.json` `asarUnpack: **/better-sqlite3/**` | Electron unpack for native module |

---

# B â€” SHARED BY ONLINE + OFFLINE â€” DO NOT DELETE

Online ERP/POS still needs these. Offline also used them. Removing would break online.

## B1. Online sale / payment / stock orchestration

| Path | Why B |
|------|-------|
| `packages/domain/src/sale-transaction.ts` | Central online sale path; also sets sync metadata columns |
| `packages/domain/src/purchase-transaction.ts` | Same for purchases |
| `packages/db/src/repositories/pos-repository.ts` | Online POS â†’ Supabase |
| `packages/db/src/repositories/parties-repository.ts` | Online customers/payments; writes sync_state when offline id present |
| `packages/db/src/repositories/purchases-repository.ts` | Online purchases; sync columns |
| `packages/db/src/repositories/inventory-repository.ts` | Online stock; sync columns |
| `apps/api/src/routes/pos.ts` | Online POS HTTP API |
| `apps/web/src/features/pos/pos-api.ts` | Online POS client |
| `apps/web/src/features/pos/session/pos-repository.ts` | Thin alias to `posApi` (online) â€” name mentions repo only |
| `apps/web/src/features/pos/session/usePosSession.ts` | Online cart session (domain) |

## B2. Contracts fields used online (idempotency / optional offline metadata)

| Path | Why B |
|------|-------|
| `packages/contracts/src/sale.ts` | `idempotencyKey` required online; `deviceId` / `offlineTransactionId` / `syncState` optional shared |
| `packages/contracts/src/payment.ts` | Same pattern |
| `packages/contracts/src/stock.ts` | SyncState + offline mutation shapes used by contracts/tests and inventory |
| `packages/contracts/src/purchase.ts` | Offline transaction optional fields on shared schemas |
| `packages/contracts/src/common.js` / decimal / auth / etc. | Not offline-specific (listed only if touched) â€” **do not delete** |

> Deleting optional offline fields from Zod schemas is a **schema cleanup (C/B careful edit)**, not an A wipe.

## B3. Shared cloud schema columns / tables still written by online path

| Artifact | Why B |
|----------|-------|
| Columns `sync_state`, `offline_transaction_id`, `device_id`, `operation_id` on `sales`, payments, stock, purchases | Online posts set `sync_state='synced'` today |
| `supabase/migrations/20260810000005_pos_sales.sql` (whole file) | Creates core POS tables â€” **not** offline-only |
| `supabase/migrations/20260810000003_inventory_engine.sql` | Core inventory |
| `supabase/migrations/20260810000004_parties_payments.sql` | Core parties |
| `supabase/migrations/20260810000006_purchases_warehouse_ops.sql` | Core purchases |
| Idempotency unique indexes on sales | Online duplicate protection |

## B4. Auth / normal UI persistence (not offline DB)

| Path / key | Why B |
|------------|-------|
| `apps/web/src/features/auth/auth-service.ts` localStorage tokens | Online auth |
| POS favorites/recent `localStorage` keys in `PosPage.tsx` | UX cache, not SQLite offline DB |

## B5. Hardware / printing (desktop shared)

| Path | Why B |
|------|-------|
| `apps/desktop/src/hardware-bridge.ts` | Hardware, not offline DB |
| `packages/hardware/**` | Shared printing/devices |
| Desktop print/drawer IPC handlers in `ipc.ts` | Shared with online Electron shell |

---

# C â€” ONLINE CODE WITH OFFLINE FALLBACK â€” CONVERT CAREFULLY

Do **not** delete these files wholesale. Remove offline branches / SQLite boot / sync mounts while keeping online behavior.

## C1. Web POS connectivity + customer paths

| Path | Offline fallback to remove | Keep |
|------|---------------------------|------|
| `apps/web/src/features/pos/PosPage.tsx` | Offline messaging / could simplify once always-online; still uses `navigator.onLine` as gate | Checkout via `posApi`, cart, UI |
| `apps/web/src/features/pos/design-system/POSTopbar.tsx` | â€œOffline â€” blockedâ€ / syncing concepts | Branch, shift, clock, holds |
| `apps/web/src/features/pos/session/pos-customer-repository.ts` | Already online-only API; still takes `online` flag | partiesApi calls |
| `apps/web/src/features/pos/session/pos-customer-runtime.ts` | `PosCustomerOfflineCache` class (legacy fallback) | `toPosCustomerProfile` helper if still used |
| `apps/web/src/features/pos/session/pos-customer.test.ts` | Uses OfflineCache as fixture | Rewrite fixture without offline cache |

## C2. Web routing / nav / gates

| Path | Convert |
|------|---------|
| `apps/web/src/app/router.tsx` | Remove `/offline-pos` and `/sync` routes (or leave redirect); keep rest |
| `apps/web/src/app/modules.ts` | Remove offline/sync module entries |
| `apps/web/src/app/shell/AppShell.tsx` | Remove `ONLINE_ONLY_HIDDEN_MODULE_PATHS` filter once modules gone |
| `packages/contracts/src/runtime-mode.ts` | Temporary gate â€” eventually remove or set permanently after cleanup |
| `apps/web/tsconfig.json` | Drop `@electronic-erp/offline` path alias |
| `apps/web/vite.config.ts` | Drop offline alias |

## C3. API sync mount (online API app with offline endpoint)

| Path | Convert |
|------|---------|
| `apps/api/src/app.ts` | Unmount `/api/v1/sync` when sync removed |
| `apps/api/src/routes/sync.ts` | Entire router is offline sync â€” treat as **A content** living in API; file deletable after unmount (**classify file as A**, app.ts as C) |

**Reclassification note:** `apps/api/src/routes/sync.ts` â†’ **A** (offline-only route module).
`apps/api/src/app.ts` â†’ **C** (shared app; edit mount).

| Path | Class |
|------|-------|
| `packages/db/src/repositories/sync-repository.ts` | **A** (only used by sync routes) |
| `packages/db/src/index.ts` | **C** â€” remove SyncRepository export only |
| `packages/contracts/src/sync.ts` | **Dâ†’ leaning A** if no other consumers; currently only sync API â€” see D |

## C4. Desktop shell still bootstrapping SQLite

| Path | Convert |
|------|---------|
| `apps/desktop/src/main.ts` | Stop `bootstrapOfflineDatabase` / sync; keep BrowserWindow, hardware, updater |
| `apps/desktop/src/ipc.ts` | Remove offline sale/sync handlers; keep print/drawer/secure/updater |
| `apps/desktop/src/first-run.ts` | Remove LocalDatabase provision path or replace with online-only device registration |
| `apps/desktop/src/paths.ts` | Remove `offline.db` path or leave unused |
| `apps/desktop/src/readiness.ts` | Stop requiring better-sqlite3 |
| `apps/desktop/src/constants.ts` | Remove offline IPC channel names |
| `apps/desktop/preload.cjs` | Remove `postOfflineSale` / `syncNow` / pending sales bridges |
| `apps/desktop/renderer/app.js` | Remove smoke offline sale / pending / online toggle offline flows; keep hardware/update |
| `apps/desktop/scripts/prepare-check.cjs` | Drop better-sqlite3 check |
| `apps/desktop/package.json` | Description / asarUnpack cleanup |
| `apps/desktop/README.md` | Rewrite for online-only Electron |

## C5. Build / test scripts referencing offline packages

| Path | Convert |
|------|---------|
| Root `package.json` `build:packages` | Stop building offline/sync when packages deleted |
| Root `package.json` `typecheck` / `test:*` | Remove offline/sync prefixes |
| `scripts/link-workspaces.cjs` | Remove offline/sync stub entries |

## C6. Domain comments only

| Path | Convert |
|------|---------|
| `packages/domain/src/sale-transaction.ts` comments | Comment cleanup only; logic is B |

---

# D â€” UNKNOWN / NEEDS MANUAL REVIEW

Do not delete until explicitly decided.

## D1. Supabase sync **tables** (vs columns)

| Path / object | Question |
|---------------|----------|
| `supabase/migrations/20260810000010_offline_sync_engine.sql` | Historical migration â€” never delete applied migration files casually. New migration to DROP tables? Needs ops approval. |
| Tables `sync_operation_acks`, `sync_conflicts`, `sync_change_log` | Unused if sync API removed â€” drop later via new migration? |
| Permissions `sync.push`, `sync.pull`, `devices.register` | Still referenced by RBAC seeds? |
| `devices` table + RLS | May still be wanted for â€œregistered POS terminalsâ€ online without offline sync â€” **manual product decision** |

## D2. Contracts sync module

| Path | Question |
|------|----------|
| `packages/contracts/src/sync.ts` | Only for sync API today â†’ could become A after API removal; confirm no admin/device UI uses DeviceSchema elsewhere |
| `packages/contracts/src/index.ts` export of sync | C edit when sync.ts removed |

## D3. Mixed documentation / status reports

| Path | Why D |
|------|-------|
| `docs/DATABASE_ARCHITECTURE.md` | Describes dual DB â€” edit later, donâ€™t delete doc tree blindly |
| `docs/POS_ARCHITECTURE.md` | Mixed online/offline narrative |
| `docs/POS_AUDIT.md` / `docs/POS_PHASE1_AUDIT.md` | Historical |
| `docs/ERP_ARCHITECTURE.md` | Mixed |
| `docs/FINAL_ERP_STATUS.md` / `PRODUCTION_READINESS.md` / deploy reports | Mentions offline â€” historical |
| `CURRENT-POS-SYSTEM-AUDIT.md` | Audit record â€” keep |
| `OFFLINE-CODE-DEPENDENCY-MAP.md` | Keep for removal phase |
| `README.md` | May mention offline â€” edit carefully |

## D4. API tests mentioning offline migration

| Path | Why D |
|------|-------|
| `apps/api/src/migrations.test.ts` | Asserts offline sync SQL exists â€” update when schema policy decided; donâ€™t delete whole test file |

## D5. Desktop â€œdevice provisionâ€ product meaning

| Path | Why D |
|------|-------|
| Device registration via sync API vs future online-only terminal ID | Product decision: keep devices for licensing/terminals or remove |

## D6. Phase 1 gate permanence

| Path | Why D |
|------|-------|
| `ONLINE_ONLY` flag | Temporary bridge â€” after A deletion, decide remove flag vs keep forever |

---

# Corrected quick reference (file â†’ class)

### Definitely A (delete candidates later)

- All of `packages/offline/**`
- All of `packages/sync/**`
- `apps/web/src/features/sync/**`
- `apps/api/src/routes/sync.ts`
- `packages/db/src/repositories/sync-repository.ts`
- `apps/desktop/src/sync-runtime.ts`
- `apps/desktop/src/db/bootstrap.ts` (after main unwired)
- `docs/OFFLINE_ARCHITECTURE.md`, `docs/PHASE10_OFFLINE_SYNC.md`
- `better-sqlite3` dependency (after desktop C conversion)

### Definitely B (never delete for offline cleanup)

- Domain sale/purchase transaction services (logic)
- Pos/parties/purchases/inventory repositories (online)
- POS API routes + web `pos-api` / `usePosSession`
- Core Supabase POS/inventory/parties migrations
- `idempotencyKey` and online posting behavior
- Auth token storage; hardware package

### Definitely C (edit)

- `PosPage`, `POSTopbar`, customer session files
- `router.tsx`, `modules.ts`, `AppShell.tsx`
- `runtime-mode.ts`
- Desktop `main.ts`, `ipc.ts`, `preload.cjs`, `first-run.ts`, `paths.ts`, `readiness.ts`, `renderer/app.js`, prepare-check
- Root `package.json` scripts + `link-workspaces.cjs`
- `apps/api/src/app.ts`, `packages/db/src/index.ts`
- Web vite/tsconfig aliases

### Definitely D (hold)

- Migration `â€¦010_offline_sync_engine.sql` (file) + whether to DROP sync_* tables
- `devices` table future use
- `packages/contracts/src/sync.ts` until consumers verified
- Historical docs / audit markdown
- `migrations.test.ts` offline assertions

---

# Explicit non-goals for deletion

1. Do **not** delete Category B files.
2. Do **not** drop Supabase columns used by online inserts without a new migration + code update (B/D).
3. Do **not** remove `idempotencyKey`.
4. Do **not** delete entire `apps/desktop` â€” convert to online shell (C).
5. Do **not** treat favorites/recent `localStorage` as offline DB (B).

---

# Step 2 status

- [x] Every mapped offline-related artifact classified A/B/C/D
- [x] Deletion rule confirmed: **only A** (after C unwired)
- [ ] No files deleted
- [ ] Awaiting Step 3 instructions

---

*End of classification.*
