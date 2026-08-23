# POS Final Production QA

**Date:** 2026-08-23  
**Scope:** Module 02 POS / Sales (`/pos/**`) — frontend only  
**Auditors:** POS engineering, frontend architecture, UI/UX, performance, QA  

---

## Executive summary

The POS workspace is fully embedded in the ERP `AppShell` with dedicated `PosShell` chrome. All **139 registered POS routes** (`POS_ROUTE_PATHS`) resolve inside the same shell (verified by automated navigation QA). Checkout terminal, sales register, returns, shift/cash, approvals, invoices, reports, tax, devices, and settings are production-grade workspaces backed by real APIs where available. Integrations that are not live (FBR, PSP terminals, offline sync, digital receipts) are explicitly marked — never simulated.

---

## Completed modules (live)

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 01 | Overview / Command Center | ✅ Live | KPIs from shared shell context; module launcher cards |
| 02 | Sales | ✅ Live | Terminal, holds, drafts, completed/void registers |
| 03 | Customers | ✅ Live | Select, walk-in, profile, history, ledger, credit, loyalty |
| 04 | Products | ✅ Live | Search, barcode, SKU, favorites, recent, categories, stock |
| 05 | Pricing & Discounts | ✅ Live | Override, item/invoice discount, coupons, promotions |
| 06 | Payments | ✅ Live | All tenders record-only; split/partial/credit/installment |
| 07 | Invoices & Receipts | ✅ Live | Registers, tax docs, quotations, orders, credit/debit notes, reprint |
| 08 | Returns & Exchange | ✅ Live | Full workflow via returns API |
| 09 | Shift & Cash | ✅ Live | Open/close, cash in/out, drawer, reconcile (transfer: see partial) |
| 10 | Approvals | ✅ Live | Inbox with approve/reject; RBAC from permissions |
| 11 | Reports | ✅ Live | 13 report types from real APIs; 2 honest gaps |
| 12 | Tax & Compliance | ✅ Live | Profile, rates, compliance report; FBR screens show not-live |
| 14 | Devices & Terminal | ✅ Live | Terminals registry, local hardware status, events |
| 15 | POS Settings | ✅ Live | General, payments list, tax summary, hardware link |

---

## Partial modules (UI present, backend or scope limited)

| Area | Screen | Gap |
|------|--------|-----|
| 04 Products | QR Scan, Camera Scan | Camera/QR capture not configured in browser host |
| 07 Invoices | Digital Receipt | No SMS/email delivery integration |
| 09 Shift | Cash Transfer | No inter-drawer transfer API — workaround documented |
| 11 Reports | Terminal Report | No per-terminal dimension in reporting API |
| 11 Reports | Discount Report | No dedicated discount report endpoint |
| 11 Reports | Shift Report | Uses day-close **preview** only — not historical shift archive |
| 12 Tax | FBR Invoice / Submit / Status | Architecture-ready; **FBR not live** (server forces `fbr_integration_enabled: false`) |
| 13 Offline & Sync | All screens | Hub placeholders only — no SQLite/offline engine |
| 14 Devices | Payment Terminal | Record-only payments; no PSP hardware integration |
| 14 Devices | Customer Display | No pole-display driver registered |
| 15 Settings | Terminal, Receipt, Invoice, Rules, Numbering | Structured panels with honest “planned” messaging |
| 15 Settings | Offline Settings | Visible but marked not implemented |

---

## Unavailable integrations (explicitly not faked)

- **FBR e-invoicing / IRIS submission** — local tax documents only
- **Live PSP / card terminal** — card/wallet tenders are record-only
- **Digital receipt delivery** (SMS/email)
- **Offline POS / SQLite sync**
- **Customer pole display**
- **Camera QR / product recognition** in POS product scan
- **Inter-drawer cash transfer API**

---

## Fixed bugs (this QA pass)

| Issue | Fix |
|-------|-----|
| Duplicate shift/hold API calls on Command Center | Introduced `PosShellContext` — single `usePosShell` instance shared by `PosShell` and `PosCommandCenterRoute` |
| Reports re-fetched on every filter keystroke | Initial load on mount/mode only; filter changes require **Run report** |
| Tax screens fetched profile + rates + documents + report on every tab | Mode-scoped loading in `TaxWorkspace` |
| Device screens fetched terminals + events + capabilities on every sub-page | Mode-scoped loading in `DevicesWorkspace` |
| Stale smoke tests after Phase 9 nav expansion | Updated `smoke.test.tsx` POS child titles and Returns status |

---

## Remaining technical debt

1. **Bundle size** — production JS ~1.9 MB (gzip ~389 KB); route-level code splitting not yet applied to POS workspaces.
2. **Vitest teardown** — occasional worker `onTaskUpdate` timeout on Windows after full suite (all assertions pass).
3. **Salesman dimension** — cashier report shows raw user IDs until HR display names are joined client-side.
4. **Void posted sales** — UI action disabled; API not exposed.
5. **Price override / void approval types** — inbox filters exist; backend may return empty for unsupported enum values.
6. **Shift transfer & expenses** — coming-soon panels where API is missing.
7. **Product search debounce** — 280 ms debounce on terminal; acceptable but could share a catalog cache layer.

---

## Performance improvements (applied)

- **Shell data deduplication** — one shift/hold poll per POS session instead of two on `/pos`.
- **Report workspace** — removed fetch-on-filter-change loop.
- **Tax workspace** — 1 API call per screen instead of 4.
- **Devices workspace** — loads terminals/events/capabilities only when the active screen needs them.
- **Existing good patterns retained:**
  - Product search debounced (280 ms) on terminal
  - `CATALOG_CHANGED_EVENT` refetch after product create (no full reload)
  - Sales register debounced search (250 ms)
  - POS terminal product `limit` pagination (`Load more`)

