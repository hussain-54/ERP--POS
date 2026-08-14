# PHASE 4A — PRICING & DISCOUNT REPORT

**Date:** 2026-08-15  
**Scope:** POS pricing, discounts, price resolution only. No Phase 4B. No POS redesign.

Status words used below are only **PASS**, **FAIL**, **PARTIAL**, **MISSING**, **NOT TESTED**, **DUPLICATED**.

---

## 1. Existing architecture

POS is online-only. Catalog prices live on `products` (retail / wholesale / dealer) plus optional `product_prices` rows (customer / price level / branch / unit).

Canonical unit-price function: `resolvePosUnitPrice` in `packages/domain/src/pos-pricing.ts`.

Posted sales go through `SaleTransactionService.postSale`. When `getProductPricing` is implemented (POS repository), the server re-resolves unit price, line discount, and tax. The browser amount is not the authority.

Cart preview uses the same domain functions (`resolvePosUnitPrice`, `applyDiscount`, `calculateSaleTotals`).

---

## 2. Pricing sources

| Source | Status |
|--------|--------|
| Product retail / wholesale / dealer columns | **PASS** (domain + live) |
| `product_prices.customer_id` | **PASS** domain; live customer create **NOT TESTED** (API 500 on `/parties/customers`) |
| Customer type → POS price level (retail/wholesale/dealer) | **PASS** (existing profile → `priceLevel`) |
| Quantity-break table | **MISSING** (`product_prices` has no `min_qty`) |
| Promotions table / engine | **MISSING** — **PROMOTION PRICING — NOT IMPLEMENTED** |
| Price books (`price_levels` + `product_prices.price_level_id`) | **PARTIAL** — catalog UI exists; POS uses the three product columns + `priceLevel` enum, not UUID books |
| Manual override | **PASS** domain (requires authorization flag) |

---

## 3. Price resolution

Inspected existing domain order (not invented):

**manual → promotion → quantity break → customer → retail/wholesale/dealer**

`preparePosSaleLine` then: resolved unit price → line discount → tax → line total.

Search loads customer contract amounts from `product_prices` when `customerId` is present. It does **not** invent quantity or promotion prices.

---

## 4. Discount calculation

Order used by `calculateSaleTotals` (existing, preserved):

1. Line gross = qty × unit price (`roundMoney`)
2. Line discount (percent wins when `discountPercent > 0`, else fixed amount, capped to line gross)
3. Invoice discount, capped to remaining (subtotal − item discount)
4. Tax is **sum of per-line tax already computed**; invoice discount does **not** reduce tax
5. Grand = subtotal − discountTotal + taxTotal

---

## 5. Percentage discount

Item `%` and fixed amount: **PASS** domain (`applyDiscount` / `preparePosSaleLine`).  
Live 10% on 1000 → discount 100, grand 900: **PASS** (`PHASE-4A-LIVE-RESULT.json` `line_percent_10`).

Cart line control accepts `10%` or a money amount (minimum UI). Invoice F5 accepts `10%` or amount.

---

## 6. Customer pricing

- Walk-in: no `customerId` → no `product_prices` lookup → price level only. **PASS** (live retail).
- Named customer row on `product_prices`: **PASS** domain (resolver + `getProductPricing`). Live insert path **NOT TESTED** (customer create failed).
- Customer tier: existing `priceLevelForCustomerType` still maps wholesale/dealer types onto `priceLevel`. **PASS** as tier-via-price-level, not a separate table.

---

## 7. Quantity pricing

Domain breaks (`quantityBreaks[]`): **PASS** (resolver + cart qty change test).  
Persisted quantity breaks: **MISSING**. Live: **MISSING**.

---

## 8. Promotion pricing

**PROMOTION PRICING — NOT IMPLEMENTED**

Domain accepts `promotionPrice` if supplied. No promotions table. Live: **MISSING**. No promotion engine was added in this phase.

---

## 9. Tax interaction

Tax is computed on **line net after line discount** (`computeLineTax`). Exclusive 10% on 900 → tax 90: **PASS** domain.  
Live sales used tax 0: tax-after-discount live **NOT TESTED**.  
Invoice discount does not change already-computed line tax (existing totals rule).

---

## 10. Approval status

Same-user RBAC ladder in `discount-policy.ts`:

| Role | Max % |
|------|-------|
| cashier | 5 (auto) |
| supervisor | 10 |
| manager | 20 |
| owner | 50 |
| special | unlimited |

API overwrites `approverRole` from the authenticated user (`apps/api/src/routes/pos.ts`). This is **not** second-actor approval.

**Do not treat this as Phase 4C dual-control.** Leave second-user approval for Phase 4C.

Unauthorized line discount (cashier vs 20%): **PASS** domain. Live owner login: **NOT TESTED**.

---

## 11. Server validation

