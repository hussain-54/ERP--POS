# ARCHITECTURE AUDIT — 39-MODULE ERP NAVIGATION

**Date:** 2026-08-15  
**Phase:** Inspection only. **No product code was modified.**  
**Runtime:** Online-only (Web → API → domain → db → Supabase). SQLite / offline POS / sync must **not** be reintroduced.

---

## Source of truth (conflict, preserved)

Two master lists exist. This audit does **not** invent a third numbering.

| Source | What it is |
|--------|------------|
| **This task’s 39-module list** (01–39) | Target grouping for UI/navigation restructuring |
| **`docs/ERP_MODULE_CHECKLIST.md`** | In-repo master inventory (~60 numbered items, including Units, Discounts, Offline POS, Sync, B2B, HR, etc.) |
| **`apps/web/src/app/modules.ts` `ERP_MODULES`** | Actual sidebar: **58 flat routes** (comment still says “placeholder”) |

The 39-module list is the **target navigation architecture**. Checklist items that are more granular become **children** of a 39-module parent (they are not deleted).

Offline POS / Advanced Sync (`ERP_MODULE_CHECKLIST` 48–49) are **historical / unwired**. They must stay out of the active online runtime.

---

## A. Current application tree

```
Electronic - ERP/
  apps/web/src/
    app/
      modules.ts          # 58 flat ERP_MODULES (nav + routes)
      router.tsx          # React Router + implemented map vs placeholder
      shell/AppShell.tsx  # ERP sidebar (hidden on /pos and /held-sales)
    features/
      auth/               # login, forgot, reset, ProtectedRoute
      catalog/            # products, taxonomy, units, barcodes, pricing, import-export
      pos/                # terminal, returns, invoices, salesman, sales-management
      inventory/          # inventory, warehouses, batch-serial, StockOpsPage (unrouted)
      parties/            # customers, suppliers, payments, credit/installments
      purchases/          # purchases, purchase-returns, transfers, deliveries
      after-sales/        # quotations, service, warranty
      finance/            # accounts, banking, expenses, ReportsPage alias
      reporting/          # dashboard, reports hub, BI
      admin/              # users, permissions, approvals, audit, branches
      commerce/           # CRM, loyalty, B2B, online store
      ai/                 # camera, insights
      enterprise/         # HR, tax, documents, notifications
      hardware/           # printing, devices
      infrastructure/     # security, backup, integrations
      modules/            # ModulePlaceholderPage
  apps/api/src/routes/    # auth, catalog, inventory, parties, pos, purchases,
                          # after-sales, accounting, admin, hardware, reports,
                          # commerce, ai, enterprise, infrastructure
  packages/{contracts,domain,db,ui,hardware,ai}
  apps/desktop/           # Electron shell (hardware/updater); not the ERP nav
  docs/ERP_ARCHITECTURE.md, docs/ERP_MODULE_CHECKLIST.md
```

Sidebar is **not** a 39-module tree. It is a **flat list of exactly 58 titles** (`ERP_MODULES.length === 58`), grouped only by a `group` string on each row (Core, Sales, Catalog, …). The file comment still says “placeholder routes” but **53 of 58** map to real feature pages; **5** render `ModulePlaceholderPage`.

---

## B. Current routes

Legend for **Status**: Implemented page | Placeholder | Duplicate route | Auth-only | Orphan (file, no route).

