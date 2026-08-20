# POS Final QA Report — Production Readiness

**Date:** 2026-08-20  
**Scope:** In-ERP POS (module 02) — existing implementation only. No features added in this audit.  
**Method:** Automated domain/web tests, typecheck/lint/build gates, static call-path review of New Sale / hold / checkout / stock, performance cost model, browser probe of `/pos`.  
**Live authenticated E2E:** Blocked — `http://localhost:5173/pos` redirects to `/login` (no credentials in session). Operational flows are covered by unit/integration tests + code evidence.

---

## Verdict

**Not production-ready.**

No **P0** money/stock “always wrong under normal happy-path” defects were confirmed in the critical sale posting path (draft → stock → payments → posted, with idempotency and compensation). Multiple **P1** issues remain: hardware scan can add the wrong product, hold edit can overwrite with a stale cart, compensation/void/installment failure modes, CI regressions in New Sale UI tests, and operator discoverability gaps.

Per policy: **do not ship as production-ready while P0/P1 remain.**

| Gate | Result |
|------|--------|
| Domain POS integrity / hold / payment / cart / customer / stock | **66/66 pass** |
| Domain `sale-transaction` | **23/23 pass** |
| Web `src/features/pos` | **120 pass / 3 fail** (`pos-new-sale.test.tsx`) |
| Nav / ownership / user-messages / perf model (spot) | **pass** |
| Typecheck (`contracts`, `domain`, `db`, `api`, `web`) | **pass** |
| Lint (`npm run lint` = typecheck) | **pass** |
| Web production build | **pass** (~1.97 MB main chunk; size warning) |
| Authenticated browser POS | **not executed** (login gate) |

---

## Severity definitions

| Level | Meaning |
|-------|---------|
| **P0 Critical** | Wrong money/stock under normal use, data corruption, security break, or sale posted without inventory integrity |
| **P1 High** | Integrity under failure/concurrency, wrong product sold, stuck sale keys, broken CI gate, or operators cannot reach required flows safely |
| **P2 Medium** | Edge cases, incomplete UX, non-critical races, documented limitations |
| **P3 Low** | Copy polish, stubs, bundle size, minor discoverability |

---

## Findings rollup

### P0 Critical

*None confirmed in this audit.*

Critical checkout path is fail-closed for “posted without stock”: sale-level idempotency, UUID stock `operation_id`, and compensate/void on mid-chain failure (`SaleTransactionService` + `docs/POS-CHECKOUT-AUDIT.md`). Duplicate posted key does not re-apply stock (`sale-transaction.test.ts`, `pos-integrity` scenarios 19–21).

### P1 High

| ID | Area | Finding | Evidence |
|----|------|---------|----------|
| **P1-01** | Products / scan | Hardware scanner falls back to **first fuzzy search hit** when there is no exact match — wrong SKU can enter the cart. Keyboard Enter path only adds exact or single-result matches. | `PosPage.tsx` scanner: `pickExactProductMatch(...) ?? items[0]` (~1903). Keyboard: exact or `items.length === 1` only (~727–728). |
| **P1-02** | Hold | **`editHold` on New Sale** applies snapshot via React state then immediately `buildHoldSnapshot({ cart, … })` from the **pre-update closure** — can overwrite hold cart with stale lines. | `PosPage.tsx` `editHold` (~1556–1607). Held Sales page save-edit of label/notes is safer. |
| **P1-03** | Inventory | Compensation is **best-effort**. If reverse-stock fails after a failed finalize, sale may void while stock remains reduced. | `docs/POS-CHECKOUT-AUDIT.md`; compensate path swallows reverse errors. Happy path tested; reverse-failure not injected. |
| **P1-04** | Inventory / payment | If **`voidIncompleteSale` fails**, draft stays “in progress” and the client keeps the same idempotency key → cashier blocked until ops intervention. | Checkout audit; draft-in-progress behavior in `sale-transaction` tests. |
| **P1-05** | Hold | **`holdSale` is not one DB transaction** — insert `sales` then `held_sales`; second failure can leave orphan `sales.status=held`. | `packages/db/.../pos-repository.ts` `holdSale`. |
| **P1-06** | Payment | **Installment plan is post-commit**. HTTP can succeed with a posted sale and **no plan** if side-effect fails. | `sale-transaction` post-commit `runPostedSideEffect`; checkout audit. |
| **P1-07** | Build / CI | **3 New Sale UI tests fail** after cashier-copy UX hardening (stale assertions: empty title, stock warning, PAY NOW loading label). Blocks a clean `vitest` POS suite. | `pos-new-sale.test.tsx`: expects `No recent products`, `Last available units`, button name `Loading…`; UI now uses `No recent products yet`, `Last N units available`, `Processing payment…`. |
| **P1-08** | Products | **Create product is not on New Sale** — hub only routes to Product Management. “Newly created product appears” requires leaving POS + catalog refresh (`erp:catalog-changed`). | `PosHubPages.tsx`; ownership map. |
| **P1-09** | Customer | Default **Walk-in disables customer search**. Primary unlock is **F3** (`setWalkIn(false)`). Easy for cashiers to miss existing-customer lookup. | `usePosSession` default `walkIn=true`; `PosCustomerPanel` `disabled={walkIn \|\| !canRead}`. |
| **P1-10** | Navigation | Core IA screens (Returns, Invoices, Exchange, Payments, Salesmen, Installments, References) are **not on `POSTerminalNav`**. Reachable via Reports hub / Ctrl+K / URL. Risk of “broken route” perception in floor ops. | `pos-ownership.ts` `POS_TERMINAL_NAV` (7 links); routes exist in `router.tsx`. |

