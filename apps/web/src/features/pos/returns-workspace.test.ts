import { describe, expect, it } from "vitest";
import {
  clampReturnQty,
  EXCHANGE_STEPS,
  originalPaymentLabel,
  parseReturnableSale,
  remainingQtyTotal,
  RETURN_LINE_COLUMNS,
  RETURN_STEPS,
  returnOperationWarnings,
  returnedQtyTotal,
} from "./returns-workspace";

describe("returns workspace", () => {
  it("clamps return qty to remaining returnable", () => {
    expect(clampReturnQty(10, 3, 8)).toBe(7);
    expect(clampReturnQty(2, 2, 1)).toBe(0);
    expect(clampReturnQty(5, 0, -1)).toBe(0);
  });

  it("parses original qty, returned qty, remaining, price, tax, discount, cashier, date, and payment", () => {
    const parsed = parseReturnableSale({
      invoiceNumber: "INV-1",
      dateTime: "2026-08-01T10:00:00.000Z",
      cashierName: "Amina",
      customerName: "Hassan",
      paidAmount: 197,
      remainingAmount: 0,
      payments: [{ method: "Cash", amount: 197, reference: "T-1" }],
      sale: { id: "s1", customerId: "c1", warehouseId: "w1", status: "posted" },
      items: [{ id: "i1", name: "Cable", qty: 4, rate: 50, discount: 5, tax: 2, total: 197 }],
      returnableLines: [
        {
          saleItemId: "i1",
          productId: "p1",
          unitId: "u1",
          name: "Cable",
          soldQty: 4,
          previouslyReturnedQty: 1,
          unitPrice: 50,
        },
      ],
    });
    expect(parsed.hasCustomer).toBe(true);
    expect(parsed.customerName).toBe("Hassan");
    expect(parsed.cashierName).toBe("Amina");
    expect(parsed.saleDate).toBe("2026-08-01T10:00:00.000Z");
    expect(parsed.paidAmount).toBe(197);
    expect(originalPaymentLabel(parsed.originalPayments, parsed.paidAmount)).toBe("Cash 197.00 (T-1)");
    expect(parsed.lines[0]?.soldQty).toBe(4);
    expect(parsed.lines[0]?.previouslyReturnedQty).toBe(1);
    expect(parsed.lines[0]?.maxReturnable).toBe(3);
    expect(parsed.lines[0]?.tax).toBe(2);
    expect(parsed.lines[0]?.discount).toBe(5);
    expect(parsed.lines[0]?.selected).toBe(false);
    expect(returnedQtyTotal(parsed.lines)).toBe(1);
    expect(remainingQtyTotal(parsed.lines)).toBe(3);
  });

  it("warns on empty selection and walk-in customer credit without changing refund math", () => {
    const parsed = parseReturnableSale({
      invoiceNumber: "INV-2",
      sale: { id: "s2", warehouseId: "w1" },
      items: [{ id: "i1", name: "Fan", qty: 1, rate: 10, discount: 0, tax: 0, total: 10 }],
      returnableLines: [{ saleItemId: "i1", name: "Fan", soldQty: 1, previouslyReturnedQty: 0, unitPrice: 10, unitId: "u1" }],
    });
    expect(parsed.hasCustomer).toBe(false);
    expect(
      returnOperationWarnings({
        lines: parsed.lines,
        hasCustomer: parsed.hasCustomer,
        disposition: "credit",
        refundMethod: "customer_credit",
        reasonCode: "defective",
        reasonDetail: "",
      }),
    ).toEqual([
      "Select at least one return item.",
      "Customer credit requires a customer on the original sale. Walk-in invoices cannot be credited.",
    ]);
  });

  it("locks return table columns and workflow labels", () => {
    expect([...RETURN_LINE_COLUMNS]).toEqual([
      "Item",
      "Original Qty",
      "Returned Qty",
      "Remaining Returnable Qty",
      "Original price",
      "Tax",
      "Discount",
      "Return qty",
    ]);
    expect(RETURN_STEPS.map((s) => s.label)).toEqual([
      "Find invoice",
      "Review sale",
      "Select return items",
      "Select quantities",
      "Show return amount",
      "Select refund method",
      "Confirm return",
      "Show completion state",
    ]);
    expect(EXCHANGE_STEPS.map((s) => s.label)).toEqual([
      "Find original invoice",
      "Select item to exchange",
      "Select replacement product",
      "Calculate difference",
      "Show amount payable/refundable",
      "Select payment/refund method",
      "Confirm",
    ]);
  });
});
