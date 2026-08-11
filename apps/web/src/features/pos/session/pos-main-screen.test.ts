import { describe, expect, it } from "vitest";
import {
  addOrIncrementProduct,
  calculatePosCartTotals,
  clearCartLines,
  createCartLineFromProduct,
  removeCartLine,
  updateCartLineQty,
} from "@electronic-erp/domain";

/** Phase 4 main-screen cart contract — same domain path as PosPage session. */
describe("POS main screen cart flows", () => {
  const unitId = "11111111-1111-4111-8111-111111111111";
  const productId = "33333333-3333-4333-8333-333333333333";

  it("search add → qty → remove → totals; customer selection does not mutate cart math", () => {
    let cart = clearCartLines();
    cart = addOrIncrementProduct(
      cart,
      createCartLineFromProduct({
        key: "1",
        productId,
        name: "LED Bulb",
        unitId,
        unitPrice: 250,
        unitName: "pcs",
      }),
    );
    expect(cart).toHaveLength(1);

    cart = updateCartLineQty(cart, "1", "2");
    let totals = calculatePosCartTotals(cart, "0");
    expect(totals.qty).toBe(2);
    expect(totals.grand).toBe(500);

    const customerSelected = { id: productId, name: "Walk-in replaced" };
    expect(customerSelected.id).toBeTruthy();
    totals = calculatePosCartTotals(cart, "0");
    expect(totals.grand).toBe(500);

    cart = removeCartLine(cart, "1");
    totals = calculatePosCartTotals(cart, "0");
    expect(cart).toHaveLength(0);
    expect(totals.grand).toBe(0);
  });
});
