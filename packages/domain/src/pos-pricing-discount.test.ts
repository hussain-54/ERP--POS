import { describe, expect, it } from "vitest";
import { applyDiscount } from "./pos-discount.js";
import { preparePosSaleLine, resolvePosUnitPrice } from "./pos-pricing.js";
import { calculateSaleTotals } from "./sale-totals.js";
import { roundMoney } from "./money.js";
import { assertDiscountAllowed } from "./discount-policy.js";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("Phase 4A pricing / discount matrix (domain)", () => {
  const catalog = {
    retailPrice: 1000,
    wholesalePrice: 900,
    dealerPrice: 800,
    priceLevel: "retail" as const,
    qty: 1,
  };

  it("1 retail price", () => {
    expect(resolvePosUnitPrice(catalog).unitPrice).toBe(1000);
    expect(resolvePosUnitPrice(catalog).source).toBe("retail");
  });

  it("2 wholesale price", () => {
    expect(resolvePosUnitPrice({ ...catalog, priceLevel: "wholesale" }).unitPrice).toBe(900);
  });

  it("3 dealer price", () => {
    expect(resolvePosUnitPrice({ ...catalog, priceLevel: "dealer" }).unitPrice).toBe(800);
  });

  it("4 customer price when a record exists", () => {
    const r = resolvePosUnitPrice({ ...catalog, customerPrice: 850 });
    expect(r.source).toBe("customer");
    expect(r.unitPrice).toBe(850);
  });

  it("5 quantity price when breaks are supplied (not persisted)", () => {
    const r = resolvePosUnitPrice({
      ...catalog,
      qty: 10,
      quantityBreaks: [{ minQty: 10, unitPrice: 820 }],
    });
    expect(r.source).toBe("quantity");
    expect(r.unitPrice).toBe(820);
  });

  it("6 promotion price when a promotion unit price is supplied (engine not persisted)", () => {
    const r = resolvePosUnitPrice({ ...catalog, promotionPrice: 750 });
    expect(r.source).toBe("promotion");
    expect(r.unitPrice).toBe(750);
  });

  it("7 fixed line discount", () => {
    const line = preparePosSaleLine({
      qty: 1,
      pricing: catalog,
      discountMode: "fixed",
      discountValue: 50,
    });
    expect(line.discount).toBe(50);
    expect(line.lineTotal).toBe(950);
  });

  it("8 percentage line discount 1000 → 900", () => {
    const line = preparePosSaleLine({
      qty: 1,
      pricing: catalog,
      discountMode: "percentage",
      discountValue: 10,
    });
    expect(line.discount).toBe(100);
    expect(line.lineTotal).toBe(900);
  });

  it("9 invoice percentage discount", () => {
    const applied = applyDiscount({ base: 900, mode: "percentage", value: 10 });
    const totals = calculateSaleTotals(
      [{ productId: uuid, unitId: uuid, qty: 1, unitPrice: 1000, discount: 100, tax: 0 }],
      applied.amount,
    );
    expect(totals.invoiceDiscount).toBe(90);
    expect(totals.grandTotal).toBe(810);
  });

  it("10 invoice fixed discount", () => {
    const totals = calculateSaleTotals(
      [{ productId: uuid, unitId: uuid, qty: 1, unitPrice: 1000, discount: 0, tax: 0 }],
      50,
    );
    expect(totals.invoiceDiscount).toBe(50);
    expect(totals.grandTotal).toBe(950);
  });

  it("11 discount threshold ladder", () => {
    expect(() => assertDiscountAllowed("cashier", 5)).not.toThrow();
    expect(() => assertDiscountAllowed("cashier", 10)).toThrow(/limit/i);
  });

  it("15 tax after discount (exclusive 10%)", () => {
    const line = preparePosSaleLine({
      qty: 1,
      pricing: catalog,
      discountMode: "percentage",
      discountValue: 10,
      taxRate: { ratePercent: 10, pricingMode: "exclusive" },
    });
    expect(line.discount).toBe(100);
    expect(line.tax).toBe(90);
    expect(line.lineTotal).toBe(990);
  });

  it("16 decimal rounding uses roundMoney", () => {
    expect(roundMoney(10.555)).toBe(10.56);
    const line = preparePosSaleLine({
      qty: 3,
      pricing: { ...catalog, retailPrice: 10.555 },
      discountMode: "fixed",
      discountValue: 0,
    });
    expect(line.unitPrice).toBe(10.56);
    expect(line.lineTotal).toBe(roundMoney(3 * 10.56));
  });
});
