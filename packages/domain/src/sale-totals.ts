import type { SaleItemInput } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";
import { finiteMoney, roundMoney } from "./money.js";

export interface SaleTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  /** Invoice/cart discount after capping to remaining taxable base. */
  invoiceDiscount: number;
  itemDiscount: number;
}

function asNum(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback;
  return finiteMoney(v, fallback);
}

/** Pure business calculation — no React, no DB. */
export function calculateSaleTotals(
  items: SaleItemInput[],
  cartDiscount = 0,
): SaleTotals {
  if (items.length === 0) {
    throw new ValidationDomainError("Sale requires at least one item");
  }
  if (!Number.isFinite(cartDiscount) || cartDiscount < 0) {
    throw new ValidationDomainError("Cart discount cannot be negative or invalid");
  }

  let subtotal = 0;
  let lineDiscount = 0;
  let taxTotal = 0;

  for (const item of items) {
    const qty = asNum(item.qty);
    const unitPrice = asNum(item.unitPrice);
    const rawDiscount = asNum(item.discount);
    const tax = asNum(item.tax);
    if (qty <= 0) throw new ValidationDomainError("Invalid quantity");
    if (unitPrice < 0) throw new ValidationDomainError("Invalid price");
    if (tax < 0) throw new ValidationDomainError("Invalid tax");
    const lineGross = roundMoney(qty * unitPrice);
    const discount = rawDiscount > lineGross ? lineGross : rawDiscount;
    subtotal += lineGross;
    lineDiscount += discount;
    taxTotal += tax;
  }

  subtotal = roundMoney(subtotal);
  lineDiscount = roundMoney(lineDiscount);
  taxTotal = roundMoney(taxTotal);
  const maxInvoice = Math.max(0, roundMoney(subtotal - lineDiscount));
  const invoiceDiscount = roundMoney(Math.min(asNum(cartDiscount), maxInvoice));
  const discountTotal = roundMoney(lineDiscount + invoiceDiscount);
  const grandTotal = roundMoney(Math.max(0, subtotal - discountTotal + taxTotal));

  if (![subtotal, discountTotal, taxTotal, grandTotal].every(Number.isFinite)) {
    throw new ValidationDomainError("Sale totals produced invalid numbers");
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    invoiceDiscount,
    itemDiscount: lineDiscount,
  };
}
