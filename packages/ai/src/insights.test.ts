import { describe, expect, it } from "vitest";
import {
  classifyAllVelocities,
  findCustomerPatterns,
  forecastDemand,
  optimizeProfit,
  predictFutureSales,
  recommendPurchases,
} from "./insights.js";

describe("AI business intelligence", () => {
  const history = Array.from({ length: 28 }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    amount: 1000 + i * 10,
    qty: 10 + (i % 5),
  }));

  it("predicts future sales with explanations", () => {
    const pred = predictFutureSales(history, 7);
    expect(pred.data.daily).toHaveLength(7);
    expect(pred.data.predictedTotal).toBeGreaterThan(0);
    expect(pred.explanations.length).toBeGreaterThan(0);
    expect(pred.sources[0]?.table).toBe("sales");
  });

  it("classifies fast/slow/stagnant with configurable days", () => {
    const v = classifyAllVelocities(
      [
        {
          productId: "a",
          productName: "A",
          qtySold: 50,
          lastSoldAt: "2026-08-10T00:00:00Z",
          qtyOnHand: 5,
        },
        {
          productId: "b",
          productName: "B",
          qtySold: 2,
          lastSoldAt: "2026-06-01T00:00:00Z",
          qtyOnHand: 40,
        },
        {
          productId: "c",
          productName: "C",
          qtySold: 0,
          lastSoldAt: null,
          qtyOnHand: 10,
        },
      ],
      { fastDays: 30, slowDays: 90, stagnantDays: 180 },
      "2026-08-11T00:00:00Z",
    );
    expect(v.data.fast.some((p) => p.productId === "a")).toBe(true);
    expect(v.data.stagnant.some((p) => p.productId === "c")).toBe(true);
  });

  it("forecasts week/month/seasonal demand", () => {
    const f = forecastDemand(history, [
      { productId: "a", productName: "A", points: history },
    ]);
    expect(f.data.nextWeek).toBeGreaterThan(0);
    expect(f.data.nextMonth).toBeGreaterThan(f.data.nextWeek);
    expect(f.data.seasonalIndex).toHaveLength(12);
  });

  it("recommends purchases from stock + forecast", () => {
    const map = new Map([["a", { nextMonthQty: 40 }]]);
    const r = recommendPurchases(
      [
        {
          productId: "a",
          productName: "A",
          qtySold: 30,
          qtyOnHand: 2,
          minStock: 10,
          maxStock: 100,
          leadTimeDays: 14,
          lastPurchaseRate: 200,
          preferredSupplierName: "Supplier X",
          preferredSupplierId: "s1",
        },
      ],
      map,
    );
    expect(r.data[0]?.quantity).toBeGreaterThan(0);
    expect(r.data[0]?.supplierName).toBe("Supplier X");
    expect(r.data[0]?.reasons.length).toBeGreaterThan(0);
  });

  it("finds purchase combinations", () => {
    const p = findCustomerPatterns(
      [
        { saleId: "1", productIds: ["a", "b"] },
        { saleId: "2", productIds: ["a", "b", "c"] },
        { saleId: "3", productIds: ["a", "b"] },
      ],
      2,
    );
    expect(p.data.combinations[0]?.support).toBeGreaterThanOrEqual(2);
  });

  it("flags margin cohorts", () => {
    const o = optimizeProfit([
      { productId: "h", productName: "High", revenue: 100, cost: 50, qtySold: 5 },
      { productId: "l", productName: "Low", revenue: 100, cost: 92, qtySold: 5 },
      { productId: "x", productName: "Loss", revenue: 50, cost: 80, qtySold: 2 },
    ]);
    expect(o.data.highMargin[0]?.productId).toBe("h");
    expect(o.data.lossMaking[0]?.productId).toBe("x");
    expect(o.data.pricingOpportunities.length).toBeGreaterThan(0);
  });
});