### P2 Medium

| ID | Area | Finding | Evidence |
|----|------|---------|----------|
| **P2-01** | Cart / products | Multi-unit options **never loaded** from POS search — unit switcher dead for typical catalog adds. | Search returns base unit; `usePosSession` builds single-option `unitOptions`. |
| **P2-02** | Cart | **Clear cart ≠ Cancel sale** — Clear leaves invoice discount / payment / installment state. | `PosPage` confirm handlers. |
| **P2-03** | Hold | After CAS resume, **`sales` status update is unchecked**; cancel sales update similarly. | `pos-repository` resume/cancel. |
| **P2-04** | Hold | Hold double-submit race uses `busy` only (no sync lock like `payingRef`). | `PosPage.holdBill`. |
| **P2-05** | Payment | Card / JazzCash / Easypaisa / SadaPay / online / other wallets are **record-only receipts** (no PSP). Cashiers must understand settlement is manual. | `RECORD_ONLY_PAYMENT_KINDS`; checkout audit. |
| **P2-06** | Payment | `PaymentAttemptGate` is **tab-local**; server idempotency is authoritative. | `pos-payment.ts`. |
| **P2-07** | Inventory | Whole sale is **not one Postgres transaction** — sequential draft + per-line RPC. Safe with compensate design, but more failure modes than a single TX. | `sale-transaction.ts` comments / audit. |
| **P2-08** | Nav | `/pos/customers`, `/pos/products`, `/pos/reports` are **stub hubs**, not full masters. | `PosHubPages.tsx`. |
| **P2-09** | Customer | Cancel/clear does not always reset to Walk-in (customer retained). | `clearSale` vs `selectWalkIn`. |
| **P2-10** | Perf | Main web bundle **~1.97 MB** minified (ERP+POS). Rollup warns &gt;500 kB. | `vite build` 2026-08-20. |
| **P2-11** | Perf / data | Recent/Favorites store product snapshots in **localStorage** — stock can be stale until re-search. | Prior performance audit; `PosPage` favorites/recent keys. |
| **P2-12** | Live QA | Authenticated end-to-end of all 10 groups **not run** in browser (login required). | Browser: `/pos` → `/login`. |

### P3 Low

| ID | Area | Finding | Evidence |
|----|------|---------|----------|
| **P3-01** | Errors | Concurrent stock conflict message not specially mapped for cashiers. | Domain string may pass ≤160 char filter. |
| **P3-02** | Products | UI OOS uses `Number(stockAvailable)`; domain uses decimal compare. | `PosProductPanel.tsx`. |
| **P3-03** | Nav | Ownership map names `RegisterPage`; router uses `SalesManagementPage` re-export — not broken. | `SalesManagementPage.tsx`. |
| **P3-04** | Manual line | Manual cart line requires borrowing a unit from an existing catalog line first. | `PosPage.addManualQuick`. |
| **P3-05** | Hold list | Resumed holds drop from pending register (by design). | Hold audit / list filter. |

---

## Test group results

### GROUP 1 — Navigation

| Check | Result | Notes |
|-------|--------|-------|
| Open ERP | **Pass** (code + smoke/nav tests) | Single `AppShell`; POS is module 02 |
| Open POS | **Pass** (route + redirect) | Canonical `/pos`; live hit redirects to login when unauthenticated |
| Switch POS sections | **Partial** | Terminal nav: POS, Hold, Customers, Products, Price & Discount, Reports, Settings. Full IA via hubs/shortcuts |
| Return to ERP | **Pass** | POS header Menu → GlobalSidebar (`pos:toggle-erp-nav`) |
| No duplicate POS app | **Pass** | Not a separate SPA; `/pos/new` alias of same `PosPage` |
| No broken route | **Pass** (registered) | All POS ownership paths mapped in `router.tsx` |

