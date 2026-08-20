import type { SaleItemInput } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";
import { finiteMoney, roundMoney } from "./money.js";
import { applyDiscount } from "./pos-discount.js";

export interface SaleTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  /** Invoice/cart discount after capping to remaining taxable base. */
  invoiceDiscount: number;
  itemDiscount: number;
  /**
   * Amount subject to tax after line + invoice discounts.
   * Exclusive: subtotal − discounts. Inclusive: that amount minus extracted tax.
   */
  taxableAmount: number;
  /** Fee added after tax (0 when delivery is flag-only). */
  deliveryCharges: number;
  /** Final rounding adjustment applied after delivery. */
  roundOff: number;
}

export type SaleTotalsOptions = {
  /**
   * Uniform tax mode when lines omit taxPricingMode.
   * Per-line taxPricingMode always wins when set.
   */
  taxPricingMode?: "inclusive" | "exclusive";
  deliveryCharges?: number;
  roundOff?: number;
};

function asNum(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback;
  return finiteMoney(v, fallback);
}

function lineTaxMode(
  item: SaleItemInput,
  fallback: "inclusive" | "exclusive",
): "inclusive" | "exclusive" {
  const mode = (item as { taxPricingMode?: string }).taxPricingMode;
  return mode === "inclusive" || mode === "exclusive" ? mode : fallback;
}

/**
 * Canonical invoice totals — single source of truth for cart UI, checkout, and posting.
 * Pure business calculation — no React, no DB.
 *
 * Chain: line gross → line discount → invoice discount → taxable → tax (exclusive add) →
 * delivery → round-off → grand.
 *
 * Inclusive lines: tax is extracted for reporting but not added again into grand.
 */
export function calculateSaleTotals(
  items: SaleItemInput[],
  cartDiscount = 0,
  options: SaleTotalsOptions = {},
): SaleTotals {
  if (items.length === 0) {
    throw new ValidationDomainError("Sale requires at least one item");
  }
  if (!Number.isFinite(cartDiscount) || cartDiscount < 0) {
    throw new ValidationDomainError("Cart discount cannot be negative or invalid");
  }

  const defaultMode = options.taxPricingMode === "inclusive" ? "inclusive" : "exclusive";
  const deliveryCharges = roundMoney(Math.max(0, asNum(options.deliveryCharges)));
  const roundOff = roundMoney(asNum(options.roundOff));

  let subtotal = 0;
  let lineDiscount = 0;
  let taxTotal = 0;
  /** Tax that must be added on top of discounted prices (exclusive lines only). */
  let exclusiveTaxAdd = 0;
  let inclusiveTaxPortion = 0;

  for (const item of items) {
    const qty = asNum(item.qty);
    const unitPrice = asNum(item.unitPrice);
    const rawDiscount = asNum(item.discount);
    const tax = asNum(item.tax);
    if (qty <= 0) throw new ValidationDomainError("Invalid quantity");
    if (unitPrice < 0) throw new ValidationDomainError("Invalid price");
    if (tax < 0) throw new ValidationDomainError("Invalid tax");
    const lineGross = roundMoney(qty * unitPrice);
    const pct = asNum(item.discountPercent);
    const discount =
      pct > 0
        ? applyDiscount({ base: lineGross, mode: "percentage", value: pct }).amount
        : rawDiscount > lineGross
          ? lineGross
          : rawDiscount;
    subtotal += lineGross;
    lineDiscount += discount;
    taxTotal += tax;
    const mode = lineTaxMode(item, defaultMode);
    if (mode === "inclusive") {
      inclusiveTaxPortion += tax;
    } else {
      exclusiveTaxAdd += tax;
    }
  }

  subtotal = roundMoney(subtotal);
  lineDiscount = roundMoney(lineDiscount);
  taxTotal = roundMoney(taxTotal);
  exclusiveTaxAdd = roundMoney(exclusiveTaxAdd);
  inclusiveTaxPortion = roundMoney(inclusiveTaxPortion);

  const maxInvoice = Math.max(0, roundMoney(subtotal - lineDiscount));
  const invoiceDiscount = roundMoney(Math.min(asNum(cartDiscount), maxInvoice));
  const discountTotal = roundMoney(lineDiscount + invoiceDiscount);
  const afterDiscount = roundMoney(Math.max(0, subtotal - discountTotal));

  /**
   * Taxable base after discounts.
   * Inclusive tax was computed on pre-invoice line nets; when invoice discount applies,
   * taxable is approximated as afterDiscount − inclusive tax portion (floored at 0).
   */
  const taxableAmount = roundMoney(
    Math.max(0, afterDiscount - inclusiveTaxPortion),
  );

  const grandTotal = roundMoney(
    Math.max(0, afterDiscount + exclusiveTaxAdd + deliveryCharges + roundOff),
  );

  if (![subtotal, discountTotal, taxTotal, grandTotal, taxableAmount].every(Number.isFinite)) {
    throw new ValidationDomainError("Sale totals produced invalid numbers");
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    invoiceDiscount,
    itemDiscount: lineDiscount,
    taxableAmount,
    deliveryCharges,
    roundOff,
  };
}
