# PHASE 2 — MODULE ALIGNMENT REPORT

**Date:** 2026-08-15  
**Scope:** Navigation / module registry only. No POS, pricing, inventory, payment, sales, or Supabase logic changes.  
**Runtime:** Online-only. Offline POS / Sync / SQLite were not present in active navigation and were not added.

---

## Changed files

| File | Change |
|------|--------|
| `apps/web/src/app/modules.ts` | 39-module tree (`ERP_NAV_SECTIONS`) + flat `ERP_MODULES` for the router |
| `apps/web/src/app/shell/AppShell.tsx` | Hierarchical sidebar + breadcrumbs from the 39-module tree |
| `apps/web/src/app/shell/SidebarNav.tsx` | **New.** Collapsible parent/child nav, icons, search, active highlighting |
| `apps/web/src/app/shell/nav-icons.tsx` | **New.** Consistent inline SVG icons (no new dependency) |
| `apps/web/src/app/router.tsx` | Wired existing pages to alias paths; registered `StockOpsPage` at `/stock-ops` |
| `apps/web/src/features/modules/ModulePlaceholderPage.tsx` | “Coming Soon” / “Module not yet implemented” (no fake data) |
| `apps/web/src/features/catalog/TaxonomyPage.tsx` | Reads path to open the matching existing tab (Categories / Brands / …) |
| `apps/web/src/features/pos/design-system/POSSidebar.tsx` | POS children grouping only (labels/links). No POS business logic |
| `apps/web/src/app/smoke.test.tsx` | Asserts 39 sections, `/orders`, no offline/sync titles |

No API, domain, database, or page-layout redesign files were changed.

---

## Navigation changes

The sidebar is no longer a flat list of 58 siblings.

- **39 collapsible parent modules** (01–39), matching the master list
- Children indented under the parent
- Filter search still works (matches parent or child, expands hits)
- Active route highlighting on the child; parent stays highlighted while a child is open
- Mobile drawer preserved
- Command palette uses the same registry
- Profile still opens `/settings` (placeholder)

Settings / security / integrations / store / mobile / HR are grouped under **System Administration**. They are no longer scattered as top-level items.

POS remains a dedicated major module. ERP sidebar POS children:

- New Sale, Hold / Resume, Invoices, Returns, Exchange, Payments, Discounts, Sales Register

POS terminal chrome (`POSSidebar`) uses the same operational grouping. Cashiers still reach the rest of the ERP via **ERP Home**.

---

## Routes moved (URLs preserved)

Existing URLs were **not renamed**. They were **re-parented in navigation**:

| URL | Previous nav group | Now under |
|-----|--------------------|-----------|
| `/products`, `/units`, `/categories`, `/pricing` | Catalog (flat) | 02 Product Management |
| `/barcodes` | Catalog | 03 Barcode & QR |
| `/ai-camera` | Catalog | 04 AI Camera Product Recognition |
| `/pos`, `/held-sales`, `/invoices`, `/returns`, `/payments`, `/discounts`, `/sales-management` | Sales (flat) | 05 POS / Sales |
| `/quotations` | Sales | 06 Quotations |
| `/b2b` | Channels | 07 Orders |
| `/deliveries` | Sales | 08 Delivery |
| `/purchases`, `/purchase-returns`, `/purchase-automation` | Purchasing | 09 Purchases |
| `/inventory`, `/batches-serials` | Inventory | 10 Inventory |
| `/warehouses`, `/stock-transfers` | Inventory | 11 Warehouses |
| `/customers`, `/credit` | Parties / Sales | 12 Customers |
| `/suppliers` | Purchasing | 13 Suppliers |
| `/service` | Service | 14 Service & Repair |
| `/warranty` | Service | 15 Warranty |
| `/accounts` | Finance | 16 Accounts |
| `/banking` | Finance | 17 Banking |
| `/crm` | Growth | 18 CRM & Marketing |
| `/reports`, `/bi`, `/ai-insights` | Insights | 19 Reports & Analytics |
| `/salesman` | Sales | 20 Salesman / Field Sales |
| `/expenses` | Finance | 21 Expenses |
| `/installments` | Sales | 22 Installments |
| `/loyalty` | Growth | 23 Loyalty |
| `/documents` | Governance | 24 Documents |
| `/approvals` | Governance | 25 Approval Workflow |
| `/users` | Admin | 26 Users & Role Management |
| `/permissions` | Admin | 27 Permissions |
| `/audit` | Governance | 28 Audit Trail |
| `/notifications` | Governance | 29 Notification Center |
| `/branches` | Admin | 30 Multi-Branch |
| `/tax` | Compliance | 31 Tax & Pakistan Compliance |
| `/import-export` | Platform | 32 Import / Export |
| `/printing` | Platform | 33 Printing |
| `/backup` | Platform | 34 Backup & Disaster Recovery |
| `/devices` | Platform | 35 Devices / Printing |
| `/transaction-linking` | Platform | 38 Rules / Automation Engine |
| `/settings`, `/security`, `/integrations`, `/online-store`, `/mobile`, `/hr` | Admin / Channels / HR | 39 System Administration |

Auth routes (`/login`, `/auth/*`) unchanged.

Product form routes `/products/new` and `/products/:id` unchanged.

---

## New alias routes (same existing page)

These are extra addresses so a child can sit under the correct module **without merging or deleting screens**:

