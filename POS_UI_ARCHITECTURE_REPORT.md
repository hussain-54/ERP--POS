# POS UI Architecture Report — Phase 1

Audit only. **No POS source files were changed.**

Reference screenshots were not stored in the repository. This report maps the **live codebase** to the requested industrial POS model (blue/white terminal, two-zone New Sale, operational Hold / Sales screens). Later phases must use the supplied screenshots as the visual source of truth.

---

## 1. What currently exists

### Environment

POS is already a **separate environment** from the 39-module ERP:

- `AppShell` detects `isPosEnvironmentPath` and renders `POSShell` (not the ERP sidebar).
- Scope: `/pos`, `/pos/new`, `/pos/customers`, `/pos/products`, `/pos/reports`, `/held-sales`, `/invoices`, `/sales-management`, `/returns`, `/exchange`, `/payments`, `/discounts`, `/pos/references`, `/pos/salesmen`, `/pos/installments`, `/pos/settings`.
- **Not** POS chrome: `/salesman`, `/installments`, `/credit`, `/settings/pos`.

### Routes and pages (canonical)

| Screen | Route | Page | Notes |
|---|---|---|---|
| New Sale | `/pos` | `PosPage.tsx` | Alias `/pos/new` |
| Hold / Resume | `/held-sales` | `HeldSalesPage.tsx` | Also a holds **drawer** on New Sale |
| Invoices / sales list | `/invoices` | `InvoicesPage` → `SalesWorkspace` | Titled “Sales Dashboard” |
| Register / shift | `/sales-management` | `RegisterPage` via `SalesManagementPage` alias | Cash shift, not a sales list |
| Returns | `/returns` | `ReturnsPage.tsx` | |
| Exchange | `/exchange` | `ExchangePage.tsx` | Return + replacement sale |
| Payments | `/payments` | `PaymentsPage.tsx` | Receipt register, not checkout |
| Discounts | `/discounts` | `DiscountsPage.tsx` | Policy + approvals |
| References | `/pos/references` | `ReferencesPage.tsx` | |
| Salesmen | `/pos/salesmen` | `SalesmenPage.tsx` | Roster; module 20 stays `/salesman` |
| Installments | `/pos/installments` | `InstallmentsPage.tsx` | Master stays `/installments` |
| Settings | `/pos/settings` | `SettingsPage.tsx` | Read-only |
| Customers hub | `/pos/customers` | `PosHubPages.tsx` | Launcher to `/pos` |
| Products hub | `/pos/products` | `PosHubPages.tsx` | Launcher to `/pos` |
| Reports hub | `/pos/reports` | `PosHubPages.tsx` | Cards to live registers |

### Shell (already matches the requested hierarchy)

```
POSShell
 ├── POSHeader     (menu, branch, terminal, cashier, shift, clock, held, notifications, user)
 ├── POSSidebar    (navy) + POSNav + cash drawer + close shift
 ├── POSWorkspace
 └── POSShortcutBar  F1–F8
```

Tokens live in `pos-tokens.css` (`.pos-terminal`). Primitives: `POSButton`, `POSCard`, `POSTable`, `POSTabs`, `POSSearch`, `POSModal`, `POSDrawer`, `POSStatCard`, etc.

### New Sale (already two-zone)

```
PosSaleLayout
 ├── PosProductPanel (search, Barcode/QR/Camera/Manual, Recent/Favorites/Categories, grid)
 └── Sale column
      ├── PosCustomerPanel
      ├── PosCart / PosCartRow
      ├── PosTotals  (via PosPaymentPanel)
      └── PosPaymentPanel (methods, PAY NOW, HOLD SALE, QUOTATION)
```

Session: `usePosSession` → domain `calculatePosCartTotals`. Checkout: `preparePosPayments` + `posApi.postSale`. Search: `posApi.searchProducts` (paged). Customers: `posCustomerRepository`.

### Canonical business sources (do not duplicate)

| Concern | Source of truth |
|---|---|
| Cart math | `@electronic-erp/domain` `pos-cart` via `usePosSession` |
| Checkout / tax / discount / stock | `sale-transaction.ts` + `PosRepository.postSale` |
| Payments on sale | `pos-payment.ts` + `preparePosPayments` |
| Hold lifecycle | `pos-hold.ts` + `/api/v1/pos/holds*` |
| Returns / exchange | `pos-return.ts` / `pos-exchange.ts` |
| HTTP | `pos-api.ts` (`session/pos-repository.ts` is a thin alias) |
| Sales list query | `searchSalesManagement` — **one** list, used by Invoices |
| Shift | `RegisterPage` + `register-shift.ts` |

### Size / hot files

- `PosPage.tsx` ~2,230 lines — orchestration + effects + shortcuts + checkout; children are already split.
- Design-system ~30 primitives.
- Feature pages for each POS child already exist and use POS primitives (not a second ERP skin).

---

## 2. What should be retained

**Do not rebuild these.** Later phases restyle or restructure UI around them.

