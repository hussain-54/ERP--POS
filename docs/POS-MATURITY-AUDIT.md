# POS Maturity Audit (Read-only)

This audit is a code inspection only. It does **not** implement fixes.

Scope: the in-ERP POS (module 02 POS / SALES) implemented in `apps/web` with backend POS routes in `apps/api` and database repositories in `packages/db`, plus domain correctness in `packages/domain`.

---

## 1. Executive Summary

1. **POS slowness is explained by backend N+1 query patterns**:
   * `packages/db/src/repositories/pos-repository.ts` → `PosRepository.searchProducts()` performs many sequential `await` calls *per product row* (stock balances + brand/company/category/model/spec + units). This is the largest, deterministic source of latency for any “type to search / scan to add / category browse”.
   * `PosRepository.getInvoice()` also performs multiple DB round-trips per invoice item (product + unit lookups per line).

2. **New products cannot reliably be added when a warehouse is selected** because:
   * `PosRepository.searchProducts()` only computes `stockAvailable` by calling `InventoryRepository.listBalances(...)` for the selected `warehouseId`.
   * `InventoryRepository.listBalances()` does **not** create missing `stock_balances` rows; when none exist, `stockAvailable` becomes `"0"`.
   * Domain stock validation in `packages/domain/src/pos-cart.ts` blocks cart adds when `line.stock` is `"0"` (see `addOrIncrementProduct()` and `assertStockAvailable()`).

3. **Existing products can sometimes fail to add** for two deterministic reasons:
   * Same missing-/zero-`stock_balances` behavior as new products (when the product lacks a balances row for the selected warehouse).
   * **Stale cached stock**: the POS “Recent” and “Favorites” tabs are loaded from `localStorage` via `PosPage.tsx` and reuse cached `ProductSearchResult.stockAvailable`. If stock changes after caching, the cart stock check still uses the old value.

4. **POS navigation can feel like a separate application** because three chrome stacks share the same route: ERP `GlobalHeader`/`GlobalSidebar` (`AppShell.tsx`), module `ModuleHeader`/`ModuleContextNav` (`ModuleWorkspace.tsx`), and POS `POSHeader`/`POSTerminalNav` (`POSShell.tsx`). The in-terminal nav list is not the same as module 02 children.

5. **POS UI divergence vs reference screenshots cannot be verified pixel-by-pixel** in this code-only audit because the reference images are not present in the repository. What we *can* say exactly is structural:
   * the POS header/side nav are implemented via the `design-system` components, and POS “workspace chrome” is intentionally layered inside the ERP shell rather than replacing it.

6. **Repeated/unnecessary data requests exist in POS holds and product search**:
   * Holds list/expiry is fetched in multiple places (`usePosShellStatus`, `PosPage`, `HeldSalesPage`), and the backend repository applies expiry by default inside `listHeldSales()` (which mutates DB state via `expireDueHolds()` unless disabled).
   * Product search is triggered by multiple independent paths in `PosPage.tsx` (q-effect, category-effect, Enter-to-add fallback, and scanner subscription). There is no centralized request cancellation/dedupe across these paths.

---

## 2. Current POS Architecture

### Frontend (React)

* **Entry point / route bindings**: `apps/web/src/app/router.tsx` binds the POS workspace routes to:
  * `/pos` and `/pos/new` → `<PosPage />`
  * `/held-sales` → `<HeldSalesPage />`
  * `/invoices` → `<InvoicesPage />`
  * `/sales-management` → `<SalesManagementPage />` (register/cash shift control, not a second sales list)
  * `/returns`, `/exchange`, `/payments`, `/discounts`, `/pos/references`, `/pos/salesmen`, `/pos/installments`, `/pos/settings`, plus POS-specific workspaces under `/pos/customers`, `/pos/products`, `/pos/reports`.

* **POS is not a second application**. Routing stays in the same React Router tree. `window.open` is not used to launch POS. The only `window.open` in POS UI is receipt print preview (`ReceiptPreview.tsx`).
* **POS shell chrome inside ERP** (three stacked chrome layers, not one):
  1. `apps/web/src/app/shell/AppShell.tsx` always renders `GlobalHeader` + `GlobalSidebar`.
  2. `apps/web/src/app/shell/ModuleWorkspace.tsx` wraps POS paths with `ModuleHeader` + `ModuleContextNav` (the 39-module workspace rail).
  3. The same file then wraps children in `POSShell` when `isPosEnvironmentPath(pathname)` is true.
  4. `POSShell` adds a fourth visual layer: `POSHeader` + `POSTerminalNav` + `POSWorkspace` + `POSShortcutBar`.
* **POS does not use React Query**. `apps/web/src/features/pos/**` has no `useQuery` / `useMutation`. Fetching is custom `useEffect` + `posApi` / `partiesApi` / `inventoryApi` / `catalogApi` / `enterpriseApi`.

* **POS terminal “dense” mode** is determined by pathname via `isPosTerminalPath()`:
  * `apps/web/src/app/modules.ts` → `POS_TERMINAL_PATHS = new Set(["/pos", "/held-sales", "/pos/new"])`

### Backend (Express + Supabase repositories)

