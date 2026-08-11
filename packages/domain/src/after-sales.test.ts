import { describe, expect, it } from "vitest";
import {
  assertOrderTransition,
  assertQuotationTransition,
  calculateQuoteTotals,
  quotationConversionPath,
} from "./quotation-lifecycle.js";
import { assertServiceJobTransition, computeServiceBill } from "./service-lifecycle.js";
import {
  assertSerialMatchesWarranty,
  assertWarrantyClaimAllowed,
  isWarrantyActive,
} from "./warranty-service.js";

describe("quotation → order → invoice path", () => {
  it("defines conversion path", () => {
    expect(quotationConversionPath()).toEqual(["quotation", "sales_order", "invoice"]);
  });

  it("allows quotation conversion lifecycle", () => {
    expect(() => assertQuotationTransition("draft", "accepted")).not.toThrow();
    expect(() => assertQuotationTransition("accepted", "converted_to_order")).not.toThrow();
    expect(() => assertQuotationTransition("draft", "converted_to_order")).toThrow(/transition/i);
  });

  it("allows order conversion to invoice", () => {
    expect(() => assertOrderTransition("draft", "confirmed")).not.toThrow();
    expect(() => assertOrderTransition("confirmed", "converted_to_invoice")).not.toThrow();
    expect(() => assertOrderTransition("draft", "converted_to_invoice")).toThrow(/transition/i);
  });

  it("calculates quotation totals", () => {
    const totals = calculateQuoteTotals(
      [{ productId: "11111111-1111-4111-8111-111111111111", unitId: "22222222-2222-4222-8222-222222222222", qty: 2, unitPrice: 100, discount: 10, tax: 5 }],
      5,
    );
    expect(totals.subtotal).toBe(200);
    expect(totals.discountTotal).toBe(15);
    expect(totals.grandTotal).toBe(190);
  });
});

describe("service job", () => {
  it("enforces Received → Diagnosis → Repairing → Ready → Delivered", () => {
    expect(() => assertServiceJobTransition("received", "diagnosis")).not.toThrow();
    expect(() => assertServiceJobTransition("diagnosis", "repairing")).not.toThrow();
    expect(() => assertServiceJobTransition("repairing", "ready")).not.toThrow();
    expect(() => assertServiceJobTransition("ready", "delivered")).not.toThrow();
    expect(() => assertServiceJobTransition("received", "delivered")).toThrow(/transition/i);
  });

  it("computes service charges and warranty coverage", () => {
    const paid = computeServiceBill({
      repairCost: 50,
      serviceCharges: 20,
      partsTotal: 30,
      underWarranty: false,
    });
    expect(paid.billableTotal).toBe(100);
    const covered = computeServiceBill({
      repairCost: 50,
      serviceCharges: 20,
      partsTotal: 30,
      underWarranty: true,
    });
    expect(covered.billableTotal).toBe(0);
    expect(covered.warrantyCovered).toBe(100);
  });
});

describe("warranty", () => {
  const warranty = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    saleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    productId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    serialNumberId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    warrantyStart: "2026-01-01",
    warrantyEnd: "2027-01-01",
  };

  it("lookup active warranty and serial validation", () => {
    expect(isWarrantyActive(warranty, new Date("2026-06-01"))).toBe(true);
    expect(() => assertWarrantyClaimAllowed(warranty, new Date("2026-06-01"))).not.toThrow();
    expect(() => assertWarrantyClaimAllowed(warranty, new Date("2028-01-01"))).toThrow(/expired/i);
    expect(() =>
      assertSerialMatchesWarranty(warranty, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
    ).not.toThrow();
    expect(() =>
      assertSerialMatchesWarranty(warranty, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"),
    ).toThrow(/serial/i);
  });
});