| New URL | Renders | Note |
|---------|---------|------|
| `/orders` | `QuotationsPage` | Orders already lived on the quotations screen |
| `/exchange` | `ReturnsPage` | Returns/exchange already combined |
| `/qr` | `BarcodesPage` | QR tools already on barcodes |
| `/subcategories`, `/brands`, `/companies` | `TaxonomyPage` | Opens the matching existing tab |
| `/stock-ops` | `StockOpsPage` | Previously **unrouted**; now Inventory → Stock Movement |
| `/inventory/serials`, `/inventory/expiry` | `BatchSerialPage` | Same traceability screen |
| `/inventory/adjustments`, `/inventory/damaged`, `/inventory/audit` | `StockOpsPage` | Same operations screen |
| `/warehouses/racks`, `/shelves`, `/bins` | `WarehousesPage` | Locations already on that page |
| `/customers/ledger`, `/customers/payment-history` | `CustomersPage` | Ledger/payments already on that page |
| `/suppliers/ledger` | `SuppliersPage` | Ledger already on that page |
| `/suppliers/price-lists` | `PurchasesPage` | Supplier prices already on purchases |
| `/service/*` children | `ServicePage` | Job/complaint/tech/repair/charges already on that page |
| `/warranty/replacements`, `/warranty/history` | `WarrantyPage` | Already on that page |
| `/crm/campaigns`, `/sms`, `/whatsapp`, `/marketing`, `/engagement` | `CrmPage` | Already on that page |
| `/accounts/journals` | `AccountsPage` | Already on that page |
| `/accounts/profit-loss` | `ReportsHubPage` | P&L already in reports |

---

## Placeholders added

Dedicated screens that do **not** exist. Each shows **Coming Soon** / **Module not yet implemented**. No fake data.

**New parent modules**

- `/industry-engine` — 36 Industry Engine
- `/customization-engine` — 37 Customization Engine
- `/rules-engine` — 38 Rules / Automation Engine

**Existing placeholders kept**

- `/discounts`
- `/purchase-automation`
- `/mobile`
- `/settings`
- `/transaction-linking`

**New child placeholders** (examples)

- Product: `/products/variants`, `/products/attributes`, `/products/media`, `/products/specifications` (available on product form)
- Warehouse: `/warehouses/receiving`, `/warehouses/dispatch`
- Customer: `/customers/receivables` (points to Reports)
- Supplier: `/suppliers/payables`, `/suppliers/performance`
- Accounts: `/accounts/cash`, `/accounts/receipts`
- System Administration: company, localization, currency, language, date/time, numbering, invoice templates, barcode settings, POS settings, email, SMS, storage, logs, maintenance

Where the function already exists on another screen, the placeholder includes **Open related screen**.

---

## Duplicates preserved

Nothing was deleted or merged.

| Pair | Status |
|------|--------|
| `/pos` + `/held-sales` | Same `PosPage` (Hold / Resume child) |
| `/credit` + `/installments` | Same `CreditInstallmentsPage` (Customers vs module 22) |
| `/quotations` + `/orders` | Same `QuotationsPage` |
| `/returns` + `/exchange` | Same `ReturnsPage` |
| `/barcodes` + `/qr` | Same `BarcodesPage` |
| `/categories` + `/subcategories` + `/brands` + `/companies` | Same `TaxonomyPage` |
| `/invoices` vs `/sales-management` | Both kept under POS |
| `/printing` vs `/devices` | Both kept (modules 33 and 35) |
| `/reports` vs `/bi` vs `/ai-insights` | All kept under Reports & Analytics |
| ERP sidebar vs POS sidebar | Dual chrome kept |

`StockOpsPage` is **not** a duplicate of `InventoryPage`; it was an orphan and is now routed.

---

## RBAC / online-only

- `ProtectedRoute` and `hasPermission` usage on pages were not changed
- Sidebar does not bypass authorization
- No SQLite, sync engine, offline POS, or offline fallback was added
- Active nav had no Offline POS / Sync Center / SQLite / Offline mode / Sync Queue items; none were introduced

---

## Errors found

1. Smoke test: `getByText(/Coming Soon/i)` matched both the badge and the empty-state heading.

## Errors fixed

1. Smoke test now uses `getAllByText` plus “Module not yet implemented”.

No product-code defects were found in typecheck/lint/test/build after that test fix.

---

## Validation results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | All 9 workspaces |
| `npm run lint` | **PASS** | Alias for typecheck |
| `npm test` | **PASS** | 271 tests (contracts 12, domain 222, api 32, web 5) |
| `npm run build` | **PASS** | Vite chunk-size warning only (unchanged class of warning) |

Manual route checks (by registry, not a running browser in this phase):

- Dashboard `/` → `DashboardPage`
- POS `/pos` → `PosPage`
- Product Management `/products` → `ProductsPage`
- Inventory `/inventory` → `InventoryPage`
- Customers `/customers` → `CustomersPage`
- Suppliers `/suppliers` → `SuppliersPage`
- Accounts `/accounts` → `AccountsPage`
- Settings `/settings` → placeholder (Coming Soon)
- Every previous `ERP_MODULES` path remains registered
- New alias/placeholder paths resolve (implemented page or Coming Soon)
- `/stock-ops` is no longer an orphan
- No blank implemented routes; placeholders are intentional Coming Soon states

---

## What must not be treated as done

This phase did **not**:

- Redesign individual business screens
- Split shared pages into real dedicated UIs (aliases only)
- Implement Industry / Customization / Rules engines
- Implement organization settings
- Change sale posting, stock math, payments, or the database
