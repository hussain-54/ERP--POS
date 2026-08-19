# POS Final QA Report — Phase 11

Industrial POS QA after the UI/UX modernization (Phases 1–10). No ERP modules outside POS were redesigned. No speculative features were added. Sale writers, hold/return math, and `posApi.postSale` were not changed in this pass.

Visual benchmark: the supplied POS screenshots are **not in the repository**. QA uses the locked design language (navy sidebar `#0f1b33`, primary `#1877f2`, workspace `#ffffff`, page background `#f4f6f9`) plus component tests and CSS breakpoints for 1366×768, 1440×900, and 1920×1080.

Live browser `/pos` was attempted at `http://localhost:5173/pos`. Vite was not running (Chrome error page), so pixel comparison against an authenticated register was not possible in this session.

---

## Completed

### Visual structure (desktop register)

All three requested widths are **two-zone terminals** (`posSaleChrome` = `split` from 1024px). Product discovery stays beside cart + pay on one screen.

| Width | `posLayoutMode` | Chrome | Layout |
|---|---|---|---|
| 1366×768 | desktop | split | Two-zone; CSS `@media (max-width: 1439px) and (min-width: 1280px)` slightly narrows cart and sidebar |
| 1440×900 | desktop | split | Two-zone; full `1.4fr / 0.95fr` grid |
| 1920×1080 | desktop | split | Same desktop grid; 3-column product cards from 1024px |

Sidebar stays open from 1280px (`posSidebarCollapsedByDefault("desktop")` is false). 768–1023 stacks both zones so the cart stays on screen. Below 768 uses mobile sheets.

Checklist:

- [x] Dedicated POS shell — `AppShell` renders `POSShell` for `isPosEnvironmentPath`; 39-module ERP tree is not shown
- [x] Dark navy sidebar — `--pos-navy` `#0f1b33`, `.pos-sidebar`
- [x] Blue primary accent — `--pos-primary` `#1877f2` (locked, not inherited from `--erp-brand`)
- [x] White/light workspace — `--pos-workspace` `#ffffff` / `--pos-bg` `#f4f6f9`
- [x] Compact professional header — Menu, Branch, POS Terminal, Cashier, Shift Status, Date/Time, Held, Notifications, User (`--pos-header-height: 3.25rem`)
- [x] Product search at top-left — `PosProductPanel` + `POSSearch` (`pos-search-input`)
- [x] Barcode / QR / Camera / Manual Entry — discovery tools on New Sale
- [x] Recent / Favorites / Categories
- [x] Product grid — 3 columns from 1024px, visible page size 12
- [x] Customer panel — walk-in, search, create, price tier
- [x] Cart — `CART (X ITEMS)` + Apply Discount + Clear Cart
- [x] Quantity controls — stepper + qty field
- [x] Discounts — line + invoice, permission-gated
- [x] Tax — `Sales Tax` from catalog tax via `calculatePosCartTotals`
- [x] Grand total — `GRAND TOTAL` / `PosTotals`
- [x] Payment method grid — live seeded methods, no fake gateway
- [x] Pay Now — `PayNowButton` / `PAY NOW`
- [x] Hold Sale — `HoldSaleButton` / `HOLD SALE`
- [x] Quotation — `QuotationButton` → `afterSalesApi.createQuotation`
- [x] Cash drawer — sidebar `Cash Drawer` (`posHardware` then `hardwareApi`)
- [x] Close Shift — sidebar navigates to `/sales-management`
- [x] Bottom keyboard shortcut bar — F1–F8 on every POS environment page

### Functionality (wired, tested at unit/page level)

