# Final 39-Module Architecture Report — Phase 10

Verification only. No new features. No module redesign. No business-logic changes.

Date: 2026-08-19  
Source of truth: `apps/web/src/app/modules.ts` (`ERP_NAV_SECTIONS`, aliased as `ERP_MODULE_REGISTRY`)  
Router: `apps/web/src/app/router.tsx`  
Shell: `apps/web/src/app/shell/AppShell.tsx`

**Result: PASS.** Exactly 39 top-level modules, one ERP application, one registry, one AppShell.

---

## Checklist

| # | Check | Result |
|---|---|---|
| 1 | Exactly 39 top-level modules | Pass |
| 2 | Exact numbering `01`–`39` | Pass |
| 3 | Exact official uppercase names | Pass |
| 4 | Exact ordering | Pass |
| 5 | Exact child ownership (one owner per path) | Pass |
| 6 | One module registry | Pass — `ERP_MODULE_REGISTRY === ERP_NAV_SECTIONS` |
| 7 | One ERP AppShell | Pass — single `createBrowserRouter` tree under `<AppShell />` |
| 8 | One global sidebar | Pass — `ERP_SIDEBAR_SECTIONS` (39 parents, `children: []`) |
| 9 | One global header | Pass — `GlobalHeader` (`data-erp-chrome="header"`) |
| 10 | No separate POS application shell | Pass — `POSShell` is workspace chrome inside `ModuleWorkspace` |
| 11 | No child-feature pollution in global sidebar | Pass |
| 12 | Module cards and sidebar use the same source | Pass — launcher + sidebar derive from `ERP_NAV_SECTIONS` |
| 13 | Routes resolve | Pass |
| 14 | Deep links work | Pass — children + `products/:id` + POS extra paths |
| 15 | Existing aliases work | Pass — registered, not redirected |
| 16 | No accidental duplicate implementations | Pass — remaining duplicates are documented aliases |
| 17 | No orphan pages | Pass — every registry path has an element |
| 18 | No broken imports | Pass — typecheck + build |
| 19 | Mobile navigation works | Pass — same 39 modules as a drawer |
| 20 | Desktop navigation works | Pass — expanded sidebar + header |
| 21 | Permissions remain intact | Pass — `canShowNavItem` / `requiredPermissionForPath` / `AuthorizationService` |
| 22 | Authentication remains intact | Pass — `ProtectedRoute` + API `requireAuth` |
| 23 | APIs remain intact | Pass — grouped Express routers, 39-row ownership table |
| 24 | Database remains intact | Pass — Supabase only; no SQLite/Dexie/IndexedDB |
| 25 | Existing business logic remains intact | Pass — domain suite 257; POS/sale writers not changed this phase |

---

## Module count

| Surface | Count |
|---|---|
| `ERP_NAV_SECTIONS` | 39 |
| `ERP_MODULE_REGISTRY` | 39 (same array) |
| `ERP_SIDEBAR_SECTIONS` | 39 parents, no children |
| `ERP_STABLE_PARENT_PATHS` | 39 |
| Launcher cards (`launcherModules()`) | 39 |
| `MODULE_API_OWNERSHIP` | 39 |
| Coming Soon parents (still visible) | 10 — 18, 27, 28, 32–38 |

---

## Module mapping

Official names are locked uppercase. Ownership is `folder` / `featureOwnership`. Coming Soon parents have `folder: null`.

