# POS Architecture Consolidation

Date: 2026-08-20  
Sources: `docs/POS-MATURITY-AUDIT.md`, `docs/POS-PERFORMANCE-AUDIT.md`, `POS-DUPLICATION-REPORT.md`, `docs/POS_ARCHITECTURE.md`, live import/route trace.

Rule: do not change sale math, payments, inventory posting, or the 39-module ERP tree. POS stays an in-ERP module.

---

## 1. Canonical map (after this pass)

```
ERP AppShell (39 modules)
  └─ Module 02 POS / SALES  →  /pos
       ├─ POSShell (chrome only)
       │    POSHeader + POSTerminalNav (= POS_OWNERSHIP, 12 items) + POSWorkspace
       └─ Pages
            /pos, /pos/new          → PosPage          (New Sale)
            /held-sales             → HeldSalesPage
            /invoices               → InvoicesPage
            /sales-management       → RegisterPage     (alias SalesManagementPage)
            /returns                → ReturnsPage
            /exchange               → ExchangePage
            /payments               → PaymentsPage
            /discounts              → DiscountsPage
            /pos/references         → ReferencesPage
            /pos/salesmen           → SalesmenPage
            /pos/installments       → InstallmentsPage
            /pos/settings           → SettingsPage
            /pos/customers|products|reports → hub aliases (not a second IA)

UI state          usePosSession  (New Sale cart + customer)
                  domain pos-cart on Exchange replacement cart (isolated ticket)

Search            searchPosProducts → posApi → GET /api/v1/pos/products/search
                  → PosRepository.searchProducts

Create product    catalogApi.createProduct → POST /api/v1/catalog/products
                  → CatalogRepository.createProduct

Pricing           resolvePosUnitPrice / pickPriceLevel (domain pos-pricing)
Discount          pos-discount + discount-policy
Tax               pos-tax → calculatePosCartTotals → calculateSaleTotals
Checkout          validatePosCheckout + preparePosPayments
Post sale         posApi.postSale → PosRepository.postSale → SaleTransactionService.postSale
Payments          SaleTransactionService → PartiesRepository.postSplitPayment
Inventory         SaleTransactionService ports → stock movements (no UI writes)
Invoice           posApi.getInvoice → PosRepository.getInvoice
Supabase          packages/db repositories only (no component access)
```

---

## 2. Dependency map — duplicates reviewed

### 2.1 POS pages / routes

| Item | Usages | Routes | Imports | Logic difference | Decision |
| --- | --- | --- | --- | --- | --- |
| `PosPage` | New Sale terminal | `/pos`, `/pos/new` | `router.tsx` | Same component | **Canonical page.** `/pos` is the canonical route; `/pos/new` stays a registered alias. |
| `HeldSalesPage` | Hold workspace | `/held-sales` | router | List/resume parked tickets | **Keep.** Different job from New Sale. In-sale drawer (`PosHoldsPanel`) is the same hold API, not a second page. |
| `InvoicesPage` | Invoice register | `/invoices` | router | `searchSalesManagement` + `getInvoice` | **Keep.** |
| `RegisterPage` | Cash shift | `/sales-management` via `SalesManagementPage` re-export | router | Shift open/close | **Keep alias.** Not a second invoice list. |
| Hub `/pos/customers`, `/pos/products`, `/pos/reports` | Bookmarks, F3, breadcrumbs | `EXTRA_APP_PATHS` + router | `PosHubPages.tsx` | Stubs; do not search/create | **Keep routes.** Removed from terminal nav so they are not a second IA. Products hub now links to `/products/new`. |
| `/credit` vs `/pos/installments` | Module 08 vs POS child | both live | different pages | Master vs POS register | **Keep both.** Different modules. |
| `/installments` | Credit master | `CreditInstallmentsPage` | router | Same page as `/credit` | Pre-existing alias; not POS. Unchanged. |

**Not a second POS app.** `window.open` is not used for POS. ERP nav module 02 is unchanged.

### 2.2 Product search

| Item | Usages | Imports | Logic difference | Decision |
| --- | --- | --- | --- | --- |
| `searchPosProducts` | `PosPage` (typed, category, Enter, scanner), `ExchangePage` replacement search | new helper → `posApi.searchProducts` | Same backend; helper clamps limit 24–50 | **Canonical UI search.** |
| `PosRepository.searchProducts` | API route only | `apps/api/src/routes/pos.ts` | Hydrated POS results + stock | **Canonical server search.** |
| `catalogApi.listProducts` | Product Management list | `ProductsPage` | Paginated catalog master, no POS stock hydrate | **Keep.** Admin listing, not POS add-to-cart. |

### 2.3 Cart

| Item | Usages | Imports | Logic difference | Decision |
| --- | --- | --- | --- | --- |
| `usePosSession` | `PosPage` | session hook | Cart + customer + tax rate | **Canonical New Sale cart.** |
| Domain `pos-cart` (`addOrIncrementProduct`, `calculatePosCartTotals`) | session + `ExchangePage` + `held-sales.ts` | `@electronic-erp/domain` | Same math | **Canonical cart engine.** Exchange keeps a **local** cart so a replacement ticket cannot clobber New Sale. |
| `PosCart` / `PosCartRow` / `PosTotals` | New Sale UI | `PosPage` | Display only | **Canonical cart UI.** |
| `PosCartPanel` | none on disk | — | Unused duplicate table | Already gone (prior cleanup). |