- All live routes and aliases (`/pos/new`, `SalesManagementPage` → `RegisterPage`, `POSTopbar` → `POSHeader`).
- Domain sale/hold/return/payment math and Supabase `PosRepository`.
- `usePosSession`, `posApi`, `posCustomerRepository`, `pos-catalog-load` paging.
- Two-zone `PosSaleLayout` + mobile drawers.
- Product discovery tools, tabs, grid cards (image, name, brand, SKU, price, stock, favorite).
- Cart columns `# / Product / Qty / Unit / Rate / Discount / Tax / Total / delete`.
- Totals rows including GRAND TOTAL, tax, discounts, delivery, round-off (honest zeros).
- Payment tiles + Pay Now / Hold / Quotation.
- F1–F8 shortcut bar and `pos:shortcut` handling.
- Hold / Resume workspace, Sales Dashboard KPIs/filters/tabs, Returns/Exchange workflows, Register shift.
- Permissions (`pos-security.ts`).
- Online-only rule (no SQLite / Dexie / offline sync).

---

## 3. What should be restructured (UI only)

These are **visual / IA** gaps vs the requested terminal — not missing backends.

### Navigation vs reference

Sidebar is **seven flat links**. “POS” is New Sale. Invoices, Register, Returns, Exchange, Payments, Salesmen, Installments only appear under **Reports** (hub + aliases).

Requested model:

```
POS
  New Sale
  Hold / Resume
  Customers
  Products
  Price & Discount
  Reports
  Settings
```

Restructure **labels and grouping** in `POS_SHELL_NAV` / `POSNav`. Do **not** add new routes. Do **not** pull the 39-module tree into the terminal.

### Hub pages

`/pos/customers` and `/pos/products` are “Open POS” cards. They should either:

- stay as shortcuts (honest), or
- become thin operational views that **reuse** `PosCustomerPanel` / product search without a second catalog load.

Do not clone ERP Customers / Product Management.

### New Sale chrome

Above the product grid, `PosPage` still shows warehouse, last invoice, grand badge, Easy/Advanced, language. That reads as **ERP toolbar**, not a register. Warehouse is required for stock; it should shrink into header/settings, not a second top bar.

### Cart header

Reference: `CART (X ITEMS)` + **Apply Discount** + **Clear Cart**.  
Current: `Cart (X)` + Manual Entry + Clear Cart. Invoice discount lives in the payment dock. Move **Apply Discount** to the cart header visually; keep the same `invoiceDiscount` state.

### Naming

| User language | Current |
|---|---|
| Sales Management dashboard | `/invoices` “Sales Dashboard” |
| Register / cashier shift | `/sales-management` |

Keep the URLs. Align **titles/breadcrumbs** (`Home > Sales Management > Sales Dashboard`) without a second sales API.

### Hold metrics

Held sales KPIs: Active, Expiring, Expired, Today, **Your Holds**. Spec wants **Total Held Value**. Add that metric from existing `computeHoldStats` / snapshot totals — no new API if amounts are already on the hold list.

---

## 4. What should be consolidated

Already consolidated (do not re-split):

- One shell, one cart math, one payment workflow, one product search API, one sales register query.
- Deleted unused duplicates: `POSLayout`, `POSToast`, `PosCartPanel`, `components/PosHeader`, `components/PosSidebar`.
- `POSTopbar` and `SalesManagementPage` are **aliases** — keep them.

Still two hold UIs by design:

- New Sale **drawer** (`PosHoldsPanel`) — in-sale hold/resume.
- `/held-sales` — operational workspace.

Keep both; restyle them to the same table language. Do not merge into one page.

`PosPage` should not gain more JSX. If Phase 4 splits files, extract presentational sections only (`NewSaleToolbar`, wiring via existing `pageOpsRef`) — **no second session store**.

---

## 5. UI / performance problems

### UI (why it can still feel like ERP)

1. Extra New Sale toolbar (warehouse / mode / locale / grand badge).
2. Reports-as-bucket hides daily cashier screens from the left nav.
3. Customer/Products hubs are empty, so those nav items feel fake.
4. Tokens inherit `--erp-brand` rather than a locked POS blue from the screenshots.
5. Cards/tables are correct structurally but spacing, type scale, PAY NOW size, and grid density need screenshot comparison (screenshots not in-repo).
6. Header cashier control is a **disabled** select (display only).
7. Notifications go to ERP `/notifications` and leave the POS shell.
8. `PosPage` is still one large orchestrator (~2.2k lines) — harder to tune layout without touching logic.
9. Purple secondary token equals brand; unused as a distinct accent.

### Performance (mostly already addressed)

- Search: debounce 180ms, limit 24/50, visible page 12 — **keep**.
- Totals memoized in `usePosSession`.
- Shell branch/device fetch keyed by membership.
- Hold names: `getCustomer(id)` not full `listCustomers`.
- Remaining: `PosPage` re-renders the whole terminal on many local states; children are `memo` but the parent is large. Sales Dashboard still loads filter lists (`listCustomers`, `listUsers`) on mount — required for visible filters, not dead calls.
- App JS bundle ~1.9 MB (whole ERP SPA). POS is not a separate bundle.

