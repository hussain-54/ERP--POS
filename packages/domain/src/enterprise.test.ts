import { describe, expect, it } from "vitest";
import {
  achievementPct,
  assertDocumentAccess,
  calculateNetSalary,
  calculateSalesCommission,
  documentStoragePath,
  performanceRating,
  splitTaxAmount,
  stockAlertNotifications,
} from "./enterprise.js";

describe("HR payroll + commission", () => {
  it("integrates salesman commission with sales totals", () => {
    const c = calculateSalesCommission(10_000, 2.5);
    expect(c.commissionAmount).toBe(250);
    expect(c.baseAmount).toBe(10_000);
  });

  it("computes net salary and performance", () => {
    expect(calculateNetSalary({
      baseSalary: 50_000,
      commissionAmount: 2500,
      incentiveAmount: 1000,
      deductions: 500,
    }).net).toBe(53_000);
    expect(performanceRating(90)).toBe("excellent");
    expect(achievementPct(80, 100)).toBe(80);
  });
});

describe("tax architecture", () => {
  it("supports inclusive and exclusive pricing", () => {
    const ex = splitTaxAmount(1000, 18, "exclusive");
    expect(ex.taxAmount).toBe(180);
    expect(ex.grandTotal).toBe(1180);
    const inc = splitTaxAmount(1180, 18, "inclusive");
    expect(inc.grandTotal).toBe(1180);
    expect(inc.taxableAmount).toBe(1000);
    expect(splitTaxAmount(1000, 18, "exclusive", true).taxAmount).toBe(0);
  });
});

describe("documents + notifications", () => {
  it("builds secure storage paths and gates sensitive docs", () => {
    const path = documentStoragePath({
      organizationId: "org1",
      entityType: "customer",
      entityId: "c1",
      fileName: "CNIC scan.pdf",
    });
    expect(path).toContain("org/org1/customer/c1/");
    expect(path).toContain("CNIC_scan.pdf");
    expect(() =>
      assertDocumentAccess({ isSensitive: true, canViewSensitive: false }),
    ).toThrow(/sensitive/);
  });

  it("emits stock alert notification types", () => {
    const notes = stockAlertNotifications([
      { productId: "a", productName: "A", qtyOnHand: 0, reorderLevel: 5 },
      { productId: "b", productName: "B", qtyOnHand: 3, reorderLevel: 5 },
      { productId: "c", productName: "C", qtyOnHand: 200, reorderLevel: 5, overstockLevel: 100 },
    ]);
    expect(notes.map((n) => n.type).sort()).toEqual(["low_stock", "out_of_stock", "overstock"]);
  });
});
