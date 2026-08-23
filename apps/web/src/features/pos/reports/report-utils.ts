import type { ReportFilterInput } from "@/features/reports/reporting-api";
import { reportingApi } from "@/features/reports/reporting-api";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { posApi } from "../api";
import type { ReportRow } from "./report-view";
import { mapNamedRows, recordRows } from "./report-view";

export type PosReportMode =
  | "sales"
  | "cashier"
  | "branch"
  | "terminal"
  | "products"
  | "categories"
  | "payments"
  | "discounts"
  | "returns"
  | "refunds"
  | "voids"
  | "shifts"
  | "cash"
  | "tax"
  | "margin";

export const POS_REPORT_META: Record<
  PosReportMode,
  { title: string; description: string; unavailable?: string }
> = {
  sales: { title: "Sales report", description: "Daily sales totals for the selected period." },
  cashier: { title: "Cashier report", description: "Sales grouped by salesman / cashier user id." },
  branch: { title: "Branch report", description: "Sales grouped by branch." },
  terminal: {
    title: "Terminal report",
    description: "Per-terminal sales performance.",
    unavailable: "Per-terminal reporting is not exposed by the reporting API yet.",
  },
  products: { title: "Product sales", description: "Revenue by product for the selected period." },
  categories: { title: "Category sales", description: "Revenue by category for the selected period." },
  payments: { title: "Payment report", description: "Cash, credit, and installment mix from posted sales." },
  discounts: {
    title: "Discount report",
    description: "Discounts issued at POS.",
    unavailable: "A dedicated discount report API is not available. Use Pricing & Discounts or completed sales detail.",
  },
  returns: { title: "Return report", description: "Posted returns from the POS returns API." },
  refunds: { title: "Refund report", description: "Refund amounts from posted returns." },
  voids: { title: "Void report", description: "Cancelled / voided sales in the selected period." },
  shifts: { title: "Shift report", description: "Day-close preview totals for the active branch." },
  cash: { title: "Cash report", description: "Fully paid cash sales in the selected period." },
  tax: { title: "Tax report", description: "Tax documents and totals from the tax module." },
  margin: { title: "Profit / margin", description: "Gross profit and margin by product." },
};

type ReportPayload = {
  metrics: Array<{ label: string; value: string; hint?: string }>;
  rows: ReportRow[];
  note?: string;
};

function filterWithBranch(filter: ReportFilterInput, branchId?: string | null): ReportFilterInput {
  return { ...filter, branchId: branchId ?? filter.branchId ?? undefined };
}

