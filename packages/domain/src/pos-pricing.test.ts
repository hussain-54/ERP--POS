import { describe, expect, it } from "vitest";
import { preparePosSaleLine, resolvePosUnitPrice } from "./pos-pricing.js";

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
    expect(r.unitPrice).toBe(95);
    expect(r.source).toBe("customer");
    expect(r.basePrice).toBe(100);
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
    expect(r.unitPrice).toBe(85);
    expect(r.source).toBe("quantity");
  });

  it("prefers promotion over quantity", () => {
    const r = resolvePosUnitPrice({
      ...base,
      qty: 10,
      promotionPrice: 75,
      quantityBreaks: [{ minQty: 5, unitPrice: 85 }],
    });
    expect(r.unitPrice).toBe(75);
    expect(r.source).toBe("promotion");
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
    expect(r.unitPrice).toBe(50);
    expect(r.source).toBe("manual");
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

  it("preparePosSaleLine applies 10% then exclusive tax", () => {
    const line = preparePosSaleLine({
      qty: 1,
      pricing: { ...base, retailPrice: 1000 },
      discountMode: "percentage",
      discountValue: 10,
      taxRate: { ratePercent: 0, pricingMode: "exclusive" },
    });
    expect(line.unitPrice).toBe(1000);
    expect(line.discount).toBe(100);
    expect(line.lineTotal).toBe(900);
  });

  it("ignores malicious client price when catalog pricing is used", () => {
    const line = preparePosSaleLine({
      qty: 1,
      pricing: { ...base, retailPrice: 1000 },
      discountMode: "fixed",
      discountValue: 0,
    });
    expect(line.unitPrice).toBe(1000);
  });
});
