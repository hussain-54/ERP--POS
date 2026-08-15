# PHASE 3 — FEATURE STRUCTURE REPORT

**Date:** 2026-08-15  
**Scope:** Web UI folder ownership only. Routes, APIs, contracts, domain, DB, and Supabase were not redesigned.  
**Runtime:** Online-only.

This phase moved existing pages into 39-module feature folders. It did **not** add functionality, wrappers, or empty folders for unimplemented engines.

---

## Files moved

### Folder renames (equivalent structure, clearer names)

| From | To | Why |
|------|----|-----|
| `features/catalog/` | `features/product-management/` | Module 02 |
| `features/parties/` | `features/customers/` | Module 12 (then suppliers/installments extracted) |
| `features/finance/` | `features/accounts/` | Module 16 (then banking/expenses extracted) |
| `features/reporting/` | `features/reports/` | Module 19 (then dashboard extracted) |
| `features/commerce/` | `features/crm/` | Module 18 (then loyalty/orders/system extracted) |
| `features/ai/` | `features/ai-camera/` | Module 04 (insights moved to reports) |
| `features/admin/` | `features/users/` | Module 26 (then permissions/approvals/audit/branches extracted) |
| `features/enterprise/` | `features/system/` | Module 39 home (then tax/documents/notifications extracted) |
| `features/hardware/` | `features/printing/` | Module 33 (then devices extracted) |

### Pages extracted to the owning module

| File | From | To |
|------|------|----|
| `BarcodesPage.tsx` | catalog | `barcode-qr/` (03) |
| `ImportExportPage.tsx` | catalog | `import-export/` (32) |
| `SuppliersPage.tsx` | parties | `suppliers/` (13) |
| `CreditInstallmentsPage.tsx` | parties | `installments/` (22) |
| `QuotationsPage.tsx` | after-sales | `quotations/` (06) |
| `ServicePage.tsx` | after-sales | `service-repair/` (14) |
| `WarrantyPage.tsx` | after-sales | `warranty/` (15) |
| `after-sales-api.ts` | after-sales | `quotations/` (shared client) |
| `BankingPage.tsx` | finance | `banking/` (17) |
| `ExpensesPage.tsx` | finance | `expenses/` (21) |
| `ReportsPage.tsx` (re-export) | finance | `reports/` |
| `DashboardPage.tsx` | reporting | `dashboard/` (01) |
| `WarehousesPage.tsx` | inventory | `warehouses/` (11) |
| `TransfersPage.tsx` | purchases | `warehouses/` (11) |
| `DeliveriesPage.tsx` | purchases | `delivery/` (08) |
| `SalesmanPage.tsx` | pos | `salesman/` (20) |
| `LoyaltyPage.tsx` | commerce | `loyalty/` (23) |
| `B2bPage.tsx` | commerce | `orders/` (07) |
| `OnlineStorePage.tsx` | commerce | `system/` (39) |
| `AiInsightsPage.tsx` | ai | `reports/` (19) |
| `PermissionsPage.tsx` | admin | `permissions/` (27) |
| `ApprovalsPage.tsx` | admin | `approvals/` (25) |
| `AuditPage.tsx` | admin | `audit/` (28) |
| `BranchesPage.tsx` | admin | `branches/` (30) |
| `TaxPage.tsx` | enterprise | `tax/` (31) |
| `DocumentsPage.tsx` | enterprise | `documents/` (24) |
| `NotificationsPage.tsx` | enterprise | `notifications/` (29) |
| `DevicesPage.tsx` | hardware | `devices/` (35) |
| `BackupPage.tsx` | infrastructure | `backup/` (34) |
| `SecurityPage.tsx` | infrastructure | `system/` (39) |
| `IntegrationsPage.tsx` | infrastructure | `system/` (39) |
| `infrastructure-api.ts` | infrastructure | `system/` (shared client) |
| `HrPage.tsx` | enterprise | stayed in `system/` (39) |
| `PaymentsPage.tsx` | parties | stayed in `customers/` (used by POS nav) |

Removed empty leftover folders: `after-sales`, `infrastructure`. Other old names were renamed in place.

**Not created (no real pages yet):** `industry/`, `customization/`, `automation/`. Those remain Coming Soon routes via `ModulePlaceholderPage`.

---

## Imports updated

Router (`apps/web/src/app/router.tsx`) now imports from the new folders. **Route URLs are unchanged.**

Cross-feature API imports updated in:

- `pos/PosPage.tsx`
- `pos/SalesManagementPage.tsx`
- `pos/session/pos-customer-repository.ts`
- Moved pages that used `./api` from a sibling that no longer lives beside them

Shared API clients were **not duplicated**. They sit with the primary owner:

| Client | Lives in | Imported by |
|--------|----------|-------------|
| `catalog-api.ts` | `product-management/` | product pages, barcode-qr, POS |
| `parties-api.ts` | `customers/` | customers, suppliers, installments, POS |
| `after-sales-api.ts` | `quotations/` | quotations, service-repair, warranty |
| `finance-api.ts` | `accounts/` | accounts, banking, expenses |
| `reporting-api.ts` | `reports/` | reports, dashboard |
| `admin-api.ts` | `users/` | users, permissions, approvals, audit, branches, delivery |
| `commerce-api.ts` | `crm/` | crm, loyalty, orders, system store, POS |
| `ai-api.ts` | `ai-camera/` | camera page, reports insights, POS |
| `enterprise-api.ts` | `system/` | HR, tax, documents, notifications, salesman, POS |
| `infrastructure-api.ts` | `system/` | security, integrations, backup, import-export |
| `hardware-api.ts` | `printing/` | printing, devices |
| `inventory-api.ts` | `inventory/` | inventory, warehouses, POS, purchases |
| `purchases-api.ts` | `purchases/` | purchases, warehouses transfers, delivery |
| `pos-api.ts` | `pos/` | POS screens |

---

## Module ownership (web UI)

```
features/
  dashboard/              01 Dashboard
  product-management/     02 Product Management
  barcode-qr/             03 Barcode & QR
  ai-camera/              04 AI Camera
  pos/                    05 POS / Sales (terminal + invoices/returns/sales register)
  quotations/             06 Quotations
  orders/                 07 Orders (B2B page)
  delivery/               08 Delivery
  purchases/              09 Purchases
  inventory/              10 Inventory
  warehouses/             11 Warehouses (+ transfers)
  customers/              12 Customers (+ payments page)
  suppliers/              13 Suppliers
  service-repair/         14 Service & Repair
  warranty/               15 Warranty
  accounts/               16 Accounts
  banking/                17 Banking
  crm/                    18 CRM & Marketing
  reports/                19 Reports & Analytics (+ AI insights)
  salesman/               20 Salesman / Field Sales
  expenses/               21 Expenses
  installments/           22 Installments
  loyalty/                23 Loyalty
  documents/              24 Documents
  approvals/              25 Approval Workflow
  users/                  26 Users & Role Management
  permissions/            27 Permissions
  audit/                  28 Audit Trail
  notifications/          29 Notification Center
  branches/               30 Multi-Branch
  tax/                    31 Tax & Pakistan Compliance
  import-export/          32 Import / Export
  printing/               33 Printing
  backup/                 34 Backup & DR
  devices/                35 Devices / Printing
  system/                 39 System Administration
  auth/                   login (outside 39-module tree)
  modules/                placeholder page
```

Unchanged layers (must stay):

- `packages/domain`, `packages/db`, `packages/contracts`, `packages/ui`
- `apps/api` routes
- POS design-system and session code remain under `features/pos/`

---

## Duplicate components discovered (kept)

None were deleted.

| Duplicate | Ownership now | Future consolidation |
|-----------|---------------|----------------------|
| `/pos` and `/held-sales` → `PosPage` | `pos/` | Keep both URLs |
| `/credit` and `/installments` → `CreditInstallmentsPage` | `installments/` (customers nav still points here) | Optional split later |
| `/quotations` and `/orders` → `QuotationsPage` | `quotations/`; `orders/` owns `B2bPage` only | Dedicated orders list later |
| `/returns` and `/exchange` → `ReturnsPage` | `pos/` | Keep |
| Taxonomy aliases (`/categories`, `/brands`, …) | `product-management/TaxonomyPage` | Keep |
| `ReportsPage.tsx` re-export of `ReportsHubPage` | `reports/` | Remove re-export when unused |
| `packages/ui` vs `pos/design-system` | shared UI vs POS chrome | Do not merge this phase |
| `PosSidebar` re-export of `POSSidebar` | `pos/components` | Cosmetic alias |

---

## Unresolved structural issues

1. **`/orders` still renders `QuotationsPage`.** `features/orders/` only contains B2B. A dedicated sales-order screen does not exist.
2. **`PaymentsPage` lives under `customers/`** while the sidebar lists it under POS. Behavior unchanged; folder follows the party API.
3. **Shared API clients still cross module boundaries** (intentional). Splitting them would duplicate HTTP code.
4. **Quotations page still lists orders** on the same screen. Not split (would be a redesign).
5. **Industry / Customization / Automation** have no feature folders (placeholders only).
6. **POS invoices/returns/sales-management** stay in `pos/` because they are POS sales documents, not separate engines.

---

## Errors found / fixed

- After the moves, relative `./api` imports in extracted pages were broken. Updated to `@/features/<owner>/…` before typecheck.
- No domain/API/database errors. No business-logic changes.

---

## Validation results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | All 9 workspaces |
| `npm run lint` | **PASS** | Alias for typecheck |
| `npm test` | **PASS** | 271 tests (contracts 12, domain 222, api 32, web 5) |
| `npm run build` | **PASS** | Vite chunk-size warning only |