### 2.4 Product creation

| Item | Usages | Routes | Imports | Decision |
| --- | --- | --- | --- | --- |
| `CatalogRepository.createProduct` | catalog route, import service | `POST /api/v1/catalog/products` | `catalog.ts`, `import-service.ts` | **Canonical writer.** |
| `catalogApi.createProduct` | `ProductFormPage` | `/products/new`, `/products/:id` | `catalog-api.ts` | **Canonical web client.** |
| POS | none | — | PosPage does not create | Unchanged. Hub now navigates to `/products/new`. |

### 2.5 Customer

| Item | Usages | Decision |
| --- | --- | --- |
| `posCustomerRepository` | `PosPage` | **Canonical POS adapter** over `partiesApi` (search/create/update/ledger). |
| `partiesApi` | Payments, Holds names, CRM | **Canonical HTTP** for parties. |
| `PartiesRepository` | API | **Canonical DB.** |

No second customer table. Hub `/pos/customers` does not load the master.

### 2.6 Pricing / discount / tax

| Item | Usages | Difference | Decision |
| --- | --- | --- | --- |
| `resolvePosUnitPrice` | cart, product cards, `preparePosSaleLine` | Full POS priority (manual → promo → qty → customer → tier) | **Canonical POS price.** |
| `pickPriceLevel` | tests + product panel fallback | Thin wrapper over `resolvePosUnitPrice` | Keep as alias. |
| `pricing.ts` (`validatePricing`, min sale) | catalog create | Catalog constraints, not POS line resolve | **Keep.** Different job. |
| `pos-discount` + `discount-policy` | New Sale + Discounts page | Server remains authority | **Canonical discount.** |
| `pos-tax` → `calculatePosCartTotals` → `calculateSaleTotals` | session, checkout, `SaleTransactionService` | Cart totals delegate to sale totals | **Canonical tax/totals.** Do not inline in React. |

### 2.7 Checkout / payment / inventory / invoice

| Flow | Canonical chain | Duplicate found | Decision |
| --- | --- | --- | --- |
| Checkout | `validatePosCheckout` → `preparePosPayments` → `posApi.postSale` | UI and domain share `preparePosPayments` | Keep both layers (UI DTO + server assert). |
| Payment post | `SaleTransactionService` → `postSplitPayment` | Payments page uses parties payments, not a second sale writer | **Keep.** Different job (on-account vs sale tender). |
| Inventory post | sale ports → stock movements | POS UI never writes `stock_balances` | **Keep.** |
| Invoice | `PosRepository.getInvoice` | Invoices + receipt preview same API | **One getter.** |

### 2.8 Supabase access

| Layer | Who talks to Supabase | Decision |
| --- | --- | --- |
| `packages/db` repositories | API only via `createUserClient` | **Canonical.** |
| Web `posApi` / `catalogApi` / `partiesApi` | HTTP | **Canonical clients.** |
| React components | none | Enforced. Removed unused `session/pos-repository.ts` (`posApi as posClientRepository`) — zero imports. |

### 2.9 Chrome / unused files

| Item | Trace | Decision |
| --- | --- | --- |
| `POSShell` / `POSHeader` / `POSTerminalNav` | live | Canonical chrome. |
| `POSTopbar`, `POSSidebar`, `POSLayout`, `POSNav`, `POSToast`, `PosHeader`, `PosSidebar`, `PosCartPanel` | not on disk; no TS imports | Already removed in an earlier cleanup. Documented, not re-deleted. |
| `session/pos-repository.ts` | unused re-export | **Deleted this pass.** |

---

## 3. Changes in this pass

1. **One terminal IA** — `POS_TERMINAL_NAV` is derived from `POS_OWNERSHIP` (same 12 titles/paths as module 02). Hub aliases remain registered but are not a second nav tree.
2. **One product search helper** — `searchPosProducts` / `clampPosSearchLimit` used by New Sale and Exchange. Limit omitted now uses 24 (canonical first page) instead of the API schema default 20.
3. **One product-create entry from POS hub** — `/pos/products` links to `/products/new` (`catalogApi.createProduct`). Search still opens `/pos`.
4. **Removed unused client alias** — `apps/web/src/features/pos/session/pos-repository.ts`.
5. **Reports hub links** — `POS_REPORT_LINKS` derived from `POS_OWNERSHIP` so titles/paths cannot drift.

Business behavior of post sale, stock, tax, discounts, and ERP module 02 children is unchanged.

---

## 4. What was not merged (not duplicates)

- Catalog `listProducts` vs POS `searchProducts`
- New Sale cart vs Exchange replacement cart (same domain engine, different tickets)
- Payments center vs checkout tenders
- `/salesman` (module 20) vs `/pos/salesmen`
- `/installments` vs `/pos/installments`
- `pricing.ts` catalog validation vs `pos-pricing.ts` line resolve
- ERP `AppShell` vs `POSShell` (POS remains inside ERP)

---

## 5. Verification

| Command | Result |
| --- | --- |
| POS navigation / ownership / shell / hub / smoke | Pass |
| Product search (`pos-product-search`, catalog-load, new-sale) | Pass |
| Cart (`pos-session`, `pos-cart`, `pos-transaction`) | Pass |
| Pricing (`pos-pricing`) | Pass |
| Product creation validation (`product-form-validation`) | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (aliases typecheck) |
| `npm run build` | Pass |