**Automated:** `module-navigation-qa.test.tsx`, `pos-ownership.test.ts`, `smoke.test.tsx`, `pos-shell.test.tsx`.

---

### GROUP 2 — Products

| Check | Result | Notes |
|-------|--------|-------|
| Search | **Pass** | Batched search; inline empty/error copy |
| Add | **Pass** | Domain stock gates + cart merge |
| Quantity | **Pass** | Session / cart engine |
| Remove | **Pass** | Confirm remove |
| Create product | **Fail / N/A on New Sale** | Hub → Product Management only (**P1-08**) |
| Newly created appears | **Conditional** | Needs catalog-changed + remounted search |
| Invalid product | **Pass** | Inline “No products found…” |
| Out of stock | **Pass** | Domain + disabled Add + humanized cart error |

**Regression:** Scanner fuzzy fallback (**P1-01**).  
**Tests:** `pos-cart.engine`, `pos-stock-availability`, `pos-product-search`, `pos-new-sale` (3 fail on copy).

---

### GROUP 3 — Customer

| Check | Result | Notes |
|-------|--------|-------|
| Walk-in | **Pass** | Default; full pay required |
| Existing customer | **Pass with UX friction** | Must exit Walk-in (F3) first (**P1-09**) |
| New customer | **Pass** | Permission-gated create on panel |
| Outstanding | **Pass** | Profile + credit hint |
| Credit limit | **Pass** | `evaluatePosCustomerCredit` at checkout |

**Tests:** `packages/domain/src/pos-customer.test.ts`, `session/pos-customer.test.ts`.

---

### GROUP 4 — Cart

| Check | Result | Notes |
|-------|--------|-------|
| Quantity | **Pass** | |
| Unit | **Partial** | Domain OK; POS search does not populate multi-unit (**P2-01**) |
| Discount | **Pass** | Line + invoice (permission/approval) |
| Tax | **Pass** | Session tax rate + totals |
| Totals | **Pass** | `calculatePosCartTotals` |
| Clear | **Pass with caveat** | Leaves payment/discount residue (**P2-02**) |
| Cancel | **Pass** | `clearSale()` |

**Tests:** `pos-cart`, `pos-cart.engine`, `pos-session`, `pos-main-screen`, `pos-integrity` clear scenario.

---

### GROUP 5 — Hold

| Check | Result | Notes |
|-------|--------|-------|
| Hold | **Pass** | Empty cart blocked; stock not reduced |
| List | **Pass** | `/held-sales` |
| Resume | **Pass** | CAS `held→resumed`; replace cart (no append) |
| Cancel | **Pass** | CAS + void held sale |

**Risks:** Non-atomic hold insert (**P1-05**), stale `editHold` (**P1-02**).  
**Tests:** `pos-hold`, `pos-hold-workflow`, integrity scenarios 6–8, `held-sales-page.test.tsx`.

---

### GROUP 6 — Payment

| Method | Result | Notes |
|--------|--------|-------|
| Cash | **Pass** | Real tender; change not posted as payment |
| Card | **Pass (record-only)** | Payment row; no PSP (**P2-05**) |
| Bank | **Pass** | Settlement classification |
| Wallet (JazzCash / etc.) | **Pass (record-only)** | Same as card |
| Credit | **Pass** | No split; AR via ledger; customer required |
| Installment | **Partial** | Plan post-commit (**P1-06**) |
| Partial payment | **Pass** | Walk-in blocked; customer credit rules |

**Double-click:** `payingRef` + pending confirmation + `PaymentAttemptGate` + disabled PAY NOW.  
**Tests:** `pos-payment`, `pos-payment-ux`, `sale-transaction`, payment confirm UI tests (where green).

---

### GROUP 7 — Inventory

| Check | Result | Notes |
|-------|--------|-------|
| Sale decreases stock | **Pass** | Atomic RPC per line |
| Failed sale does not corrupt stock | **Mostly pass** | Compensate designed; reverse failure = **P1-03** |
| Duplicate checkout ≠ duplicate stock | **Pass** | Idempotency + unique operation_id |

**Tests:** `sale-transaction.test.ts` (23), `pos-integrity` (scenarios 1, 8, 16, 19, 21).

---

### GROUP 8 — Performance

