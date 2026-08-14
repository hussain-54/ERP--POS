# PHASE 4A — PRICING AUDIT (read-only)

**Date:** 2026-08-15  
Inspected before code changes. Status words: PASS / FAIL / PARTIAL / MISSING / DUPLICATED.

---

## 1. Current price sources

| Source | Storage | Used by POS today |
|--------|---------|-------------------|
| Product retail / wholesale / dealer | `products.retail_price`, `wholesale_price`, `dealer_price` | **Yes** — search + cart `resolvePosUnitPrice` / `pickPriceLevel` |
| Minimum sale price | `products.minimum_sale_price` | Manual override only |
| Special / last / average purchase | `products` + `pricing.ts` catalog helpers | Catalog/profit, **not** POS sell |
| Price levels | `price_levels` | Catalog Pricing page |
| Extra / customer / branch / unit rows | `product_prices` (`customer_id`, `price_level_id`, `branch_id`, `unit_id`, `amount`) | Catalog write; **not** POS search/post |
| Supplier prices | `supplier_product_prices` | Purchases only |
| Commerce B2B book | product columns via `commerce.ts` `priceForCustomerType` | B2B portal, not POS cart |
| Domain quantity breaks | In-memory `QuantityPriceBreak[]` | Domain + cart if search supplies them; **no DB column** |
| Domain promotion unit price | `promotionPrice` on search DTO | Domain only; **no promotions table** |

---

## 2. Which one POS currently uses

POS search returns the three product-column prices.

Cart (`usePosSession.addProduct`) calls `resolvePosUnitPrice` with:

manual → promotion → quantity break → customer → retail/wholesale/dealer.

Search does **not** populate `customerPrice`, `promotionPrice`, or `quantityBreaks`, so live POS effectively uses **price level on product columns**.

Posted sale uses **client `unitPrice` / `discount`**. Server does not re-resolve catalog price.

---

## 3. Duplicate price sources

| DUPLICATED | Notes |
|------------|--------|
| `pickPriceLevel` (pos-cart) vs `pickTierPrice` / `resolvePosUnitPrice` (pos-pricing) vs `priceForCustomerType` (commerce) vs `pricing.ts` special/retail | Same three columns, three pickers |
| Product columns vs `product_prices` | Two stores for sell price |
| Cart totals vs `calculateSaleTotals` | Cart already delegates to sale-totals (aligned) |
| UI `applyDiscount` vs server `item.discount` | Amount sent from browser; percent not applied on post |

---

## 4. Existing database tables

- `products` — retail / wholesale / dealer / min / cost
- `price_levels` — named levels
- `product_prices` — optional override rows (customer, level, branch, unit). **No `min_qty`. No promotion FK.**
- `sale_discount_audits` — kind includes percentage, fixed, customer, wholesale, promotion, special, bulk
- **No** `promotions` / `quantity_breaks` table

---

## 5. Existing contracts

- `SaleItemInput`: `unitPrice`, `discount`, `discountPercent` (0–100)
- `ProductSearchResult`: retail/wholesale/dealer + optional customer/promo/breaks
- `ProductSearchQuery`: optional `customerId`, `priceLevelId`
- `CreateSaleInput`: `discountTotal`, `discounts[]`, `priceLevelId` (UUID), **no** `priceLevel` enum

---

## 6. Existing domain functions

- `resolvePosUnitPrice` — **canonical POS unit price** (already documented priority)
- `applyDiscount` / `applyCartLineDiscountInput` — % and fixed
- `calculateSaleTotals` — line discount then invoice discount then **add tax** (tax is per-line input, not recomputed here)
- `assertDiscountAllowed` / `evaluateDiscountApproval` — same-user RBAC ladder, not second actor
- `computeLineTax` — exclusive/inclusive
- `roundMoney` — 2 dp

---

## 7. Existing API endpoints

- `GET /api/v1/pos/products/search`
- `POST /api/v1/pos/sales` (overwrites `discounts[].approverRole` from authz)
- `GET/POST /api/v1/catalog/price-levels`
- `GET/POST /api/v1/catalog/products/:id/prices`

---

## 8. Missing functionality

| Item | Status |
|------|--------|
| Customer-specific from `product_prices` on POS search/post | **MISSING** (table exists) |
| Quantity-break persistence (`min_qty`) | **MISSING** (domain only) |
| Promotion engine / table | **MISSING** |
| Server re-resolve of unit price | **MISSING** |
| Line % discount posted from cart | **PARTIAL** (schema + `applyDiscount`; cart UI is amount-only) |
| Invoice % (value ending `%`) | **PARTIAL** (invoice is fixed amount) |
| Second-actor discount approval | **MISSING** (same-user RBAC) — Phase 4C |

---

## 9. Conflicting functionality

- Documented conceptual order (customer → promo → qty → tier) **differs** from implemented `resolvePosUnitPrice` (promo → qty → customer → tier). **Keep implemented order.**
- Client can post `unitPrice: 1` today; stock still deducts at full qty. **Server must overwrite.**

---

## Intended Phase 4A work (after this audit)

1. Keep `resolvePosUnitPrice` as single resolver; richer typed result.
2. Load `product_prices` customer rows into search + sale post.
3. Re-resolve catalog lines on the server; apply `%` via `applyDiscount`.
4. Minimal cart/invoice `%` controls.
5. Do **not** invent quantity-break or promotion tables.