* **POS router**: `apps/api/src/routes/pos.ts`
  * `/api/v1/pos/products/search` → `PosRepository.searchProducts(...)`
  * `/api/v1/pos/sales` → `PosRepository.postSale(...)`
  * `/api/v1/pos/sales/:id/invoice` → `PosRepository.getInvoice(...)`
  * `/api/v1/pos/holds` and `/api/v1/pos/holds/:id/resume` → `PosRepository.holdSale(...)`, `listHeldSales(...)`, `resumeHeldSale(...)`

### Domain correctness (stock, discounts, payments)

* Cart state + stock validation rules:
  * `packages/domain/src/pos-cart.ts` (`addOrIncrementProduct`, `assertStockAvailable`, qty rules)
* Finalization orchestration:
  * `packages/domain/src/sale-transaction.ts` (`SaleTransactionService.postSale()`), including sequential stock writes + payment preparation + idempotency.

---

## 3. Route Map

### Canonical POS entry points (module 02)

From `apps/web/src/app/router.tsx` and `apps/web/src/app/modules.ts`:

* `"/pos"` and `"/pos/new"` → `PosPage.tsx`
* `"/held-sales"` → `HeldSalesPage.tsx`
* `"/invoices"` → `InvoicesPage.tsx`
* `"/sales-management"` → `SalesManagementPage.tsx`
* `"/returns"` → `ReturnsPage.tsx`
* `"/exchange"` → `ExchangePage.tsx`
* `"/payments"` → `PaymentsPage.tsx`
* `"/discounts"` → `DiscountsPage.tsx`
* `"/pos/references"` → `ReferencesPage.tsx`
* `"/pos/salesmen"` → `SalesmenPage.tsx`
* `"/pos/installments"` → `InstallmentsPage.tsx`
* `"/pos/settings"` → `SettingsPage.tsx`
* `"/pos/customers"`, `"/pos/products"`, `"/pos/reports"` → POS-specific pages

### “Workspace chrome” detection

`apps/web/src/app/modules.ts` documents that POS screens use POS workspace chrome inside the ERP AppShell (not a separate application).

POS environment paths are driven by `POS_ENVIRONMENT_PATHS` in `apps/web/src/features/pos/pos-ownership.ts`.

### Two different POS nav trees (exact mismatch)

ERP module 02 children (`apps/web/src/app/modules.ts` → `ERP_NAV_SECTIONS` id `"02"`):

New Sale, Hold / Resume, Invoices, Register, Returns, Exchange, Payments, Discounts, References, Salesmen, Installments, Settings.

In-terminal nav (`POS_TERMINAL_NAV` in `pos-ownership.ts`):

POS, Hold / Resume, Customers, Products, Price & Discount, Reports, Settings.

`POSTerminalNav` therefore does **not** list Invoices, Register, Returns, Exchange, Payments, References, Salesmen, or Installments. It **does** list `/pos/customers`, `/pos/products`, `/pos/reports`, which are hub stubs (see Section 6).

### Old POS still reachable?

No second POS page is registered. `/pos` and `/pos/new` both render `<PosPage />`. `LEGACY_ROUTES` in `modules.ts` is an empty array. Deprecated `PosHeader.tsx` / `PosSidebar.tsx` re-export unused design-system files and are not imported by the router.

---

## 4. Component Map

### POS shell (terminal chrome)

* `apps/web/src/features/pos/design-system/POSShell.tsx`
* `apps/web/src/features/pos/design-system/POSHeader.tsx`
* `apps/web/src/features/pos/design-system/POSTerminalNav.tsx`
* `apps/web/src/features/pos/design-system/POSWorkspace.tsx`
* `apps/web/src/features/pos/design-system/POSShortcutBar.tsx`

### New sale / hold terminal (core)

* `apps/web/src/features/pos/PosPage.tsx`
  * Uses `PosSaleLayout`, `PosProductPanel`, `PosCustomerPanel`, `PosCart`, `PosPaymentPanel`,
    `PosApprovalDialog`, `ReceiptPreview`, `PosHoldsPanel`.

### Data/state helpers

* `apps/web/src/features/pos/pos-api.ts` (frontend API client)
* `apps/web/src/features/pos/session/usePosSession.ts` (cart + totals)
* `apps/web/src/features/pos/session/usePosShellStatus.ts` (header holds + shift + terminal options)
* `apps/web/src/features/pos/session/pos-customer-repository.ts` (customer search, create/update, history)

### Catalog and search helpers

* `apps/web/src/features/pos/pos-catalog-load.ts` (limits, helper functions used by POS product selection)
* `apps/web/src/features/pos/pos-ux.ts` (keyboard parsing + cashier UX helpers)

---

## 5. Data Flow Map

### A) New sale: product search → cart add → totals

1. Product search UI:
   * `PosProductPanel.tsx` maintains `draft` input and debounces `onQueryChange` by `POS_SEARCH_FLUSH_MS`.
   * On Enter/scanner commit, `PosPage.tsx` may call the backend immediately.

2. Product search request:
   * `PosPage.tsx` uses `posApi.searchProducts({ q, warehouseId, customerId, limit })`
   * `apps/web/src/features/pos/pos-api.ts` → `GET /api/v1/pos/products/search?...`
   * `apps/api/src/routes/pos.ts` → `PosRepository.searchProducts(orgId, query)`

3. Backend product search:
   * `PosRepository.searchProducts()` queries products + barcodes + QR codes + taxonomy matches + product specifications.
   * Then it iterates every “byId” result and runs per-product lookups (stock balances + brand/company/category/model/spec + units).