| Metric | Measurement | Method |
|--------|-------------|--------|
| POS first load | ~9 bootstrap API kinds + ERP shell; remount within 60s can cache-hit | Code inventory + `pos-bootstrap-cache` + prior audit. **No wall-clock** (login gate) |
| Search response | Batched ≤**~18** Supabase RTs for 24–50 hits (was ~178 at N=24) | `pos-performance-model.test.ts` |
| Product add | In-memory domain + local state — sub-frame for typical carts | Code path (no network until checkout) |
| Cart update | Memoized recalculate — O(lines) | Domain |
| Checkout response | Multi-step draft→stock→pay→post + post-commit side effects | Architecture; no live timing |

**Indexes:** `supabase/migrations/20260820000001_pos_performance_indexes.sql` present — must be applied in target Supabase.  
**Build size:** main JS **1,968.81 kB** / **413.78 kB** gzip (**P2-10**).

---

### GROUP 9 — Error handling

| Check | Result | Notes |
|-------|--------|-------|
| Network failure | **Pass** | Online gate + sanitized `formatPosFailure` / `formatOnlineFailure` |
| Invalid input | **Pass** | Validation + inline cart/payment errors |
| Duplicate SKU | **Pass (copy)** | Infra errors sanitized; known SKU message mapped |
| Duplicate barcode | **Partial** | Unique-constraint sanitized to generic fallback unless message matches known SKU pattern; create path is outside New Sale |
| Insufficient stock | **Pass** | Domain + humanized cart messages |
| Failed payment | **Pass** | Inline confirmation error; idempotency key kept |
| Double click | **Pass** | Client gates + server idempotency |

**Tests:** `pos-user-messages.test.ts`, payment gate tests, integrity insufficient-stock scenario.

---

### GROUP 10 — Build

| Check | Result | Command / note |
|-------|--------|----------------|
| Typecheck | **Pass** | packages + apps/api + apps/web |
| Lint | **Pass** | `lint` aliases typecheck |
| Build | **Pass** | `apps/web` vite production build |
| POS web test suite | **Fail** | 3 failures in `pos-new-sale.test.tsx` (**P1-07**) |
| Domain POS critical tests | **Pass** | 66 + 23 sale-transaction |

---

## What is solid (ship-quality foundations)

1. POS is **one ERP module**, not a second application.  
2. Checkout is **sale-level idempotent** and **fail-closed** for posted-without-stock.  
3. Hold parks snapshots and **does not reduce inventory**.  
4. Duplicate posted checkout **does not double stock movements**.  
5. Cashier-facing errors no longer dump raw Supabase/Postgres text (mapper + logging).  
6. Search N+1 storm fixed (cost model).  
7. Typecheck and production web build succeed.

---

## Must-fix before production (P1)

1. **Scanner:** never add `items[0]` without exact (or explicit confirm) match.  
2. **`editHold`:** build snapshot from restored snapshot object, not stale React state — or remove New Sale edit-hold path.  
3. **Compensation / void:** monitoring + runbook for stuck drafts and reverse-stock failures; ideally harden void retries.  
4. **Hold insert:** single transaction or compensating delete of orphan sale.  
5. **Installment:** surface failure when plan side-effect fails after post (or make plan critical).  
6. **Update `pos-new-sale.test.tsx`** assertions to current cashier copy so CI is green.  
7. **Customer UX:** visible “Existing customer” control (not F3-only).  
8. **Create-product / nav:** either document floor SOP clearly or expose create + full IA in terminal nav.  
9. **Authenticated E2E** of Groups 1–9 on a staging org with real Supabase + applied index migration.

---

## Production-readiness statement

```
PRODUCTION READY: NO
```

Reason: **P1 findings remain** (wrong-product scan risk, hold integrity edges, compensation/installment gaps, failing New Sale UI tests, operator discoverability). No confirmed P0 on the happy-path checkout/stock path.

---

## Evidence index

| Artifact | Path |
|----------|------|
| Checkout audit | `docs/POS-CHECKOUT-AUDIT.md` |
| Hold audit | `docs/POS-HOLD-RESUME-AUDIT.md` |
| Performance audit | `docs/POS-PERFORMANCE-AUDIT.md` |
| Ownership / routes | `apps/web/src/features/pos/pos-ownership.ts`, `apps/web/src/app/router.tsx` |
| Sale posting | `packages/domain/src/sale-transaction.ts` |
| Stock RPC | `packages/db/src/repositories/inventory-repository.ts` |
| New Sale | `apps/web/src/features/pos/PosPage.tsx` |
| Perf indexes | `supabase/migrations/20260820000001_pos_performance_indexes.sql` |

---

*End of report.*