| # | Name | Icon | Route | Permission | Ownership | Children |
|---|---|---|---|---|---|---|
| 01 | COMMAND CENTER | dashboard | `/command-center` | `dashboard.view` | `dashboard` | Modules |
| 02 | POS / SALES | pos | `/pos` | `pos.sell` | `pos` | New Sale, Hold / Resume, Invoices, Register, Returns, Exchange, Payments, Discounts, References, Salesmen, Installments, Settings |
| 03 | PRODUCT & CATALOG | products | `/product-catalog` | `products.read` | `product-management` | Products, New Product, Categories, Subcategories, Brands, Companies, Units, Pricing, Barcodes, QR, Variants, Attributes, Media, Specifications |
| 04 | PURCHASING | purchases | `/purchasing` | `purchases.read` | `purchases` | Purchases, Returns, Suppliers, Ledger, Price Lists, Payables, Performance, Automation |
| 05 | INVENTORY | inventory | `/inventory` | `inventory.view` | `inventory` | Inventory, Movements, Batches, Serials, Expiry, Adjustments, Damaged, Counts |
| 06 | WAREHOUSE / WMS | warehouse | `/warehouse` | `warehouses.manage` | `warehouses` | Warehouses, Racks, Shelves, Bins, Receiving, Dispatch, Transfers |
| 07 | DELIVERY / LOGISTICS | delivery | `/delivery` | `deliveries.view` | `delivery` | Delivery |
| 08 | CUSTOMERS / CRM | customers | `/customers` | `customers.read` | `customers` | Customers, Ledger, Receivables, Credit, History, Installments, CRM, Campaigns, Engagement |
| 09 | SERVICE MANAGEMENT | service | `/service` | `service.manage` | `service-repair` | Service, Complaints, Technicians, Repairs, Charges |
| 10 | WARRANTY | warranty | `/warranty` | `warranty.manage` | `warranty` | Warranty, Replacements, History |
| 11 | ACCOUNTS & FINANCE | accounts | `/accounts` | `accounts.read` | `accounts` | Accounts, Cash, Journals, Receipts, P&L, Expenses, Period Reports |
| 12 | BANKING & PAYMENTS | banking | `/banking` | `banking.manage` | `banking` | Banking |
| 13 | REPORTS & BUSINESS INTELLIGENCE | reports | `/reports` | `reports.view` | `reports` | Reports, BI |
| 14 | AI & AUTOMATION | camera | `/ai` | `ai.recognize` | `ai-camera` | AI Camera, AI Insights |
| 15 | MARKETING & LOYALTY | loyalty | `/marketing` | `loyalty.view` | `loyalty` | Loyalty, Offers, Redeem, SMS, WhatsApp, Marketing |
| 16 | B2B / WHOLESALE | orders | `/b2b` | `b2b.manage` | `orders` | B2B, Quotations, Orders |
| 17 | ONLINE STORE | orders | `/online-store` | `store.manage` | `system` | Store |
| 18 | MOBILE | devices | `/mobile` | `settings.manage` | none (placeholder) | Coming Soon |
| 19 | ORGANIZATION / BRANCHES | branches | `/organization` | `branches.manage` | `branches` | Branches, Membership |
| 20 | HR & PAYROLL | salesman | `/hr` | `hr.view` | `system` | HR, Salesmen, References, Commissions |
| 21 | TAX / FBR | tax | `/tax` | `tax.view` | `tax` | Tax, Rates, Tax Reports |
| 22 | DOCUMENT MANAGEMENT | documents | `/documents` | `documents.view` | `documents` | Documents |
| 23 | WORKFLOW / APPROVALS | approvals | `/workflows` | `approvals.act` | `approvals` | Approvals |
| 24 | NOTIFICATIONS | notifications | `/notifications` | `notifications.view` | `notifications` | Notifications |
| 25 | USERS / ROLES / PERMISSIONS | users | `/users` | `users.manage` | `users` | Users, Roles, Permissions, User Overrides |
| 26 | SECURITY / AUDIT | audit | `/security` | `audit.view` | `audit` | Audit, Security |
| 27 | OFFLINE / LOCAL OPERATIONS | warehouse | `/offline` | `settings.manage` | none (placeholder) | Coming Soon |
| 28 | SYNC CENTER | import | `/sync` | `settings.manage` | none (placeholder) | Coming Soon |
| 29 | BACKUP / DISASTER RECOVERY | backup | `/backup` | `backup.view` | `backup` | Backup, Restore Points |
| 30 | INTEGRATION HUB | admin | `/integrations` | `integrations.view` | `system` | Integrations |
| 31 | DEVICES / PRINTING | devices | `/devices` | `devices.manage` | `devices` | Devices, Cash Drawer, Device Events, Printing, Print Queue, Preview |
| 32 | INDUSTRY ENGINE | industry | `/industry` | `settings.manage` | none (placeholder) | Coming Soon |
| 33 | CUSTOMIZATION ENGINE | customize | `/customization` | `settings.manage` | none (placeholder) | Coming Soon |
| 34 | RULES / AUTOMATION ENGINE | rules | `/automation` | `settings.manage` | none (placeholder) | Automation, Transaction Linking, Rules |
| 35 | CLIENT / TENANT MANAGEMENT | users | `/tenants` | `settings.manage` | none (placeholder) | Coming Soon |
| 36 | SUBSCRIPTION / BILLING | accounts | `/subscription` | `settings.manage` | none (placeholder) | Coming Soon |
| 37 | USAGE / METERING | reports | `/usage` | `settings.manage` | none (placeholder) | Coming Soon |
| 38 | DEVELOPER PLATFORM | customize | `/developer` | `settings.manage` | none (placeholder) | Coming Soon |
| 39 | SYSTEM ADMINISTRATION | admin | `/settings` | `settings.manage` | `system` | Company, Localization, Currency, Language, Date & Numbering, Numbering, Templates, Barcode, POS, Email, SMS, Storage, Logs, Maintenance, Import, Export, Import Templates |

