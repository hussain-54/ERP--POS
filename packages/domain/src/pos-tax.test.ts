import { describe, expect, it } from "vitest";
import { buildTaxInvoiceSummary, computeLineTax } from "./pos-tax.js";

describe("pos-tax", () => {
  it("computes exclusive sales tax / GST", () => {
    const exclusive = computeLineTax({
      amount: 100,
      rate: { ratePercent: 17, pricingMode: "exclusive", kind: "gst" },
    });
    expect(exclusive.tax).toBe(17);
    expect(exclusive.net).toBe(100);
    expect(exclusive.gross).toBe(117);
    expect(exclusive.kind).toBe("gst");
  });

  it("extracts inclusive tax", () => {
    const inclusive = computeLineTax({
      amount: 117,
      rate: { ratePercent: 17, pricingMode: "inclusive", kind: "sales_tax" },
    });
    expect(inclusive.net).toBe(100);
    expect(inclusive.tax).toBe(17);
    expect(inclusive.kind).toBe("sales_tax");
  });

  it("honors tax exemption", () => {
    const exempt = computeLineTax({
      amount: 100,
      rate: { ratePercent: 17, pricingMode: "exclusive", isExempt: true, kind: "exempt" },
    });
    expect(exempt.tax).toBe(0);
    expect(exempt.exempt).toBe(true);
    expect(exempt.kind).toBe("exempt");
  });

  it("rejects invalid tax rate", () => {
    expect(() =>
      computeLineTax({
        amount: 100,
        rate: { ratePercent: -1, pricingMode: "exclusive" },
      }),
    ).toThrow(/invalid tax/i);
    expect(() =>
      computeLineTax({
        amount: 100,
        rate: { ratePercent: 120, pricingMode: "exclusive" },
      }),
    ).toThrow(/invalid tax/i);
  });

  it("never returns NaN for bad amount", () => {
    const r = computeLineTax({
      amount: Number.NaN,
      rate: { ratePercent: 10, pricingMode: "exclusive" },
    });
    expect(r.tax).toBe(0);
    expect(r.net).toBe(0);
  });

  it("builds tax invoice summary", () => {
    const summary = buildTaxInvoiceSummary(
      [
        { taxableNet: 100, tax: 17 },
        { taxableNet: 50, tax: 8.5 },
      ],
      { ratePercent: 17, pricingMode: "exclusive", kind: "gst" },
    );
    expect(summary.isTaxInvoice).toBe(true);
    expect(summary.taxableAmount).toBe(150);
    expect(summary.taxTotal).toBe(25.5);
    expect(summary.kind).toBe("gst");
  });
});
