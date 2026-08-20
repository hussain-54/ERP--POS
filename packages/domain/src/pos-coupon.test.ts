import { describe, expect, it } from "vitest";
import { evaluatePosCoupon, normalizeCouponCode, type PosCouponRecord } from "./pos-coupon";

const baseCoupon = (): PosCouponRecord => ({
  id: "11111111-1111-4111-8111-111111111111",
  code: "SAVE10",
  discountMode: "percentage",
  discountValue: 10,
  minPurchase: 0,
  maxDiscount: null,
  usageLimit: 100,
  usageCount: 0,
  perCustomerLimit: null,
  customerRedemptionCount: 0,
  validFrom: null,
  validTo: null,
  isActive: true,
});

describe("pos coupon evaluation", () => {
  it("normalizes codes and applies percentage through applyDiscount", () => {
    expect(normalizeCouponCode(" save10 ")).toBe("SAVE10");
    const result = evaluatePosCoupon({ coupon: baseCoupon(), purchaseBase: 1000 });
    expect(result.amount).toBe(100);
    expect(result.code).toBe("SAVE10");
  });

  it("rejects expired, inactive, min purchase, and usage limits", () => {
    expect(() =>
      evaluatePosCoupon({
        coupon: { ...baseCoupon(), isActive: false },
        purchaseBase: 100,
      }),
    ).toThrow(/inactive/i);

    expect(() =>
      evaluatePosCoupon({
        coupon: { ...baseCoupon(), minPurchase: 500 },
        purchaseBase: 100,
      }),
    ).toThrow(/Minimum purchase/i);

    expect(() =>
      evaluatePosCoupon({
        coupon: { ...baseCoupon(), usageLimit: 2, usageCount: 2 },
        purchaseBase: 100,
      }),
    ).toThrow(/usage limit/i);

    expect(() =>
      evaluatePosCoupon({
        coupon: {
          ...baseCoupon(),
          validTo: "2020-01-01T00:00:00.000Z",
        },
        purchaseBase: 100,
        now: new Date("2024-01-01T00:00:00.000Z"),
      }),
    ).toThrow(/expired/i);
  });

  it("caps fixed coupons by maxDiscount and base", () => {
    const result = evaluatePosCoupon({
      coupon: {
        ...baseCoupon(),
        discountMode: "fixed",
        discountValue: 50,
        maxDiscount: 25,
      },
      purchaseBase: 100,
    });
    expect(result.amount).toBe(25);
    expect(result.capped).toBe(true);
  });
});
