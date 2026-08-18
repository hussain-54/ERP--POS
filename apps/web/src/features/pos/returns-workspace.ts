import {
  maxReturnableQty,
  reasonLabel,
  restockDecision,
  RETURN_CONDITIONS,
  RETURN_REASON_CODES,
  type PreparedSaleReturn,
  type ReturnCondition,
  type RestockTarget,
} from "@electronic-erp/domain";

export const RETURN_STEPS = [
  { id: "find", label: "Find invoice" },
  { id: "review", label: "Review sale" },
  { id: "items", label: "Select return items" },
  { id: "qty", label: "Select quantities" },
  { id: "amount", label: "Show return amount" },
  { id: "method", label: "Select refund method" },
  { id: "confirm", label: "Confirm return" },
  { id: "result", label: "Show completion state" },
] as const;

export const EXCHANGE_STEPS = [
  { id: "find", label: "Find original invoice" },
  { id: "return", label: "Select item to exchange" },
  { id: "replace", label: "Select replacement product" },
  { id: "difference", label: "Calculate difference" },
  { id: "payable", label: "Show amount payable/refundable" },
  { id: "method", label: "Select payment/refund method" },
  { id: "confirm", label: "Confirm" },
] as const;

export const RETURN_LINE_COLUMNS = [
  "Item",
  "Original Qty",
  "Returned Qty",
  "Remaining Returnable Qty",
  "Original price",
  "Tax",
  "Discount",
  "Return qty",
] as const;

export const REASON_OPTIONS = RETURN_REASON_CODES.map((code) => ({
  value: code,
  label: reasonLabel(code),
}));

export const CONDITION_OPTIONS = RETURN_CONDITIONS.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

export type ReturnableDraft = {
  saleItemId: string;
  productId: string | null;
  unitId: string;
  name: string;
  soldQty: number;
  previouslyReturnedQty: number;
  maxReturnable: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
  batchId: string | null;
  selected: boolean;
  qty: string;
  condition: ReturnCondition;
  originalPackaging: boolean;
  accessoriesComplete: boolean;
  inspectionNotes: string;
};

export type OriginalPayment = {
  method: string;
  amount: number;
  reference: string | null;
};