| Current Route | Current Page | Current Feature | Current module (`group`) | Recommended 39-module | Duplicate? | Misplaced? | Missing parent? | Status |
|---------------|--------------|-----------------|--------------------------|----------------------|------------|------------|-----------------|--------|
| `/login` | LoginPage | Auth | (none) | 39 System Administration | No | Auth is outside ERP tree | — | Auth-only |
| `/auth/forgot-password` | ForgotPasswordPage | Auth | (none) | 39 | No | No | — | Auth-only |
| `/auth/reset` | ResetPasswordPage | Auth | (none) | 39 | No | No | — | Auth-only |
| `/` | DashboardPage | Ops dashboard | Core | **01 Dashboard** | No | No | No | Implemented |
| `/pos` | PosPage | POS terminal | Sales | **05 POS / Sales** | Partial (`/held-sales` same page) | No | Should own returns/invoices/hold as children | Implemented |
| `/held-sales` | PosPage | Hold/resume (same terminal) | Sales | **05** child | **Yes** vs `/pos` | Standalone nav item | Parent 05 | Duplicate route |
| `/products` | ProductsPage | Product master | Catalog | **02 Product Management** | No | No | No | Implemented |
| `/products/new`, `/products/:id` | ProductFormPage | Product form | Catalog | **02** | No | Extra routes not in `ERP_MODULES` | Parent 02 | Implemented (not in sidebar list) |
| `/units` | UnitsPage | UOM | Catalog | **02** child | No | Standalone nav | Parent 02 | Implemented |
| `/categories` | TaxonomyPage | Brand/company/category | Catalog | **02** child | No | Standalone nav | Parent 02 | Implemented |
| `/pricing` | PricingPage | Price levels / lists | Catalog | **02** child (or 05 pricing policy) | No | Standalone | Parent 02 | Implemented |
| `/barcodes` | BarcodesPage | Barcode/QR | Catalog | **03 Barcode & QR** | No | No | No | Implemented |
| `/ai-camera` | AiCameraPage | Image/hint recognition | Catalog | **04 AI Camera** | No | Also belongs with POS | Dual parent 04/05 | Implemented (partial vs POS-embedded camera) |
| `/discounts` | ModulePlaceholderPage | Discount policies | Sales | **05** child | No | Standalone | Parent 05 | **Placeholder** |
| `/customers` | CustomersPage | Customer master | Parties | **12 Customers** | Also in POS sidebar | Dual nav | No | Implemented |
| `/payments` | PaymentsPage | Receipts/tender | Sales | **12** or **16** child | No | Under Sales group | Parent 12/16 | Implemented |
| `/credit` | CreditInstallmentsPage | Credit/udhaar | Sales | **12** child | **Yes** vs `/installments` | Standalone | Parent 12 | Implemented (shared page) |
| `/installments` | CreditInstallmentsPage | Installment plans | Sales | **22 Installments** | **Yes** vs `/credit` | Same component | — | Implemented |
| `/returns` | ReturnsPage | Sales return/exchange | Sales | **05** child | POS sidebar too | Standalone | Parent 05 | Implemented |
| `/invoices` | InvoicesPage | Invoice register | Sales | **05** child | POS sidebar too | Standalone | Parent 05 | Implemented |
| `/sales-management` | SalesManagementPage | Sales register/KPI | Sales | **05** child | Overlaps invoices/reports | Standalone | Parent 05 | Implemented |
| `/salesman` | SalesmanPage | Commission/references | Sales | **20 Salesman / Field Sales** | POS sidebar too | No | No | Implemented |
| `/purchases` | PurchasesPage | Purchase invoices | Purchasing | **09 Purchases** | No | No | No | Implemented |
| `/purchase-returns` | PurchaseReturnsPage | Purchase returns | Purchasing | **09** child | No | Standalone | Parent 09 | Implemented |
| `/purchase-automation` | ModulePlaceholderPage | Reorder suggestions | Purchasing | **09** child / **38** | No | Standalone | Parent 09 | **Placeholder** |
| `/suppliers` | SuppliersPage | Supplier master | Purchasing | **13 Suppliers** | No | Grouped under Purchasing | No | Implemented |
| `/inventory` | InventoryPage | Stock on hand | Inventory | **10 Inventory** | No | No | No | Implemented |
| `/batches-serials` | BatchSerialPage | Batch/serial/expiry | Inventory | **10** child | No | Standalone | Parent 10 | Implemented |
| `/warehouses` | WarehousesPage | Warehouses/bins | Inventory | **11 Warehouses** | No | No | No | Implemented |
| `/stock-transfers` | TransfersPage | Inter-warehouse | Inventory | **10** or **11** child | No | Lives in `features/purchases` | Parent 10/11 | Implemented (folder misplaced) |
| `/deliveries` | DeliveriesPage | Delivery notes | Sales | **08 Delivery** | POS sidebar too | Grouped Sales | No | Implemented |
| `/quotations` | QuotationsPage | Quotes | Sales | **06 Quotations** | No | Grouped Sales | No | Implemented |
| `/service` | ServicePage | Job cards | Service | **14 Service & Repair** | No | No | No | Implemented |
| `/warranty` | WarrantyPage | Claims | Service | **15 Warranty** | No | No | No | Implemented |
| `/accounts` | AccountsPage | COA/journals | Finance | **16 Accounts** | No | No | No | Implemented |
| `/banking` | BankingPage | Bank books | Finance | **17 Banking** | No | No | No | Implemented |
| `/expenses` | ExpensesPage | Expense entry | Finance | **21 Expenses** | No | No | No | Implemented |
| `/ai-insights` | AiInsightsPage | AI insights | Insights | **19** child | Overlaps BI | Standalone | Parent 19 | Implemented |
| `/bi` | BiPage | KPI dashboards | Insights | **19 Reports & Analytics** | Overlaps reports | Standalone | Parent 19 | Implemented |
| `/reports` | ReportsHubPage | Report hub | Insights | **19** | POS sidebar too | No | No | Implemented |
| `/crm` | CrmPage | Segments/campaigns | Growth | **18 CRM & Marketing** | No | No | No | Implemented |
| `/loyalty` | LoyaltyPage | Points | Growth | **23 Loyalty** | No | No | No | Implemented |
| `/b2b` | B2bPage | Wholesale portal | Channels | **07 Orders** (partial) + channel | No | No dedicated `/orders` | **07 missing as parent** | Implemented (B2B orders inside page) |
| `/online-store` | OnlineStorePage | Storefront config | Channels | 39 / channel child | No | Not in 39 list as top-level | Parent 39 or 07 | Implemented |
| `/mobile` | ModulePlaceholderPage | Mobile apps | Channels | 39 | No | Standalone | Parent 39 | **Placeholder** |
| `/documents` | DocumentsPage | Files | Governance | **24 Documents** | No | No | No | Implemented |
| `/approvals` | ApprovalsPage | Approval inbox | Governance | **25 Approval Workflow** | No | No | No | Implemented |
| `/users` | UsersRolesPage | Users/roles | Admin | **26 Users & Role Management** | No | Combined users+roles | No | Implemented |
| `/permissions` | PermissionsPage | Matrix | Admin | **27 Permissions** | No | No | No | Implemented |
| `/audit` | AuditPage | Audit log | Governance | **28 Audit Trail** | No | Grouped Governance vs 26–27 Admin | No | Implemented |
| `/notifications` | NotificationsPage | Notification center | Governance | **29 Notification Center** | No | No | No | Implemented |
| `/branches` | BranchesPage | Branches | Admin | **30 Multi-Branch** | No | No | No | Implemented |
| `/tax` | TaxPage | Pakistan/FBR | Compliance | **31 Tax & Pakistan Compliance** | No | No | No | Implemented |
| `/import-export` | ImportExportPage | Import/export | Platform | **32 Import / Export** | No | Lives in catalog feature | Parent 32 | Implemented |
| `/printing` | PrintingPage | Print templates | Platform | **33 Printing** | Overlaps 35 | Dual with devices | — | Implemented |
| `/devices` | DevicesPage | Device registry | Platform | **35 Devices / Printing** | Overlaps 33 | Dual | — | Implemented |
| `/backup` | BackupPage | Backup jobs | Platform | **34 Backup & DR** | No | No | No | Implemented (DR not claimed complete) |
| `/integrations` | IntegrationsPage | API keys/webhooks | Platform | **39** child | No | Standalone | Parent 39 | Implemented |
| `/settings` | ModulePlaceholderPage | Org settings | Admin | **39 System Administration** | Profile menu also | Standalone | Parent 39 | **Placeholder** |
| `/security` | SecurityPage | Password/2FA/sessions | Admin | **39** child | No | Standalone | Parent 39 | Implemented |
| `/transaction-linking` | ModulePlaceholderPage | Linked documents | Platform | **38 Rules / Automation** (partial) | No | Standalone | Parent 38 | **Placeholder** |
| `/hr` | HrPage | Employees/payroll | HR | **39** or later HR (not in 39) | No | **Not in 39-module list** | Extra vs 39 | Implemented |

