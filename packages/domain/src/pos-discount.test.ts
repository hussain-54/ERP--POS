import { describe, expect, it } from "vitest";
import {
  applyBulkDiscount,
  applyCustomerDiscount,
  applyDiscount,
  applyPromotionDiscount,
  capLineDiscount,
  computeStackedLineDiscount,
  resolveBulkDiscountPercent,
} from "./pos-discount.js";

describe("pos-discount", () => {
  it("applies item percentage and fixed", () => {
    expect(applyDiscount({ base: 200, mode: "percentage", value: 10 })).toMatchObject({
      amount: 20,
      percent: 10,
      kind: "percentage",
      capped: false,
    });
    expect(applyDiscount({ base: 200, mode: "fixed", value: 15 })).toMatchObject({
      amount: 15,
      percent: 7.5,
      kind: "fixed",
      capped: false,
    });
  });

  it("caps discount to line amount and rejects invalid", () => {
    expect(applyDiscount({ base: 50, mode: "fixed", value: 80 })).toMatchObject({
      amount: 50,
      percent: 100,
      capped: true,
    });
    expect(() => applyDiscount({ base: 50, mode: "percentage", value: 101 })).toThrow(/100/);
    expect(() => applyDiscount({ base: -1, mode: "fixed", value: 1 })).toThrow(/negative/i);
    expect(() => applyDiscount({ base: 50, mode: "fixed", value: -1 })).toThrow(/negative/i);
  });

  it("applies customer, promotion, and bulk discounts", () => {
    expect(applyCustomerDiscount(100, 5).kind).toBe("customer");
    expect(applyCustomerDiscount(100, 5).amount).toBe(5);
    expect(applyPromotionDiscount(100, { mode: "fixed", value: 12 }).kind).toBe("promotion");
    expect(resolveBulkDiscountPercent(12, [
      { minQty: 5, percent: 3 },
      { minQty: 10, percent: 7 },
    ])).toBe(7);
    expect(applyBulkDiscount(200, 12, [{ minQty: 10, percent: 7 }]).amount).toBe(14);
  });

  it("capLineDiscount never exceeds gross", () => {
    expect(capLineDiscount(2, 50, 200)).toBe(100);
    expect(capLineDiscount(2, 50, Number.NaN)).toBe(0);
  });

  it("stacks item → customer → promo → bulk without exceeding line", () => {
    const stacked = computeStackedLineDiscount({
      qty: 2,
      unitPrice: 100,
      item: { mode: "percentage", value: 10 },
      customerPercent: 5,
      promotion: { mode: "fixed", value: 5 },
      bulkBreaks: [{ minQty: 2, percent: 2 }],
    });
    expect(stacked.discountTotal).toBeLessThanOrEqual(200);
    expect(stacked.parts.length).toBeGreaterThanOrEqual(3);
    expect(Number.isFinite(stacked.discountTotal)).toBe(true);
  });
});
