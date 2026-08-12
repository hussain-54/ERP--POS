import type { PaymentStatus, SaleManagementTab, SaleStatus } from "@electronic-erp/contracts";

export type SaleManagementRow = {
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  grandTotal: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  paidTotal: number;
  remainingTotal: number;
  customerId?: string | null;
};

export type SaleManagementSummary = {
  totalSales: number;
  totalInvoices: number;
  netSales: number;
  totalDiscount: number;
  totalTax: number;
  pendingAmount: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Tab predicates for sales register views. */
export function matchesSaleManagementTab(row: SaleManagementRow, tab: SaleManagementTab): boolean {
  switch (tab) {
    case "all":
      return row.status !== "draft" && row.status !== "held";
    case "completed":
      return row.status === "posted" && row.paymentStatus === "paid";
    case "credit":
      return (
        row.status === "posted" &&
        row.remainingTotal > 0 &&
        Boolean(row.customerId) &&
        row.paymentStatus !== "paid"
      );
    case "partial":
      return row.status === "posted" && row.paymentStatus === "partial";
    case "cancelled":
      return row.status === "void";
    case "pending":
      return (
        row.status === "draft" ||
        row.status === "held" ||
        (row.status === "posted" && row.paymentStatus === "unpaid" && row.remainingTotal > 0)
      );
    default:
      return true;
  }
}

/** Dashboard KPIs from finalized (posted) sales in the current result set. */
export function summarizeSaleManagement(rows: SaleManagementRow[]): SaleManagementSummary {
  let totalSales = 0;
  let totalInvoices = 0;
  let netSales = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let pendingAmount = 0;

  for (const row of rows) {
    if (row.status !== "posted") continue;
    totalInvoices += 1;
    totalSales += row.grandTotal;
    netSales += row.subtotal - row.discountTotal;
    totalDiscount += row.discountTotal;
    totalTax += row.taxTotal;
    if (row.remainingTotal > 0) pendingAmount += row.remainingTotal;
  }

  return {
    totalSales: round(totalSales),
    totalInvoices,
    netSales: round(netSales),
    totalDiscount: round(totalDiscount),
    totalTax: round(totalTax),
    pendingAmount: round(pendingAmount),
  };
}

export function paginateItems<T>(items: T[], offset: number, limit: number): T[] {
  const start = Math.max(0, offset);
  const size = Math.max(1, limit);
  return items.slice(start, start + size);
}

export function salesManagementExportCsv(
  rows: Array<{
    invoiceNumber: string;
    dateTime: string;
    customerName?: string | null;
    cashierName?: string | null;
    salesmanName?: string | null;
    itemCount: number;
    grandTotal: number;
    paidTotal: number;
    remainingTotal: number;
    paymentMethods?: string | null;
    status: string;
    paymentStatus: string;
  }>,
): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = [
    "invoice",
    "date_time",
    "customer",
    "cashier",
    "salesman",
    "items",
    "total",
    "paid",
    "remaining",
    "payment_method",
    "status",
    "payment_status",
  ];
  const lines = rows.map((r) =>
    [
      r.invoiceNumber,
      r.dateTime,
      r.customerName ?? "",
      r.cashierName ?? "",
      r.salesmanName ?? "",
      r.itemCount,
      r.grandTotal,
      r.paidTotal,
      r.remainingTotal,
      r.paymentMethods ?? "",
      r.status,
      r.paymentStatus,
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