export async function loadPosReport(
  mode: PosReportMode,
  filter: ReportFilterInput,
  branchId?: string | null,
): Promise<ReportPayload> {
  const scoped = filterWithBranch(filter, branchId);

  if (mode === "sales") {
    const data = (await reportingApi.sales("daily", scoped)) as {
      rows?: unknown;
      totals?: { sales?: number; lines?: number };
    };
    return {
      metrics: [
        { label: "Sales total", value: String(data.totals?.sales ?? 0) },
        { label: "Line count", value: String(data.totals?.lines ?? 0) },
      ],
      rows: mapNamedRows(data.rows),
    };
  }

  if (mode === "cashier") {
    const data = (await reportingApi.sales("salesman", scoped)) as { rows?: unknown; totals?: { sales?: number } };
    return {
      metrics: [{ label: "Sales total", value: String(data.totals?.sales ?? 0) }],
      rows: mapNamedRows(data.rows),
    };
  }

  if (mode === "branch") {
    const data = (await reportingApi.sales("branch", scoped)) as { rows?: unknown; totals?: { sales?: number } };
    return {
      metrics: [{ label: "Sales total", value: String(data.totals?.sales ?? 0) }],
      rows: mapNamedRows(data.rows),
    };
  }

  if (mode === "products") {
    const data = (await reportingApi.sales("product", scoped)) as { rows?: unknown; totals?: { sales?: number } };
    return {
      metrics: [{ label: "Sales total", value: String(data.totals?.sales ?? 0) }],
      rows: mapNamedRows(data.rows),
    };
  }

  if (mode === "categories") {
    const data = (await reportingApi.sales("category", scoped)) as { rows?: unknown; totals?: { sales?: number } };
    return {
      metrics: [{ label: "Sales total", value: String(data.totals?.sales ?? 0) }],
      rows: mapNamedRows(data.rows),
    };
  }

  if (mode === "payments") {
    const [cash, credit, installment] = await Promise.all([
      reportingApi.sales("cash", scoped),
      reportingApi.sales("credit", scoped),
      reportingApi.sales("installment", scoped),
    ]);
    const rows = [
      ...mapNamedRows((cash as { rows?: unknown }).rows),
      ...mapNamedRows((credit as { rows?: unknown }).rows),
      ...mapNamedRows((installment as { rows?: unknown }).rows),
    ];
    const total = rows.reduce((a, r) => a + r.amount, 0);
    return {
      metrics: [{ label: "Combined amount", value: total.toFixed(2) }],
      rows,
      note: "Payment mix is derived from posted sale payment status — not live PSP settlement.",
    };
  }

  if (mode === "cash") {
    const data = (await reportingApi.sales("cash", scoped)) as { rows?: unknown; totals?: { sales?: number } };
    return {
      metrics: [{ label: "Cash / paid total", value: String(data.totals?.sales ?? 0) }],
      rows: mapNamedRows(data.rows),
    };
  }

  if (mode === "margin") {
    const data = (await reportingApi.profit("margin", scoped)) as {
      rows?: unknown;
      totals?: { revenue?: number; cost?: number; grossProfit?: number };
    };
    return {
      metrics: [
        { label: "Revenue", value: String(data.totals?.revenue ?? 0) },
        { label: "Cost", value: String(data.totals?.cost ?? 0) },
        { label: "Gross profit", value: String(data.totals?.grossProfit ?? 0) },
      ],
      rows: mapNamedRows(data.rows),
    };
  }

  if (mode === "returns" || mode === "refunds") {
    const data = await posApi.returnReport({
      branchId: scoped.branchId ?? undefined,
      dateFrom: scoped.from,
      dateTo: scoped.to,
    });
    const summary = data.summary as {
      count?: number;
      totalRefundAmount?: number;
      byDisposition?: Record<string, number>;
      byScope?: Record<string, number>;
      byReason?: Record<string, number>;
    };
    if (mode === "refunds") {
      const refundRows = recordRows(summary.byDisposition ?? {}, "Refund · ");
      return {
        metrics: [
          { label: "Returns", value: String(summary.count ?? 0) },
          { label: "Refund total", value: String(summary.totalRefundAmount ?? 0) },
        ],
        rows: refundRows,
      };
    }
    return {
      metrics: [
        { label: "Returns", value: String(summary.count ?? 0) },
        { label: "Refund total", value: String(summary.totalRefundAmount ?? 0) },
      ],
      rows: [
        ...recordRows(summary.byScope ?? {}, "Scope · "),
        ...recordRows(summary.byReason ?? {}, "Reason · "),
      ],
    };
  }

  if (mode === "voids") {
    if (!branchId) return { metrics: [], rows: [] };
    const res = await posApi.searchSalesManagement({
      branchId,
      tab: "cancelled",
      dateFrom: scoped.from,
      dateTo: scoped.to,
      limit: 200,
      offset: 0,
    });
    const total = res.items.reduce((a, s) => a + Number(s.grandTotal ?? 0), 0);
    return {
      metrics: [
        { label: "Void / cancelled", value: String(res.items.length) },
        { label: "Grand total", value: total.toFixed(2) },
      ],
      rows: res.items.map((s) => ({
        key: s.id,
        label: s.invoiceNumber ?? s.id.slice(0, 8),
        amount: Number(s.grandTotal ?? 0),
        qty: 1,
      })),
    };
  }

  if (mode === "shifts") {
    if (!branchId) return { metrics: [], rows: [] };
    const preview = await posApi.previewDayClose(branchId);
    const totals = preview.totals ?? {};
    const rows = Object.entries(totals).map(([key, value]) => ({
      key,
      label: key.replace(/_/g, " "),
      amount: typeof value === "number" ? value : Number(value ?? 0),
    }));
    return {
      metrics: rows.slice(0, 4).map((r) => ({ label: r.label, value: r.amount.toFixed(2) })),
      rows,
      note: "Day-close preview totals — not a historical shift archive.",
    };
  }

  if (mode === "tax") {
    const data = await enterpriseApi.taxReport();
    const recent = Array.isArray(data.recent) ? data.recent : [];
    return {
      metrics: [
        { label: "Documents", value: String(data.documentCount ?? 0) },
        { label: "Taxable", value: String(data.taxableTotal ?? 0) },
        { label: "Tax collected", value: String(data.taxTotal ?? 0) },
        {
          label: "FBR integration",
          value: data.fbrIntegration ? "Enabled" : "Not live",
          hint: typeof data.note === "string" ? data.note : undefined,
        },
      ],
      rows: recent.map((doc) => {
        const row = doc as Record<string, unknown>;
        return {
          key: String(row.id ?? row.document_type ?? Math.random()),
          label: String(row.document_type ?? row.documentType ?? "tax document"),
          amount: Number(row.tax_amount ?? row.taxAmount ?? 0),
          meta: { grandTotal: Number(row.grand_total ?? row.grandTotal ?? 0) },
        };
      }),
    };
  }

  return { metrics: [], rows: [] };
}