**No `/orders` route.** RBAC catalog includes module `"orders"`. B2B page contains order fields.

**Orphan file:** `features/inventory/StockOpsPage.tsx` — stock movement UI, **not registered** in `router.tsx`.

---

## C. Current navigation

### C.1 ERP AppShell (`AppShell.tsx`)

- Renders **every** `ERP_MODULES` entry as a **top-level** `NavLink`.
- Filter search only; **no collapsible module tree**.
- `group` is a subtitle, not a parent folder.
- Hidden when path is `/pos`, `/held-sales`, or `/pos/*` (POS uses its own sidebar).
- Command palette repeats the same 58 items.
- Header Profile → `/settings` (placeholder).
- Branch selector is in the header (related to **30 Multi-Branch**), not a module page.

### C.2 POS sidebar (`POSSidebar.tsx`)

| Item | Route | 39-module | Duplicate vs ERP nav? |
|------|-------|-----------|------------------------|
| ERP Home | `/` | 01 | Yes |
| POS | `/pos` | 05 | Yes |
| Hold / Resume | `/held-sales` | 05 child | Yes |
| Customers | `/customers` | 12 | Yes |
| Products | `/products` | 02 | Yes |
| Invoices | `/invoices` | 05 child | Yes |
| Returns | `/returns` | 05 child | Yes |
| Salesman | `/salesman` | 20 | Yes |
| Deliveries | `/deliveries` | 08 | Yes |
| Reports | `/reports` | 19 | Yes |
| Settings | `/settings` | 39 | Yes (placeholder) |