4. Cart add:
   * `PosPage.tsx` → `usePosSession.addProduct(p, ...)`
   * `usePosSession.addProduct()` uses `createCartLineFromProduct({ stock: p.stockAvailable, ... })`
   * Domain validation runs stock checks using `addOrIncrementProduct()` in `packages/domain/src/pos-cart.ts`.

### B) Checkout / posting

1. Checkout:
   * `PosPage.tsx` → `posApi.postSale(...)`
   * `apps/api/src/routes/pos.ts` → `PosRepository.postSale(...)`

2. Domain orchestration:
   * `packages/domain/src/sale-transaction.ts` (`SaleTransactionService.postSale()`)
   * Performs:
     * idempotency lookup,
     * resolve posted sale items (pricing/discount/tax snapshots),
     * validates stock availability via `ports.searchStockAvailable`,
     * inserts sale in `draft`,
     * posts items, stock movements, ledger/payment, then finalizes sale status.

### C) Holds and resume

* `PosPage.tsx` hold action → `posApi.hold(...)` → `PosRepository.holdSale(...)`
* `usePosShellStatus.ts` fetches hold count using `posApi.listHolds(...)`
* `HeldSalesPage.tsx` lists holds using `posApi.listHolds(...)`
* Resume uses `posApi.resumeHold(id, checkout?)` → `PosRepository.resumeHeldSale(...)`

---

## 6. Product Creation Flow

### What POS does (and does not) do

* **POS does not create products**. There is no `catalogApi.create*` (or equivalent) call in `PosPage.tsx`.
* POS product add relies on catalog search results returned by `PosRepository.searchProducts()`.
* `PosProductsPage` (`apps/web/src/features/pos/PosHubPages.tsx`) is a **hub card** that only navigates to `/pos`. It does not load the catalog and does not open `/products/new`.
* Manual cart lines (`addManualQuick` in `PosPage.tsx`) require an existing catalog line in the cart for a `unitId`. They are not product-master creation.

### Where product creation happens

* Product creation lives under the product-management module:
  * `apps/web/src/app/router.tsx` binds `"/products/new"` → `ProductFormPage`.

### Exact dependency that blocks “newly created product immediately addable”

The POS “add to cart” path relies on `stockAvailable` returned from `PosRepository.searchProducts()` for the selected `warehouseId`.

If a newly created product lacks a `stock_balances` row for that warehouse, POS receives `stockAvailable = "0"` and domain rejects cart adds (see Sections 11–13 and Section 14).

The same default happens at checkout: `PosRepository.buildPorts().searchStockAvailable()` returns `"0"` when no `stock_balances` row exists (`packages/db/src/repositories/pos-repository.ts`). `SaleTransactionService.postSale()` then throws `Insufficient stock`.

---

## 7. Product Search Flow

### A) Debounced query typing

* `PosProductPanel.tsx` debounces `onQueryChange(draft)` with `POS_SEARCH_FLUSH_MS`.
* `PosPage.tsx` keeps `q` as the canonical query state.

### B) Backend query execution

`PosRepository.searchProducts()` (backend) executes these steps:

1. Query products by `name ilike`, `name_ur ilike`, `sku ilike`.
2. Query barcodes and QR codes by `ilike('%q%')`.
3. Query taxonomy match tables (`brands`, `companies`, `categories`, `product_models`) to collect matching ids.
4. Query `product_specifications` via `size/color/material/gauge/model_label` + (optionally) numeric fields matching `Number(q)`.
5. Merge results into a `byId` map:
   * products from the main query,
   * taxonomy products,
   * specs-only products,
   * barcode/QR matched products.
6. Iterate `byId` and construct each `ProductSearchResult`:
   * for each product:
     * `inventory.listBalances(...)` if `query.warehouseId` is present,
     * then sequentially resolves brand/company/category/model/spec,
     * then sequentially resolves base unit record from `units`.
7. Optional customer-specific prices:
   * if `query.customerId && results.length`, it queries `product_prices` and then matches by `unit_id`.
8. Sort/score results and return `results.slice(0, query.limit ?? 20)`.

### C) Enter-to-add and scanner-to-add bypass debouncing

`PosPage.tsx` commits product additions in two other paths:

1. Enter-to-add fallback:
   * `PosPage.tsx` `commitProductSearch()` calls `posApi.searchProducts()` when there is no exact match in the current `results`.
2. Scanner subscription:
   * `PosPage.tsx` subscribes to `posHardware.subscribeScanner(...)` once.
   * Each scan triggers `posApi.searchProducts(...)` immediately.
   * `scanLockRef.current` gates re-entrancy only for ~80ms, not for the full request duration.

This increases request volume and can cause in-flight responses to overwrite each other (scanner path does not use the same `isLatestRequest()` mechanism as the typed query effect).

---

## 8. Cart Flow

1. Cart state lives in-memory:
   * `apps/web/src/features/pos/session/usePosSession.ts`
2. Totals are derived:
   * totals computed by `calculatePosCartTotals(cart, invoiceDiscount, taxRate)` (domain).
3. Add/increment:
   * `usePosSession.addProduct()` constructs a `PosCartLine` with `stock: p.stockAvailable`.
   * Domain `addOrIncrementProduct()` checks:
     * if `!line.isManual && line.stock != null && line.stock !== ""`:
       * it normalizes stock and blocks add if stock is `<= 0`.

**Exact stock-check behavior** (domain):
* `packages/domain/src/pos-cart.ts` → `addOrIncrementProduct()`:
  * blocks when `line.stock` is present and normalized stock `<= 0`.
