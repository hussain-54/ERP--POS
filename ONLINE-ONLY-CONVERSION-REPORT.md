# ONLINE-ONLY-CONVERSION-REPORT

**Project:** Electronic ERP
**Date:** 2026-08-12
**Scope:** Convert application from dual online/offline (SQLite + sync) to **online-only** with Supabase/PostgreSQL as the single source of truth.
**Companion step reports:** `STEP4`â€“`STEP20`, `OFFLINE-CODE-DEPENDENCY-MAP.md`, `OFFLINE-CODE-CLASSIFICATION.md`, `ONLINE-ARCHITECTURE-PROTECTION.md`, `STEP19-FINAL-OFFLINE-REFERENCE-SCAN.md`, `STEP20-FINAL-ONLINE-ARCHITECTURE-CHECK.md`.

**Final architecture:**

```
React â†’ Tailwind UI â†’ POS Components â†’ Hooks/State â†’ Domain â†’ API â†’ Supabase repositories â†’ Supabase â†’ PostgreSQL
```

**Verdict:** Conversion complete. No active React â†’ SQLite, Offline Repository, or Sync Queue â†’ SQLite path.

---

# 1. What was removed

Offline-specific components and subsystems removed:

| Component / subsystem | Role (before) |
|-----------------------|---------------|
| `@electronic-erp/offline` package | Local SQLite schemas, `LocalDatabase`, `OfflinePosEngine`, `SyncCoordinator`, durable KV, mutation stores |
| `@electronic-erp/sync` package | SyncEngine, HttpCloudTransport, entity sync helpers, conflict resolver |
| Desktop SQLite bootstrap | `better-sqlite3` open, migrations, integrity, `OfflinePosEngine` wiring |
| Desktop sync runtime | SyncCoordinator / SyncEngine construction |
| Sync HTTP API | Device register, push, pull, conflicts, status |
| `SyncRepository` | Server-side outbox apply against Supabase sync tables |
| Contracts sync DTOs | Device / SyncPush / SyncPull / Conflict Zod schemas |
| Web Sync Center UI | Sync status, conflicts, sync-now product UI |
| Web Offline POS status UI | SQLite/outbox status messaging |
| Desktop â€œSimulate offlineâ€ | Fake offline mode toggle |
| Desktop Offline POS panel | Smoke sale / pending sales against local DB |
| Desktop SQLite path / integrity UI | Local database management |
| `desktop:setConnectivity` IPC | Powered simulate-offline |
| Offline sale / pending / sync IPC channels | Desktop offline POS operations |
| Runtime mode flag `ONLINE_ONLY` / `runtime-mode.ts` | Dual-mode / kill-switch for offline ops |
| `PosCustomerOfflineCache` | Local customer cache dual path |
| Path aliases `@electronic-erp/offline` | Vite / tsconfig wiring |
| Workspace build/test/link stubs for offline/sync | Root scripts / `link-workspaces.cjs` |
| Env template `OFFLINE_DATA_DIR` | Unused offline data directory |
| Extraneous `better-sqlite3` / `@types/better-sqlite3` in `node_modules` | Leftover native SQLite installs |
| Stale Vercel `api/handler.cjs` sync mount | Rebuilt so bundle no longer serves `/api/v1/sync` |
| Orphan contracts `sync.js` / `sync.d.ts` emit | Leftover after `sync.ts` delete (Step 19) |

Misleading offline product copy (â€œCloud onlyâ€, â€œOffline readyâ€, â€œPending syncâ€, â€œSync completeâ€) was removed or rewritten to connection-required messaging only.

---

# 2. What was retained

Shared / online components retained (Class B / protected online path):

