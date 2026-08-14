# STEP 15 â€” Verify every POS workflow (online / Supabase)

## Goal

After online-only conversion, verify each listed POS workflow uses **Supabase** (via API) for business data â€” not SQLite, offline queue, or a fake local DB.

## Infrastructure check

| Check | Result |
|-------|--------|
| `packages/offline` | Absent |
| `packages/sync` | Absent |
| `better-sqlite3` | Absent |
| Live path | UI â†’ `*Api` â†’ `/api/v1/*` â†’ repository / domain â†’ Supabase |

## Automated gates (this step)

| Suite | Result |
|-------|--------|
| `npm run test:foundation` (contracts + domain + api + web) | **PASS** |
| Domain POS suite (80 tests: cart, payment, hold, return, commission, tax, discount, sale txn, â€¦) | **PASS** |
| Web POS session tests | **PASS** |
| `npm run smoke:online` | **SKIPPED locally** â€” API not running on `127.0.0.1:4000` (needs live API + env) |

## Workflow verification matrix

| # | Workflow | Persistence | Verdict | Notes |
|---|----------|-------------|---------|-------|
| 1 | Login | Supabase Auth + profiles/permissions | **SUPABASE_OK** | `auth-service` / `/api/v1/auth` |
| 2 | Product search | `PosRepository.searchProducts` | **SUPABASE_OK** | `GET /api/v1/pos/products/search` |
| 3 | Category filtering | Catalog taxonomy + products | **SUPABASE_OK** | `/api/v1/catalog/*` |
| 4 | Product selection | Catalog via search; cart session | **SESSION â†’ SUPABASE** | Selection uses online search; cart until hold/sale |
| 5 | Add to cart | In-memory session | **SESSION_OK** | Persists on hold/sale to Supabase |
| 6 | Quantity change | In-memory session | **SESSION_OK** | Same |
| 7 | Unit selection | Session; base unit from search | **SESSION_OK** * | Multi-unit conversions not loaded from catalog (UX gap, still online) |
| 8 | Price selection | Prices from online search + session level | **SESSION â†’ SUPABASE** | Written on `postSale` |
| 9 | Discount | Domain preview â†’ sale post | **SESSION â†’ SUPABASE** | `sale_discount_audits` on post |
| 10 | Tax | `tax_rates` online + session apply | **SESSION â†’ SUPABASE** | Rates from `/api/v1/tax/rates` |
| 11 | Customer selection | `partiesApi` | **SUPABASE_OK** | `customers` |
| 12 | New customer | `POST /parties/customers` | **SUPABASE_OK** | |
| 13 | Payment | Inside `POST /pos/sales` | **SUPABASE_OK** | `payments` |
| 14 | Split payment | Same sale path | **SUPABASE_OK** | Multiple payment rows |
| 15 | Credit | Remaining on sale + parties credit | **SUPABASE_OK** | Ledger / credit tables |
| 16 | Installment | Sale + installment plans | **SUPABASE_OK** | `installment_plans` / schedule |
| 17 | Hold sale | `POST /pos/holds` | **SUPABASE_OK** | `held_sales` + cart snapshot |
| 18 | Resume sale | `POST /pos/holds/:id/resume` | **SUPABASE_OK** | Then session until re-hold/sale |
| 19 | Complete sale | `SaleTransactionService` â†’ Supabase | **SUPABASE_OK** | Sales, items, stock, ledger, â€¦ |
| 20 | Stock update | Sale/return movements | **SUPABASE_OK** | `stock_movements` / `stock_balances` |
| 21 | Customer ledger | `GET â€¦/customers/:id/ledger` | **SUPABASE_OK** | `party_ledger_entries` |
| 22 | Invoice | `GET â€¦/sales/:id/invoice` | **SUPABASE_OK** | |
| 23 | Sales history | `GET /pos/sales` | **SUPABASE_OK** | |
| 24 | Sales management | `/pos/sales/management` | **SUPABASE_OK** | |
| 25 | Return | `POST /pos/returns` | **SUPABASE_OK** | |
| 26 | Exchange | Same return path, disposition exchange | **SUPABASE_OK** | UI uses product UUID field |
| 27 | Salesman | `/hr/employees` + references | **SUPABASE_OK** | |
| 28 | Commission | Accrue on sale; pay/report APIs | **SUPABASE_OK** | `sale_commissions` |
| 29 | Delivery | `purchasesApi.createDelivery` | **SUPABASE_OK** | `deliveries` (+ status pages) |
| 30 | Reports | `/api/v1/reports/*` | **SUPABASE_OK** | Reporting aggregates |

\* Unit conversions: online architecture only; product multi-unit picker is incomplete â€” **not** an offline fallback.

## Session vs Supabase (by design)

Cart mutations (#4â€“10 preview) live in React/`usePosSession` until:

- **Hold** â†’ `held_sales.cart_snapshot` in Supabase, or
- **Complete sale** â†’ `sales` / `sale_items` / payments / stock in Supabase

This is **not** SQLite and **not** an offline queue.

## Manual live E2E (recommended when API + Supabase env are up)

```bash
npm run dev:api
npm run dev:web
# or: npm run smoke:online  (with SMOKE_API_URL / SMOKE_WEB_URL)
```

Walk #1â€“30 against a real project: login â†’ search â†’ cart â†’ pay â†’ hold/resume â†’ return/exchange â†’ salesman/commission â†’ delivery â†’ reports.

## Final verdict

**PASS for conversion goal:** Every POS workflowâ€™s **business persistence** uses Supabase via the online API. There is no SQLite / offline repository path.

**Caveats (online UX, not offline):** multi-unit conversion UI incomplete; exchange product picker is UUID-based; full browser E2E against live Supabase requires a running API and configured env (smoke was not runnable in this environment).
