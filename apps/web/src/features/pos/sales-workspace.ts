import type { PaymentStatus, SaleManagementTab, SaleStatus } from "@electronic-erp/contracts";
import type { InvoiceAction } from "@electronic-erp/domain";
import type { POSBadgeTone } from "./design-system";

export type SaleTab = SaleManagementTab;

export type SaleRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  postedAt?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  cashierName?: string | null;
  salesmanName?: string | null;
  itemCount?: number;
  grandTotal: number;
  paidTotal: number;
  remainingTotal: number;
  paymentMethods?: string | null;
  status: SaleStatus | string;
  paymentStatus: PaymentStatus | string;
  deviceId?: string | null;
  branchId?: string;
};

export type SaleSummary = {
  totalSales: number;
  totalInvoices: number;
  netSales: number;
  totalDiscount: number;
  totalTax: number;
  pendingAmount: number;
};

export const SALE_TABS: Array<{ id: SaleTab; label: string }> = [
  { id: "all", label: "All Sales" },
  { id: "completed", label: "Completed" },
  { id: "credit", label: "Credit Sales" },
  { id: "partial", label: "Partial Payments" },
  { id: "cancelled", label: "Cancelled" },
  { id: "pending", label: "Pending" },
];

export const INVOICE_TABLE_COLUMNS = [
  "Invoice #",
  "Date / Time",
  "Customer",
  "Cashier",
  "Salesman",
  "Items",
  "Total Amount",
  "Paid Amount",
  "Remaining",
  "Payment Method",
  "Status",
  "Action",
] as const;

export const SALE_STATUS_FILTERS: Array<{ value: SaleStatus | ""; label: string }> = [
  { value: "", label: "Any status" },
  { value: "posted", label: "posted" },
  { value: "void", label: "void" },
  { value: "returned", label: "returned" },
  { value: "exchanged", label: "exchanged" },
];

/** Invoice actions the receipt renderer actually implements. */
export const SUPPORTED_INVOICE_ACTIONS: InvoiceAction[] = [
  "save",
  "print_a4",
  "print_80mm",
  "print_58mm",
  "download_pdf",
  "whatsapp",
  "email",
];

export function defaultSalesDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatSaleDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function parseSaleRow(row: Record<string, unknown>): SaleRow {
  return {
    id: String(row.id ?? ""),
    invoiceNumber: String(row.invoiceNumber ?? row.invoice_number ?? ""),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    postedAt: (row.postedAt as string | null | undefined) ?? (row.posted_at as string | null) ?? null,
    customerName: (row.customerName as string | null | undefined) ?? null,
    customerMobile: (row.customerMobile as string | null | undefined) ?? null,
    cashierName: (row.cashierName as string | null | undefined) ?? null,
    salesmanName: (row.salesmanName as string | null | undefined) ?? null,
    itemCount: Number(row.itemCount ?? row.item_count ?? 0) || 0,
    grandTotal: Number(row.grandTotal ?? row.grand_total ?? 0) || 0,
    paidTotal: Number(row.paidTotal ?? row.paid_total ?? 0) || 0,
    remainingTotal: Number(row.remainingTotal ?? row.remaining_total ?? 0) || 0,
    paymentMethods: (row.paymentMethods as string | null | undefined) ?? null,
    status: String(row.status ?? "posted"),
    paymentStatus: String(row.paymentStatus ?? row.payment_status ?? "unpaid"),
    deviceId: (row.deviceId as string | null | undefined) ?? (row.device_id as string | null) ?? null,
    branchId: row.branchId ? String(row.branchId) : row.branch_id ? String(row.branch_id) : undefined,
  };
}

export const SALE_PAGE_SIZE = 25;

export const SALE_KPI_CARDS = [
  { id: "totalSales", label: "Total Sales", tone: "neutral" as const },
  { id: "totalInvoices", label: "Total Invoices", tone: "neutral" as const },
  { id: "netSales", label: "Net Sales", tone: "neutral" as const },
  { id: "totalDiscount", label: "Total Discount", tone: "neutral" as const },
  { id: "totalTax", label: "Total Tax", tone: "neutral" as const },
  { id: "pendingAmount", label: "Pending Amount", tone: "warning" as const },
] as const;

export type SaleFilterState = {
  dateFrom: string;
  dateTo: string;
  search: string;
  customerId: string;
  cashierUserId: string;
  salesmanUserId: string;
  paymentMethodId: string;
  status: string;
  branchId: string;
  deviceId: string;
};

export function emptySaleFilters(branchId = ""): SaleFilterState {
  return {
    ...defaultSalesDates(),
    search: "",
    customerId: "",
    cashierUserId: "",
    salesmanUserId: "",
    paymentMethodId: "",
    status: "",
    branchId,
    deviceId: "",
  };
}

export function kpiDisplay(summary: SaleSummary | null, id: (typeof SALE_KPI_CARDS)[number]["id"]): string {
  if (id === "totalInvoices") return String(summary?.totalInvoices ?? 0);
  return formatMoney(summary?.[id] ?? 0);
}

export function saleColumnClassName(col: (typeof INVOICE_TABLE_COLUMNS)[number]): string {
  const bits: string[] = [];
  if (col === "Salesman" || col === "Payment Method") bits.push("hidden xl:table-cell");
  if (col === "Items" || col === "Paid Amount") bits.push("hidden lg:table-cell");
  if (col === "Remaining") bits.push("hidden md:table-cell");
  if (col === "Items" || col.includes("Amount") || col === "Remaining") bits.push("text-right");
  return bits.join(" ");
}

export function parseSaleSummary(raw: Record<string, unknown> | null | undefined): SaleSummary {
  return {
    totalSales: Number(raw?.totalSales ?? 0) || 0,
    totalInvoices: Number(raw?.totalInvoices ?? 0) || 0,
    netSales: Number(raw?.netSales ?? 0) || 0,
    totalDiscount: Number(raw?.totalDiscount ?? 0) || 0,
    totalTax: Number(raw?.totalTax ?? 0) || 0,
    pendingAmount: Number(raw?.pendingAmount ?? 0) || 0,
  };
}

export function saleRegisterBadge(
  status: string,
  paymentStatus: string,
): { label: string; tone: POSBadgeTone } {
  if (status === "void") return { label: "Cancelled", tone: "danger" };
  if (status === "returned") return { label: "Returned", tone: "neutral" };
  if (status === "exchanged") return { label: "Exchanged", tone: "neutral" };
  if (paymentStatus === "paid" || paymentStatus === "refunded") return { label: "Completed", tone: "success" };
  if (paymentStatus === "partial") return { label: "Partial", tone: "warning" };
  return { label: "Pending", tone: "warning" };
}

export function saleStatusTone(status: string, paymentStatus: string): POSBadgeTone {
  return saleRegisterBadge(status, paymentStatus).tone;
}

export function saleStatusLabel(status: string, paymentStatus: string): string {
  return saleRegisterBadge(status, paymentStatus).label;
}

export function customerLabel(row: Pick<SaleRow, "customerName">): string {
  return row.customerName?.trim() || "Walk-in";
}

export function terminalLabel(deviceId: string | null | undefined, names: Record<string, string>): string {
  if (!deviceId) return "—";
  if (names[deviceId]) return names[deviceId];
  return "Terminal";
}