| Component | Why retained |
|-----------|--------------|
| `apps/web` React POS / ERP UI | Online product surface |
| Tailwind + POS design system | Online UI |
| `usePosSession` cart/session | Ephemeral cart until hold/sale (not a local business DB) |
| `posApi`, `partiesApi`, catalog/inventory/enterprise APIs | Online HTTP clients |
| `apps/api` Express `/api/v1/*` (except sync) | Online gateway |
| `packages/domain` (`SaleTransactionService`, payment gate, totals, holds, returns, commission, â€¦) | Shared business rules |
| `packages/db` repositories (`PosRepository`, `PartiesRepository`, `InventoryRepository`, â€¦) | Supabase persistence |
| `packages/contracts` (sale, payment, stock, purchase, authz, â€¦) | Shared DTOs; optional `syncState` / `offlineTransactionId` fields kept as schema mirrors |
| `packages/hardware` + desktop hardware bridge | Printing / devices â€” not offline DB |
| `packages/ui`, `packages/ai` | Shared online packages |
| Supabase Auth + JWT `createUserClient` | Online auth / RLS |
| Idempotency keys on sales/payments | Online duplicate protection |
| Columns `sync_state`, `offline_transaction_id`, `device_id` | Shared Postgres columns; online writers set `synced` / null |
| Authz permission strings `sync.*` | RBAC catalog only â€” no sync runtime |
| Migration `20260810000010_offline_sync_engine.sql` + sync_* tables | Class D schema history â€” **no DROP** |
| `navigator.onLine` + connection banners | Connectivity gate for online API (not SQLite selection) |
| Desktop Electron shell | Hosts online web + hardware; config JSON only for device settings |
| `apps/desktop/src/config-store.ts` (**new**) | Replaces SQLite for terminal identity / encrypted settings only |
| `apps/web/src/lib/online-required.ts` (**new**) | Connection-required failure copy |
| Favorites / recent / auth tokens in `localStorage` | UX / session cache â€” not ERP ledger |

---

# 3. Supabase Architecture

## Data flow

```
Browser (React + Tailwind POS)
  â†’ session hooks + domain helpers (cart, preparePosPayments, PaymentAttemptGate)
  â†’ *Api clients (posApi, partiesApi, â€¦) via apiFetch + Bearer JWT
  â†’ Express apps/api  /api/v1/*
  â†’ authz + route handlers
  â†’ packages/db repositories (PosRepository, â€¦) with createUserClient(JWT)
  â†’ packages/domain services (SaleTransactionService, â€¦) where applicable
  â†’ Supabase JS (.from / .rpc)
  â†’ Supabase (Auth + PostgREST + RLS)
  â†’ PostgreSQL
```

**POS sales do not write from the browser to Supabase tables.** They go through `POST /api/v1/pos/sales`.

## Clients

| Client | Use |
|--------|-----|
| `createUserClient(accessToken)` | Business CRUD under RLS |
| `createAnonClient()` | Login / password reset / health probe |
| `createServiceClient()` | Optional server infra (lockout, audit) â€” null if key missing |
| Browser Supabase client | Auth session + hydrate; not POS sale writes |

## Desktop role

Electron is an **online shell**: loads the web app, hardware IPC, JSON config store. No local business SQLite.

---

# 4. Deleted Files

Exact paths removed from the tree (git `--diff-filter=D` vs HEAD, plus Step 8 / Step 19 cleanups):

### Package `@electronic-erp/offline`

```
packages/offline/package.json
packages/offline/tsconfig.json
packages/offline/vitest.config.ts
packages/offline/src/index.ts
packages/offline/src/catalog-schema.ts
packages/offline/src/customer-store.ts
packages/offline/src/customer-store.test.ts
packages/offline/src/durable-storage.ts
packages/offline/src/inventory-schema.ts
packages/offline/src/local-database.ts
packages/offline/src/offline-pos-engine.ts
packages/offline/src/offline-sync.engine.test.ts
packages/offline/src/parties-schema.ts
packages/offline/src/payment-mutation-store.ts
packages/offline/src/payment-mutation-store.test.ts
packages/offline/src/pos-schema.ts
packages/offline/src/pos-store.ts
packages/offline/src/pos-store.test.ts
packages/offline/src/product-store.ts
packages/offline/src/product-store.test.ts
packages/offline/src/sqlite-kv-storage.ts
packages/offline/src/sqlite-migrations.ts
packages/offline/src/sqlite-migrations.test.ts
packages/offline/src/sqlite-schema.ts
packages/offline/src/stock-mutation-store.ts
packages/offline/src/stock-mutation-store.test.ts
packages/offline/src/sync-coordinator.ts
packages/offline/src/sync-schema.ts
packages/offline/src/warehouse-ops-schema.ts
packages/offline/src/warehouse-ops-store.ts
packages/offline/src/warehouse-ops-store.test.ts
```

### Package `@electronic-erp/sync`

