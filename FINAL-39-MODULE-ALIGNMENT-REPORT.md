# FINAL 39-MODULE ALIGNMENT REPORT

**Date:** 2026-08-15  
**Scope:** Structural audit only. No new features, database changes, business logic, offline/sync, or POS redesign.  
**Runtime:** Online-only (Supabase). Browser `offline` listeners on POS/returns are connectivity guards, not a local database.

This audit classifies modules by **actual functionality**, not by the presence of a sidebar item.

**Status key**

| Status | Meaning |
|--------|---------|
| **IMPLEMENTED** | Real UI plus backend that performs the module’s core job |
| **PARTIAL** | Core path exists, but important screens are thin, JSON-only, UUID-paste, or still Coming Soon |
| **PLACEHOLDER** | Navigation/UI exists; functionality is Coming Soon |
| **MISSING** | No meaningful UI and no implementation |
| **DUPLICATED** | More than one URL (or leftover copy) performs the same function |
| **MISPLACED** | Functionality exists under the wrong module or folder |

A module may be **IMPLEMENTED** and still have **duplicated routes**. Duplication is listed in the matrix notes and in section 8. It is not treated as “not implemented.”

Navigation labels use the Phase 5 short names (`Products`, `Sales`, `System`). The matrix **Master Module** column keeps the official 39 names.

No structural defects from Phases 2–5 required a code fix. Leftover grouped folders (`parties`, `catalog`, `finance`, …) are **not** on disk in the live tree.

---

## 1. Final module tree

```
01 Dashboard
02 Products                    → Product Management
03 Barcodes                    → Barcode & QR
04 AI Camera                   → AI Camera Product Recognition
05 Sales                       → POS / Sales
     Hold / Resume, Invoices, Register, Returns, Exchange,
     Payments, Discounts (Soon), References, Salesmen, Installments
06 Quotations
07 Orders
     B2B
08 Delivery
09 Purchases
     Returns, Automation (Soon)
10 Inventory
     Movements, Batches, Serials, Expiry, Adjustments, Damaged, Counts
11 Warehouses
     Racks, Shelves, Bins, Receiving (Soon), Dispatch (Soon), Transfers
12 Customers
     Ledger, Receivables (Soon), Credit, History
13 Suppliers
     Ledger, Payables (Soon), Price Lists, Performance (Soon)
14 Service
     Complaints, Technicians, Repairs, Charges
15 Warranty
     Replacements, History
16 Accounts
     Cash (Soon), Journals, Receipts (Soon), P&L
17 Banking
18 CRM
     Campaigns, SMS, WhatsApp, Marketing, Engagement
19 Reports
     BI, AI Insights
20 Salesmen                    → Salesman / Field Sales
21 Expenses
22 Installments
23 Loyalty
24 Documents
25 Approvals                   → Approval Workflow
26 Users                       → Users & Role Management
27 Permissions
28 Audit                       → Audit Trail
29 Notifications               → Notification Center
30 Branches                    → Multi-Branch
31 Tax                         → Tax & Pakistan Compliance
32 Import / Export
33 Printing
34 Backup                      → Backup & Disaster Recovery
35 Devices                     → Devices / Printing
36 Industry                    → Industry Engine          (Coming Soon)
37 Customization               → Customization Engine     (Coming Soon)
38 Automation                  → Rules / Automation Engine (Coming Soon)
     Linking (Soon)
39 System                      → System Administration
     Company/Localization/Currency/Language/Date/Numbering/Templates
     Barcode/POS/Email/SMS/Storage/Logs/Maintenance (Soon)
     Security, Integrations, Store, Mobile (Soon), HR
```

39 parents. Count verified in `ERP_NAV_SECTIONS`.

---

## 2. Complete matrix

