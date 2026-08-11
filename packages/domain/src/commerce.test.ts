import { describe, expect, it } from "vitest";
import {
  assertRedeemable,
  assertStoreStock,
  buyingPatternSummary,
  calculateEarnPoints,
  customerMatchesSegment,
  pickProductPrice,
  priceBookForCustomerType,
  resolveTier,
} from "./commerce.js";

describe("loyalty", () => {
  it("earns points and resolves tiers", () => {
    expect(calculateEarnPoints(250, 1)).toBe(250);
    expect(calculateEarnPoints(250, 1.5)).toBe(375);
    expect(resolveTier(0)).toBe("silver");
    expect(resolveTier(1000)).toBe("gold");
    expect(resolveTier(5000)).toBe("platinum");
  });

  it("blocks insufficient or expired redemptions", () => {
    expect(() => assertRedeemable(10, 20)).toThrow(/Insufficient/);
    expect(() =>
      assertRedeemable(100, 50, {
        pointsCost: 50,
        endsAt: "2020-01-01T00:00:00.000Z",
        isActive: true,
      }),
    ).toThrow(/expired/i);
    expect(() => assertRedeemable(100, 50, { pointsCost: 50, isActive: true })).not.toThrow();
  });
});

describe("crm + pricing", () => {
  it("matches segment rules and maps B2B price books", () => {
    const customer = {
      id: "c1",
      customerType: "wholesale" as const,
      locationCity: "Lahore",
      outstanding: 5000,
      totalPurchases: 20000,
      loyaltyTier: "gold" as const,
    };
    expect(
      customerMatchesSegment(customer, {
        customerTypes: ["wholesale"],
        cities: ["Lahore"],
        minTotalPurchases: 10000,
      }),
    ).toBe(true);
    expect(customerMatchesSegment(customer, { cities: ["Karachi"] })).toBe(false);
    expect(priceBookForCustomerType("dealer")).toBe("dealer");
    expect(
      pickProductPrice({ retailPrice: 100, wholesalePrice: 80, dealerPrice: 70 }, "wholesale"),
    ).toBe(80);
  });
});

describe("store stock + patterns", () => {
  it("guards online availability from ERP stock", () => {
    expect(() =>
      assertStoreStock(
        [{ productId: "p1", qty: 5 }],
        [{ productId: "p1", qtyOnHand: 10, qtyReserved: 6 }],
      ),
    ).toThrow(/Insufficient/);
    expect(() =>
      assertStoreStock(
        [{ productId: "p1", qty: 3 }],
        [{ productId: "p1", qtyOnHand: 10, qtyReserved: 6 }],
      ),
    ).not.toThrow();
  });

  it("summarizes buying patterns", () => {
    const summary = buyingPatternSummary([
      { postedAt: "2026-08-01T00:00:00Z", grandTotal: 100, productIds: ["a", "b"] },
      { postedAt: "2026-08-10T00:00:00Z", grandTotal: 200, productIds: ["a"] },
    ]);
    expect(summary.orderCount).toBe(2);
    expect(summary.totalSpend).toBe(300);
    expect(summary.topProductIds[0]).toBe("a");
    expect(summary.lastPurchaseAt).toBe("2026-08-10T00:00:00Z");
  });
});