```
packages/sync/package.json
packages/sync/tsconfig.json
packages/sync/vitest.config.ts
packages/sync/src/index.ts
packages/sync/src/conflict-resolver.ts
packages/sync/src/conflict-resolver.test.ts
packages/sync/src/customer-sync.ts
packages/sync/src/engine.ts
packages/sync/src/http-cloud.ts
packages/sync/src/memory-cloud.ts
packages/sync/src/payment-sync.ts
packages/sync/src/product-sync.ts
packages/sync/src/product-sync.test.ts
packages/sync/src/purchase-sync.ts
packages/sync/src/sale-sync.ts
packages/sync/src/stock-sync.ts
packages/sync/src/stock-sync.test.ts
```

### API / DB / contracts / web / desktop

```
apps/api/src/routes/sync.ts
packages/db/src/repositories/sync-repository.ts
packages/contracts/src/sync.ts
apps/web/src/features/sync/OfflinePosStatusPage.tsx
apps/web/src/features/sync/SyncCenterPage.tsx
apps/web/src/features/sync/sync-api.ts
apps/desktop/src/db/bootstrap.ts
apps/desktop/src/sync-runtime.ts
```

### Additional removals (not always in the same git delete list)

```
packages/contracts/src/runtime-mode.ts          # Step 8 â€” offline mode flag
packages/contracts/src/sync.js                  # Step 19 â€” orphan emit
packages/contracts/src/sync.d.ts                # Step 19
packages/contracts/src/sync.js.map              # Step 19
apps/desktop/src/db/                            # empty dir removed (Step 9)
```

Exports of sync / runtime-mode removed from `packages/contracts/src/index.ts` and `packages/db/src/index.ts`.

---

# 5. Deleted Dependencies

Exact npm package names removed (declared and/or cleaned from tree):

| Package | Notes |
|---------|-------|
| `better-sqlite3` | Root dependency removed; extraneous `node_modules` uninstall (Step 11) |
| `@types/better-sqlite3` | Types companion removed |
| `@electronic-erp/offline` | Workspace package deleted (not an external npm dep) |
| `@electronic-erp/sync` | Workspace package deleted |

**Not present / never used as POS DB:** `sqlite3`, `sql.js`, WASM SQLite, OPFS adapters.

**Kept (online):** `@supabase/supabase-js`, `electron`, `electron-builder`, `electron-updater`, Express, React, Zod, etc.

---

# 6. Deleted Routes

### Web (React Router / modules)

| Route | Former page |
|-------|-------------|
| `/sync` | Sync Center |
| `/offline-pos` | Offline POS status |

Nav entries for Sync / Offline POS removed from `apps/web/src/app/modules.ts`.

### API (Express)

| Route prefix | Former handlers |
|--------------|-----------------|
| `/api/v1/sync` | Mount removed from `apps/api/src/app.ts` |
| `/api/v1/sync/devices/register` | Device register for sync |
| `/api/v1/sync/push` | Outbox push |
| `/api/v1/sync/pull` | Change pull |
| `/api/v1/sync/conflicts` | Conflict list / resolve |
| `/api/v1/sync/status` | Sync status |

Stale Vercel bundle `api/handler.cjs` rebuilt so it no longer mounts `syncRouter`.

### Desktop IPC (offline-only channels removed)

Examples: sync now / sync status, offline sale / pending sales, `setConnectivity`, SQLite integrity/status fields on `getStatus`.

---

# 7. Modified Files

Exact files changed for the conversion and why (high-signal list from working tree + step reports):