- [x] Product search — `posApi.searchProducts`, 180ms flush, limit 24/50
- [x] Product selection / cart add — `usePosSession.addProduct`
- [x] Quantity changes / remove item — `PosCartRow`
- [x] Customer selection / new customer — `PosCustomerPanel` + `posCustomerRepository`
- [x] Price tier — retail / wholesale / dealer on customer panel; cart reprices
- [x] Discount / tax / recalculate — domain cart math + F6
- [x] Payment / cash change — `preparePosPayments` + cash received / change
- [x] Credit — customer required; walk-in must pay in full; `evaluatePosCustomerCredit`
- [x] Installment — `installments.manage` + plan fields on New Sale; register at `/pos/installments`
- [x] Hold / resume / cancel hold — New Sale drawer + `/held-sales` (`posApi.hold` / `resumeHold` / `cancelHold`); KPI includes **Total Held Value**
- [x] Sales register — `/invoices` → `SalesWorkspace` (heading Sales Dashboard; breadcrumb Home → Sales Management `/pos/reports`)
- [x] Invoice view / print — `ReceiptPreview` (`window.print` + thermal when hardware supports it)
- [x] Return — `/returns` live `prepareSaleReturn` / `posApi.postReturn`
- [x] Exchange — `/exchange` return + replacement sale
- [x] Shift state — header badge + `RegisterPage` open/close

### Data integrity

- [x] No duplicated sale / payment / stock — `SaleTransactionService` + `findSaleByIdempotency`; domain `pos-integrity.test.ts` scenarios 1–20 all passed this session
- [x] Idempotency preserved — checkout `PaymentAttemptGate` + sale `idempotency_key`
- [x] Supabase path preserved — `PosRepository` / `apps/api/src/routes/pos.ts`
- [x] No SQLite / Dexie / IndexedDB / offline sync in `apps/web` or `apps/api` POS path
- [x] No fake payment integration — methods from `parties` payment-methods; installment is a plan, not a card processor

### Performance / quality

- [x] Product catalog is paged search, not a full dump (`POS_PRODUCT_SEARCH_LIMIT` 24, max 50, visible 12)
- [x] Cart totals memoized in `usePosSession` via `calculatePosCartTotals`
- [x] New Sale meta (`PosSaleMeta`) is memoized so payment keystrokes do not rebuild the product grid
- [x] Hold list expiry is applied inside `listHeldSales` (no extra expire on refresh)
- [x] Hold names use `GET customer/:id` for missing ids only
- [x] Shell branch/device fetch is keyed by membership, not array identity
- [x] Typecheck/lint and web build pass (no broken POS imports)

### Routing (canonical POS architecture)

| Route | Page | Shell |
|---|---|---|
| `/pos` | `PosPage` | POSShell |
| `/pos/new` | `PosPage` (alias) | POSShell |
| `/held-sales` | `HeldSalesPage` | POSShell |
| `/invoices` | `InvoicesPage` → `SalesWorkspace` | POSShell |
| `/sales-management` | `RegisterPage` (via `SalesManagementPage`) | POSShell |
| `/returns` | `ReturnsPage` | POSShell |
| `/exchange` | `ExchangePage` | POSShell |
| `/payments` | `PaymentsPage` | POSShell |
| `/discounts` | `DiscountsPage` | POSShell |
| `/pos/salesmen` | `SalesmenPage` | POSShell |
| `/pos/installments` | `InstallmentsPage` | POSShell |

Also in `POS_ENVIRONMENT_PATHS` (same shell): `/pos/customers`, `/pos/products`, `/pos/reports`, `/pos/references`, `/pos/settings`.

`/salesman` and `/installments` remain ERP masters and do **not** enter the POS shell.

---

## Remaining

1. **Authenticated visual pass on a live register** — needs running `npm run dev:web` + `dev:api` and a signed-in cashier. This QA could not screenshot 1366 / 1440 / 1920 against the reference images (`localhost:5173/pos` returned a Chrome error page).
2. **Reference screenshots** are not stored in the repo, so pixel-level screenshot matching was not done.
3. **Header Notifications** links to ERP `/notifications` and leaves the POS environment (intentional existing route; not a second POS inbox).
4. **`/pos/customers` and `/pos/products`** are honest **Open POS** hubs; they are not a second Customers or Product Management module.
5. **Web camera / QR capture** throws “Camera capture not configured in this host”. Barcode wedge still works. Not a fake catalog.
6. **POS sidebar is 7 items** (New Sale, Hold / Resume, Customers, Products, Price & Discount, Reports, Settings). The 12 IA children remain as routes; Invoices / Register / Returns / Exchange / Payments / Salesmen / Installments highlight **Reports**.
7. **ERP mobile-nav smoke test** can hit the 15s timeout when the full web suite is under CPU contention. Isolated re-run passed in ~3.9s. Not a POS layout regression.