| # | Master Module | Navigation | Route | Existing UI | Backend | Status |
|---|---------------|------------|-------|-------------|---------|--------|
| 01 | Dashboard | Dashboard | `/` | `features/dashboard/DashboardPage.tsx` — KPI cards + mini bars from `reportingApi.executive` | `GET /api/v1/reports/executive` · `reporting-repository` · `reporting.ts` | **IMPLEMENTED** |
| 02 | Product Management | Products | `/products` | `product-management/` list + form + taxonomy + units + pricing. Variants/attributes/media/specs nav is Soon (media exists on the product form) | `/api/v1/catalog` · `catalog-repository` · `pricing.ts`, `unit-conversion.ts` | **IMPLEMENTED** |
| 03 | Barcode & QR | Barcodes | `/barcodes` (`/qr` alias) | `barcode-qr/BarcodesPage.tsx` — generate/list; product id is pasted | `/api/v1/catalog` barcodes/QR · `barcode.ts` | **PARTIAL** · **DUPLICATED** (`/qr`) |
| 04 | AI Camera Product Recognition | AI Camera | `/ai-camera` | `ai-camera/AiCameraPage.tsx` — upload, recognize, confirm | `/api/v1/ai` · `ai-repository` · `packages/ai` (no domain file) | **IMPLEMENTED** |
| 05 | POS / Sales | Sales | `/pos` | Full terminal (`PosPage`), invoices, returns wizard, sales register. Discounts policy page is Soon (caps already in POS). Payments UI is thin | `/api/v1/pos` · `pos-repository` · sale/hold/return/payment domain | **IMPLEMENTED** · **DUPLICATED** (`/held-sales`, `/pos/new`) |
| 06 | Quotations | Quotations | `/quotations` | `quotations/QuotationsPage.tsx` — list, create, convert to order | `/api/v1/after-sales` quotations · `quotation-lifecycle.ts` | **IMPLEMENTED** · **DUPLICATED** (`/orders` same page) |
| 07 | Orders | Orders | `/orders` | Same `QuotationsPage` as 06; B2B at `/b2b` is UUID/JSON | after-sales orders + `/api/v1/b2b` · `commerce.ts` | **PARTIAL** · **DUPLICATED** |
| 08 | Delivery | Delivery | `/deliveries` | `delivery/DeliveriesPage.tsx` — list, create, status, tracking | `/api/v1/purchases` deliveries · `delivery-lifecycle.ts` | **IMPLEMENTED** · **MISPLACED** API (purchases router) |
| 09 | Purchases | Purchases | `/purchases` | Invoice list/post is real; returns are UUID-post only; automation Soon | `/api/v1/purchases` · `purchase-transaction.ts` | **PARTIAL** |
| 10 | Inventory | Inventory | `/inventory` | Balances/ledger real; movements/batch/serial are post forms without registers | `/api/v1/inventory` · `stock-balances.ts` | **PARTIAL** |
| 11 | Warehouses | Warehouses | `/warehouses` | Master + locations + transfers. Receiving/dispatch desks Soon | inventory warehouses + purchases locations/transfers · `transfer-lifecycle.ts` | **IMPLEMENTED** |
| 12 | Customers | Customers | `/customers` | Master + ledger + history real; credit shares installments page | `/api/v1/parties` customers · `party-ledger.ts`, `credit.ts` | **IMPLEMENTED** · **DUPLICATED** (`/credit` = installments page) |
| 13 | Suppliers | Suppliers | `/suppliers` | Master + ledger. Price lists open Purchases. Payables/performance Soon | `/api/v1/parties` suppliers · `supplier-pricing.ts` | **IMPLEMENTED** · **MISPLACED** price-lists UI (Purchases page) |
| 14 | Service & Repair | Service | `/service` | `service-repair/ServicePage.tsx` — jobs, parts, advance (child URLs are the same screen) | `/api/v1/after-sales` service · `service-lifecycle.ts` | **IMPLEMENTED** |
| 15 | Warranty | Warranty | `/warranty` | Lookup, claims, replacements (child URLs same screen) | `/api/v1/after-sales` warranty · `warranty-service.ts` | **IMPLEMENTED** |
| 16 | Accounts | Accounts | `/accounts` | COA, journals, vouchers. Cash/receipts Soon. P&L opens Reports hub | `/api/v1/accounting` · `accounting-posting.ts` | **PARTIAL** · **MISPLACED** P&L route (reports UI) |
| 17 | Banking | Banking | `/banking` | `banking/BankingPage.tsx` — accounts, import, recon | `/api/v1/accounting` bank* · accounting repo | **IMPLEMENTED** |
| 18 | CRM & Marketing | CRM | `/crm` | Segments + campaigns; SMS/WhatsApp/marketing/engagement are the same page | `/api/v1/crm` · `commerce.ts` | **IMPLEMENTED** |
| 19 | Reports & Analytics | Reports | `/reports` | Live report APIs rendered as JSON `<pre>`, not grids/charts | `/api/v1/reports` · `reporting.ts` | **PARTIAL** |
| 20 | Salesman / Field Sales | Salesmen | `/salesman` | `salesman/SalesmanPage.tsx` — profiles, references, commissions | `/api/v1` HR/commissions/references · `pos-commission.ts` | **IMPLEMENTED** · **DUPLICATED** (`/pos/salesmen`, `/pos/references`) |
| 21 | Expenses | Expenses | `/expenses` | List, post, period report | `/api/v1/accounting` expenses · expense journal helpers | **IMPLEMENTED** |
| 22 | Installments | Installments | `/installments` | Create/approve APIs; UUID paste; no plan register | `/api/v1/parties` installments · `installments.ts` | **PARTIAL** · **DUPLICATED** (`/credit`, `/pos/installments`) |
| 23 | Loyalty | Loyalty | `/loyalty` | Seed/offers + UUID account/redeem | `/api/v1/loyalty` · `commerce.ts` | **PARTIAL** |
| 24 | Documents | Documents | `/documents` | Metadata register; paste entity UUID | `/api/v1/documents` · thin `enterprise.ts` helpers | **PARTIAL** |
| 25 | Approval Workflow | Approvals | `/approvals` | Inbox list, create, approve/reject | `/api/v1/admin` approvals · `approval-workflow.ts` | **IMPLEMENTED** |
| 26 | Users & Role Management | Users | `/users` | Roles/users list, seed, assign | `/api/v1/admin` roles/users · `rbac-catalog.ts` | **IMPLEMENTED** |
| 27 | Permissions | Permissions | `/permissions` | Role matrix + user override | `/api/v1/admin` permissions · `authz-service.ts` | **IMPLEMENTED** |
| 28 | Audit Trail | Audit | `/audit` | Read-only event list | `/api/v1/admin` audit · `audit-trail.ts` | **IMPLEMENTED** |
| 29 | Notification Center | Notifications | `/notifications` | Feed, scan, broadcast | `/api/v1/notifications` · enterprise repo | **IMPLEMENTED** |
| 30 | Multi-Branch | Branches | `/branches` | List, create, membership | `/api/v1/admin` branches · DB only (no branch domain engine) | **IMPLEMENTED** |
| 31 | Tax & Pakistan Compliance | Tax | `/tax` | Profile, rates, tax report. FBR is not live | `/api/v1` tax · `pos-tax.ts` | **PARTIAL** |
| 32 | Import / Export | Import / Export | `/import-export` | Templates, CSV import, product export | `/api/v1/data/import|export` + catalog import · `import-service.ts` | **IMPLEMENTED** |
| 33 | Printing | Printing | `/printing` | Queue jobs + local preview | `/api/v1/hardware` print-jobs · hardware repo (no domain) | **IMPLEMENTED** |
| 34 | Backup & Disaster Recovery | Backup | `/backup` | Queue backup/restore-point APIs; not a full DR runbook | `/api/v1/backup` · `planBackupJob` | **PARTIAL** |
| 35 | Devices / Printing | Devices | `/devices` | Device status, drawer, events (Printing is module 33) | `/api/v1/hardware` events · hardware repo | **IMPLEMENTED** |
| 36 | Industry Engine | Industry | `/industry-engine` | `ModulePlaceholderPage` only | None | **PLACEHOLDER** |
| 37 | Customization Engine | Customization | `/customization-engine` | `ModulePlaceholderPage` only | None | **PLACEHOLDER** |
| 38 | Rules / Automation Engine | Automation | `/rules-engine` | Coming Soon + `/transaction-linking` Coming Soon | None | **PLACEHOLDER** |
| 39 | System Administration | System | `/settings` | General settings Coming Soon. **Live children:** Security, Integrations, Store, HR. Mobile Soon | `/api/v1` security/backup/integrations/store/hr · `infrastructure.ts` | **PARTIAL** |