| File | Why changed |
|------|-------------|
| `package.json` | Drop offline/sync workspace scripts/deps; build packages list |
| `.env.example` | Remove `OFFLINE_DATA_DIR`, `ELECTRON_DIST_CHANNEL`; document desktop online env |
| `apps/api/src/app.ts` | Unmount `/api/v1/sync` |
| `apps/api/src/lib/logger.ts` | Drop `sqlite` / `sync` log categories |
| `apps/web/src/app/router.tsx` | Remove `/sync`, `/offline-pos` routes |
| `apps/web/src/app/modules.ts` | Remove Sync / Offline POS modules |
| `apps/web/vite.config.ts` | Drop `@electronic-erp/offline` alias |
| `apps/web/tsconfig.json` | Drop offline path alias |
| `apps/web/src/lib/api.ts` | Map network failures to connection-required errors |
| `apps/web/src/lib/online-required.ts` | **Added** â€” online failure messaging |
| `apps/web/src/features/pos/PosPage.tsx` | Connectivity gate; remove dual-path/customer online param; failure banners |
| `apps/web/src/features/pos/ReturnsPage.tsx` | Connection-required UX |
| `apps/web/src/features/pos/design-system/POSTopbar.tsx` | Connected / Connection Required badges; remove syncing / Cloud only |
| `apps/web/src/features/pos/session/pos-customer-repository.ts` | Always online API; drop offline selection param |
| `apps/web/src/features/pos/session/pos-customer-runtime.ts` | Remove `PosCustomerOfflineCache` |
| `apps/web/src/features/pos/session/pos-customer.test.ts` | In-memory fixtures without offline cache |
| `apps/web/src/features/pos/session/pos-repository.ts` | Online-only client boundary comments |
| `apps/web/src/features/pos/components/PosCustomerPanel.tsx` | Copy / online-only customer UX |
| `packages/contracts/src/index.ts` | Stop exporting sync / runtime-mode |
| `packages/db/src/index.ts` | Stop exporting SyncRepository |
| `packages/domain/src/sale-transaction.ts` | Comment: SQLite removed; online write path only |
| `apps/desktop/src/main.ts` | Boot without SQLite |
| `apps/desktop/src/ipc.ts` | Config store; remove offline sale/sync handlers |
| `apps/desktop/src/first-run.ts` | JSON provision; no sync register required |
| `apps/desktop/src/paths.ts` | No `offline.db`; online messaging |
| `apps/desktop/src/readiness.ts` | No better-sqlite3 check |
| `apps/desktop/src/constants.ts` | Remove offline/sync IPC channel names |
| `apps/desktop/src/config-store.ts` | **Added** â€” JSON device/config store |
| `apps/desktop/preload.cjs` | Expose online-only IPC surface |
| `apps/desktop/renderer/app.js` / `index.html` | Remove simulate-offline / Offline POS / SQLite UI; connection pill |
| `apps/desktop/scripts/prepare-check.cjs` | Drop sqlite native check |
| `apps/desktop/package.json` | Drop better-sqlite3 asarUnpack / offline wording |
| `apps/desktop/README.md` | Document online-only shell |
| `api/handler.cjs` | Regenerated â€” no sync router |
| `scripts/link-workspaces.cjs` | No offline/sync stubs (per Step 11) |

Schema migrations under `supabase/migrations/` were **not** dropped for sync tables (Class D retention).

---

# 8. POS Functionality Verification

From Step 15 (business persistence = Supabase via API). Status vocabulary: **PASS** / **PARTIAL** / **FAIL**.

| # | Workflow | Status | Notes |
|---|----------|--------|-------|
| 1 | Login | **PASS** | Supabase Auth + profiles |
| 2 | Product search | **PASS** | `GET /api/v1/pos/products/search` |
| 3 | Category filtering | **PASS** | Catalog API |
| 4 | Product selection | **PASS** | Online search â†’ session cart |
| 5 | Add to cart | **PASS** | In-memory until hold/sale (by design) |
| 6 | Quantity change | **PASS** | Session |
| 7 | Unit selection | **PARTIAL** | Online path; multi-unit conversion UI incomplete |
| 8 | Price selection | **PASS** | Online prices â†’ sale post |
| 9 | Discount | **PASS** | Domain + `sale_discount_audits` on post |
| 10 | Tax | **PASS** | Tax rates API + session â†’ sale |
| 11 | Customer selection | **PASS** | parties API |
| 12 | New customer | **PASS** | `POST /parties/customers` |
| 13 | Payment | **PASS** | Inside `POST /pos/sales` |
| 14 | Split payment | **PASS** | Same sale path |
| 15 | Credit | **PASS** | Ledger / credit |
| 16 | Installment | **PASS** | Plans / schedule on sale |
| 17 | Hold sale | **PASS** | `held_sales` |
| 18 | Resume sale | **PASS** | Hold resume â†’ session |
| 19 | Complete sale | **PASS** | `SaleTransactionService` â†’ Supabase |
| 20 | Stock update | **PASS** | Movements / balances |
| 21 | Customer ledger | **PASS** | `party_ledger_entries` |
| 22 | Invoice | **PASS** | Invoice endpoint |
| 23 | Sales history | **PASS** | List sales |
| 24 | Sales management | **PASS** | Management + export |
| 25 | Return | **PASS** | `POST /pos/returns` |
| 26 | Exchange | **PARTIAL** | Online return path; UI uses UUID product field |
| 27 | Salesman | **PASS** | Employees / references |
| 28 | Commission | **PASS** | Accrue / pay / report |
| 29 | Delivery | **PASS** | deliveries API |
| 30 | Reports | **PASS** | `/api/v1/reports/*` |