### C.3 Grouping problems

- **58 siblings** instead of 39 parents with children.
- Catalog children (units, categories, pricing) look like equal modules to Products.
- Sales children (payments, credit, returns, invoices, hold, sales-management) look like equal modules to POS.
- Insights split across AI / BI / Reports as three top-level modules.
- Printing (**33**) and Devices (**35**) both top-level; names overlap.
- HR, B2B, Online Store, Mobile, Integrations are top-level but **not** in the 39 list (except as 07/39 children).

---

## D. Current feature inventory

| Feature folder | Screens (routed unless noted) | Depth |
|----------------|------------------------------|--------|
| catalog | Products, form, taxonomy, units, barcodes, pricing, import-export | Real CRUD/API |
| pos | Terminal, returns, invoices, salesman, sales-management; hold = same PosPage | Real posting |
| inventory | Inventory, warehouses, batch-serial; **StockOpsPage unrouted** | Real |
| parties | Customers, suppliers, payments, credit+installments | Real |
| purchases | Purchases, purchase-returns, transfers, deliveries | Real |
| after-sales | Quotations, service, warranty | Real |
| finance | Accounts, banking, expenses | Real |
| reporting | Dashboard, reports hub, BI | Real |
| admin | Users/roles, permissions, approvals, audit, branches | Real |
| commerce | CRM, loyalty, B2B, store | Real (channel-admin style) |
| ai | Camera, insights | Real API-backed |
| enterprise | HR, tax, documents, notifications | Real |
| hardware | Printing, devices | Real |
| infrastructure | Security, backup, integrations | Real (backup honest “DR not claimed”) |
| modules | Placeholder only | Shell |
| auth | Login/reset | Real |

Desktop (`apps/desktop`): updater, hardware bridge, config store — **not** a 39-module UI.

---

## E. 39-module target tree

Preserve this numbering (task master). Checklist children shown in parentheses.

```
01 Dashboard
02 Product Management          (checklist 2,3,4,10 pricing)
03 Barcode & QR
04 AI Camera Product Recognition
05 POS / Sales                 (POS, search, entry, discounts, payments,
                                returns, invoices, hold, sales-management)
06 Quotations
07 Orders                      (B2B/store orders; no dedicated route today)
08 Delivery
09 Purchases                   (purchases, purchase-returns, purchase-automation)
10 Inventory                   (stock, batch/serial, transfers)
11 Warehouses
12 Customers                   (customer master, credit as child)
13 Suppliers
14 Service & Repair
15 Warranty
16 Accounts
17 Banking
18 CRM & Marketing
19 Reports & Analytics         (reports, BI, AI insights)
20 Salesman / Field Sales
21 Expenses
22 Installments
23 Loyalty
24 Documents
25 Approval Workflow
26 Users & Role Management
27 Permissions
28 Audit Trail
29 Notification Center
30 Multi-Branch
31 Tax & Pakistan Compliance
32 Import / Export
33 Printing
34 Backup & Disaster Recovery
35 Devices / Printing
36 Industry Engine             (no route / no UI)
37 Customization Engine        (no route / no UI)
38 Rules / Automation Engine   (placeholder transaction-linking only)
39 System Administration       (settings, security, integrations, mobile, online-store admin)
```

