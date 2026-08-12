import type { Sale } from "@electronic-erp/contracts";
import { buildAuditRow, type AuditEntryInput } from "./audit-trail.js";

/** Full POS invoice document — domain shape for print / share / PDF text. */
export type SaleInvoiceDocument = {
  invoiceNumber: string;
  dateTime: string;
  branchId: string;
  branchName: string | null;
  terminalId: string | null;
  cashierId: string | null;
  cashierName: string | null;
  customerId: string | null;
  customerName: string | null;
  customerMobile: string | null;
  customerAddress: string | null;
  reference: string | null;
  salesmanId: string | null;
  salesmanName: string | null;
  commissionPercent: number | null;
  commissionAmount: number | null;
  dueDate: string | null;
  terms: string | null;
  warrantyNotes: string | null;
  items: Array<{
    name: string;
    qty: string | number;
    unit: string | null;
    rate: number;
    discount: number;
    tax: number;
    total: number;
    warrantyDays: number;
  }>;
  payments: Array<{ method: string; amount: number }>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  status: string;
};

export type InvoiceAction = "save" | "print_a4" | "print_80mm" | "print_58mm" | "download_pdf" | "whatsapp" | "email";

export function buildSaleInvoiceDocument(input: {
  sale: Sale;
  branchName?: string | null;
  terminalId?: string | null;
  cashierName?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  customerAddress?: string | null;
  salesmanName?: string | null;
  commissionPercent?: number | null;
  commissionAmount?: number | null;
  terms?: string | null;
  warrantyNotes?: string | null;
  items: SaleInvoiceDocument["items"];
  payments: SaleInvoiceDocument["payments"];
}): SaleInvoiceDocument {
  const s = input.sale;
  return {
    invoiceNumber: s.invoiceNumber,
    dateTime: s.postedAt ?? s.createdAt,
    branchId: s.branchId,
    branchName: input.branchName ?? null,
    terminalId: input.terminalId ?? s.deviceId ?? null,
    cashierId: null,
    cashierName: input.cashierName ?? null,
    customerId: s.customerId ?? null,
    customerName: input.customerName ?? null,
    customerMobile: input.customerMobile ?? null,
    customerAddress: input.customerAddress ?? null,
    reference: s.referenceName ?? null,
    salesmanId: s.salesmanUserId ?? null,
    salesmanName: input.salesmanName ?? null,
    commissionPercent: input.commissionPercent ?? null,
    commissionAmount: input.commissionAmount ?? null,
    dueDate: s.dueDate ?? null,
    terms: input.terms ?? null,
    warrantyNotes: input.warrantyNotes ?? null,
    items: input.items,
    payments: input.payments,
    subtotal: s.subtotal,
    discountTotal: s.discountTotal,
    taxTotal: s.taxTotal,
    grandTotal: s.grandTotal,
    paidAmount: s.paidTotal,
    remainingAmount: s.remainingTotal,
    paymentStatus: s.paymentStatus,
    status: s.status,
  };
}

/** Render invoice as plain text for thermal / email / WhatsApp / PDF-via-print. */
export function renderSaleInvoiceText(
  doc: SaleInvoiceDocument,
  format: "80mm" | "58mm" | "a4" = "80mm",
): string {
  const width = format === "58mm" ? 32 : format === "80mm" ? 42 : 64;
  const line = (ch = "-") => ch.repeat(width);
  const row = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return `${left}${" ".repeat(space)}${right}`;
  };
  const money = (n: number) => n.toFixed(2);
  const lines = [
    "ELECTRONIC ERP",
    "SALES INVOICE",
    line("="),
    `Inv: ${doc.invoiceNumber}`,
    `Date: ${new Date(doc.dateTime).toLocaleString()}`,
    doc.branchName ? `Branch: ${doc.branchName}` : `Branch: ${doc.branchId.slice(0, 8)}`,
    doc.terminalId ? `Terminal: ${doc.terminalId}` : "",
    doc.cashierName ? `Cashier: ${doc.cashierName}` : "",
    doc.customerName ? `Customer: ${doc.customerName}` : "Customer: Walk-in",
    doc.customerMobile ? `Mobile: ${doc.customerMobile}` : "",
    doc.reference ? `Ref: ${doc.reference}` : "",
    doc.salesmanName ? `Salesman: ${doc.salesmanName}` : "",
    doc.dueDate ? `Due: ${doc.dueDate}` : "",
    line(),
    ...doc.items.flatMap((it) => [
      String(it.name).slice(0, width),
      row(
        `${it.qty}${it.unit ? ` ${it.unit}` : ""} x ${money(it.rate)}`,
        money(it.total),
      ),
      it.discount > 0 ? row("  Disc", money(it.discount)) : "",
      it.tax > 0 ? row("  Tax", money(it.tax)) : "",
      it.warrantyDays > 0 ? `  Warranty ${it.warrantyDays}d` : "",
    ]),
    line(),
    row("Subtotal", money(doc.subtotal)),
    row("Discount", money(doc.discountTotal)),
    row("Tax", money(doc.taxTotal)),
    row("TOTAL", money(doc.grandTotal)),
    ...doc.payments.map((p) => row(p.method, money(p.amount))),
    row("Paid", money(doc.paidAmount)),
    row("Remaining", money(doc.remainingAmount)),
    doc.commissionAmount != null && doc.commissionAmount > 0
      ? row("Commission", money(doc.commissionAmount))
      : "",
    doc.warrantyNotes ? `Warranty: ${doc.warrantyNotes}` : "",
    doc.terms ? `Terms: ${doc.terms}` : "",
    line("="),
    "Thank you",
  ].filter(Boolean);
  return lines.join("\n");
}

export function saleFinalizationAuditInput(input: {
  organizationId: string;
  branchId: string;
  saleId: string;
  invoiceNumber: string;
  actorUserId?: string | null;
  deviceId?: string | null;
  grandTotal: number;
  paidTotal: number;
  status: string;
}): AuditEntryInput {
  return {
    organizationId: input.organizationId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    actorKind: "creator",
    action: "sale.finalize",
    entityType: "sale",
    entityId: input.saleId,
    deviceId: input.deviceId,
    correlationId: input.saleId,
    after: {
      invoiceNumber: input.invoiceNumber,
      grandTotal: input.grandTotal,
      paidTotal: input.paidTotal,
      status: input.status,
    },
    remarks: `Sale finalized ${input.invoiceNumber}`,
  };
}

export function buildSaleFinalizationAuditRow(
  input: Parameters<typeof saleFinalizationAuditInput>[0],
): Record<string, unknown> {
  return buildAuditRow(saleFinalizationAuditInput(input));
}

export function assertInvoiceActionSupported(action: InvoiceAction): void {
  const supported: InvoiceAction[] = [
    "save",
    "print_a4",
    "print_80mm",
    "print_58mm",
    "download_pdf",
    "whatsapp",
    "email",
  ];
  if (!supported.includes(action)) {
    throw new Error(`Unsupported invoice action: ${action}`);
  }
}