**Automated:** foundation + domain POS tests **PASS**.
**Live `smoke:online`:** not run in conversion environment (API not always up) â€” architecture verified in code; manual E2E recommended with live API + Supabase.

**No FAIL** attributed to offline/SQLite fallback (there is none).

---

# 9. Supabase Verification

From Step 18 (architecture + live health probe):

| Operation area | Verified how | Result |
|----------------|--------------|--------|
| Supabase client init | `GET /health`, `GET /health/supabase` against `*.supabase.co` | **OK** |
| URL + anon/publishable configured | Health payload | **OK** |
| Service role locally | `hasServiceRole: false` | Documented gap |
| Auth (login / session / logout / reset) | Code path â†’ Supabase Auth | Wired |
| Permissions RPC | `get_user_permission_keys` via UserRepository | Wired |
| Branch memberships | Table select under JWT | Wired |
| Product / catalog queries | PosRepository / CatalogRepository `.from` | Wired |
| Customer CRUD / ledger | PartiesRepository | Wired |
| Sales / items / holds / returns | PosRepository + SaleTransactionService | Wired |
| Payments / installments | Parties ports on sale | Wired |
| Stock movements / balances | InventoryRepository | Wired |
| Commission / salesman | Pos / Enterprise repos | Wired |
| Soft deletes | Catalog `deleted_at` pattern | Wired |
| RLS | ~141 ENABLE RLS / ~154 policies in migrations | Present |
| Error handling | Repo throw â†’ Express errorHandler; UI connection-required | Wired |
| Authenticated cashier sale E2E under RLS | Not executed in Step 18 environment | Follow-up |
| Schema redesign | None | N/A |

---

# 10. Remaining Offline References

Allowed leftovers only (Step 19). **No active execution path.**

| Reference | Why it remains |
|-----------|----------------|
| `navigator.onLine` + online/offline listeners | Harmless connectivity gate for online API |
| `online-required.ts` / connection badges | UX when network unavailable â€” no local save |
| Columns / Zod: `offline_transaction_id`, `sync_state` | Shared Supabase schema; online sets `synced` |
| Authz keys `sync.manage`, `sync.push`, `sync.pull`, `sync.resolve` | RBAC strings; sync API gone |
| `supabase/migrations/20260810000010_offline_sync_engine.sql` | Class D â€” historical tables; no DROP |
| `migrations.test.ts` offline sync migration assertion | Documents applied schema history |
| Comments in `sale-transaction.ts`, `config-store.ts`, `paths.ts` | Document removal / online-only |
| Desktop README / STEP / audit docs | Documentation for conversion & history |
| `api/handler.cjs` MIME `application/vnd.sqlite3` | Unrelated mime database entry |
| Pre-conversion docs (`CURRENT-POS-SYSTEM-AUDIT.md`, `docs/PHASE10_OFFLINE_SYNC.md`, â€¦) | Historical narrative â€” not runtime |

---

# 11. Errors Found

| Gate | Before conversion (dual-mode era) | After conversion (Step 17) |
|------|-----------------------------------|----------------------------|
| `npm run typecheck` | Dual packages online+offline (historically green when deps present) | **PASS** (exit 0) |
| `npm run lint` | Aliases to typecheck | **PASS** (exit 0) |
| `npm run build` | Included offline/sync package builds | **PASS** â€” packages + api + web |
| Desktop typecheck / build | Required better-sqlite3 | **PASS** without SQLite |
| TypeScript suppressions for conversion | â€” | **None** (`@ts-ignore` / config weakenings not used) |

**Conversion-phase TypeScript/build errors:** none remaining after Steps 4â€“16; Step 17 required **no code fixes**.

**Stale artifacts found and cleared during conversion:**