Child features live in `ModuleContextNav` / command palette. They are not global sidebar rows.

---

## Route mapping

`ERP_MODULES` is flattened from `ERP_NAV_SECTIONS` (parents + children + aliases). The router maps each path with `elementForModulePath`:

- listed in `IMPLEMENTED_ROUTES` → live page
- `/settings/*` Coming Soon children → `SystemComingSoonPage`
- other unimplemented registry paths → `ModulePlaceholderPage`
- unknown path inside the shell → `NotFoundPage` (still behind `ProtectedRoute`)

### Parent aliases (old URLs stay registered, no redirects)

| Parent | Canonical | Alias |
|---|---|---|
| 01 | `/command-center` | `/` |
| 03 | `/product-catalog` | `/products` |
| 04 | `/purchasing` | `/purchases` |
| 06 | `/warehouse` | `/warehouses` |
| 07 | `/delivery` | `/deliveries` |
| 14 | `/ai` | `/ai-camera` |
| 15 | `/marketing` | `/loyalty` |
| 19 | `/organization` | `/branches` |
| 23 | `/workflows` | `/approvals` |
| 26 | `/security` | `/audit` |
| 32 | `/industry` | `/industry-engine` |
| 33 | `/customization` | `/customization-engine` |
| 34 | `/automation` | `/rules-engine` |
| 36 | `/subscription` | `/billing` |

### Extra deep links (not promoted to global modules)

| Path | Binding | Owner |
|---|---|---|
| `/products/:id` | `ProductFormPage` | 03 PRODUCT & CATALOG |
| `/pos/new` | `PosPage` (same as `/pos`) | 02 POS / SALES |
| `/pos/customers` | `PosCustomersPage` hub | 02 (prefix match; not a sidebar child) |
| `/pos/products` | `PosProductsPage` hub | 02 |
| `/pos/reports` | `PosReportsPage` hub | 02 |

### Shared page bindings (intentional)

Several children reuse one screen (taxonomy tabs, warehouse locations, service sections, tax rates, import/export, printing, devices). Canonical vs duplicate pairs are listed in `DUPLICATE_ROUTE_PAIRS`. Related-but-distinct screens (`sameComponent: false`) stay separate: New Sale vs Hold, Returns vs Exchange, Inventory vs Stock Ops, Security vs Audit, CRM installments vs POS installments, HR salesman vs POS salesmen.

---

## Duplicate cleanup

No accidental second module tree, second router, or second ERP shell was found.

Already cleaned / locked:

- One registry: launcher (`launcherModules`) and sidebar (`ERP_SIDEBAR_SECTIONS`) both derive from `ERP_NAV_SECTIONS`.
- One shell: login/auth pages are outside the app; every product URL is `ProtectedRoute` → `AppShell` → `ModuleWorkspace` → `Outlet`.
- POS is not a second app: `POSShell` wraps POS environment pages inside the module workspace. Global sidebar still shows the 39 parents. There is no “ERP Home” product nav.
- Page re-exports (not duplicate products): `DashboardPage` → `ModuleLauncherPage`; `SalesManagementPage` → `RegisterPage`.
- Aliases reuse the same element. They are not merged and not redirected.

Leftover unused files (not mounted; not a second running shell):

- `apps/web/src/features/pos/design-system/POSLayout.tsx` — defined, not exported from the POS design-system barrel, not imported by the router.
- `apps/web/src/features/system/SystemAdminLayout.tsx` — defined, not imported. Module 39 uses `SystemAdminHome` + `ModuleWorkspace`.

These files were **not deleted** in this verification phase.

---

## Architecture facts

### One AppShell

```
Login / forgot / reset
ProtectedRoute
  AppShell
    GlobalSidebar (39 parents)
    GlobalHeader
    main
      ModuleWorkspace
        ModuleHeader + ModuleContextNav
        POSShell (only POS environment paths)
        Outlet (page)
```

Mobile: same sidebar as a drawer (`data-erp-nav="drawer"` / `drawer-open`).  
Tablet: same sidebar collapsed to an icon rail.  
Desktop: same sidebar expanded.

### Permissions and authentication

- Nav and workspace tabs use `canShowNavItem(permission, grantedCount, hasPermission)`.
- Route gate: `requiredPermissionForPath` → `UnauthorizedPage` when keys are loaded and the key is missing.
- Session: `AuthProvider` + `ProtectedRoute` (`Navigate` to `/login` when no session).
- API: `requireAuth` Bearer token against Supabase; grouped mounts under `/api/v1/*` (not 39 Express routers).