**MISSING modules:** none. Every master module has navigation. 36–38 are placeholders, not missing.

---

## 3. Route map

### Live pages (`apps/web/src/app/router.tsx`)

| Path | Page |
|------|------|
| `/` | DashboardPage |
| `/products`, `/products/new`, `/products/:id` | ProductsPage / ProductFormPage |
| `/categories`, `/subcategories`, `/brands`, `/companies` | TaxonomyPage |
| `/units` | UnitsPage |
| `/pricing` | PricingPage |
| `/barcodes`, `/qr` | BarcodesPage |
| `/ai-camera` | AiCameraPage |
| `/pos`, `/pos/new`, `/held-sales` | PosPage (holds drawer on `/held-sales`) |
| `/invoices` | InvoicesPage |
| `/sales-management` | SalesManagementPage |
| `/returns`, `/exchange` | ReturnsPage |
| `/payments` | PaymentsPage |
| `/quotations`, `/orders` | QuotationsPage |
| `/b2b` | B2bPage |
| `/deliveries` | DeliveriesPage |
| `/purchases` | PurchasesPage |
| `/purchase-returns` | PurchaseReturnsPage |
| `/inventory` | InventoryPage |
| `/stock-ops`, `/inventory/adjustments`, `/inventory/damaged`, `/inventory/audit` | StockOpsPage |
| `/batches-serials`, `/inventory/serials`, `/inventory/expiry` | BatchSerialPage |
| `/warehouses`, `/warehouses/racks`, `/warehouses/shelves`, `/warehouses/bins` | WarehousesPage |
| `/stock-transfers` | TransfersPage |
| `/customers`, `/customers/ledger`, `/customers/payment-history` | CustomersPage |
| `/suppliers`, `/suppliers/ledger` | SuppliersPage |
| `/suppliers/price-lists` | PurchasesPage |
| `/credit`, `/installments`, `/pos/installments` | CreditInstallmentsPage |
| `/salesman`, `/pos/salesmen`, `/pos/references` | SalesmanPage |
| `/service` (+ complaints/technicians/repairs/charges) | ServicePage |
| `/warranty` (+ replacements/history) | WarrantyPage |
| `/accounts`, `/accounts/journals` | AccountsPage |
| `/accounts/profit-loss` | ReportsHubPage |
| `/banking` | BankingPage |
| `/crm` (+ campaigns/sms/whatsapp/marketing/engagement) | CrmPage |
| `/reports` | ReportsHubPage |
| `/bi` | BiPage |
| `/ai-insights` | AiInsightsPage |
| `/expenses` | ExpensesPage |
| `/loyalty` | LoyaltyPage |
| `/documents` | DocumentsPage |
| `/approvals` | ApprovalsPage |
| `/users` | UsersRolesPage |
| `/permissions` | PermissionsPage |
| `/audit` | AuditPage |
| `/notifications` | NotificationsPage |
| `/branches` | BranchesPage |
| `/tax` | TaxPage |
| `/import-export` | ImportExportPage |
| `/printing` | PrintingPage |
| `/backup` | BackupPage |
| `/devices` | DevicesPage |
| `/hr` | HrPage |
| `/security` | SecurityPage |
| `/integrations` | IntegrationsPage |
| `/online-store` | OnlineStorePage |
| `*` | NotFoundPage |

