import type { SaleItemInput } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface SaleTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

const roundMoney = (n: number): number => Math.round(n * 100) / 100;

function asNum(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Pure business calculation — no React, no DB. */
export function calculateSaleTotals(
  items: SaleItemInput[],
  cartDiscount = 0,
): SaleTotals {
  if (items.length === 0) {
    throw new ValidationDomainError("Sale requires at least one item");
  }
  if (cartDiscount < 0) {
    throw new ValidationDomainError("Cart discount cannot be negative");
  }

  let subtotal = 0;
  let lineDiscount = 0;
  let taxTotal = 0;

  for (const item of items) {
    const qty = asNum(item.qty);
    const unitPrice = asNum(item.unitPrice);
    const discount = asNum(item.discount);
    const tax = asNum(item.tax);
    if (qty <= 0) throw new ValidationDomainError("Invalid quantity");
    if (unitPrice < 0) throw new ValidationDomainError("Invalid price");
    subtotal += qty * unitPrice;
    lineDiscount += discount;
    taxTotal += tax;
  }

  const discountTotal = roundMoney(lineDiscount + cartDiscount);
  const grandTotal = roundMoney(Math.max(0, subtotal - discountTotal + taxTotal));

  return {
    subtotal: roundMoney(subtotal),
    discountTotal,
    taxTotal: roundMoney(taxTotal),
    grandTotal,
  };
}
