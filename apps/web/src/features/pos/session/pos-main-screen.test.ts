import { describe, expect, it } from "vitest";
import {
  addOrIncrementProductOrThrow,
  applyCartLineDiscountInput,
  calculatePosCartTotals,
  clearCartLines,
  createCartLineFromProduct,
  pickPriceLevel,
  removeCartLine,
  repriceCartForPriceLevel,
  updateCartLineQty,
} from "@electronic-erp/domain";

describe("POS main screen cart flows", () => {
  const unitId = "11111111-1111-4111-8111-111111111111";
  const productId = "33333333-3333-4333-8333-333333333333";
  const taxRate = {
    id: "55555555-5555-4555-8555-555555555555",
    ratePercent: 17,
    pricingMode: "exclusive" as const,
    isExempt: false,
    kind: "sales_tax" as const,
  };

  it("search add → qty → remove → totals", () => {
    let cart = clearCartLines();
    cart = addOrIncrementProductOrThrow(
      cart,
      createCartLineFromProduct({
        key: "1",
        productId,
        name: "LED Bulb",
        unitId,
        unitPrice: 250,
        unitName: "pcs",
        stock: "20",
      }),
    );
    const qty = updateCartLineQty(cart, "1", "2");
    expect(qty.ok).toBe(true);
    cart = qty.cart;
    expect(calculatePosCartTotals(cart, "0").grand).toBe(500);
    cart = removeCartLine(cart, "1");
    expect(calculatePosCartTotals(cart, "0").grand).toBe(0);
  });

  it("price level, line discount, tax, invoice discount, and cancel", () => {
    let cart = addOrIncrementProductOrThrow(
      clearCartLines(),
      createCartLineFromProduct({
        key: "1",
        productId,
        name: "LED Bulb",
        unitId,
        unitPrice: 250,
        retailPrice: 250,
        wholesalePrice: 200,
        dealerPrice: 180,
        priceLevel: "retail",
        taxRate,
        stock: "20",
      }),
    );
    expect(pickPriceLevel({ retailPrice: 250, wholesalePrice: 200, dealerPrice: 180 }, "wholesale")).toBe(
      200,
    );
    cart = repriceCartForPriceLevel(cart, "wholesale", taxRate);
    expect(cart[0]?.unitPrice).toBe(200);
    const discounted = applyCartLineDiscountInput(cart, "1", { mode: "fixed", value: 20 }, taxRate);
    expect(discounted.ok).toBe(true);
    cart = discounted.cart;
    const totals = calculatePosCartTotals(cart, "10", taxRate);
    expect(totals.subtotal).toBe(200);
    expect(totals.itemDiscount).toBe(20);
    expect(totals.invoiceDiscount).toBe(10);
    expect(totals.tax).toBeGreaterThan(0);
    expect(totals.taxInvoice?.taxableAmount).toBeGreaterThan(0);
    expect(totals.grand).toBeGreaterThan(0);
    cart = clearCartLines();
    expect(calculatePosCartTotals(cart, "0", taxRate).grand).toBe(0);
  });
});
