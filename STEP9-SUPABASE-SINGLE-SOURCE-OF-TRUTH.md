# STEP 9 â€” Supabase as single source of truth

## Goal

For every major POS operation, verify the live path is:

```
UI â†’ client API â†’ Express route â†’ repository / domain â†’ Supabase (PostgreSQL)
```

Requirements:

- No SQLite fallback
- No offline repository fallback
- No fake local database for business data

## Infrastructure check

| Artifact | On disk? | Wired into POS? |
|----------|----------|-----------------|
| `packages/offline` | **No** | N/A |
| `packages/sync` | **No** | N/A |
| `apps/web/src/features/sync` | **No** | N/A |
| `apps/api/src/routes/sync.ts` | **No** | N/A |
| `apps/desktop/src/db` | **Removed** (empty leftover dir) | N/A |
| `better-sqlite3` / `LocalDatabase` / `OfflinePos` imports in web/api/desktop/db/domain | **None** | â€” |

## Operation verification matrix

| Operation | Path | Persistence | Verdict |
|-----------|------|-------------|---------|
| Product search | `posApi.searchProducts` â†’ `GET /api/v1/pos/products/search` â†’ `PosRepository.searchProducts` | `products`, barcodes, brands, categories, `stock_balances`, â€¦ | **ONLINE_OK** |
| Product details | Same search enrichment (online) | Same | **ONLINE_OK** |
| Categories | `catalogApi.listTaxonomy` / `listProducts` â†’ `/api/v1/catalog/*` â†’ `CatalogRepository` | `categories`, `products` | **ONLINE_OK** |
| Brands | Via POS search taxonomy joins | `brands` | **ONLINE_OK** |
| Inventory / Stock | Search stock + `inventoryApi.listWarehouses`; sale stock via `postMovement` | `stock_balances`, `warehouses`, stock movements | **ONLINE_OK** |
| Customers | `posCustomerRepository` â†’ `partiesApi` â†’ `/api/v1/parties/customers` | `customers` | **ONLINE_OK** |
| Customer history | `partiesApi.customerLedger` | `party_ledger_entries` | **ONLINE_OK** |
| Pricing | Prices from online search / catalog; client `pickPriceLevel` | Product price columns / price lists | **ONLINE_OK** |
| Discounts | Applied in session; persisted on `posApi.postSale` | `sales`, `sale_items`, `sale_discount_audits` | **ONLINE_OK** |
| Tax | `enterpriseApi.listTaxRates` â†’ applied in session â†’ sale totals | `tax_rates` + sale tax fields | **ONLINE_OK** |
| Cart | `usePosSession` React state until hold/sale | **In-memory session** (by design); holds â†’ Supabase | **SESSION_OK** |
| Sales / sale items | `posApi.postSale` â†’ `POST /api/v1/pos/sales` â†’ `SaleTransactionService` / `PosRepository` | `sales`, `sale_items`, stock, journal, â€¦ | **ONLINE_OK** |
| Payments | Inside `postSale` â†’ parties payment ports | `payments`, `payment_splits`, `payment_receipts` | **ONLINE_OK** |
| Installments | Inside `postSale` â†’ `createInstallmentPlan` | `installment_plans`, `installment_schedule` | **ONLINE_OK** |
| Customer ledger | Read via parties; write on sale/return | `party_ledger_entries` | **ONLINE_OK** |
| Holds | `posApi.hold` / list / resume / edit / â€¦ | `held_sales` (+ cart snapshot JSON) | **ONLINE_OK** |
| Returns | `posApi.postReturn` / list / report | `sale_returns`, `sale_return_items`, stock, ledger | **ONLINE_OK** |
| Exchanges | Same return path with exchange disposition / product | Returns + stock movements | **ONLINE_OK** |
| Salesman | `enterpriseApi` employees | `employees` | **ONLINE_OK** |
| References | `enterpriseApi` references | `sale_references` | **ONLINE_OK** |
| Commission | Accrued on sale; pay/report via enterprise API | `sale_commissions` | **ONLINE_OK** |
| Invoices | `posApi.listSales` / `getInvoice` / management | `sales`, items, payments | **ONLINE_OK** |
| Delivery | `purchasesApi.createDelivery` after sale | `deliveries` | **ONLINE_OK** |
| Reports | `posApi` management + `reportingApi.sales` + return/commission reports | Supabase reporting / sales tables | **ONLINE_OK** |
| Audit logs | Written on sale/return finalize; viewed via admin audit | `audit_logs`, `sale_discount_audits` | **ONLINE_OK** |

## Intentionally not a business database

| Item | Role |
|------|------|
| Cart (`usePosSession`) | Ephemeral UI session until hold/checkout |
| Favorites / recent product IDs in `localStorage` | UX cache only; search/sale still online |
| Auth tokens / branch id in `localStorage` | Session credentials, not ERP data |
| Desktop config JSON | Device identity for Electron shell |
| Network `navigator.onLine` gate | Blocks API use when disconnected â€” no offline writer |

## Hygiene applied in this step

| Change | Why |
|--------|-----|
| Removed empty `apps/desktop/src/db` | Leftover offline DB folder |
| Dropped `sqlite` / `sync` from API `LogCategory` | Categories implied offline subsystems |

## Schema remnants (not fallbacks)

Optional fields `offline_transaction_id` / `sync_state` may still be written as `null` / `synced` on online posts. They are shared columns, **not** an alternate repository. Column DROPs remain Class D (future migration), not required for single-source runtime.

## Final verdict

**PASS** â€” Supabase via the online API is the single source of truth for all major POS business operations. There is no SQLite fallback, no offline repository fallback, and no fake local business database on the live sell path.
