# POS cart & pricing engine audit

Date: 2026-08-20  
Scope: cart/pricing math only. No UI redesign.

## Verdict

There is **one source of truth** for sale math:

| Step | Canonical function | File |
|------|--------------------|------|
| Unit price | `resolvePosUnitPrice` | `packages/domain/src/pos-pricing.ts` |
| Line discount | `applyDiscount` / `capLineDiscount` | `packages/domain/src/pos-discount.ts` |
| Line tax | `computeLineTax` | `packages/domain/src/pos-tax.ts` |
| Line economics (post) | `preparePosSaleLine` | `packages/domain/src/pos-pricing.ts` |
| Live cart line | `withRecalc` → `lineTaxAmount` / `lineTotal` | `packages/domain/src/pos-cart.ts` |
| Invoice totals | `calculateSaleTotals` | `packages/domain/src/sale-totals.ts` |
| Cart facade | `calculatePosCartTotals` → `calculateSaleTotals` | `packages/domain/src/pos-cart.ts` |
| Paid / remaining / change | `preparePosPayments` | `packages/domain/src/pos-payment.ts` |
| Posted sale | `SaleTransactionService.postSale` | `packages/domain/src/sale-transaction.ts` |
| Invoice display | Stored `subtotal` / `discount_total` / `tax_total` / `grand_total` | `PosRepository.getInvoice` |

UI (`PosTotals`, `toPosTransactionSummary`, `PosPaymentPanel`) **maps** those results. It must not invent a second grand.

Quotations now call `calculateSaleTotals` via `calculateQuoteTotals`.

---

## Calculation chain (authoritative)

```
Product price          resolvePosUnitPrice (manual → promo → qty break → customer → tier)
  → quantity           cart qty string, normalized to unit decimal places (max 4)
  → unit of measure    factorToBase for stock only — does not convert sell price
  → line subtotal      roundMoney(qty × unitPrice)
  → line discount      applyDiscount / capLineDiscount
  → invoice discount   capped to remaining after line discounts
  → taxable amount     exclusive: after discounts; inclusive: after discounts − extracted tax
  → tax                computeLineTax (exclusive add / inclusive extract)
  → delivery charge    SaleTotals.deliveryCharges (live POS: 0)
  → round-off          SaleTotals.roundOff (live POS: 0)
  → grand total        afterDiscount + exclusive tax + delivery + round-off
  → payment            preparePosPayments
  → remaining          grand − paidTowardBill
  → change             cash tendered − applied
```

Money rounding: `roundMoney` = `Math.round(n * 100) / 100` (`packages/domain/src/money.ts`).

---

## What was hardened in this pass

1. **Inclusive tax grand total** — exclusive tax is added to grand; inclusive tax is reported but **not added again**. `preparePosSaleLine.lineTotal` uses `computeLineTax().gross`. Cart lines stamp `taxPricingMode`. Posted items copy catalog `taxPricingMode`.
2. **Single tax column** — `calculatePosCartTotals` uses **stored** `line.tax` for the tax invoice summary (no second recompute that could disagree with grand).
3. **Delivery / round-off** — first-class fields on `SaleTotals` / `PosCartTotals`. Defaults 0. Live New Sale still posts 0 (delivery remains a fulfillment flag).
4. **Taxable amount** — comes from `calculateSaleTotals.taxableAmount`, not a UI formula.
5. **UI remaining** — credit hint uses `preparePosPayments.remaining` instead of `grand - sum(amounts)`.
6. **Quotations** — `calculateQuoteTotals` delegates to `calculateSaleTotals`.
7. **Returns** — refund line totals use `roundMoney` (same 2-dp helper).

---

## Case results (automated)

File: `packages/domain/src/pos-pricing-engine.test.ts`

| Case | Result |
|------|--------|
| 1. 1 × qty 1 @ 100 + 10% exclusive | subtotal 100, tax 10, grand **110** |
| 2. Two products 100 + 50 + 10% | subtotal 150, tax 15, grand **165** |
| 3. Line discount 20 on 200 | taxable 180, tax 18, grand **198** |
| 4. Invoice discount 10 on 100 + 10% tax | taxable 90, tax 10 (line tax not recomputed), grand **100** |
| 5. Tax 10% exclusive on 1000 | taxable 1000, tax 100, grand **1100** |
| 6. Partial pay 50 of 110 | paid 50, remaining **60**, change 0 |
| 7. Credit sale unpaid | paid 0, remaining **110**, type `credit` |
| 8. Rounding + delivery 1.50 + round-off −0.01 | 10.125 → 10.13; 3 × 10.13 = 30.39; grand **31.88** |
| 9. Refund 1 × original unit price 100 | refund **100** (does **not** include the 10 tax) |
| Inclusive 117 @ 17% | tax 17, grand **117** (not 134) |
| UoM pcs → box (factor 10) | stock factor changes; **unit price stays 100** |
| UI line total = cart grand = payment remaining | shared `calculateSaleTotals` / `preparePosPayments` |

Also covered: `sale-totals.test.ts` (inclusive, delivery, round-off, 2-dp line gross).

---

## Remaining limitations (intentional / not in live POS config)

1. **Invoice discount does not recompute line tax.** Line taxes are frozen after line net; invoice discount reduces grand, not GST extract. Same as previous posting behavior.
2. **Delivery charge is 0 on live checkout.** The checkbox flags a delivery note; it does not add a fee unless `calculateSaleTotals(..., { deliveryCharges })` is passed.
3. **Round-off is 0 on live checkout.** The engine accepts a signed adjustment; New Sale does not yet choose a rounding policy (nearest 1, 0.05, etc.).
4. **UoM does not convert sell price.** `changeCartLineUnit` switches unit metadata and stock `factorToBase`. Catalog unit-specific prices would require a price re-resolve by `unitId`.
5. **Returns refund qty × original unit price**, not the posted line total (tax/discount not reversed in refund amount). Exchange is a separate ticket.
6. **Server reprice is authority on post.** `resolvePostedSaleItems` uses catalog prices/tax per product. UI session tax rate can differ from a product’s catalog rate until post.

---

## Duplicate math removed

| Before | After |
|--------|--------|
| `calculateSaleTotals` always `subtotal − discount + tax` (broke inclusive) | Exclusive tax only is added |
| `preparePosSaleLine` `net + tax` on inclusive | `taxResult.gross` |
| `calculatePosCartTotals` recomputed tax for tax-invoice row | Uses stored `line.tax` |
| UI credit hint `grand - sum(payment amounts)` | `preparePosPayments.remaining` |
| `calculateQuoteTotals` local `Math.round` engine | `calculateSaleTotals` |
| Return `Math.round(qty * price * 100) / 100` | `roundMoney` |

UI still evaluates **discount policy % of base** (`subtotal − itemDiscount`, `qty × unitPrice`) for approval ladders. That is not a second grand total.