* `assertStockAvailable()` also performs the same check and throws `ValidationDomainError`.

---

## 9. Checkout Flow

### Frontend checkout

* `PosPage.tsx` uses domain helpers:
  * `validatePosCheckout`, `preparePosPayments`, `PaymentAttemptGate` etc (domain orchestrations)
* Then it calls:
  * `posApi.postSale(CreateSaleInput)` → `POST /api/v1/pos/sales`

### Backend checkout orchestration

* `apps/api/src/routes/pos.ts`:
  * validates authorization (e.g. `pos.sell`)
  * parses input with `CreateSaleSchema`
  * calls `PosRepository.postSale(input, userId)`

* `PosRepository.postSale()` delegates to:
  * `packages/domain/src/sale-transaction.ts` → `SaleTransactionService.postSale()`

The domain ensures a safe finalization workflow:
* inserts sale as `draft`,
* posts stock + ledger + payment,
* finalizes sale status only after critical path succeeds.

---

## 10. Inventory/Stock Flow

### Stock availability for product add/search

* `PosRepository.searchProducts()` computes `stockAvailable` by:
  * calling `inventory.listBalances(organizationId, { warehouseId, productId })`
  * using `balances[0]?.qtyAvailable ?? "0"`
* `InventoryRepository.listBalances()` does not create missing `stock_balances` rows.

### Stock movement on sale finalization

* `packages/domain/src/sale-transaction.ts` validates and orchestrates.
* `PosRepository` ports implement:
  * `postStockSale()` → `InventoryRepository.postMovement()`

### Exact “missing balances” consequence

If a product has no `stock_balances` row for the currently selected warehouse:
* search returns `stockAvailable = "0"`,
* domain blocks cart adds (see Section 14).

---

## 11. Customer Flow

### Customer search

* `PosPage.tsx` → effect on `customerQuery`:
  * if not `walkIn` and query is non-empty:
    * calls `posCustomerRepository.search({ q, organizationId, canRead })`
    * `posCustomerRepository.search()` calls `partiesApi.listCustomers(q)`

### Customer add/update

* `PosCustomerPanel.tsx` triggers creation/update by calling callbacks:
  * `posCustomerRepository.create()` / `posCustomerRepository.update()`
* These repository methods call `partiesApi.createCustomer(...)` and `partiesApi.updateCustomer(...)`.

---

## 12. Payment Flow

1. Payment method selection:
   * `PosPage.tsx` calls `partiesApi.seedPaymentMethods()` on mount.
2. Payment posting and customer ledger are orchestrated by:
   * `packages/domain/src/sale-transaction.ts` which calls `ports.postSplitPayment()` and `ports.postCustomerSaleLedger()`
3. `PosRepository` implements payment ports using `parties` repository methods.

---

## 13. Hold/Resume Flow

### Hold creation

* `PosPage.tsx` hold action:
  * builds cart snapshot,
  * calls `posApi.hold(...)` → `PosRepository.holdSale(...)`
* `PosRepository.holdSale()`:
  * inserts into `sales` with `status: "held"` (and `invoice_number: HOLD-...`),
  * inserts into `held_sales` with `status: "held"`,
  * stores `cart_snapshot`,
  * does **not** insert sale_items or stock movements.

### Hold listing and expiry side effect

* `PosRepository.listHeldSales()`:
  * by default calls `expireDueHolds(organizationId, branchId)` before listing.
  * then selects `held_sales` rows.

### Hold resume

* `posApi.resumeHold()` → `PosRepository.resumeHeldSale()`
* Backend resumes:
  * updates `held_sales` status,
  * sets `sales` status back to `draft`.
* Client restores snapshot via `replaceCart` (the repository note says the client must restore via snapshot replacement).

---

## 14. Performance Bottlenecks

### P0: Backend N+1 in `PosRepository.searchProducts()`

In `packages/db/src/repositories/pos-repository.ts`:

* After collecting candidates into `byId`, it iterates:
  * `for (const row of byId.values()) { ... }`
* When `query.warehouseId` is present:
  * it calls `await this.inventory.listBalances(...)` **per product**
* Then it sequentially performs:
  * brand lookup (`brands`)
  * company lookup (`companies`)
  * category lookup (`categories`)
  * model lookup (`product_models`)
  * spec lookup (`product_specifications`)
  * base unit lookup (`units`)

All of the above are `await`-ed inside the per-product loop, producing classic N+1 sequential latency.

### P1: Missing request cancellation / dedupe across frontend search triggers

In `apps/web/src/features/pos/PosPage.tsx`:

* Typed search effect:
  * one effect runs on `q` / `warehouseId` / `customerId` / `walkIn` / `tab` / `searchLimit` etc.
  * it uses `isLatestRequest(productSearchSeq...)` to prevent stale typed-search results from overwriting state.
* Scanner path:
  * separate `useEffect` subscribes to scanner events and triggers `posApi.searchProducts()` on **every scan**.
  * it sets `scanLockRef.current = false` after `80ms` regardless of request completion.
  * it **does not** use `isLatestRequest()` gating, so scanner responses may overwrite `results` out of order.

### P1: Repeated holds listing with expiry side effects

Multiple parts of the UI call `posApi.listHolds()`:
* `apps/web/src/features/pos/session/usePosShellStatus.ts`:
  * fetches `holdCount` by calling `posApi.listHolds(branchId)`