Auth (outside the 39): `/login`, `/auth/forgot-password`, `/auth/reset`.

### Placeholder routes (Coming Soon)

`/products/variants`, `/products/attributes`, `/products/media`, `/products/specifications`, `/discounts`, `/purchase-automation`, `/warehouses/receiving`, `/warehouses/dispatch`, `/customers/receivables`, `/suppliers/payables`, `/suppliers/performance`, `/accounts/cash`, `/accounts/receipts`, `/industry-engine`, `/customization-engine`, `/rules-engine`, `/transaction-linking`, `/settings` and `/settings/*` (except live children above), `/mobile`.

---

## 4. Navigation map

- Source: `apps/web/src/app/modules.ts` → `ERP_NAV_SECTIONS` (39) → `SidebarNav`.
- Desktop: collapsible 280px / 72px rail, search, expand/collapse children.
- Mobile: slide-in drawer (`Menu` / `Close`); collapse ignored while the drawer is open.
- POS terminal (`/pos`, `/held-sales`, `/pos/new`): navy POS chrome; ERP Home returns to the 39-module shell.
- Active state: parent highlighted on child routes; child `end` match for the exact path.
- Permissions: each parent/child has a key. Empty permission list **fails open**. Loaded keys hide unauthorized items and deep links show **Not authorized**.
- Login: `ProtectedRoute` still wraps the shell.

---

## 5. Implemented modules

01 Dashboard, 02 Product Management, 04 AI Camera, 05 POS / Sales, 06 Quotations, 08 Delivery, 11 Warehouses, 12 Customers, 13 Suppliers, 14 Service & Repair, 15 Warranty, 17 Banking, 18 CRM & Marketing, 20 Salesman / Field Sales, 21 Expenses, 25 Approval Workflow, 26 Users & Role Management, 27 Permissions, 28 Audit Trail, 29 Notification Center, 30 Multi-Branch, 32 Import / Export, 33 Printing, 35 Devices.

