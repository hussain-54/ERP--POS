import { buildInstallmentPlan, installmentPlanProgress } from "@electronic-erp/domain";
import type { POSBadgeTone } from "./design-system";

export const INSTALLMENT_PLAN_COLUMNS = [
  "Plan #",
  "Customer",
  "Invoice",
  "Total Amount",
  "Paid",
  "Remaining",
  "Next Due Date",
  "Status",
] as const;

export const INSTALLMENT_LINE_COLUMNS = [
  "Installment #",
  "Due Date",
  "Amount",
  "Paid",
  "Remaining",
  "Status",
] as const;

export type InstallmentPlanRow = {
  id: string;
  planNumber: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  totalAmount: number;
  paid: number;
  remaining: number;
  nextDueDate: string | null;
  status: string;
  lines: ReturnType<typeof installmentPlanProgress>["lines"];
};

export function planDisplayNumber(id: string): string {
  return `PLAN-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function installmentStatusTone(status: string): POSBadgeTone {
  if (status === "paid" || status === "completed" || status === "active") return "success";
  if (status === "overdue" || status === "defaulted") return "danger";
  if (status === "cancelled" || status === "waived") return "neutral";
  if (status === "partial") return "warning";
  return "primary";
}

export function parseInstallmentSchedule(raw: unknown) {
  const items = Array.isArray(raw) ? raw : [];
  return items.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      sequenceNo: Number(row.sequenceNo ?? row.sequence_no ?? 0) || 0,
      dueDate: String(row.dueDate ?? row.due_date ?? ""),
      amount: String(row.amount ?? "0"),
      paidAmount: String(row.paidAmount ?? row.paid_amount ?? "0"),
      status: String(row.status ?? "pending"),
    };
  });
}

export function parseInstallmentPlanRow(
  row: Record<string, unknown>,
  asOfDate: string,
): InstallmentPlanRow {
  const id = String(row.id ?? "");
  const progress = installmentPlanProgress({
    totalAmount: String(row.total_amount ?? row.totalAmount ?? "0"),
    downPayment: String(row.down_payment ?? row.downPayment ?? "0"),
    planStatus: String(row.status ?? "active"),
    schedule: parseInstallmentSchedule(row.schedule ?? row.installment_schedule),
    asOfDate,
  });
  return {
    id,
    planNumber: planDisplayNumber(id),
    customerId: String(row.customer_id ?? row.customerId ?? ""),
    customerName: String(row.customerName ?? row.customer_name ?? "Customer"),
    invoiceNumber: String(row.invoiceNumber ?? row.invoice_number ?? "") || "—",
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0) || 0,
    paid: Number(progress.paid) || 0,
    remaining: Number(progress.remaining) || 0,
    nextDueDate: progress.nextDueDate,
    status: progress.status,
    lines: progress.lines,
  };
}

export function previewInstallmentSchedule(input: {
  totalAmount: string;
  downPayment: string;
  installmentCount: number;
  startDate: string;
  frequency?: "weekly" | "biweekly" | "monthly" | "quarterly";
}) {
  return buildInstallmentPlan(input);
}
