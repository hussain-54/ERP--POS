# STEP 20 â€” Final online architecture check

## Goal

Confirm the active application architecture is online-only:

```
React
  â†’ Tailwind UI
  â†’ POS Components
  â†’ Hooks / State
  â†’ Domain / Business Services
  â†’ Supabase Repository / Services
  â†’ Supabase
  â†’ PostgreSQL
```

And that **none** of these are active for application functionality:

```
React â†’ SQLite
React â†’ Offline Repository
React â†’ Sync Queue â†’ SQLite
```

## Confirmed architecture (sale write â€” canonical)

```
PosPage (React)
  â†’ POS design-system / panels (Tailwind utility classes + CSS vars)
  â†’ usePosSession + PaymentAttemptGate / preparePosPayments (@electronic-erp/domain)
  â†’ posApi.postSale  (apps/web â€¦/pos-api.ts)
  â†’ POST /api/v1/pos/sales  (Express, apps/api â€¦/routes/pos.ts)
  â†’ PosRepository(createUserClient(JWT))  (@electronic-erp/db)
  â†’ SaleTransactionService  (@electronic-erp/domain)
  â†’ Supabase client (.from / ports)
  â†’ Supabase API
  â†’ PostgreSQL
```

Evidence:

| Layer | Live artifact |
|-------|----------------|
| React | `apps/web/src/features/pos/PosPage.tsx` |
| Tailwind UI | `apps/web/tailwind.config.js`; POS `design-system/*` and panels use Tailwind `className`s |
| POS components | `PosProductPanel`, `PosPaymentPanel`, `PosCustomerPanel`, `PosHoldsPanel`, â€¦ |
| Hooks / state | `usePosSession`; cart/hold UI state until checkout |
| Domain (client) | `preparePosPayments`, `PaymentAttemptGate`, totals / pricing helpers from `@electronic-erp/domain` |
| Domain (server write) | `SaleTransactionService.postSale` via `PosRepository.postSale` |
| Repository | `packages/db` `PosRepository` + JWT `createUserClient` |
| Cloud DB | Supabase â†’ PostgreSQL |

Thin web boundary: `session/pos-repository.ts` re-exports `posApi` as `posClientRepository` and documents **no direct Supabase from components**.

### Layer note (intentional)

Business persistence does **not** go React â†’ `packages/db` in the browser. The Express API is the online gateway that constructs `PosRepository` with the user JWT. That matches online-only security (RLS + authz) and is the correct expansion of â€œSupabase Repository/Servicesâ€ for this monorepo.

Browser Supabase (`auth-service` / `getSupabase`) is used for **auth session**, not POS sales writes.

## Forbidden paths â€” status

| Forbidden path | Status |
|----------------|--------|
| React â†’ SQLite | **Absent** â€” no `better-sqlite3` / sqlite open in web; desktop `db/bootstrap.ts` **not on disk** |
| React â†’ Offline Repository | **Absent** â€” `packages/offline` gone; web `features/sync` gone; no offline client repo |
| React â†’ Sync Queue â†’ SQLite | **Absent** â€” `packages/sync`, sync API route, `SyncRepository`, outbox engine all gone |

Disk checks (authoritative; IDE index may still ghost deleted files):

| Path | On disk? |
|------|----------|
| `packages/offline` | No |
| `packages/sync` | No |
| `apps/web/src/features/sync` | No |
| `apps/api/src/routes/sync.ts` | No |
| `packages/db/.../sync-repository.ts` | No |
| `apps/desktop/src/db/bootstrap.ts` | No |

## Other POS operations (same spine)

| Operation | Client | API | Persistence |
|-----------|--------|-----|-------------|
| Product search | `posApi.searchProducts` | `GET /api/v1/pos/products/search` | Supabase catalog/stock |
| Customers | `posCustomerRepository` â†’ `partiesApi` | `/api/v1/parties/*` | `customers`, ledger |
| Holds | `posApi.hold` / resume / â€¦ | `/api/v1/pos/holds*` | `held_sales` |
| Returns | `posApi.postReturn` | `/api/v1/pos/returns` | returns + stock |
| Invoices / management | `posApi.listSales` / management | `/api/v1/pos/sales*` | `sales` |
| Shifts | `posApi.openShift` / close | `/api/v1/pos/shifts*` | shift tables |

Cart remains **in-memory** until hold or sale â€” not a local business database.

## Not alternate architectures

| Item | Role |
|------|------|
| `navigator.onLine` / connection banner | Blocks API use when disconnected â€” no SQLite writer |
| Desktop `config-store.ts` JSON | Device/config only â€” not POS ledger |
| Columns `offline_transaction_id` / `sync_state` | Schema fields on online rows; not an offline repository |
| Authz keys `sync.*` | RBAC strings; no sync runtime |
| Historical docs / STEP reports | Documentation only |

## Verdict

**PASS** â€” Final active architecture is online-only:

**React â†’ Tailwind UI â†’ POS Components â†’ Hooks/State â†’ Domain â†’ API â†’ Supabase repositories â†’ Supabase â†’ PostgreSQL.**

There is **no** active React â†’ SQLite, React â†’ Offline Repository, or React â†’ Sync Queue â†’ SQLite path for application functionality.