* `apps/web/src/features/pos/PosPage.tsx`:
  * when `branchId && showHolds`, it runs `refreshHolds()` → `posApi.listHolds(branchId, holdsFilter)`
* `apps/web/src/features/pos/HeldSalesPage.tsx`:
  * `reload()` calls `posApi.listHolds(branchId, "all_pending")`

Backend side effect:
* `PosRepository.listHeldSales()` calls `expireDueHolds()` by default (`applyExpiry !== false`).
* Therefore each duplicate list request can also run DB expiry updates.

### P2: Invoice generation has N+1 per invoice item

`packages/db/src/repositories/pos-repository.ts` → `getInvoice()`:
* after loading `sale_items`, it does `Promise.all((items ?? []).map(async (i) => { ... }))`
* for each invoice item line:
  * fetches product name/sku (`products`)
  * fetches unit code (`units`)

This can become slow on invoices with many lines, especially on cold DB/cache.

---

## 15. Product Creation Failures

### Exact behavior: “new products cannot be added” (root cause)

The POS does not create products. The failure is in **adding a newly created catalog product** immediately after creation.

From `apps/api` + `packages/db`:

1. The POS adds only products present in search results from:
   * `PosRepository.searchProducts()`.
2. When a warehouse is selected (`query.warehouseId` is passed from `PosPage.tsx` via `warehouseId || undefined`):
   * `PosRepository.searchProducts()` sets `stockAvailable` as:
     * `balances[0]?.qtyAvailable ?? "0"`
3. `InventoryRepository.listBalances()` does not create balances rows:
   * it selects existing rows from `stock_balances`.
4. Domain blocks adds when `line.stock` is `"0"`:
   * `packages/domain/src/pos-cart.ts` → `addOrIncrementProduct()`:
     * `if (!line.isManual && line.stock != null && line.stock !== "") { ... if (stock <= 0) return fail("Product is out of stock") }`

Therefore, a newly created product that has **no stock balance row for the selected warehouse** is treated as out of stock and cannot be added.

### Exact UI mechanism that makes this “unreliable”

`PosPage.tsx` caches product results (including `stockAvailable`) for:
* Recent tab: `RECENT_DATA_KEY` localStorage
* Favorites tab: `FAVORITES_DATA_KEY` localStorage

These tabs can lead to inconsistent behavior if:
* stock balances get created/updated after the cache snapshot,
* while the POS still uses stale cached `stockAvailable` values.

---

## 16. Duplicate Implementations

This section lists duplicates that exist *by behavior* (multiple UI entry points calling the same or overlapping backend operations).

### Holds listing duplication

Duplicate calls to `posApi.listHolds()` exist in:
* `apps/web/src/features/pos/session/usePosShellStatus.ts` (holdCount badge)
* `apps/web/src/features/pos/PosPage.tsx` (holds panel)
* `apps/web/src/features/pos/HeldSalesPage.tsx` (holds workspace)

All hit:
* backend `PosRepository.listHeldSales()` which also applies expiry.

### Product search duplication

`PosPage.tsx` can call `posApi.searchProducts()` from multiple independent triggers:
* q-effect (typed search)
* categories-effect (category browse)
* Enter-to-add commit fallback (`commitProductSearch()` does a second API call when no exact match is present in current `results`)
* scanner subscription (each scan does an API call)

No single dedupe/cancellation layer exists across these triggers.

### Duplicate chrome / cart UI files (live vs leftover)

Live terminal chrome is `POSHeader` + `POSTerminalNav` (used by `POSShell`).

Leftover / unused in the live tree:

* `design-system/POSTopbar.tsx` — only re-exported by deprecated `components/PosHeader.tsx`. No live import of `PosHeader`.
* `design-system/POSSidebar.tsx` — only re-exported by deprecated `components/PosSidebar.tsx`. No live import of `PosSidebar`.
* `components/PosCartPanel.tsx` — still on disk; `PosPage` uses `PosCart.tsx` instead. No TS/TSX import of `PosCartPanel` outside its own file.

### Duplicate “POS repository” names (not two DB layers)

* Backend: `packages/db/src/repositories/pos-repository.ts` (`PosRepository`) — real Supabase access.
* Frontend: `apps/web/src/features/pos/session/pos-repository.ts` only re-exports `posApi as posClientRepository`. Not a second data store.

---

## 17. Broken Implementations

### Category browse can be blocked by stale query state

From `apps/web/src/features/pos/PosPage.tsx`:

* Category browse effect:
  * `useEffect(() => { if (tab !== "categories" || q.trim()) return; ... })`
* Category selection:
  * `selectCategory(id)` sets:
    * `setSelectedCategoryId(id)`
    * `setSearchLimit(POS_PRODUCT_SEARCH_LIMIT)`
    * `setTab("categories")`
  * but does **not** clear `q`.

Therefore, if `q` is non-empty (user previously typed/committed a search) and the cashier taps a category:
* the category effect will bail (`q.trim()` truthy),
* the product grid remains driven by the q-effect results rather than category-specific results.

This can look like “products are missing” during category browse.

### Scanner request ordering can overwrite typed results

* Scanner effect updates `results` and `q` without the same `isLatestRequest(productSearchSeq...)` guard used by typed search.
* Scanner lock is time-based (80ms) rather than request-completion-based.

So out-of-order responses are possible, which can manifest as “products not appearing”.

