import { describe, expect, it } from "vitest";
import { calculateSaleTotals } from "./sale-totals.js";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("calculateSaleTotals", () => {
  it("computes grand total", () => {
    const totals = calculateSaleTotals(
      [
        {
          productId: uuid,
          unitId: uuid,
          qty: 2,
          unitPrice: 100,
          discount: 10,
          tax: 5,
        },
      ],
      5,
    );
    expect(totals.subtotal).toBe(200);
    expect(totals.discountTotal).toBe(15);
    expect(totals.taxTotal).toBe(5);
    expect(totals.grandTotal).toBe(190);
  });
});
