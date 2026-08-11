import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";

export type PosTaxKind = "sales_tax" | "gst" | "exempt";

export type PosTaxRateInput = {
  id?: string;
  /** Display / filing kind. */
  kind?: PosTaxKind;
  ratePercent: number;
  pricingMode: "inclusive" | "exclusive";
  isExempt?: boolean;
  name?: string;
};

export type LineTaxResult = {
  tax: number;
  net: number;
  gross: number;
  kind: PosTaxKind;
  ratePercent: number;
  exempt: boolean;
};

function finite(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Compute tax for a taxable net (qty * price - discount).
 * Exclusive: tax added on top. Inclusive: tax extracted from gross.
 */
export function computeLineTax(input: {
  /** Amount subject to tax (after discount). For inclusive, this is gross including tax. */
  amount: number;
  rate: PosTaxRateInput | null | undefined;
}): LineTaxResult {
  const amount = roundMoney(Math.max(0, finite(input.amount)));
  const rate = input.rate;
  const kind: PosTaxKind =
    rate?.isExempt || rate?.kind === "exempt"
      ? "exempt"
      : rate?.kind === "sales_tax"
        ? "sales_tax"
        : "gst";

  if (!rate || rate.isExempt || kind === "exempt") {
    return {
      tax: 0,
      net: amount,
      gross: amount,
      kind: "exempt",
      ratePercent: 0,
      exempt: true,
    };
  }

  if (!Number.isFinite(rate.ratePercent) || rate.ratePercent < 0 || rate.ratePercent > 100) {
    throw new ValidationDomainError("Invalid tax rate");
  }

  if (!(rate.ratePercent > 0) || amount <= 0) {
    return {
      tax: 0,
      net: amount,
      gross: amount,
      kind: "exempt",
      ratePercent: 0,
      exempt: true,
    };
  }

  if (rate.pricingMode === "inclusive") {
    const net = roundMoney(amount / (1 + rate.ratePercent / 100));
    const tax = roundMoney(amount - net);
    return {
      tax,
      net,
      gross: amount,
      kind,
      ratePercent: rate.ratePercent,
      exempt: false,
    };
  }

  const tax = roundMoney((amount * rate.ratePercent) / 100);
  return {
    tax,
    net: amount,
    gross: roundMoney(amount + tax),
    kind,
    ratePercent: rate.ratePercent,
    exempt: false,
  };
}

export type TaxInvoiceSummary = {
  isTaxInvoice: boolean;
  taxableAmount: number;
  taxTotal: number;
  exempt: boolean;
  kind: PosTaxKind;
  ratePercent: number;
};

/** Build tax-invoice style totals from line tax results. */
export function buildTaxInvoiceSummary(
  lines: Array<{ taxableNet: number; tax: number }>,
  rate: PosTaxRateInput | null | undefined,
): TaxInvoiceSummary {
  const taxableAmount = roundMoney(lines.reduce((s, l) => s + finite(l.taxableNet), 0));
  const taxTotal = roundMoney(lines.reduce((s, l) => s + finite(l.tax), 0));
  if (!Number.isFinite(taxableAmount) || !Number.isFinite(taxTotal)) {
    throw new ValidationDomainError("Invalid tax invoice totals");
  }
  const exempt = !rate || Boolean(rate.isExempt) || rate.kind === "exempt" || !(rate.ratePercent > 0);
  const kind: PosTaxKind = exempt ? "exempt" : rate?.kind === "sales_tax" ? "sales_tax" : "gst";
  return {
    isTaxInvoice: !exempt && taxTotal > 0,
    taxableAmount,
    taxTotal,
    exempt,
    kind,
    ratePercent: exempt ? 0 : finite(rate?.ratePercent),
  };
}
