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
    expect(totals.itemDiscount).toBe(10);
    expect(totals.invoiceDiscount).toBe(5);
    expect(totals.discountTotal).toBe(15);
    expect(totals.taxTotal).toBe(5);
    expect(totals.grandTotal).toBe(190);
  });

  it("caps line and invoice discounts and prevents negative totals", () => {
    const totals = calculateSaleTotals(
      [
        {
          productId: uuid,
          unitId: uuid,
          qty: 1,
          unitPrice: 50,
          discount: 999,
          tax: 0,
        },
      ],
      100,
    );
    expect(totals.itemDiscount).toBe(50);
    expect(totals.invoiceDiscount).toBe(0);
    expect(totals.grandTotal).toBe(0);
  });

  it("rejects invalid tax and empty cart", () => {
    expect(() => calculateSaleTotals([], 0)).toThrow(/at least one/i);
    expect(() =>
      calculateSaleTotals(
        [{ productId: uuid, unitId: uuid, qty: 1, unitPrice: 10, discount: 0, tax: -1 }],
        0,
      ),
    ).toThrow(/tax/i);
  });

  it("applies line percentage before invoice discount; tax is added after discounts", () => {
    const totals = calculateSaleTotals(
      [
        {
          productId: uuid,
          unitId: uuid,
          qty: 1,
          unitPrice: 1000,
          discount: 0,
          discountPercent: 10,
          tax: 0,
        },
      ],
      0,
    );
    expect(totals.itemDiscount).toBe(100);
    expect(totals.grandTotal).toBe(900);
  });
});