---

## Known limitations

- **Round off** and **delivery charges** display as zero with honest hints. Checkout does not invent a delivery fee or round-off policy.
- **Web printers / cash drawer** use memory adapters plus API fallback. Physical devices belong to Electron / hardware host.
- **POS Settings** is read-only (hardware, methods, tax, hold TTL, shortcuts). Writers stay in System Administration.
- **Payments center** records receipts; it does not void/reverse (no API) and is not a second sale poster.
- **Exchange** is two posted legs (return + replacement sale), not a single combined document.
- **Installment collection** after plan create is on Payments / New Sale, not a card gateway on `/pos/installments`.
- **Production JS bundle** is ~1.95 MB (Vite chunk warning). POS is not code-split from the rest of the ERP app; this is an existing app-wide observation, not a POS-only regression.
- React Router v7 future-flag warnings appear in tests; they are not POS runtime errors.

---

## Routes verified

Registered in `router.tsx` `implemented` map and `POS_ENVIRONMENT_PATHS`. Smoke + ownership tests lock:

- `/pos`, `/pos/new` → New Sale
- `/held-sales` → Hold / Resume
- `/invoices` ≠ `/sales-management` (invoice register vs cash shift)
- `/returns`, `/exchange`, `/payments`, `/discounts`
- `/pos/salesmen`, `/pos/installments`, `/pos/settings`, `/pos/references`
- `/pos/customers`, `/pos/products`, `/pos/reports` hubs (`POS_REPORT_LINKS` opens live POS screens only)

Broken-import check: `apps/web` typecheck and Vite build (439 modules) succeeded.

---

## Tests verified

This session:

| Suite | Result |
|---|---|
| `apps/web` typecheck / lint | Pass |
| `apps/web` vitest (`src/features/pos` + `smoke.test.tsx`) | 137 passed; 1 timeout under load, then isolated pass |
| `packages/domain` `pos-integrity.test.ts` | 20 passed |
| `apps/web` `npm run build` | Pass (439 modules; JS 1,945.82 kB) |

Phase 10 foundation totals (unchanged POS writers; same source as this commit):

| Suite | Files | Tests |
|---|---|---|
| contracts | 2 | 12 |
| domain | 37 | 257 |
| api | 7 | 37 |
| web | 39 | 138 |
| **Total** | **85** | **444** |

POS-specific web coverage includes: `pos-shell`, `pos-new-sale`, `pos-layout` (including 1366 desktop two-zone), `pos-sale-layout`, `pos-hub-pages`, `held-sales`, invoices, register, returns, exchange, payments, discounts, salesmen, installments, settings, catalog load, quotation, payment UX, integrity session.

---

## Performance observations

- Product search is debounced (180ms) and capped (24 then 50). No full-catalog load on `/pos` or `/pos/products`.
- Cart totals are memoized in `usePosSession`. `PosSaleMeta`, discovery tools, holds panel, and approval dialog are memoized.
- POS shell stays mounted across POS routes; hold count / shift are fetched per branch, not per keystroke.
- Sales Dashboard uses one paged `searchSalesManagement` call per filter apply (summary + rows together).
- Remaining cost: the main web bundle is large (~1.95 MB JS). First load of the ERP/POS SPA is heavier than a dedicated POS-only app would be. No POS-specific render-lag tests were run in a browser profiler this session (dev server was down).

---

## Verdict

The POS is a **mature online retail/industrial terminal** on the existing Supabase path: one shell, locked POS tokens, two-zone New Sale from 1024px, one cart math source, one payment workflow, paged product search, real holds/returns/exchange/shift. It is not a CRUD ERP page wrapped in extra chrome.

What this QA did **not** replace: a cashier sitting at 1366×768 with live stock posting. That remains an on-site sign-off, not a code gap found in this pass.
