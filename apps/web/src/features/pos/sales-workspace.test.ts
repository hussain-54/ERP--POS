import { describe, expect, it } from "vitest";
import {
  customerLabel,
  emptySaleFilters,
  kpiDisplay,
  parseSaleRow,
  parseSaleSummary,
  SALE_TABS,
  saleStatusLabel,
  saleStatusTone,
} from "./sales-workspace";

describe("sales workspace helpers", () => {
  it("locks supported sales-management tabs to backend tab ids", () => {
    expect(SALE_TABS.map((t) => t.id)).toEqual([
      "all",
      "completed",
      "credit",
      "partial",
      "cancelled",
      "pending",
    ]);
  });

  it("parses management rows and uses walk-in when no customer name is stored", () => {
    const row = parseSaleRow({
      id: "s1",
      invoiceNumber: "INV-1001",
      createdAt: "2026-08-16T10:00:00.000Z",
      grandTotal: 250,
      paidTotal: 100,
      remainingTotal: 150,
      status: "posted",
      paymentStatus: "partial",
      itemCount: 2,
      paymentMethods: "Cash",
    });
    expect(row.invoiceNumber).toBe("INV-1001");
    expect(customerLabel(row)).toBe("Walk-in");
    expect(saleStatusLabel(row.status, row.paymentStatus)).toBe("Partial");
    expect(saleStatusTone(row.status, row.paymentStatus)).toBe("warning");
    expect(saleStatusLabel("posted", "paid")).toBe("Completed");
    expect(saleStatusLabel("void", "unpaid")).toBe("Cancelled");
    expect(saleStatusLabel("posted", "unpaid")).toBe("Pending");
  });

  it("reads summary KPIs from the sales-management payload", () => {
    const summary = parseSaleSummary({
      totalSales: 1000,
      totalInvoices: 4,
      netSales: 900,
      totalDiscount: 50,
      totalTax: 50,
      pendingAmount: 200,
    });
    expect(summary.totalInvoices).toBe(4);
    expect(summary.pendingAmount).toBe(200);
    expect(kpiDisplay(summary, "totalInvoices")).toBe("4");
    expect(kpiDisplay(null, "totalInvoices")).toBe("0");
    expect(emptySaleFilters("b1").branchId).toBe("b1");
    expect(emptySaleFilters().search).toBe("");
  });
});