### APIs and database

- Ownership table: `apps/api/src/module-api-ownership.ts` — 39 modules, grouped routers.
- Database client: `packages/db` → Supabase. No Dexie, IndexedDB, or SQLite runtime.

### Business logic

Phase 10 did not change sale posting, refunds, stock, POS checkout, `usePosSession`, `posApi.postSale`, or schema. Domain tests remain the lock.

---

## Browser console

Inspected at `http://localhost:5173` (Vite 6.4.3). Unauthenticated session.

| URL opened | Result |
|---|---|
| `/login` | Login form. Title `Electronic ERP`. React root present. No Vite error overlay. |
| `/pos` | Redirect to `/login` (auth intact). |
| `/products` | Redirect to `/login` (alias still gated). |
| `/offline` | Redirect to `/login` (Coming Soon module still registered, not hidden). |
| `/this-route-does-not-exist` | Redirect to `/login` (wildcard still behind `ProtectedRoute`). |

Console / network on `/login`:

| Check | Result |
|---|---|
| Errors | None observed |
| Failed requests (`responseStatus >= 400`) | None |
| React warnings on the login page | None observed |
| Routing errors | None (redirect is the designed gate) |
| Hydration errors | Not applicable — SPA uses `ReactDOM.createRoot`, not `hydrateRoot` |
| Duplicate key errors | None |
| Vite overlay | Absent |

Authenticated 39-module pages were not opened in the browser (no session). They were rendered in `module-navigation-qa.test.tsx` (every parent and child inside `AppShell`). That suite would fail on render exceptions, blank 404 headings, duplicate shells, or missing workspace titles.

Test stderr includes React Router v6 **future-flag warnings** (`v7_startTransition`, `v7_relativeSplatPath`). These are library upgrade notices, not routing failures.

---

## Remaining known issues

1. **Coming Soon is product-complete, not feature-complete.** Modules 18, 27, 28, 32–38 (and many children under 03/04/08/11/39) open in the same shell with placeholder copy. They are not hidden.
2. **Shared screens.** Several child URLs show a section of one parent page (racks on warehouses, ledger on customers, etc.). URLs resolve; they are not separate implementations.
3. **Unused layout files.** `POSLayout.tsx` and `SystemAdminLayout.tsx` are dead code. Safe to remove later; not mounted today.
4. **POS hub shortcuts.** `/pos/customers`, `/pos/products`, `/pos/reports` are extra POS environment URLs, not global modules and not module-02 workspace children.
5. **`token()` throws synchronously when unauthenticated.** Production stays behind `ProtectedRoute`. Not a navigation-registry bug.
6. **Production bundle size.** Vite warns the main JS chunk is >500 kB. Architecture is intact; code-splitting is out of scope for this phase.
7. **React Router v7 future flags.** Warnings in tests only. No current routing break.
8. **Historical docs.** Older POS QA text described hiding the 39-module tree on POS. Current locked architecture keeps the ERP sidebar on POS and adds `POSShell` as workspace chrome only.

None of these are reasons to hide a module or split POS into a second application.

---

## Test results

```
npm run typecheck  → pass (contracts, domain, ai, db, hardware, ui, api, web, desktop)

npm test           → pass
  packages/contracts   12 passed
  packages/domain     257 passed
  apps/api             37 passed
  apps/web            164 passed
```

Architecture locks include:

- `apps/web/src/app/module-navigation-qa.test.tsx` — 39 parents, ownership, real-page open, children, launcher/back/refresh
- `apps/web/src/app/smoke.test.tsx` — names, order, child titles, one AppShell, no child pollution
- `apps/web/src/app/shell/erp-responsive.test.tsx` — mobile drawer / tablet rail / desktop chrome
- `apps/api/src/module-api-ownership.test.ts` — 39 API ownership rows

First `npm test` in this session hit a Vitest worker RPC timeout after 164/164 passed (machine load). Immediate rerun: **exit 0**, 164 passed, no worker error.

---

## Build result

```
npm run build  → pass

packages/*     tsc
apps/api       tsc
apps/web       tsc --noEmit && vite build
               449 modules transformed
               dist/assets/index-Bu-x8P9S.js  1,938.52 kB (gzip 406.13 kB)
               built in 16.70s
```

Chunk-size warning only. Build succeeded.

---

## Stop

Phase 10 verification is complete. Do not start module-specific redesign from this report.