Items **in the app but not in 39:** HR, B2B portal, Online Store, Mobile, Integrations, AI Insights (fold into 19 or 39), Offline/Sync (do not activate).

---

## F. Current → target mapping

| 39 | Current routes | Action later (do not do now) |
|----|----------------|------------------------------|
| 01 | `/` | Stay |
| 02 | `/products`, `/units`, `/categories`, `/pricing` | Nest children |
| 03 | `/barcodes` | Stay |
| 04 | `/ai-camera` | Stay; optional POS entry later |
| 05 | `/pos`, `/held-sales`, `/returns`, `/invoices`, `/sales-management`, `/payments`, `/discounts` | Nest; merge hold into POS |
| 06 | `/quotations` | Stay |
| 07 | *(none)*; B2B order UI on `/b2b` | Add parent or promote child |
| 08 | `/deliveries` | Stay |
| 09 | `/purchases`, `/purchase-returns`, `/purchase-automation` | Nest |
| 10 | `/inventory`, `/batches-serials`, `/stock-transfers` | Nest; optionally route StockOpsPage |
| 11 | `/warehouses` | Stay |
| 12 | `/customers`, `/credit` | Nest credit |
| 13 | `/suppliers` | Stay |
| 14 | `/service` | Stay |
| 15 | `/warranty` | Stay |
| 16 | `/accounts` | Stay |
| 17 | `/banking` | Stay |
| 18 | `/crm` | Stay |
| 19 | `/reports`, `/bi`, `/ai-insights` | Nest |
| 20 | `/salesman` | Stay |
| 21 | `/expenses` | Stay |
| 22 | `/installments` (shared with credit) | Split or nest under 12/22 |
| 23 | `/loyalty` | Stay |
| 24 | `/documents` | Stay |
| 25 | `/approvals` | Stay |
| 26 | `/users` | Stay |
| 27 | `/permissions` | Stay |
| 28 | `/audit` | Stay |
| 29 | `/notifications` | Stay |
| 30 | `/branches` | Stay |
| 31 | `/tax` | Stay |
| 32 | `/import-export` | Stay |
| 33 | `/printing` | Stay; clarify vs 35 |
| 34 | `/backup` | Stay |
| 35 | `/devices` | Stay; clarify vs 33 |
| 36 | — | Missing |
| 37 | — | Missing |
| 38 | `/transaction-linking` placeholder; `/purchase-automation` placeholder | Missing engine |
| 39 | `/settings` placeholder, `/security`, `/integrations`, `/mobile`, `/online-store` | Nest |

---

## G. Misplaced items

| Item | Why |
|------|-----|
| `TransfersPage` under `features/purchases` | Business is inventory/warehouse, route `/stock-transfers` |
| `/import-export` under `features/catalog` | 32 is platform-wide |
| `/payments`, `/credit` under Sales group | Belong with 12 Customers / 16 Accounts / 22 |
| `/deliveries` under Sales group | Target **08** (OK as sibling of POS, not child of “Sales” blob) |
| `/suppliers` under Purchasing group | Target **13** (own module) |
| `/held-sales` | Same PosPage as `/pos` |
| `/credit` and `/installments` | Same `CreditInstallmentsPage` |
| POS Settings link | Goes to ERP placeholder `/settings` |
| Header “Alerts” badge | Decorative; real center is `/notifications` |

---

## H. Duplicates