These have real list/workflow UI and API/DB backing. Some still have Soon children or thin sibling screens; the **core job** exists.

---

## 6. Partial modules

| # | Why partial |
|---|-------------|
| 03 Barcode & QR | Generate/list works; product picker is UUID paste; `/qr` is the same page |
| 07 Orders | `/orders` is the quotations screen; B2B is UUID/JSON |
| 09 Purchases | Invoices real; returns UUID-only; automation Soon |
| 10 Inventory | Stock ledger real; ops/batch/serial are post forms, not registers |
| 16 Accounts | Journals real; cash/receipts Soon; P&L is the reports hub |
| 19 Reports & Analytics | APIs live; UI dumps JSON |
| 22 Installments | APIs live; UUID paste; overlaps `/credit` |
| 23 Loyalty | Seed/redeem live; UUID account load |
| 24 Documents | Metadata only |
| 31 Tax | Profile/rates real; FBR not live |
| 34 Backup | Job/restore-point APIs; not full DR |
| 39 System | HR/security/integrations/store live; general settings Coming Soon |

---

## 7. Placeholder modules

| # | Route | Reality |
|---|-------|---------|
| 36 Industry Engine | `/industry-engine` | Coming Soon. No API, domain, or DB |
| 37 Customization Engine | `/customization-engine` | Coming Soon. No API, domain, or DB |
| 38 Rules / Automation Engine | `/rules-engine` | Coming Soon. `/transaction-linking` also Coming Soon. No API, domain, or DB |

These are **not** implemented. Navigation exists so the 39-module tree is complete.

---

## 8. Missing modules

**None.** All 39 appear in the sidebar. Placeholders are classified as PLACEHOLDER, not MISSING.

---

## 9. Duplicated modules / routes

Kept on purpose (do not delete):

| Canonical | Duplicate(s) | Shared page |
|-----------|--------------|-------------|
| `/pos` | `/held-sales`, `/pos/new` | PosPage |
| `/quotations` | `/orders` | QuotationsPage |
| `/returns` | `/exchange` | ReturnsPage |
| `/barcodes` | `/qr` | BarcodesPage |
| `/installments` | `/credit`, `/pos/installments` | CreditInstallmentsPage |
| `/salesman` | `/pos/salesmen`, `/pos/references` | SalesmanPage |
| `/inventory` | `/stock-ops` and inventory child aliases | StockOpsPage / InventoryPage as noted |
| `/categories` | `/subcategories`, `/brands`, `/companies` | TaxonomyPage (different tab) |

Sales also lists Salesmen and Installments as children while modules 20 and 22 remain top-level. Same screens, two nav entries.

---

## 10. Misplaced features

| Feature | Lives in | 39-module home | Note |
|---------|----------|----------------|------|
| Payments page file | `features/pos/PaymentsPage.tsx` | 05 Sales | Moved from `customers/` (file move only; `parties-api` stays shared) |
| Delivery API | `apps/api/src/routes/purchases.ts` | 08 Delivery | UI folder is `delivery/` |
| Orders list | QuotationsPage | 07 Orders | Shared after-sales screen |
| Supplier price lists | PurchasesPage | 13 Suppliers (nav child) | Intentional reuse |
| Accounts P&L | ReportsHubPage | 16 Accounts (nav child) | Report, not ledger UI |
| HR | System child `/hr` | Not in the 39 list | Folded into 39 |
| Online store | System child `/online-store` | 39 | Correct fold |
| B2B | Orders child `/b2b` | 07 | Correct fold |
| AI insights | Reports child | 19 | Correct fold |
| Shared API clients | `parties-api`, `after-sales-api`, `admin-api`, `commerce-api`, `enterprise-api`, `infrastructure-api` | Several modules | One client per old backend bucket |

None of these require a further folder or API split in the structural alignment. Delivery stays on `purchases.ts`.

---

## Verification (10 checks)

