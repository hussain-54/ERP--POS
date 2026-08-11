import { describe, expect, it } from "vitest";
import {
  addOrIncrementProductOrThrow,
  calculatePosCartTotals,
  clearCartLines,
  createCartLineFromProduct,
  removeCartLine,
  updateCartLineQty,
} from "@electronic-erp/domain";

describe("POS main screen cart flows", () => {
  const unitId = "11111111-1111-4111-8111-111111111111";
  const productId = "33333333-3333-4333-8333-333333333333";

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
});
