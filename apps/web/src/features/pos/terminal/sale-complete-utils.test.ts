import { describe, expect, it } from "vitest";
import { validateSaleBeforeComplete, mapCartLineToSaleItem, isManualCartLine } from "./sale-complete-utils";
import type { CartLine, PosCustomerView } from "../types";
import { emptyCustomer } from "../types";

const baseLine: CartLine = {
  id: "1",
  productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Bulb",
  sku: "SKU-1",
  unitId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  unitLabel: "Pcs",
  qty: 2,
  rate: 500,
  listPrice: 500,
  discount: 0,
  discountPercent: 0,
  tax: 85,
  taxRate: 0.17,
  stockAvailable: 10,
};

describe("sale-complete-utils", () => {
  it("blocks insufficient cash", () => {
    const result = validateSaleBeforeComplete({
      lines: [baseLine],
      customer: emptyCustomer(),
      paymentKind: "cash",
      cashReceived: 100,
      grandTotal: 1170,
      defaultUnitId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.title).toMatch(/Insufficient cash/i);
  });

  it("maps manual lines for postSale", () => {
    const manual: CartLine = {
      ...baseLine,
      productId: "custom-abc",
      isManual: true,
      name: "Misc Item",
      sku: "MANUAL",
    };
    expect(isManualCartLine(manual)).toBe(true);
    const mapped = mapCartLineToSaleItem(manual, baseLine.unitId);
    expect(mapped.isManual).toBe(true);
    expect(mapped.manualName).toBe("Misc Item");
    expect(mapped.productId).toBeUndefined();
    expect(mapped.unitId).toBe(baseLine.unitId);
  });

  it("blocks credit over limit", () => {
    const customer: PosCustomerView = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      label: "Ali",
      priceTier: "Retail",
      creditLimit: 1000,
      outstanding: 900,
      loyaltyPoints: 0,
    };
    const result = validateSaleBeforeComplete({
      lines: [baseLine],
      customer,
      paymentKind: "credit",
      grandTotal: 500,
      defaultUnitId: null,
    });
    expect(result.ok).toBe(false);
  });
});
