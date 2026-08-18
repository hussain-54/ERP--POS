import { describe, expect, it } from "vitest";
import {
  addOrIncrementProductOrThrow,
  applyCartLineDiscountInput,
  calculatePosCartTotals,
  createCartLineFromProduct,
  lineTotal,
  updateCartLineQty,
} from "@electronic-erp/domain";
import {
  cartLineDisplayTotal,
  POS_DELIVERY_CHARGES,
  POS_ROUND_OFF,
  toPosTransactionSummary,
} from "./pos-transaction";

describe("POS transaction summary", () => {
  const unitId = "11111111-1111-4111-8111-111111111111";
  const productId = "33333333-3333-4333-8333-333333333333";
  const taxRate = {
    id: "55555555-5555-4555-8555-555555555555",
    ratePercent: 17,
    pricingMode: "exclusive" as const,
    isExempt: false,
    kind: "sales_tax" as const,
  };

  it("mirrors domain cart totals so UI and checkout share one grand", () => {
    let cart = addOrIncrementProductOrThrow(
      [],
      createCartLineFromProduct({
        key: "1",
        productId,
        name: "LED Bulb",
        sku: "LED-12",
        unitId,
        unitPrice: 250,
        taxRate,
        stock: "20",
      }),
    );
    const qty = updateCartLineQty(cart, "1", "2", taxRate);
    expect(qty.ok).toBe(true);
    cart = qty.cart;
    const discounted = applyCartLineDiscountInput(cart, "1", { mode: "fixed", value: 20 }, taxRate);
    expect(discounted.ok).toBe(true);
    cart = discounted.cart;

    const totals = calculatePosCartTotals(cart, "10", taxRate);
    const summary = toPosTransactionSummary(totals);

    expect(summary.items).toBe(totals.items);
    expect(summary.qty).toBe(totals.qty);
    expect(summary.subtotal).toBe(totals.subtotal);
    expect(summary.itemDiscount).toBe(totals.itemDiscount);
    expect(summary.invoiceDiscount).toBe(totals.invoiceDiscount);
    expect(summary.totalDiscount).toBe(totals.discount);
    expect(summary.salesTax).toBe(totals.tax);
    expect(summary.taxableAmount).toBe(totals.taxInvoice?.taxableAmount);
    expect(summary.deliveryCharges).toBe(POS_DELIVERY_CHARGES);
    expect(summary.roundOff).toBe(POS_ROUND_OFF);
    expect(summary.grand).toBe(totals.grand);
    expect(cartLineDisplayTotal(cart[0]!)).toBe(lineTotal(cart[0]!));
  });
});