- Vercel `api/handler.cjs` still mounting sync (Step 7 / 16 rebuild)
- Extraneous `better-sqlite3` in `node_modules` (Step 11 uninstall)
- Orphan `packages/contracts/src/sync.{js,d.ts}` (Step 19 delete)

---

# 12. Risks

| ID | Risk | Severity | Mitigation / follow-up |
|----|------|----------|------------------------|
| R1 | Local `.env` missing `SUPABASE_SERVICE_ROLE_KEY` | Medium (local only) | Set for staging/prod; production config asserts key |
| R2 | Anon key length in local env may be truncated | Low | Confirm full Supabase anon/publishable key |
| R3 | Full authenticated POS sale E2E under RLS not run in conversion env | Medium | Run `smoke:online` + manual cashier flow against live project |
| R4 | Multi-unit conversion UI incomplete | Low (UX) | Online catalog work â€” not offline |
| R5 | Exchange product picker is UUID-based | Low (UX) | Improve picker; path already online |
| R6 | Sync_* Supabase tables unused but still in schema | Info | Keep until explicit Class D migration DROP decision |
| R7 | Historical docs still describe OfflinePosEngine | Info | Treat STEP reports / this file as current; update audits when convenient |
| R8 | Accidental emit of `.js`/`.d.ts` under `packages/contracts/src` | Low | Prefer `dist/` as package entry; rebuild contracts; avoid compiling into `src/` |
| R9 | Cashiers may expect offline sales after outage | Product | Connection Required UX is intentional; no silent local success |

---

# 13. Future Offline Reintroduction Notes

**DO NOT implement offline now.** Guidance only for a future phase.

### Architectural boundary (required)

1. **Keep Supabase/PostgreSQL as the cloud source of truth.** Online path must remain:
   ```
   React â†’ API â†’ domain â†’ packages/db â†’ Supabase â†’ PostgreSQL
   ```
2. **Do not dual-write business rules.** Cart math, discounts, tax, payments, holds, returns, commission stay in `packages/domain`. A future offline engine must call the **same** domain services (or shared pure functions), not reimplement totals in React or SQLite adapters.
3. **Introduce offline as a new adapter package**, e.g. `@electronic-erp/offline` again, behind an explicit **port/adapter** boundary:
   - Online adapter: existing `PosRepository` / HTTP API
   - Offline adapter: local projection + outbox **only**
   Application code selects adapter via a single composition root (desktop main / feature flag) â€” **never** scatter `if (offline)` inside sale UI business logic.
4. **Outbox + idempotency** must target the existing online API (`/api/v1/pos`, parties, inventory) or a dedicated sync API that **applies through the same domain services** used online â€” avoid a second sale writer.
5. **Reuse schema columns** already retained (`offline_transaction_id`, `sync_state`, device/operation ids) and existing Class D `sync_*` tables if still present â€” prefer extending them over inventing parallel cloud models.
6. **Desktop-only SQLite (or OPFS) is fine for local projection**; the **browser web app should not** become a second offline POS DB unless product explicitly requires it.
7. **Protect online path:** never make SQLite the production source of truth when online; never fake payment/stock success locally without durable outbox + successful cloud apply semantics.
8. **UI:** offline mode must be explicit (â€œOffline mode â€” queuedâ€) and distinct from todayâ€™s â€œConnection Requiredâ€ (online-only blocked) messaging.

### Suggested layering (future)

```
POS UI / hooks
  â†’ domain (shared)
  â†’ Port: PosWritePort / CatalogReadPort / â€¦
       â”œâ”€ OnlinePosAdapter â†’ HTTP API â†’ PosRepository â†’ Supabase
       â””â”€ OfflinePosAdapter â†’ LocalDatabase + Outbox â†’ (later) SyncTransport â†’ Online API
```

### Explicit non-goals for reintroduction

- Do not bypass `SaleTransactionService` with raw SQLite inserts of finalized sales as the only writer.
- Do not resurrect Sync Center UI until transport + conflict policy are redesigned against the online-only baseline.
- Do not put `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

---

## Summary

| Question | Answer |
|----------|--------|
| Offline SQLite / sync runtime gone? | **Yes** |
| Online POS â†’ Supabase intact? | **Yes** |
| Typecheck / lint / build? | **PASS** |
| Remaining offline keywords? | Docs, schema fields, connectivity UX only |
| Ready for future offline? | Documented boundary only â€” **not implemented** |