| Pair | Status |
|------|--------|
| `/pos` and `/held-sales` | **DUPLICATED** page (`PosPage`) |
| `/credit` and `/installments` | **DUPLICATED** page |
| ERP sidebar vs POS sidebar | **DUPLICATED** links (intentional dual chrome) |
| `PosSidebar` re-export vs `POSSidebar` | **DUPLICATED** name, same component |
| `/invoices` vs `/sales-management` | **PARTIAL** overlap (register vs management) |
| `/reports` vs `/bi` vs `/ai-insights` | **DUPLICATED** “analytics” surfaces |
| `/printing` vs `/devices` | **PARTIAL** overlap with 33 vs 35 |
| `packages/ui` vs `pos/design-system` | **DUPLICATED** primitives (do not merge this phase) |
| `finance/ReportsPage` re-exports reporting hub | Alias only |
| Checklist Offline POS vs current online POS | **Historical**; do not merge into runtime |

---

## I. Missing navigation entries

- **07 Orders** as a first-class module (RBAC `orders` exists; no `/orders`).
- **36 Industry Engine**
- **37 Customization Engine**
- **38 Rules / Automation Engine** (only a placeholder “transaction linking”)
- Nested children under 02/05/09/10/19/39 (they exist as **flat** items, not missing pages)
- `StockOpsPage` not in any nav
- Product form routes not listed in sidebar (reachable from products list)

---

## J. Orphan pages

| File | Issue |
|------|--------|
| `features/inventory/StockOpsPage.tsx` | No router entry |
| `features/finance/ReportsPage.tsx` | Alias only; `/reports` uses ReportsHubPage |

Auth pages are not orphans; they sit outside `AppShell`.

---

## K. Risky areas

1. **Do not flatten or delete POS, catalog, inventory, parties, finance posting paths** while regrouping nav.
2. **Do not reintroduce** SQLite, sync engine, or offline sale posting (`docs/OFFLINE_ARCHITECTURE.md` is historical).
3. Changing `ERP_MODULES` length will break `apps/web/src/app/smoke.test.tsx` (`length >= 50`).
4. `/held-sales` → `PosPage` may surprise users (same terminal, different URL).
5. `/settings` is a **placeholder** linked from Profile and POS.
6. Remote Supabase migration history vs repo migrations (from prior POS work) — nav work must not `db push`.
7. 33 vs 35 naming collision if merged carelessly.
8. B2B “orders” vs missing **07** — easy to build a fake Orders module that duplicates B2B.

---

## L. Recommended restructuring order

**Do not execute in this phase.** Suggested later:

1. **Nav model only:** introduce parent/child in `modules.ts` + AppShell accordion. Keep all URLs stable.
2. **Demote duplicates in the sidebar** (not delete routes): hold under POS; units/categories/pricing under Products; credit under Customers.
3. **Clarify 07 Orders** without new posting engine: label B2B/store order UI as child of 07.
4. **Nest 19** (Reports / BI / AI insights).
5. **Nest 39** (settings, security, integrations, mobile).
6. **Decide 33 vs 35** labels only.
7. **Optional:** register `StockOpsPage` under 10 — new route, no logic rewrite.
8. **Last:** placeholders for 36/37/38 — shell pages only, no fake engines.
9. Never: POS redesign, payment modal redesign, promotion engine, offline, DB resets.

---

# CONCISE FINAL REPORT

## CURRENT STRUCTURE

58 flat `ERP_MODULES` in one sidebar + POS mini-nav. Router maps ~53 paths to real pages and 5 to `ModulePlaceholderPage`. Features live in domain folders (`catalog`, `pos`, `inventory`, …), not in a 39-module tree.

## TARGET STRUCTURE

39 numbered parents (01–39). Existing screens become children. URLs should stay until a dedicated routing phase. Online-only remains mandatory.

## WHAT WILL MOVE

- Sidebar grouping (Sales/Catalog blobs → 39 parents).
- Possibly feature-folder of transfers (purchases → inventory) **later**, URL can stay `/stock-transfers`.
- Hold, units, categories, pricing, returns, invoices, reports/BI as **nav children**.

## WHAT WILL STAY

- All posting APIs and domain services (sale, stock RPC, pricing, refunds).
- Existing page components and almost all paths.
- Dual POS vs ERP chrome (POS can keep a short operational list).
- Desktop hardware shell.

## WHAT IS DUPLICATED

- `/pos` + `/held-sales`
- `/credit` + `/installments`
- ERP nav + POS nav
- Reports / BI / AI insights
- Printing vs Devices (33/35)
- UI kits (ERP `packages/ui` vs POS design-system)

## WHAT IS MISSING

