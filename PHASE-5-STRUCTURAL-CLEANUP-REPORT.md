# PHASE 5 — STRUCTURAL CLEANUP REPORT

**Date:** 2026-08-15  
**Scope:** Navigation labels, hierarchy, shell chrome, and route fallbacks only.  
**Not in scope:** Feature deletion, duplicate-component removal, service merges, POS terminal redesign, sale/stock/payment logic.

---

## Objective

Make the ERP feel like one product: short names, no repeated sidebar rows, no empty expand groups, permission-aware nav, working collapse/mobile/active states, and no blank pages on unknown URLs.

No working routes, duplicate pages, or duplicate services were deleted.

---

## Naming convention

Parents and children use **short Title Case nouns**. Dropped “Management”, “Page”, “System”, “Center”, “Engine”, and “Workflow” from module titles.

| Before | After |
|--------|--------|
| Product Management | Products |
| Barcode & QR | Barcodes |
| AI Camera Product Recognition | AI Camera |
| POS / Sales | Sales |
| Service & Repair | Service |
| CRM & Marketing | CRM |
| Reports & Analytics | Reports |
| Salesman / Field Sales | Salesmen |
| Approval Workflow | Approvals |
| Users & Role Management | Users |
| Audit Trail | Audit |
| Notification Center | Notifications |
| Multi-Branch | Branches |
| Tax & Pakistan Compliance | Tax |
| Backup & Disaster Recovery | Backup |
| Devices / Printing | Devices |
| Industry Engine | Industry |
| Customization Engine | Customization |
| Rules / Automation Engine | Automation |
| System Administration | System |

Child labels were shortened the same way (for example Sales Management → **Register**, Business Intelligence → **BI**, Profit & Loss → **P&L**, Customer Segmentation → **Segments**, HR & Employees → **HR**).

Page headings inside existing screens were **not** redesigned. `/sales-management` still shows “Sales Management” on the page.

---

## Repeated labels removed (routes kept)

A child that used the **same URL as its parent** was hidden from the ERP sidebar (`sidebar: false`). The route is still registered.

| Module | Hidden sidebar child | Still works |
|--------|----------------------|-------------|
| Products | Products `/products` | Parent opens the list |
| Barcodes | Barcodes `/barcodes` | Parent opens barcodes |
| Sales | New Sale `/pos` | Parent opens the terminal |
| Sales | Customer / Checkout helpers `/pos` | Helpers remain on the terminal |
| Orders | Orders `/orders` | Parent opens orders |
| Purchases | Invoices `/purchases` | Parent opens purchases |
| Inventory | Stock `/inventory` | Parent opens stock |
| Warehouses | Warehouses `/warehouses` | Parent opens warehouses |
| Customers | Profiles `/customers` | Parent opens customers |
| Suppliers | Profiles `/suppliers` | Parent opens suppliers |
| Service | Job Cards `/service` | Parent opens service |
| Warranty | Claims `/warranty` | Parent opens warranty |
| CRM | Segments `/crm` | Parent opens CRM |
| Reports | Reports `/reports` | Parent opens reports |
| Salesmen | References `/salesman` | Parent opens salesman |
| Automation | Rules `/rules-engine` | Parent opens the placeholder |
| System | General `/settings` | Parent opens settings |

POS terminal sidebar still shows **New Sale** (deduped by path so checkout helpers are not listed twice).

Visible children under one parent now have unique titles and unique paths.

---

## Empty visual groups

Expand chevrons render only when the parent has **visible** children. Modules that are themselves the screen (Quotations, Banking, Salesmen, Installments, …) no longer show a one-item nested copy of the parent.

---

## Dead navigation

No nav item pointed at a missing route. Placeholder “Soon” rows still map to `ModulePlaceholderPage` or `availableOn`. **None were deleted.**

Duplicate implementations kept: `/held-sales`, `/credit`, `/exchange`, `/pos/salesmen`, `/pos/references`, `/pos/installments`, `/qr`, taxonomy aliases.

---

## Nav item contract

Every parent now has:

- icon
- label
- route
- permission key

Every child has:

- label
- route
- parent module
- permission key
- optional Soon badge

Permission mapping uses existing keys (`pos.sell`, `products.read`, `customers.read`, …).  
If the session has **no** permission keys loaded, the sidebar stays visible (fail open).  
If keys are loaded and the user lacks the mapped key, the item is hidden and a deep link shows **Not authorized** instead of a blank page. Login `ProtectedRoute` is unchanged.

---

## Shell behavior

| Concern | Result |
|---------|--------|
| Active state | Parent stays highlighted on child routes; child `end` match for the exact URL |
| Mobile | Drawer still slides in; collapse is ignored while the mobile menu is open |
| Collapsed sidebar | Desktop « / » toggle; icon-only 72px rail; children hidden; labels via `title` / sr-only |
| Deep links | Existing URLs plus `/products/:id`, `/products/new`, `/pos/new` |
| Refresh | Vercel already rewrites to `index.html`; unknown paths now render a 404 card, not an empty outlet |
| Unauthorized | Login wall unchanged; module permission gate when keys are present |

POS terminal chrome is still exact-path only (`/pos`, `/held-sales`, `/pos/new`).

---

## Changed files

| File | Change |
|------|--------|
| `apps/web/src/app/modules.ts` | Short names, sidebar flags, permission fields, `canShowNavItem` |
| `apps/web/src/app/shell/SidebarNav.tsx` | Permission filter, collapse, no empty child groups |
| `apps/web/src/app/shell/AppShell.tsx` | Collapse toggle, unauthorized outlet, command-palette filter |
| `apps/web/src/app/router.tsx` | Catch-all `NotFoundPage` |
| `apps/web/src/features/modules/RouteFallbackPage.tsx` | Unauthorized + 404 (new) |
| `apps/web/src/features/pos/design-system/POSSidebar.tsx` | Title “Sales”; unique paths |
| `apps/web/src/app/smoke.test.tsx` | Naming, sidebar uniqueness, collapse, permission fail-open |

---

## What was not changed

- SaleTransactionService, stock RPC, payment posting, returns, idempotency, Supabase, pricing resolver
- Duplicate pages/services (not merged)
- Working URLs (not renamed)
- Individual page layouts
- Phase 4B/4C features

---

## Validation

### Route smoke (automated)

`apps/web/src/app/smoke.test.tsx` checks:

- 39 parents, each with icon / label / route / permission
- Duplicate parent-path children hidden from the ERP sidebar
- Duplicate working URLs still registered
- Extra deep links `/products/new` and `/pos/new`
- Permission fail-open / fail-closed
- Collapsed sidebar hides child expanders
- Active Customers link href

### Commands

Ran from repo root after these edits. All **PASS**.

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (alias of typecheck) |
| `npm test` | PASS — 277 tests (contracts 12, domain 222, api 32, web 11) |
| `npm run build` | PASS (Vite chunk-size warning only) |