This is an implementation risk identified exactly by the different gating strategies.

---

## 18. Dead Code

Confirmed unused at runtime (no production call sites found):

* `mergeProductSearches` in `pos-catalog-load.ts` — referenced only by `pos-catalog-load.test.ts`. Category browse in `PosPage.tsx` calls `posApi.searchProducts({ q: categoryName })` instead.
* `posApi.expireHolds` — defined in `pos-api.ts`; no POS web caller. Expiry already runs inside `PosRepository.listHeldSales()` when `applyExpiry !== false`.
* `components/PosCartPanel.tsx` — superseded by `PosCart.tsx`.
* `components/PosHeader.tsx` / `components/PosSidebar.tsx` and their targets `POSTopbar` / `POSSidebar` — not used by `POSShell`.

Still used (not dead):

* `requireOnlineForPos` in `PosPage.tsx` — wrapper around `requireInternetConnection`; still called from checkout/quotation paths.

---

## 19. Risky Code

### P0 risky code: backend sequential awaits per product

* `PosRepository.searchProducts()` uses sequential `await` inside:
  * `for (const row of byId.values()) { ... }`

This is risky for terminal UX latency and can cause timeouts under load.

### Risk: scanner-to-add can create overlapping searches

In `PosPage.tsx`:
* `scanLockRef.current` only blocks scans for ~80ms.
* It does not block based on request completion.

Thus multiple inflight search requests may run concurrently.

### Risk: cached `stockAvailable` in localStorage

`PosPage.tsx` stores full `ProductSearchResult` objects in localStorage and reuses them in Recent/Favorites.

If stock balances change, cached `stockAvailable` can become stale and block adds.

---

## 20. Database/Supabase Problems

### P0: N+1 query patterns in `searchProducts`

The code in `PosRepository.searchProducts()` heavily relies on per-product joins implemented as separate queries rather than a single joined query or RPC.

This will be sensitive to:
* missing indexes for `ilike` searches,
* high row counts,
* product counts returned by `byId`.

### P1: invoice generation N+1

`getInvoice()` performs per-line product and unit lookups in `Promise.all`.

### P2: missing `stock_balances` rows amplify add failures

The system assumes `stock_balances` rows exist for warehouse/product pairs.

Because the repository only creates balances on stock movement (`InventoryRepository.getOrCreateBalance()` is called from `postMovement()`), there’s a strong coupling between “stock movement occurred” and “POS can add”.

---

## 21. UI/UX Problems

### Holds and terminal chrome feel “separate”

Exact mechanism (file/function):

1. `AppShell.tsx` keeps ERP `GlobalHeader` + `GlobalSidebar` on POS paths.
2. `ModuleWorkspace.tsx` still renders `ModuleHeader` + `ModuleContextNav` (module 02 children).
3. `POSShell` then adds `POSHeader` (branch / terminal / cashier / clock / held sales) and `POSTerminalNav` (a **different** item list than the workspace rail).
4. Result: two headers and two POS navs on `/pos`. That is why it feels like a nested second app even though routing is still inside the ERP.

`POSHeader` uses distinct aria-labels (`POS Branch`, `POS Notifications`, `POS User`) specifically because the ERP global header already exposes Branch / Notifications / User (see prior test collisions).

### Category browse can show unexpected results

Exact mechanism:
* Category browse effect is gated by `q.trim()` being empty.
* Category selection does not clear `q`.

### “No catalog match” vs actual visible mismatch

Because there are multiple request triggers, the visible grid (`results`) may be out of sync with the commit path when:
* scanner returns after a typed request has updated `results`,
* Enter commit uses current `results`/`highlighted` before the q-effect completes.

This can feel like “existing products sometimes fail to appear/add” (even when catalog contains them).

---

## 22. Reference-vs-current Gap Analysis

This code audit cannot do pixel-perfect comparison because reference screenshots are not stored in the repository.

What is exact from code:
* POS is implemented as “workspace chrome inside ERP AppShell” rather than a full replacement shell:
  * `apps/web/src/app/modules.ts` documents this.
  * `features/pos/design-system/POSShell.tsx` comment explicitly says “ERP chrome stays above this.”
  * `ModuleWorkspace.tsx` still shows ERP module header + context nav **and** POSShell.

Therefore, any reference that shows a single compact POS header, one left retail nav, a product grid on the left, and a transaction column on the right — without a second ERP module title bar — will structurally diverge.

Additional code-backed visual gaps (not screenshot-guessed):

* Product cards use initials unless `imageUrl` is on the search DTO. `PosRepository.searchProducts()` `productSelect` does not include image columns, so POS search never hydrates photos (`productImageUrl` in `pos-catalog-load.ts`).
* `PosProductsPage` / `PosCustomersPage` are empty hubs, not catalog/customer masters.
* Bottom bar is a shortcut legend (`POSShortcutBar` / `POS_SHORTCUTS`), not a dedicated F-key action strip wired to barcode/hold/pay as exclusive primary actions (those actions live on `PosPage` + discovery tiles).

---

## 23. Recommended Target Architecture

### Performance: move to batched/RPC data fetching

For `searchProducts` and `getInvoice`, target:
* single RPC or a single batched query that returns:
  * product core fields,
  * brand/company/category/model names,
  * spec attributes,
  * unit record,
  * stock balances for the selected warehouse in one go,
  * optionally customer pricing in the same RPC.