| Check | Status |
|-------|--------|
| Client `unitPrice: 1` overwritten from catalog | **PASS** live (retail/wholesale/dealer posted 1000/900/800) |
| Line `%` applied on catalog price | **PASS** live |
| Invoice `%` recomputed from percent | **PASS** live (grand 900) |
| Discount policy on line/invoice percent | **PASS** domain |
| `getProductPricing` optional so old unit tests without the port still use client price | **PASS** |

---

## 12. Rounding

`roundMoney` (2 dp) is used in pricing, discount, tax, cart, and posted line totals.  
`Math.round` remains inside `roundMoney` itself and in unrelated modules (returns, commission, purchases). Those were **not** deleted.

Deterministic 10.555 → 10.56: **PASS** domain.

---

## 13. Tests

Domain matrix (`pos-pricing-discount.test.ts`, `sale-transaction.test.ts`, `pos-cart.test.ts`, `sale-totals.test.ts`):

| # | Case | Status |
|---|------|--------|
| 1 | Retail | **PASS** |
| 2 | Wholesale | **PASS** |
| 3 | Dealer | **PASS** |
| 4 | Customer price | **PASS** domain / live **NOT TESTED** |
| 5 | Quantity price | **PASS** domain / live **MISSING** |
| 6 | Promotion price | **PASS** domain-if-supplied / live **MISSING** |
| 7 | Fixed line discount | **PASS** |
| 8 | Percentage line discount | **PASS** |
| 9 | Invoice percentage | **PASS** |
| 10 | Invoice fixed | **PASS** |
| 11 | Discount threshold | **PASS** |
| 12 | Unauthorized discount | **PASS** domain |
| 13 | Quantity change | **PASS** domain (breaks in memory) |
| 14 | Price recalculation | **PASS** (qty / price level) |
| 15 | Tax after discount | **PASS** domain |
| 16 | Decimal rounding | **PASS** |
| 17 | Malicious client price | **PASS** domain + live |
| 18 | Duplicate sale / idempotency | **PASS** live |

`npm run typecheck` **PASS**  
`npm test` **PASS**  
`npm run build` **PASS**

---

## 14. Live verification

Script: `scripts/phase4a-pricing-verify.cjs`  
Result: `PHASE-4A-LIVE-RESULT.json`  
API: rebuilt process on port 4003 (`SMOKE_API_URL`).

Controlled product: retail 1000, wholesale 900, dealer 800. Client always sent `unitPrice: 1`.

| Step | Status |
|------|--------|
| Retail posted 1000 | **PASS** |
| Wholesale posted 900 | **PASS** |
| Dealer posted 800 | **PASS** |
| Named customer 850 | **NOT TESTED** |
| Quantity threshold | **MISSING** |
| Promotion | **MISSING** |
| 10% line → 900 before tax | **PASS** |
| 10% invoice → 900 | **PASS** |
| Idempotent retry | **PASS** |

Regression live:

| Suite | Status |
|-------|--------|
| Phase 1C (`phase1c-steps-12-18.cjs`) | **PASS** (ledger N/A walk-in; cleanup PARTIAL as before) |
| Phase 3A refund | **PASS** |
| Phase 3B stock/UOM/RPC | **PASS** |

---

## 15. Remaining limitations

- No persisted quantity-break prices.
- No promotion engine (**PROMOTION PRICING — NOT IMPLEMENTED**).
- Customer-specific live sale not executed (customer POST 500).
- Discount approval is same-user RBAC, not a second actor (Phase 4C).
- Invoice discount still does not recompute tax.
- POS product cards still display `retailPrice` for browsing (not the posted price).
- `getProductPricing` is optional; callers that omit the port still trust client prices (tests / non-POS).

---

## 16. Duplications discovered (not deleted)

| Item | Status |
|------|--------|
| `commerce.ts` `priceForCustomerType` vs POS `resolvePosUnitPrice` | **DUPLICATED** (B2B vs POS) |
| `pricing.ts` catalog profit helpers vs POS resolver | **DUPLICATED** (different purpose) |
| Product columns vs `product_prices` | **DUPLICATED** storage |
| `PosProductPanel` retail display vs resolved cart price | **DUPLICATED** display |
| `Record<string, unknown>` on PosPage holds/shift | **DUPLICATED** (pre-existing snapshots; not pricing math) |
| `Math.round` money in returns/commission/purchases | **DUPLICATED** vs `roundMoney` (out of 4A scope) |
| Cart tax vs `calculateSaleTotals` tax input | **PARTIAL** — cart computes tax; totals sums the provided tax (one path if items come from `toSaleItems`) |

`pickPriceLevel` now delegates to `resolvePosUnitPrice` (qty 1, no extra sources).

---

## Stop

Phase 4A implementation, audit, tests, live verification, and this report are complete. **Phase 4B was not started.**
