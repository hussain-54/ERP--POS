import { describe, expect, it } from "vitest";
import { resolvePosUnitPrice } from "./pos-pricing.js";

describe("resolvePosUnitPrice", () => {
  const base = {
    retailPrice: 100,
    wholesalePrice: 90,
    dealerPrice: 80,
    priceLevel: "retail" as const,
    qty: 1,
  };

  it("uses retail / wholesale / dealer tiers", () => {
    expect(resolvePosUnitPrice(base).source).toBe("retail");
    expect(resolvePosUnitPrice(base).unitPrice).toBe(100);
    expect(resolvePosUnitPrice({ ...base, priceLevel: "wholesale" }).unitPrice).toBe(90);
    expect(resolvePosUnitPrice({ ...base, priceLevel: "dealer" }).unitPrice).toBe(80);
  });

  it("prefers customer price over tier", () => {
    const r = resolvePosUnitPrice({ ...base, customerPrice: 95 });
    expect(r).toEqual({ unitPrice: 95, source: "customer" });
  });

  it("prefers quantity break over customer", () => {
    const r = resolvePosUnitPrice({
      ...base,
      qty: 10,
      customerPrice: 95,
      quantityBreaks: [
        { minQty: 5, unitPrice: 85 },
        { minQty: 20, unitPrice: 70 },
      ],
    });
    expect(r).toEqual({ unitPrice: 85, source: "quantity" });
  });

  it("prefers promotion over quantity", () => {
    const r = resolvePosUnitPrice({
      ...base,
      qty: 10,
      promotionPrice: 75,
      quantityBreaks: [{ minQty: 5, unitPrice: 85 }],
    });
    expect(r).toEqual({ unitPrice: 75, source: "promotion" });
  });

  it("manual override requires authorization", () => {
    expect(() =>
      resolvePosUnitPrice({ ...base, manualOverride: 50, allowManualOverride: false }),
    ).toThrow(/not authorized/i);
    const r = resolvePosUnitPrice({
      ...base,
      manualOverride: 50,
      allowManualOverride: true,
    });
    expect(r).toEqual({ unitPrice: 50, source: "manual" });
  });

  it("rejects negative / below minimum manual price", () => {
    expect(() =>
      resolvePosUnitPrice({
        ...base,
        manualOverride: -1,
        allowManualOverride: true,
      }),
    ).toThrow(/negative/i);
    expect(() =>
      resolvePosUnitPrice({
        ...base,
        manualOverride: 10,
        allowManualOverride: true,
        minimumSalePrice: 20,
      }),
    ).toThrow(/minimum/i);
  });

  it("never returns NaN for bad inputs", () => {
    const r = resolvePosUnitPrice({
      retailPrice: Number.NaN,
      wholesalePrice: Number.NaN,
      dealerPrice: Number.NaN,
      priceLevel: "retail",
      qty: Number.NaN,
    });
    expect(Number.isFinite(r.unitPrice)).toBe(true);
    expect(r.unitPrice).toBe(0);
  });
});