### Frontend: centralize request state + cancellation

In `PosPage.tsx`:
* centralize product search into a single hook that:
  * dedupes typed/category/scanner searches,
  * supports abort/cancellation,
  * uses one “latest request” sequence guard for all triggers (including scanner).

### Stock correctness: make stock availability resilient to missing balances

Options (architecture-level, not implementation):
* ensure `stock_balances` rows exist for all products/warehouses at product creation time (or via async background initialization),
* or change POS availability rules:
  * treat missing balances as “unknown” (allow add but block checkout) OR
  * create balances on-demand in search (but that turns reads into writes and must be designed carefully).

---

## 24. Files that should be preserved

These contain core wiring and business logic that should remain stable:

* `apps/web/src/features/pos/PosPage.tsx` (keep orchestration, but likely refactor internals later)
* `apps/web/src/features/pos/session/usePosSession.ts` (cart math orchestration)
* `packages/domain/src/pos-cart.ts` (stock validation rules)
* `packages/domain/src/sale-transaction.ts` (finalization workflow + idempotency)
* `apps/api/src/routes/pos.ts` (authorization boundaries and endpoint contracts)
* `packages/db/src/repositories/pos-repository.ts` (POS repository abstraction)

---

## 25. Files that should be consolidated

* `apps/web/src/features/pos/session/usePosShellStatus.ts` + `PosPage.tsx` + `HeldSalesPage.tsx`:
  * consolidate holds retrieval so the system does not repeatedly call the same list endpoint and re-apply expiry.
* `PosPage.tsx` product search triggers:
  * unify q-effect, category-effect, Enter fallback, and scanner subscription into a single deduped/cancelable mechanism.

---

## 26. Files that may be removed

Safe to remove only after a follow-up unused-export pass (not done this phase):

* `apps/web/src/features/pos/components/PosCartPanel.tsx` (superseded by `PosCart.tsx`)
* `apps/web/src/features/pos/components/PosHeader.tsx` and `design-system/POSTopbar.tsx`
* `apps/web/src/features/pos/components/PosSidebar.tsx` and `design-system/POSSidebar.tsx`
* `posApi.expireHolds` if no other app calls it
* runtime-unused `mergeProductSearches` (keep tests or delete both)

Do **not** remove `/pos/new`, `/held-sales`, or other registered aliases — they are intentional `DUPLICATE_ROUTE_PAIRS`.

---

## 27. Critical issues ranked P0/P1/P2/P3

### P0 (must fix first)

1. **Backend N+1 sequential awaits**:
   * `packages/db/src/repositories/pos-repository.ts` → `searchProducts()` per-product loop + `getInvoice()` per-line loop
2. **Warehouse-scoped stock availability becomes `"0"` when balances rows are missing**:
   * `searchProducts()` uses `listBalances()` and defaults missing balances to `"0"`
   * domain cart validation blocks `"0"`

### P1 (should fix next)

1. **Stale cached stockAvailable in Recent/Favorites**:
   * `PosPage.tsx` localStorage caching reuses `ProductSearchResult.stockAvailable`
2. **Scanner/typed search request ordering and lack of shared “latest request” gating**:
   * scanner path does not use `isLatestRequest(productSearchSeq...)`
3. **Holds expiry side effects triggered by multiple list calls**:
   * `usePosShellStatus`, `PosPage`, `HeldSalesPage` all call `posApi.listHolds()`

### P2 (quality / UX correctness)

1. Category browse blocked by stale `q`:
   * `PosPage.tsx` category effect bails when `q.trim()` is non-empty
   * `selectCategory()` does not clear `q`
2. Potential invoice performance on large invoices (N+1 per line)

### P3 (cleanup)

* Dead/unused POS helpers/API methods (needs validation via lint/TS)

---

## 28. Exact recommended implementation order

This order is designed to reduce slowness and unblock product adds without touching business math.

1. **Introduce batched backend data access for `searchProducts()`**:
   * Replace per-product sequential queries with a single RPC/batched query that returns all fields and stock balances for the current `warehouseId` in one go.
2. **Introduce batched backend data access for `getInvoice()`**:
   * Fetch product names/units for all sale items in one go instead of per-line lookups.
3. **Fix stock availability semantics for missing `stock_balances` rows**:
   * Ensure balances rows exist before POS search uses them, or change POS read semantics so missing balances don’t become forced `"0"`.
4. **Unify frontend product search into one cancelable request pipeline**:
   * Ensure scanner and typed/category requests share the same latest-request sequencing guard and dedupe.
5. **Correct category browse gating**:
   * Ensure selecting a category reliably clears/overrides `q` so the category effect runs as intended.
6. **Make Recent/Favorites stock caching safe**:
   * Either remove warehouse-scoped stock from cached results, or refresh it when adding from cached tabs, or change domain rules to accept “unknown stock” differently.
7. **Consolidate holds list fetching**:
   * Ensure only one component triggers `listHeldSales()` (and any expiry mutation) per relevant time window.
8. **Run TS/lint cleanup and remove/merge dead helpers once behavior is stable**.

---

## Typecheck / Lint / Build Results (post-audit)

Run from repo root (`C:\Users\Black Scorpion\Downloads\Electronic - ERP`) after writing this report. No POS code was changed.

### `npm run typecheck`

* **Exit code:** `0`
* **Result:** pass
* All packages completed `tsc --noEmit`:
  * `packages/contracts`, `packages/domain`, `packages/ai`, `packages/db`, `packages/hardware`, `packages/ui`, `apps/api`, `apps/web`, `apps/desktop`

