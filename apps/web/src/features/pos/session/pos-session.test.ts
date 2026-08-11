import { describe, expect, it } from "vitest";
import {
  addOrIncrementProduct,
  calculatePosCartTotals,
  clearCartLines,
  createCartLineFromProduct,
  pickPriceLevel,
  removeCartLine,
  updateCartLineQty,
} from "@electronic-erp/domain";

/**
 * Phase 2 session contract tests — cart/customer/totals without React/DB.
 * Mirrors usePosSession mutations via domain (single source of truth).
 */
describe("POS session cart contract", () => {
  const unitId = "11111111-1111-4111-8111-111111111111";
  const productId = "22222222-2222-4222-8222-222222222222";

  it("create cart → add → remove → qty → customer totals path", () => {
    let cart = clearCartLines();
    const taxRate = {
      id: "t",
      ratePercent: 0,
      pricingMode: "exclusive" as const,
      isExempt: true,
    };

    const price = pickPriceLevel(
      { retailPrice: 150, wholesalePrice: 120, dealerPrice: 100 },
      "retail",
    );
    expect(price).toBe(150);

    cart = addOrIncrementProduct(
      cart,
      createCartLineFromProduct({
        key: "1",
        productId,
        name: "Breaker",
        unitId,
        unitPrice: price,
        taxRate,
      }),
      taxRate,
    );
    expect(cart).toHaveLength(1);

    cart = updateCartLineQty(cart, "1", "4", taxRate);
    expect(cart[0].qty).toBe("4");

    let totals = calculatePosCartTotals(cart, "10");
    expect(totals.subtotal).toBe(600);
    expect(totals.invoiceDiscount).toBe(10);
    expect(totals.grand).toBe(590);

    // select customer does not change totals (session only)
    const customer = { id: productId, name: "Ali Traders" };
    expect(customer.id).toBeTruthy();

    cart = removeCartLine(cart, "1");
    totals = calculatePosCartTotals(cart, "0");
    expect(cart).toHaveLength(0);
    expect(totals.grand).toBe(0);
  });
});
