import type { QuotationStatus, SalesOrderStatus } from "@electronic-erp/contracts";
import type { QuoteLineInput } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";
import { calculateSaleTotals } from "./sale-totals.js";

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

/** Same engine as POS invoices — quotations cannot drift from sale math. */
export function calculateQuoteTotals(items: QuoteLineInput[], invoiceDiscount = 0): QuoteTotals {
  const totals = calculateSaleTotals(items, invoiceDiscount);
  return {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
  };
}

/** Quotation → Sales Order → Invoice */
export function quotationConversionPath(): ["quotation", "sales_order", "invoice"] {
  return ["quotation", "sales_order", "invoice"];
}