Do not invent a catalog cache or offline store.

---

## 6. Proposed POS architecture

Keep the current tree. Treat the screenshot spec as a **fidelity pass** on this structure:

```
POSShell                         # Phase 3 — visual + nav labels
 ├── POSHeader
 ├── POSSidebar / POSNav
 ├── POSWorkspace
 │    ├── PosPage                # Phase 4 — New Sale density
 │    │    PosSaleLayout
 │    │     ├── ProductDiscovery (PosProductPanel)
 │    │     └── SalePanel
 │    │          Customer / Cart / Totals / Payment
 │    ├── HeldSalesPage          # Phase 5
 │    ├── SalesWorkspace         # Phase 6 — title “Sales Management”
 │    └── other POS pages        # Phase 7
 └── POSShortcutBar              # already F1–F8
```

**Rules for Phases 2–10**

- Tokens and primitives only inside `.pos-terminal` / `design-system/`. No second UI kit.
- No new POS routes unless a screenshot requires a screen that already has a URL (it does).
- No new sale/payment/hold calculators.
- No ERP module restyle.
- Screenshot comparison is mandatory in Phase 3–4; “similar blue” is not done.

---

## 7. Exact files / components that should change

**Phase 2 — tokens (visual only)**  
`apps/web/src/features/pos/pos-tokens.css`  
`design-system/POSButton.tsx`, `POSCard.tsx`, `POSInput.tsx`, `POSSearch.tsx`, `POSTable.tsx`, `POSTabs.tsx`, `POSBadge.tsx`

**Phase 3 — shell**  
`POSShell.tsx`, `POSHeader.tsx`, `POSSidebar.tsx`, `POSNav.tsx`, `POSShortcutBar.tsx`, `POSWorkspace.tsx`  
`pos-ownership.ts` (`POS_SHELL_NAV` labels/order only)  
`pos-tokens.css` (sidebar width, header height)

**Phase 4 — New Sale**  
`PosPage.tsx` (layout chrome only)  
`PosSaleLayout.tsx`  
`PosProductPanel.tsx`, `PosDiscoveryTools.tsx`  
`PosCustomerPanel.tsx`  
`PosCart.tsx`, `PosCartRow.tsx`  
`PosTotals.tsx`  
`PosPaymentPanel.tsx`, `PaymentMethodGrid.tsx`, `PayNowButton.tsx`, `HoldSaleButton.tsx`, `QuotationButton.tsx`

**Phase 5**  
`HeldSalesPage.tsx`, `held-sales.ts` (display/KPI labels)

**Phase 6**  
`InvoicesPage.tsx`, `SalesWorkspace.tsx` (header/breadcrumb copy + table density)

**Phase 7**  
`RegisterPage.tsx`, `ReturnsPage.tsx`, `ExchangePage.tsx`, `PaymentsPage.tsx`, `DiscountsPage.tsx`, `ReferencesPage.tsx`, `SalesmenPage.tsx`, `InstallmentsPage.tsx`, `SettingsPage.tsx`, `PosHubPages.tsx`

**Phase 8**  
`pos-layout.ts`, `PosSaleLayout.tsx`, `pos-tokens.css` media queries

**Phase 9**  
`PosPage.tsx` (split presentational chunks if it reduces re-renders), `usePosSession.ts` (already memoized — verify only)

**Do not change (unless a proven UI bug)**  
`packages/domain/src/sale-transaction.ts`, `pos-cart.ts`, `pos-payment.ts`, `pos-hold.ts`, `pos-return.ts`, `pos-exchange.ts`  
`packages/db/src/repositories/pos-repository.ts`  
`apps/api/src/routes/pos.ts`  
Checkout handlers inside `PosPage` that call `posApi.postSale`

---

## Single source of truth (summary)

| Feature | Canonical |
|---|---|
| Shell | `POSShell` |
| Header | `POSHeader` (`POSTopbar` alias) |
| Nav | `POS_SHELL_NAV` + `POSNav` |
| New Sale | `PosPage` |
| Product search | `PosProductPanel` + `posApi.searchProducts` |
| Cart UI | `PosCart` |
| Cart math | `usePosSession` / `calculatePosCartTotals` |
| Customer | `PosCustomerPanel` |
| Payment UI | `PosPaymentPanel` |
| Pay / hold / quote | same panel + `posApi` / `afterSalesApi` |
| Hold workspace | `HeldSalesPage` |
| Sales list | `SalesWorkspace` on `/invoices` |
| Shift | `RegisterPage` on `/sales-management` |
| Shortcuts | `POS_SHORTCUTS` + `POSShortcutBar` |

---

## Phase 1 conclusion

The POS is **already an industrial terminal architecture** (dedicated shell, two-zone New Sale, live operational pages, one write path). It is not a blank CRUD screen.

What is **not** done relative to this brief: screenshot-level hierarchy (nav grouping, New Sale density, cart header actions, Sales Management titling, hub honesty, locked POS blue independent of “just recoloring ERP”).

**Phase 2 is not started.** Waiting for approval to begin the design-token pass only.
