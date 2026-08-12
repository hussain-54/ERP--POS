import { describe, expect, it } from "vitest";
import {
  buildSaleReturnAuditRow,
  inferReturnScope,
  maxReturnableQty,
  prepareSaleReturn,
  restockDecision,
  summarizeReturnHistory,
} from "./pos-return.js";

const saleItem = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const saleItemB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const unit = "55555555-5555-4555-8555-555555555555";
const product = "44444444-4444-4444-8444-444444444444";

describe("pos return / exchange", () => {
  it("caps return qty at sold minus previously returned", () => {
    expect(maxReturnableQty(10, 3)).toBe(7);
    expect(maxReturnableQty(2, 2)).toBe(0);
    expect(() =>
      prepareSaleReturn({
        disposition: "refund",
        reasonCode: "damaged",
        hasCustomer: true,
        returnable: [
          {
            saleItemId: saleItem,
            productId: product,
            unitId: unit,
            soldQty: 5,
            previouslyReturnedQty: 2,
            unitPrice: 100,
          },
        ],
        lines: [
          {
            originalSaleItemId: saleItem,
            unitId: unit,
            qty: 4,
            unitPrice: 100,
            condition: "good",
            originalPackaging: true,
            accessoriesComplete: true,
          },
        ],
      }),
    ).toThrow(/exceeds returnable/i);
  });

  it("prepares partial refund with cash and restock policy", () => {
    const prepared = prepareSaleReturn({
      disposition: "refund",
      reasonCode: "not_satisfied",
      refundMethod: "cash",
      hasCustomer: true,
      returnable: [
        {
          saleItemId: saleItem,
          productId: product,
          unitId: unit,
          soldQty: 5,
          previouslyReturnedQty: 0,
          unitPrice: 100,
        },
        {
          saleItemId: saleItemB,
          productId: product,
          unitId: unit,
          soldQty: 2,
          previouslyReturnedQty: 0,
          unitPrice: 50,
        },
      ],
      lines: [
        {
          originalSaleItemId: saleItem,
          unitId: unit,
          qty: 2,
          unitPrice: 100,
          condition: "good",
          originalPackaging: true,
          accessoriesComplete: true,
        },
      ],
    });
    expect(prepared.scope).toBe("partial");
    expect(prepared.refundAmount).toBe(200);
    expect(prepared.refundMethod).toBe("cash");
    expect(prepared.lines[0]?.restockTarget).toBe("on_hand");
  });

  it("routes damaged/defective to damaged stock and blocks incomplete restock", () => {
    expect(
      restockDecision({
        condition: "damaged",
        originalPackaging: false,
        accessoriesComplete: true,
      }),
    ).toEqual({ restock: true, target: "damaged" });
    expect(
      restockDecision({
        condition: "good",
        originalPackaging: true,
        accessoriesComplete: false,
      }),
    ).toEqual({ restock: false, target: "none" });
    expect(
      restockDecision({
        condition: "good",
        originalPackaging: true,
        accessoriesComplete: true,
      }),
    ).toEqual({ restock: true, target: "on_hand" });
  });

  it("requires exchange product and customer for credit", () => {
    expect(() =>
      prepareSaleReturn({
        disposition: "exchange",
        reasonCode: "wrong_product",
        hasCustomer: true,
        returnable: [
          {
            saleItemId: saleItem,
            productId: product,
            unitId: unit,
            soldQty: 1,
            previouslyReturnedQty: 0,
            unitPrice: 10,
          },
        ],
        lines: [
          {
            originalSaleItemId: saleItem,
            unitId: unit,
            qty: 1,
            unitPrice: 10,
            condition: "good",
            originalPackaging: true,
            accessoriesComplete: true,
          },
        ],
      }),
    ).toThrow(/exchange requires/i);

    expect(() =>
      prepareSaleReturn({
        disposition: "credit",
        reasonCode: "other",
        reasonDetail: "store credit please",
        hasCustomer: false,
        returnable: [
          {
            saleItemId: saleItem,
            productId: product,
            unitId: unit,
            soldQty: 1,
            previouslyReturnedQty: 0,
            unitPrice: 10,
          },
        ],
        lines: [
          {
            originalSaleItemId: saleItem,
            unitId: unit,
            qty: 1,
            unitPrice: 10,
            condition: "good",
            originalPackaging: true,
            accessoriesComplete: true,
          },
        ],
      }),
    ).toThrow(/requires a customer/i);
  });

  it("infers full vs partial scope", () => {
    const returnable = [
      {
        saleItemId: saleItem,
        productId: product,
        unitId: unit,
        soldQty: 2,
        previouslyReturnedQty: 0,
        unitPrice: 10,
      },
    ];
    expect(
      inferReturnScope([{ originalSaleItemId: saleItem, qty: 2 }], returnable),
    ).toBe("full");
    expect(
      inferReturnScope([{ originalSaleItemId: saleItem, qty: 1 }], returnable),
    ).toBe("partial");
  });

  it("prevents duplicate line over-claim in one request", () => {
    expect(() =>
      prepareSaleReturn({
        disposition: "refund",
        reasonCode: "damaged",
        hasCustomer: true,
        returnable: [
          {
            saleItemId: saleItem,
            productId: product,
            unitId: unit,
            soldQty: 3,
            previouslyReturnedQty: 0,
            unitPrice: 10,
          },
        ],
        lines: [
          {
            originalSaleItemId: saleItem,
            unitId: unit,
            qty: 2,
            unitPrice: 10,
            condition: "good",
            originalPackaging: true,
            accessoriesComplete: true,
          },
          {
            originalSaleItemId: saleItem,
            unitId: unit,
            qty: 2,
            unitPrice: 10,
            condition: "good",
            originalPackaging: true,
            accessoriesComplete: true,
          },
        ],
      }),
    ).toThrow(/exceed/i);
  });

  it("builds audit row and history summary", () => {
    const row = buildSaleReturnAuditRow({
      organizationId: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
      returnId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      originalSaleId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      disposition: "refund",
      scope: "partial",
      refundAmount: 50,
      reason: "Damaged",
    });
    expect(row.action).toBe("sale.return");
    const summary = summarizeReturnHistory([
      { refundAmount: 50, disposition: "refund", scope: "partial", reasonCode: "damaged" },
      { refundAmount: 20, disposition: "exchange", scope: "full", reasonCode: "wrong_product" },
    ]);
    expect(summary.count).toBe(2);
    expect(summary.totalRefundAmount).toBe(70);
    expect(summary.byDisposition.refund).toBe(1);
  });
});