- Module **07 Orders** as parent route
- Modules **36, 37, 38** (engines)
- Nested navigation
- `StockOpsPage` route
- Real `/settings` (placeholder)
- `/discounts`, `/purchase-automation`, `/mobile`, `/transaction-linking` (placeholders)

## WHAT MUST NOT BE TOUCHED

- Sale/return/stock/payment/pricing **business logic**
- Supabase schema / `db push` / RLS
- Offline/SQLite/sync revival
- POS visual redesign, camera/QR/voice as new products
- Deleting duplicate pages “to clean nav”
- Auth/session/permission enforcement internals

---

## Validation results

Commands run **2026-08-15** after completing this audit. No code was modified to fix failures.

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | All 9 workspaces: contracts, domain, ai, db, hardware, ui, api, web, desktop |
| `npm run lint` | **PASS** | Alias for typecheck (no separate ESLint) |
| `npm test` | **PASS** | 271 tests: contracts 12, domain 222, api 32, web 5 |
| `npm run build` | **PASS** | packages + api + web; Vite chunk-size warning only (>500 kB bundle) |

**Warnings (informational, not failures):**

- React Router v7 future-flag warnings in web smoke tests
- Vite production bundle size advisory (no code-splitting yet)

---

## Appendix: API route inventory (`apps/api`)

All routes are online-only via Express → `@electronic-erp/db` → Supabase. Prefix `/api/v1` unless noted.

| Router mount | Domain | Key endpoints |
|--------------|--------|---------------|
| `/health` | Infrastructure | Health + Supabase probe |
| `/auth` | Auth | login, logout, me, session, password-reset |
| `/catalog` | 02–03, 32 | products, taxonomy, units, barcodes, QR, pricing, import/export |
| `/inventory` | 10–11 | warehouses, balances, movements, adjustments, batches, serials, counts, reservations |
| `/parties` | 12–13, 22 | customers, suppliers, payments, credit, installments |
| `/pos` | 05, 20 | sales, holds, returns, shifts, product search, sales management |
| `/purchases` | 08–09 | invoices, returns, transfers, deliveries, supplier prices, locations |
| `/after-sales` | 06–07, 14–15 | quotations, orders, service jobs, warranty claims |
| `/accounting` | 16–17, 21 | COA, journals, vouchers, banking, expenses, finance reports |
| `/admin` | 25–30 | roles, permissions, users, branches, approvals, audit, group dashboard |
| `/hardware` | 33, 35 | print jobs, cash drawer, device events/capabilities |
| `/reports` | 19 | dashboard executive, sales/purchases/stock/profit/bi/accounting |
| `/crm`, `/loyalty`, `/b2b`, `/store` (commerce) | 07, 18, 23 | segments, campaigns, loyalty, B2B orders, storefront |
| `/ai/*` (ai router) | 04, 19 | recognize-product, insights, settings |
| `/hr`, `/tax`, `/documents`, `/notifications` (enterprise) | 31, 24, 29, HR* | employees, tax, documents, notifications |
| `/security`, `/backup`, `/integrations`, `/data/*` (infrastructure) | 34, 39, 32 | security, backup/DR, API clients, import/export |

\*HR is implemented in API/UI but **not** in the 39-module target list — fold under 39 or retain as extension.

**RBAC modules without dedicated UI route:** `orders` (API exists under `/after-sales/orders`; B2B orders under `/b2b`; no `/orders` page).

---

## Appendix: Page implementation depth (inspected, not filename-only)

| Status | Count | Examples |
|--------|-------|------------|
| **Implemented** | ~45 routed pages | PosPage, ProductsPage, DashboardPage, AccountsPage, CrmPage, … |
| **Partial** | ~8 | BarcodesPage (ID-driven), BatchSerialPage (create-only), PaymentsPage, CreditInstallmentsPage, PurchaseReturnsPage, B2bPage, StockOpsPage (**unrouted**), ResetPasswordPage (instructions only) |
| **Placeholder** | 5 module routes | `/discounts`, `/purchase-automation`, `/mobile`, `/settings`, `/transaction-linking` → `ModulePlaceholderPage` |

Discount logic **exists in POS/domain** (`packages/domain/src/discount-policy.ts`); only the dedicated `/discounts` admin screen is a placeholder.