export type ParsedReturnableSale = {
  saleId: string;
  invoiceNumber: string;
  warehouseId: string;
  customerId: string | null;
  customerName: string | null;
  customerMobile: string | null;
  hasCustomer: boolean;
  saleDate: string | null;
  cashierName: string | null;
  paidAmount: number;
  remainingAmount: number;
  originalPayments: OriginalPayment[];
  status: string;
  lines: ReturnableDraft[];
};

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function parseReturnableSale(data: Record<string, unknown>): ParsedReturnableSale {
  const sale = (data.sale && typeof data.sale === "object" ? data.sale : data) as Record<string, unknown>;
  const invoiceItems = Array.isArray(data.items) ? data.items : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const raw of invoiceItems) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    byId.set(String(row.id ?? ""), row);
  }
  const returnable = Array.isArray(data.returnableLines) ? data.returnableLines : [];
  const lines: ReturnableDraft[] = [];
  for (const raw of returnable) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const saleItemId = String(row.saleItemId ?? "");
    if (!saleItemId) continue;
    const inv = byId.get(saleItemId) ?? {};
    const soldQty = num(row.soldQty ?? inv.qty);
    const previouslyReturnedQty = num(row.previouslyReturnedQty);
    const max = maxReturnableQty(soldQty, previouslyReturnedQty);
    const unitPrice = num(row.unitPrice ?? inv.rate);
    lines.push({
      saleItemId,
      productId: row.productId ? String(row.productId) : inv.productId ? String(inv.productId) : null,
      unitId: String(row.unitId ?? inv.unitId ?? ""),
      name: String(row.name ?? inv.name ?? "Item"),
      soldQty,
      previouslyReturnedQty,
      maxReturnable: max,
      unitPrice,
      discount: num(inv.discount),
      tax: num(inv.tax),
      lineTotal: num(inv.total),
      batchId: row.batchId ? String(row.batchId) : null,
      selected: false,
      qty: max > 0 ? String(max) : "0",
      condition: "good",
      originalPackaging: true,
      accessoriesComplete: true,
      inspectionNotes: "",
    });
  }
  const customerId = sale.customerId ? String(sale.customerId) : sale.customer_id ? String(sale.customer_id) : null;
  const originalPayments: OriginalPayment[] = [];
  if (Array.isArray(data.payments)) {
    for (const raw of data.payments) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      originalPayments.push({
        method: String(row.method ?? "Payment"),
        amount: num(row.amount),
        reference: row.reference != null && String(row.reference).trim() ? String(row.reference) : null,
      });
    }
  }
  return {
    saleId: String(sale.id ?? data.id ?? ""),
    invoiceNumber: String(data.invoiceNumber ?? sale.invoiceNumber ?? sale.invoice_number ?? ""),
    warehouseId: String(sale.warehouseId ?? sale.warehouse_id ?? ""),
    customerId,
    customerName: strOrNull(data.customerName ?? sale.customerName),
    customerMobile: strOrNull(data.customerMobile ?? sale.customerMobile),
    hasCustomer: Boolean(customerId),
    saleDate: strOrNull(data.dateTime ?? sale.postedAt ?? sale.posted_at ?? sale.createdAt ?? sale.created_at),
    cashierName: strOrNull(data.cashierName ?? sale.cashierName),
    paidAmount: num(data.paidAmount ?? sale.paidTotal ?? sale.paid_total),
    remainingAmount: num(data.remainingAmount ?? sale.remainingTotal ?? sale.remaining_total),
    originalPayments,
    status: String(data.status ?? sale.status ?? ""),
    lines,
  };
}

export function originalPaymentLabel(payments: OriginalPayment[], paidAmount: number): string {
  if (payments.length) {
    return payments
      .map((p) => {
        const amount = p.amount.toFixed(2);
        return p.reference ? `${p.method} ${amount} (${p.reference})` : `${p.method} ${amount}`;
      })
      .join(" · ");
  }
  if (paidAmount > 0) return `Paid ${paidAmount.toFixed(2)}`;
  return "—";
}

export function returnedQtyTotal(lines: Array<Pick<ReturnableDraft, "previouslyReturnedQty">>): number {
  return lines.reduce((sum, line) => sum + line.previouslyReturnedQty, 0);
}

export function remainingQtyTotal(lines: Array<Pick<ReturnableDraft, "maxReturnable">>): number {
  return lines.reduce((sum, line) => sum + line.maxReturnable, 0);
}

export function selectedQtyTotal(lines: ReturnableDraft[]): number {
  return selectedReturnLines(lines).reduce((sum, line) => sum + Number(line.qty || 0), 0);
}

export function clampReturnQty(soldQty: number, previouslyReturnedQty: number, qty: number): number {
  const max = maxReturnableQty(soldQty, previouslyReturnedQty);
  if (!Number.isFinite(qty) || qty < 0) return 0;
  return Math.min(qty, max);
}

export function restockEffectLabel(target: RestockTarget, restock: boolean): string {
  if (!restock || target === "none") return "No restock";
  if (target === "damaged") return "Restock to damaged";
  return "Restock to on-hand";
}

export function lineRestockLabel(line: Pick<ReturnableDraft, "condition" | "originalPackaging" | "accessoriesComplete">): string {
  const decision = restockDecision(line);
  return restockEffectLabel(decision.target, decision.restock);
}

export function selectedReturnLines(lines: ReturnableDraft[]) {
  return lines.filter((line) => line.selected && Number(line.qty) > 0);
}

