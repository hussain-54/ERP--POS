import { describe, expect, it } from "vitest";
import { preparePosExchange } from "./pos-exchange.js";

const saleItem = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const unit = "55555555-5555-4555-8555-555555555555";
const product = "44444444-4444-4444-8444-444444444444";
const replacement = "66666666-6666-4666-8666-666666666666";

const returnable = [
  {
    saleItemId: saleItem,
    productId: product,
    unitId: unit,
    soldQty: 2,
    previouslyReturnedQty: 0,
    unitPrice: 100,
  },
];

const returnLine = {
  originalSaleItemId: saleItem,
  unitId: unit,
  qty: 1,
  unitPrice: 100,
  condition: "good" as const,
  originalPackaging: true,
  accessoriesComplete: true,
};

describe("pos exchange plan", () => {
  it("reuses return qty caps and computes collect difference from a real replacement line", () => {
    const prepared = preparePosExchange({
      reasonCode: "wrong_product",
      hasCustomer: true,
      returnDisposition: "refund",
      refundMethod: "cash",
      returnable,
      returnLines: [returnLine],
      replacements: [{ productId: replacement, unitId: unit, qty: 1, unitPrice: 150 }],
    });
    expect(prepared.preparedReturn.refundAmount).toBe(100);
    expect(prepared.returnValue).toBe(100);
    expect(prepared.replacementTotal).toBe(150);
    expect(prepared.difference).toBe(50);
    expect(prepared.settlement).toBe("collect");
    expect(prepared.collectAmount).toBe(150);
    expect(prepared.refundAmount).toBe(100);
  });

  it("does not allow returning more than sold, and does not allow overselling replacement stock", () => {
    expect(() =>
      preparePosExchange({
        reasonCode: "wrong_product",
        hasCustomer: true,
        returnDisposition: "refund",
        refundMethod: "cash",
        returnable,
        returnLines: [{ ...returnLine, qty: 3 }],
        replacements: [{ productId: replacement, unitId: unit, qty: 1, unitPrice: 100 }],
      }),
    ).toThrow(/exceeds returnable/i);

    expect(() =>
      preparePosExchange({
        reasonCode: "wrong_product",
        hasCustomer: true,
        returnDisposition: "refund",
        refundMethod: "cash",
        returnable,
        returnLines: [returnLine],
        replacements: [
          { productId: replacement, unitId: unit, qty: 2, unitPrice: 100, stockAvailable: 1 },
        ],
      }),
    ).toThrow(/available stock/i);
  });

  it("requires replacement items and treats an even swap as even", () => {
    expect(() =>
      preparePosExchange({
        reasonCode: "wrong_product",
        hasCustomer: true,
        returnDisposition: "refund",
        refundMethod: "cash",
        returnable,
        returnLines: [returnLine],
        replacements: [],
      }),
    ).toThrow(/replacement item/i);

    const even = preparePosExchange({
      reasonCode: "wrong_product",
      hasCustomer: false,
      returnDisposition: "refund",
      refundMethod: "cash",
      returnable,
      returnLines: [returnLine],
      replacements: [{ productId: replacement, unitId: unit, qty: 1, unitPrice: 100 }],
    });
    expect(even.settlement).toBe("even");
    expect(even.difference).toBe(0);
  });
});
