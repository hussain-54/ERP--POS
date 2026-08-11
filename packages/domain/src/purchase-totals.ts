import type { PurchaseItemInput } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface PurchaseTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

function asNum(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function calculatePurchaseTotals(
  items: PurchaseItemInput[],
  invoiceDiscount = 0,
): PurchaseTotals {
  if (!items.length) throw new ValidationDomainError("Purchase requires at least one item");
  let subtotal = 0;
  let lineDiscount = 0;
  let taxTotal = 0;
  for (const item of items) {
    const qty = asNum(item.qty);
    const cost = asNum(item.unitCost);
    if (qty <= 0) throw new ValidationDomainError("Invalid quantity");
    if (cost < 0) throw new ValidationDomainError("Invalid cost");
    subtotal += qty * cost;
    lineDiscount += asNum(item.discount);
    taxTotal += asNum(item.tax);
  }
  const discountTotal = round(lineDiscount + invoiceDiscount);
  return {
    subtotal: round(subtotal),
    discountTotal,
    taxTotal: round(taxTotal),
    grandTotal: round(Math.max(0, subtotal - discountTotal + taxTotal)),
  };
}