---

## CHECK 1 — Routing verification

| Check | Result |
|-------|--------|
| All POS routes registered | ✅ `POS_ROUTE_PATHS` + `buildPosImplementedRoutes()` |
| Stays inside ERP shell | ✅ `AppShell` → `ModuleWorkspace` → `PosShell` → page |
| No standalone POS app | ✅ Global header hidden on `/pos/**`; ERP sidebar remains |
| Back to Command Center | ✅ `PosSubPageShell`, `PosHeader`, terminal top bar all link to `/pos` |
| Intentional duplicate routes | ✅ `/pos/shift` → alias of `/pos/shifts` (legacy compat) |
| Deep links from catalog | ✅ `/products/new?returnTo=/pos/sales/new` returns to terminal |

**Automated proof:** `module-navigation-qa.test.tsx` — opens every POS parent and child inside one `AppShell` (5/5 pass).

---

## CHECK 2 — UI / responsive verification

| Check | Result |
|-------|--------|
| Horizontal scroll | ✅ `overflow-x-hidden` on app shell; POS zones use `min-w-0` |
| Page scroll in POS workspace | ✅ `h-screen overflow-hidden` fill mode for POS paths |
| Clipped / overlapping panels | ✅ Flex column + `min-h-0` on workspace, terminal grid, registers |
| Fixed-height bugs | ✅ Terminal uses `flex-1 overflow-hidden`; internal `.pos-zone-scroll` |
| Mobile | ✅ Terminal 3-pane tabs (Products / Cart / Pay); POS sidebar drawer |
| Tablet | ✅ ERP sidebar collapses; terminal 3-column from `lg:` breakpoint |
| Desktop | ✅ Full 3-zone terminal grid; sidebar + content |

**Automated proof:** `erp-responsive.test.tsx`, `module-workspace.test.tsx` (POS chrome assertions).

---

## CHECK 3 — POS terminal verification

| Flow | Result |
|------|--------|
| Product search | ✅ Debounced API search + category/favorites/recent tabs |
| Product selection | ✅ Tap/click adds to cart |
| Cart / quantity | ✅ `CartZone` qty +/- , remove |
| Discount | ✅ Item + invoice discount dialogs; URL `?discount=1` deep link |
| Customer | ✅ Select / walk-in / create dialog |
| Hold | ✅ Posts to `/api/v1/pos/holds` |
| Resume | ✅ Held sales register → terminal state restore |
| Payment | ✅ `PaymentDrawer` split/partial/credit/installment |
| Complete sale | ✅ Posts to `/api/v1/pos/sales`; cart preserved until success |

**Viewport:** Terminal root is `flex min-h-0 flex-1 flex-col overflow-hidden`; only product list, cart lines, and checkout summary scroll internally.

---

## CHECK 4 — Performance audit summary

See **Performance improvements** above. No business logic changed.

---

## CHECK 5 — Product creation → POS

| Step | Result |
|------|--------|
| Create from terminal | ✅ Link to `/products/new?returnTo=<terminal path>` |
| Create from POS Products | ✅ Same `returnTo` pattern |
| Notify catalog | ✅ `notifyCatalogChanged()` dispatches `CATALOG_CHANGED_EVENT` |
| Terminal refetch | ✅ `PosTerminalPage` listener calls `loadProducts()` |
| Navigate back | ✅ `ProductFormPage` navigates to `returnTo` when path starts with `/pos` |
| Full page reload required | ❌ Not required |

---

## CHECK 6 — Data integrity

No changes were made to sale posting, stock movement, payment settlement, return/refund, discount, customer, or accounting APIs during this QA pass. Frontend continues to:

- Post sales through existing `posApi.postSale`
- Hold/resume through hold snapshot APIs
- Return/refund through `prepareSaleReturn` domain + returns API
- Record payments only (no fake PSP settlement)
- Apply discounts through existing pricing domain helpers

---

## CHECK 7 — Build & test results

Commands run from `apps/web`:

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm run lint` | ✅ Pass (tsc `--noEmit`) |
| `npm test` | ✅ **58 / 58** tests pass |
| `npm run build` | ✅ Pass — `dist/` produced in 23s |

**Key test files:**

- `src/app/module-navigation-qa.test.tsx` — all POS routes in ERP shell
- `src/app/smoke.test.tsx` — 39-module nav lock incl. expanded POS children
- `src/app/shell/erp-responsive.test.tsx` — mobile/tablet shell
- `src/app/shell/module-workspace.test.tsx` — POS workspace chrome

---

## Route inventory (15 POS modules)

All paths under `/pos` — **139 unique routes** in `POS_ROUTE_PATHS` including:

- Command Center `/pos`
- 15 module hubs (`/pos/overview`, `/pos/sales`, … `/pos/settings`)
- All child screens (sales terminal, registers, workspaces)
- Legacy alias `/pos/shift` → shift dashboard

Ownership source: `apps/web/src/features/pos/ownership.ts`  
Route map: `apps/web/src/features/pos/posRoutes.tsx`

---

## Conclusion

The POS module now behaves as a **mature in-ERP retail workspace**: dedicated terminal chrome, searchable operational registers, honest integration boundaries, and responsive layout without breaking out of the ERP shell. Remaining gaps are documented and scoped to missing backend capabilities — not hidden behind fake UI.