export function toReturnLineInputs(lines: ReturnableDraft[]) {
  return selectedReturnLines(lines).map((line) => ({
    originalSaleItemId: line.saleItemId,
    productId: line.productId,
    unitId: line.unitId,
    qty: Number(line.qty),
    unitPrice: line.unitPrice,
    condition: line.condition,
    originalPackaging: line.originalPackaging,
    accessoriesComplete: line.accessoriesComplete,
    inspectionNotes: line.inspectionNotes.trim() || null,
    batchId: line.batchId,
  }));
}

export function toReturnableRows(lines: ReturnableDraft[]) {
  return lines.map((line) => ({
    saleItemId: line.saleItemId,
    productId: line.productId,
    unitId: line.unitId,
    name: line.name,
    soldQty: line.soldQty,
    previouslyReturnedQty: line.previouslyReturnedQty,
    unitPrice: line.unitPrice,
    batchId: line.batchId,
  }));
}

export function refundPreviewError(prepared: PreparedSaleReturn | null, error: string | null): string | null {
  if (error) return error;
  if (!prepared) return "Complete the return lines before confirming";
  return null;
}

/** UI guards only. Refund and stock amounts still come from prepareSaleReturn. */
export function returnOperationWarnings(input: {
  lines: ReturnableDraft[];
  hasCustomer: boolean;
  disposition: string;
  refundMethod: string;
  reasonCode: string;
  reasonDetail: string;
}): string[] {
  const warnings: string[] = [];
  const remaining = input.lines.filter((line) => line.maxReturnable > 1e-9);
  if (!input.lines.length) {
    warnings.push("This invoice has no sale lines.");
  } else if (!remaining.length) {
    warnings.push("Nothing remaining to return. Every line on this invoice is already fully returned.");
  }
  const checked = input.lines.filter((line) => line.selected);
  if (remaining.length && !checked.length) {
    warnings.push("Select at least one return item.");
  }
  for (const line of checked) {
    if (line.maxReturnable <= 1e-9) {
      warnings.push(`${line.name}: nothing remaining to return.`);
      continue;
    }
    const qty = Number(line.qty);
    if (!(qty > 0)) {
      warnings.push(`${line.name}: enter a return quantity greater than zero.`);
    } else if (qty - line.maxReturnable > 1e-9) {
      warnings.push(`${line.name}: quantity exceeds remaining returnable (${line.maxReturnable}).`);
    }
  }
  if (input.reasonCode === "other" && !input.reasonDetail.trim()) {
    warnings.push("Describe the return reason when Other is selected.");
  }
  const credit = input.disposition === "credit" || input.refundMethod === "customer_credit";
  if (credit && !input.hasCustomer) {
    warnings.push("Customer credit requires a customer on the original sale. Walk-in invoices cannot be credited.");
  }
  return warnings;
}

export function exchangeOperationWarnings(input: {
  lines: ReturnableDraft[];
  replacementCount: number;
  hasCustomer: boolean;
  disposition: string;
  refundMethod: string;
  reasonCode: string;
  reasonDetail: string;
  canSell: boolean;
}): string[] {
  const warnings = returnOperationWarnings(input);
  if (!input.replacementCount) {
    warnings.push("Select at least one replacement product.");
  }
  if (!input.canSell) {
    warnings.push("Replacement sale requires pos.sell. The return cannot be completed as an exchange.");
  }
  return warnings;
}

export type ReturnHistoryRow = {
  id: string;
  type: string;
  scope: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
};

export function parseReturnHistoryRow(row: Record<string, unknown>): ReturnHistoryRow {
  return {
    id: String(row.id ?? ""),
    type: String(row.returnType ?? row.return_type ?? ""),
    scope: String(row.returnScope ?? row.return_scope ?? ""),
    amount: num(row.refundAmount ?? row.refund_amount),
    reason: String(row.reasonCode ?? row.reason_code ?? row.reason ?? ""),
    status: String(row.status ?? ""),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
  };
}

export type ReturnStepId = (typeof RETURN_STEPS)[number]["id"];
export type ExchangeStepId = (typeof EXCHANGE_STEPS)[number]["id"];
