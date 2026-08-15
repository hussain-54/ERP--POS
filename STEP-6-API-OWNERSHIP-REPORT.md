# STEP 6 — API ownership report

**Date:** 2026-08-16  
**Scope:** Documentation only. Grouped API routers were not split into 39. No endpoint, contract, RBAC, repository, or Supabase change.

Source of truth: `apps/api/src/module-api-ownership.ts` (loaded from `apps/api/src/app.ts`).

---

## Rule

The 39 ERP modules are a **product** architecture. The API stays **grouped**.

Do not create 39 Express routers. Do not rename URLs. Do not copy shared web clients into 39 feature clients.

---

## Grouped API mounts

| API group | Mount | Product modules |
|-----------|--------|-----------------|
| catalog | `/api/v1/catalog` | 02 Product Management, 03 Barcode & QR, 32 Import (catalog templates) |
| inventory | `/api/v1/inventory` | 10 Inventory, 11 Warehouses (masters) |
| parties | `/api/v1/parties` | 12 Customers, 13 Suppliers, 22 Installments, 05 Sales payments |
| pos | `/api/v1/pos` | 05 POS / Sales |
| purchases | `/api/v1/purchases` | 09 Purchases, **08 Delivery**, 11 locations/transfers, 13 supplier prices |
| after-sales | `/api/v1/after-sales` | 06 Quotations, 07 Orders, 14 Service, 15 Warranty |
| accounting | `/api/v1/accounting` | 16 Accounts, 17 Banking, 21 Expenses (reports also feed 19) |
| admin | `/api/v1/admin` | 25 Approvals, 26 Users, 27 Permissions, 28 Audit, 30 Branches, 01 dashboard group |
| hardware | `/api/v1/hardware` | 33 Printing, 35 Devices |
| reports | `/api/v1/reports` | 01 Dashboard, 19 Reports |
| commerce | `/api/v1` (`/crm`, `/loyalty`, `/b2b`, `/store`) | 18 CRM, 23 Loyalty, 07 B2B, 39 Store |
| ai | `/api/v1/ai` | 04 AI Camera, 19 AI Insights |
| enterprise | `/api/v1` (`/hr`, `/references`, `/commissions`, `/tax`, `/documents`, `/notifications`) | 20 Salesmen, 24 Documents, 29 Notifications, 31 Tax, 39 HR |
| infrastructure | `/api/v1` (`/security`, `/backup`, `/integrations`, `/data`) | 32 Import/Export, 34 Backup, 39 Security/Integrations |
| auth | `/api/v1/auth` | Outside the 39 (login / session) |
| health | `/health` | Outside the 39 (probes) |

36 Industry, 37 Customization, 38 Automation: **no API**. Coming Soon.

---

## Module → API (39)

