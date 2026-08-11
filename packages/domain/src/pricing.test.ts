import { describe, expect, it } from "vitest";
import { assertSalePriceAllowed, expectedProfit, profitMarginPercent, validatePricing } from "./pricing.js";

describe("pricing", () => {
  const pricing = {
    costPrice: 100,
    retailPrice: 150,
    wholesalePrice: 140,
    dealerPrice: 130,
    minimumSalePrice: 120,
    lastPurchasePrice: 100,
    averagePurchasePrice: 100,
  };

  it("computes profit metrics", () => {
    expect(expectedProfit(pricing)).toBe(50);
    expect(profitMarginPercent(pricing)).toBeCloseTo(33.33, 1);
  });

  it("blocks below minimum", () => {
    expect(() => assertSalePriceAllowed(110, 120)).toThrow();
  });

  it("validates retail vs minimum", () => {
    expect(() => validatePricing({ ...pricing, retailPrice: 100 })).toThrow();
  });
});