### `npm run lint`

* **Exit code:** `0`
* **Result:** pass
* `package.json` maps `lint` to `npm run typecheck` (same TypeScript check as above).
* Shell wrapper printed a PowerShell `Add-Content` IOException against a temp `ps-state-out-*.txt` file after the lint process finished. That is an environment/tooling stream issue, not a TypeScript/lint failure: the npm `lint`/`typecheck` chain itself exited `0`.

### `npm run build`

* **Exit code:** `0`
* **Result:** pass
* Built packages, API (`tsc`), and web (`tsc --noEmit` + `vite build`).
* Vite production build: `450` modules transformed, `built in 22.75s`.
* Vite warning (non-fatal): main JS chunk `dist/assets/index-CT88VAj8.js` is `1,944.55 kB` minified (`407.22 kB` gzip). Rollup suggests code-splitting; this is a bundle-size warning, not a compile error.

---

## Appendix: Inspection checklist A–AQ

| ID | Topic | Finding (source) |
| --- | --- | --- |
| A | POS routes | `router.tsx` binds module 02 paths; `/pos` and `/pos/new` share `PosPage`. |
| B | POS pages | Live pages listed in Section 3. Hubs: `PosHubPages.tsx`. |
| C | POS components | Maps in Section 4 + `pos-ownership.ts` `POS_COMPONENT_OWNERS`. |
| D | POS layouts | `PosSaleLayout.tsx` + `POSWorkspace` dense vs pad. |
| E | POS navigation | Dual trees: ERP `ModuleContextNav` vs `POS_TERMINAL_NAV`. |
| F | POS state | In-memory `usePosSession`; no Zustand/Redux; no React Query. |
| G | Product search | `PosPage` effects + `PosRepository.searchProducts`. |
| H | Product creation | Not in POS. Catalog: `/products/new` → `ProductFormPage`. |
| I | Product fetching | Only via POS search API (plus localStorage recent/favorites). |
| J | Inventory fetching | Per-product `listBalances` during search; checkout `searchStockAvailable`. |
| K | Cart state | `usePosSession` + `packages/domain/src/pos-cart.ts`. |
| L | Customer state | `posCustomerRepository` → `partiesApi`. |
| M | Pricing | `resolvePosUnitPrice` / `pos-pricing.ts`; server re-resolves in `SaleTransactionService`. |
| N | Discounts | Domain `discount-policy` + `PosPage` approval dialog + API overwrites `approverRole`. |
| O | Taxes | `enterpriseApi.listTaxRates` on POS mount → `setTaxRate`; line tax in `pos-tax.ts`. |
| P | Payment logic | `preparePosPayments` + `parties.postSplitPayment`. |
| Q | Hold/resume | `holdSale` / `listHeldSales` / `resumeHeldSale`. |
| R | Invoice generation | `getInvoice` N+1 per line. |
| S | Stock movement | `InventoryRepository.postMovement` via sale ports. |
| T | Supabase queries | Search + invoice + holds as documented. |
| U | Supabase mutations | Sale draft→posted, holds, expiry updates, stock RPC/fallback. |
| V | React Query | Absent in POS feature folder. |
| W | useEffect chains | Many on `PosPage` (online, bootstrap APIs, search, customer, scanner, shortcuts, holds). |
| X | Re-renders | `PosPage` is ~2.2k lines with large local state; `POSClock` ticks every 1s (local to header). |
| Y | Duplicate APIs | Multiple `listHolds` / `searchProducts` callers. |
| Z | Duplicate repositories | Name-only: frontend `pos-repository.ts` re-exports `posApi`. |
| AA | Duplicate pages/routes | `/pos` vs `/pos/new` same component (intentional alias). |
| AB | Large components | `PosPage.tsx` is the god component. |
| AC | Expensive calculations | Cart totals via domain `useMemo`; search latency dominates, not JS math. |
| AD | Unnecessary network | Holds list + expiry; search N+1; scanner vs typed overlap. |
| AE | Loading states | `searching` badge; holds `loading` on HeldSalesPage; checkout `busy`. |
| AF | Error handling | Toasts via `formatOnlineFailure`; many bootstrap `.catch(() => undefined)` swallow errors. |
| AG | Product creation flow | Outside POS (Section 6). |
| AH | Auth/RBAC | `pos.sell`, `pos.hold`, discount perms, `customers.read/write` on `posRouter` + `posActionFlags`. |
| AI | Branch/warehouse/terminal | Auth `branchId`; first warehouse auto-selected; terminal from `infrastructureApi.devices` + localStorage. |
| AJ | Schema assumptions | `products`, `barcodes`, `qr_codes`, `stock_balances`, `held_sales`, `sales`, `sale_items`. Missing balance row ⇒ `"0"`. |
| AK | TypeScript errors | `npm run typecheck` exit 0 (this audit). |
| AL | Runtime errors | Not reproduced in a live session this phase. |
| AM | Console errors | Not captured (read-only; no browser run). |
| AN | Stale/dead code | Section 18. |
| AO | Unused imports | Not exhaustively linted; repo `lint` script is typecheck only. |
| AP | Duplicate business logic | Cart math stays in domain; UI does not reimplement sale totals. |
| AQ | Old POS via routing | No. Empty `LEGACY_ROUTES`. |

