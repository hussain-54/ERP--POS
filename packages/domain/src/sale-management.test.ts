import { describe, expect, it } from "vitest";
import {
  matchesSaleManagementTab,
  paginateItems,
  summarizeSaleManagement,
} from "./sale-management.js";

const postedPaid = {
  status: "posted" as const,
  paymentStatus: "paid" as const,
  grandTotal: 1000,
  subtotal: 900,
  discountTotal: 50,
  taxTotal: 150,
  paidTotal: 1000,
  remainingTotal: 0,
  customerId: "cust-1",
};

describe("sale-management", () => {
  it("tab filters: completed, credit, partial, cancelled, pending", () => {
    expect(matchesSaleManagementTab(postedPaid, "completed")).toBe(true);
    expect(matchesSaleManagementTab(postedPaid, "credit")).toBe(false);
    expect(
      matchesSaleManagementTab(
        { ...postedPaid, paymentStatus: "partial", paidTotal: 400, remainingTotal: 600 },
        "partial",
      ),
    ).toBe(true);
    expect(
      matchesSaleManagementTab(
        { ...postedPaid, status: "void", paymentStatus: "unpaid", paidTotal: 0, remainingTotal: 0 },
        "cancelled",
      ),
    ).toBe(true);
    expect(
      matchesSaleManagementTab(
        { ...postedPaid, paymentStatus: "unpaid", paidTotal: 0, remainingTotal: 1000 },
        "pending",
      ),
    ).toBe(true);
    expect(
      matchesSaleManagementTab(
        { ...postedPaid, paymentStatus: "unpaid", paidTotal: 0, remainingTotal: 500, customerId: "c" },
        "credit",
      ),
    ).toBe(true);
  });

  it("summary uses posted sales only", () => {
    const summary = summarizeSaleManagement([
      postedPaid,
      {
        ...postedPaid,
        grandTotal: 500,
        subtotal: 450,
        discountTotal: 25,
        taxTotal: 75,
        remainingTotal: 200,
        paymentStatus: "partial",
        paidTotal: 300,
      },
      {
        ...postedPaid,
        status: "void",
        grandTotal: 9999,
      },
    ]);
    expect(summary.totalInvoices).toBe(2);
    expect(summary.totalSales).toBe(1500);
    expect(summary.netSales).toBe(1275);
    expect(summary.totalDiscount).toBe(75);
    expect(summary.totalTax).toBe(225);
    expect(summary.pendingAmount).toBe(200);
  });

  it("pagination slices items", () => {
    const all = [1, 2, 3, 4, 5];
    expect(paginateItems(all, 0, 2)).toEqual([1, 2]);
    expect(paginateItems(all, 2, 2)).toEqual([3, 4]);
    expect(paginateItems(all, 4, 2)).toEqual([5]);
    expect(paginateItems(all, 10, 5)).toEqual([]);
  });
});