| ID | Module | API group | Canonical mounts |
|----|--------|-----------|------------------|
| 01 | Dashboard | reports, admin | `/api/v1/reports`, `/api/v1/admin/dashboard` |
| 02 | Product Management | catalog | `/api/v1/catalog` |
| 03 | Barcode & QR | catalog | `/api/v1/catalog/barcodes`, `/api/v1/catalog/qr` |
| 04 | AI Camera | ai | `/api/v1/ai/recognize-product` |
| 05 | POS / Sales | pos, parties | `/api/v1/pos`, `/api/v1/parties/payments` |
| 06 | Quotations | after-sales | `/api/v1/after-sales/quotations` |
| 07 | Orders | after-sales, commerce | `/api/v1/after-sales/orders`, `/api/v1/b2b` |
| 08 | Delivery | **purchases** | `/api/v1/purchases/deliveries` |
| 09 | Purchases | purchases | `/api/v1/purchases/invoices`, `/api/v1/purchases/returns` |
| 10 | Inventory | inventory | `/api/v1/inventory` |
| 11 | Warehouses | inventory, purchases | `/api/v1/inventory/warehouses`, `/api/v1/purchases/locations`, `/api/v1/purchases/transfers` |
| 12 | Customers | parties | `/api/v1/parties/customers`, `/api/v1/parties/credit` |
| 13 | Suppliers | parties, purchases | `/api/v1/parties/suppliers`, `/api/v1/purchases/supplier-prices` |
| 14 | Service | after-sales | `/api/v1/after-sales/service-jobs` |
| 15 | Warranty | after-sales | `/api/v1/after-sales/warranties`, `/warranty-claims` |
| 16 | Accounts | accounting | `/api/v1/accounting/accounts`, `/journals`, `/vouchers`, `/reports` |
| 17 | Banking | accounting | `/api/v1/accounting/bank-accounts`, `/bank-statements`, `/reconciliations` |
| 18 | CRM | commerce | `/api/v1/crm` |
| 19 | Reports | reports, ai, accounting | `/api/v1/reports`, `/api/v1/ai/insights`, `/api/v1/accounting/reports` |
| 20 | Salesmen | enterprise | `/api/v1/hr`, `/references`, `/commissions` |
| 21 | Expenses | accounting | `/api/v1/accounting/expenses` |
| 22 | Installments | parties | `/api/v1/parties/installments` |
| 23 | Loyalty | commerce | `/api/v1/loyalty` |
| 24 | Documents | enterprise | `/api/v1/documents` |
| 25 | Approvals | admin | `/api/v1/admin/approvals` |
| 26 | Users | admin | `/api/v1/admin/users`, `/roles` |
| 27 | Permissions | admin | `/api/v1/admin/permissions` |
| 28 | Audit | admin | `/api/v1/admin/audit` |
| 29 | Notifications | enterprise | `/api/v1/notifications` |
| 30 | Branches | admin | `/api/v1/admin/branches` |
| 31 | Tax | enterprise | `/api/v1/tax` |
| 32 | Import / Export | infrastructure, catalog | `/api/v1/data/import`, `/api/v1/data/export`, `/api/v1/catalog/import` |
| 33 | Printing | hardware | `/api/v1/hardware/print`, `/print-jobs` |
| 34 | Backup | infrastructure | `/api/v1/backup` |
| 35 | Devices | hardware | `/api/v1/hardware/events`, `/cash-drawer` |
| 36 | Industry | none | Coming Soon |
| 37 | Customization | none | Coming Soon |
| 38 | Automation | none | Coming Soon |
| 39 | System | infrastructure, commerce, enterprise | `/api/v1/security`, `/integrations`, `/store`, `/hr` |

---

## Genuine ownership ambiguities

These are **shared grouped APIs**, not bugs. Do not split them in this pass.

1. **08 Delivery** — implemented on `purchases.ts` (`/api/v1/purchases/deliveries`). Domain is `delivery-lifecycle.ts`. Keep here.
2. **11 Warehouses** — warehouse masters on `inventory.ts`; racks/shelves/bins and transfers on `purchases.ts`.
3. **13 Supplier price lists** — supplier master on `parties.ts`; prices on `purchases.ts`. UI reuses PurchasesPage.
4. **05 Payments** — tender posting is `/api/v1/parties/payments`, not `pos.ts`. POS sales stay on `/api/v1/pos`.
5. **07 Orders** — sales orders on `after-sales.ts`; B2B portal on `commerce.ts` `/b2b`.
6. **20 / 39 HR** — one `/api/v1/hr` on `enterprise.ts` for Salesmen and System HR.
7. **16 / 19 finance reports** — `accounting/reports`, `reports.ts`, and `/ai/insights` all feed reporting UIs. Accounts P&L may use ReportsHubPage.
8. **32 Import / Export** — catalog templates on `catalog.ts`; generic CSV import/export on `infrastructure.ts` `/data/*`.

No other genuine router-ownership bugs were found. Auth and health are intentionally outside the 39.

---

## Shared web API clients (do not duplicate)

| Client | Folder | Modules served |
|--------|--------|----------------|
| `parties-api` | `features/customers` | 05, 12, 13, 22 |
| `after-sales-api` | `features/quotations` | 06, 07, 14, 15 |
| `admin-api` | `features/users` | 01, 25, 26, 27, 28, 30 |
| `commerce-api` | `features/crm` | 07 B2B, 18, 23, 39 store |
| `enterprise-api` | `features/system` | 20, 24, 29, 31, 39 HR |
| `infrastructure-api` | `features/system` | 32, 34, 39 security/integrations |

---

## What this step did **not** change

- API paths and contracts
- Authentication / RBAC
- Supabase access
- Database repositories
- Business logic
- Number of Express routers (still the grouped set plus auth/health)
