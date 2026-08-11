import type { QuotationStatus, SalesOrderStatus } from "@electronic-erp/contracts";
import type { QuoteLineInput } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

const QUOTE_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ["sent", "accepted", "cancelled"],
  sent: ["accepted", "expired", "cancelled"],
  accepted: ["converted_to_order", "cancelled"],
  converted_to_order: [],
  expired: [],
  cancelled: [],
};

const ORDER_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["converted_to_invoice", "cancelled"],
  converted_to_invoice: [],
  cancelled: [],
};

export function assertQuotationTransition(from: QuotationStatus, to: QuotationStatus): void {
  if (from === to) return;
  if (!QUOTE_TRANSITIONS[from].includes(to)) {
    throw new ValidationDomainError(`Invalid quotation transition ${from} → ${to}`);
  }
}

export function assertOrderTransition(from: SalesOrderStatus, to: SalesOrderStatus): void {
  if (from === to) return;
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new ValidationDomainError(`Invalid order transition ${from} → ${to}`);
  }
}

export interface QuoteTotals {
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

export function calculateQuoteTotals(items: QuoteLineInput[], invoiceDiscount = 0): QuoteTotals {
  if (!items.length) throw new ValidationDomainError("At least one line required");
  let subtotal = 0;
  let lineDiscount = 0;
  let taxTotal = 0;
  for (const item of items) {
    const qty = asNum(item.qty);
    const price = asNum(item.unitPrice);
    if (qty <= 0) throw new ValidationDomainError("Invalid quantity");
    subtotal += qty * price;
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

/** Quotation → Sales Order → Invoice */
export function quotationConversionPath(): ["quotation", "sales_order", "invoice"] {
  return ["quotation", "sales_order", "invoice"];
}
