import { describe, expect, it } from "vitest";
import {
  addOrIncrementProductOrThrow,
  calculatePosCartTotals,
  clearCartLines,
  createCartLineFromProduct,
  pickPriceLevel,
  removeCartLine,
  updateCartLineQty,
} from "@electronic-erp/domain";

describe("POS session cart contract", () => {
  const unitId = "11111111-1111-4111-8111-111111111111";
  const productId = "22222222-2222-4222-8222-222222222222";

  it("create cart → add → remove → qty → customer totals path", () => {
    let cart = clearCartLines();
    const price = pickPriceLevel(
      { retailPrice: 150, wholesalePrice: 120, dealerPrice: 100 },
      "retail",
    );
    cart = addOrIncrementProductOrThrow(
      cart,
      createCartLineFromProduct({
        key: "1",
        productId,
        name: "Breaker",
        unitId,
        unitPrice: price,
        stock: "40",
      }),
    );
    const qty = updateCartLineQty(cart, "1", "4");
    expect(qty.ok).toBe(true);
    cart = qty.cart;
    let totals = calculatePosCartTotals(cart, "10");
    expect(totals.subtotal).toBe(600);
    expect(totals.grand).toBe(590);
    cart = removeCartLine(cart, "1");
    totals = calculatePosCartTotals(cart, "0");
    expect(totals.grand).toBe(0);
  });
});