| # | Check | Result |
|---|--------|--------|
| 1 | Sidebar structure | 39 collapsible parents, children indented, no parent-path duplicate rows |
| 2 | Routes | Every nav path is registered; unknown URLs hit `NotFoundPage`; refresh uses SPA rewrite |
| 3 | Mobile navigation | Drawer + Menu/Close; labels restored when the drawer is open |
| 4 | Permissions | Mapped on all 39; fail-open if no keys; gate when keys exist; login still required |
| 5 | Module visibility | Unauthorized items hidden when keys loaded; placeholders show Soon |
| 6 | Page ownership | Live pages sit in 39-oriented `features/*` folders (see tree below) |
| 7 | Component ownership | POS chrome in `features/pos`; ERP shell in `app/shell`; shared UI in `packages/ui` |
| 8 | API ownership | 16 routers, not 39 files. Grouped as catalog/parties/pos/purchases/after-sales/accounting/admin/hardware/reports/commerce/ai/enterprise/infrastructure |
| 9 | Domain ownership | Strong for POS, inventory, purchases, after-sales, RBAC. Empty for 36–38. Printing/devices/branches are API+DB |
| 10 | Database ownership | 15 Supabase repositories in `packages/db`. No SQLite client |

### Live web feature folders (on disk)

`accounts`, `ai-camera`, `approvals`, `audit`, `auth`, `backup`, `banking`, `barcode-qr`, `branches`, `crm`, `customers`, `dashboard`, `delivery`, `devices`, `documents`, `expenses`, `import-export`, `installments`, `inventory`, `loyalty`, `modules`, `notifications`, `orders`, `permissions`, `pos`, `printing`, `product-management`, `purchases`, `quotations`, `reports`, `salesman`, `service-repair`, `suppliers`, `system`, `tax`, `users`, `warehouses`, `warranty`.

No `industry/`, `customization/`, or `automation/` folders — those modules are placeholders only.

---

## Findings checklist

| Topic | Finding |
|-------|---------|
| Duplicate routes | Present and documented. Not deleted. |
| Broken imports (live tree) | None found in routed pages |
| Orphan pages | None in the live `features/` tree |
| Dead navigation | None. Soon items still route to Coming Soon or `availableOn` |
| Incorrect parent-child | Children match the 39-module intent. Salesmen/Installments appear under both Sales and their own modules (intentional) |
| Inconsistent labels | Master names (long) vs sidebar (short). Intentional Phase 5 |
| Inconsistent module naming | Same as above. IDs 01–39 match the master list |
| Accidental offline | No SQLite/Dexie/offline POS. `navigator.onLine` guards only |
| Accidental sync | No sync engine in web/API. Historical SQL migration file still in `supabase/migrations/` (not wired) |

---

## Remaining technical debt

1. **Placeholder engines:** Industry, Customization, Automation have no backend.
2. **Thin operator UIs:** Reports JSON dumps; barcode/payments/installments/loyalty/documents UUID paste.
3. **Shared screens:** Orders = quotations; many child URLs only change the heading/tab.
4. **API still grouped by old buckets** (`parties`, `after-sales`, `enterprise`) while the UI is 39 modules.
5. **Settings:** `/settings` is Coming Soon while Security/HR/Integrations/Store already work as children.
6. **FBR / purchase automation / warehouse receiving-dispatch / discount policy page** are not built.
7. **Historical** `offline_sync_engine` migration remains in Supabase SQL (unused by app code).
8. **Vite** production chunk exceeds 500 kB (warning only).

---

## Future cleanup recommendations

Do **not** do these as a silent “alignment” pass. They are follow-up work.

1. Keep duplicate URLs until a dedicated merge phase; then pick one canonical path and 301/redirect the rest.
2. Split `/orders` onto its own list when wholesale orders need a different UX from quotations.
3. ~~Move `PaymentsPage` into `features/pos/`~~ **Done** (`features/pos/PaymentsPage.tsx`).
4. Give Reports a table/chart UI; keep the same APIs.
5. Replace UUID-paste screens with search pickers (barcodes, payments, installments, B2B).
6. Implement or hide 36–38 rather than leaving Coming Soon if the product story does not need engines yet.
7. Optionally extract delivery routes out of `purchases.ts` (API split, no behavior change).
8. Do not reintroduce offline POS, SQLite, or a sync queue.

---

## What this audit did not do

- Did not implement missing engines or FBR
- Did not redesign POS
- Did not merge duplicate pages or services
- Did not change sale, stock, payment, or pricing logic
- Did not delete working routes

The ERP **looks and navigates** as one 39-module product. Several modules are still **partial** or **placeholder**. Those are not claimed as implemented.

---

## Command validation

Ran from repo root after this audit (no application code changes). All **PASS**.

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (alias of typecheck) |
| `npm test` | PASS — 277 tests (contracts 12, domain 222, api 32, web 11) |
| `npm run build` | PASS (Vite chunk-size warning only) |
