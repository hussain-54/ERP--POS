import {
  isRecordOnlyPaymentKind,
  paymentDisplayLabel,
  paymentDisplayStatus,
  PAYMENT_DISPLAY_STATUS_LABEL,
  type PaymentDisplayStatus,
  type PaymentRegisterSummary,
} from "@electronic-erp/domain";
import type { POSBadgeTone } from "./design-system";

export const PAYMENT_TABLE_COLUMNS = [
  "Payment #",
  "Date / Time",
  "Invoice #",
  "Customer",
  "Amount",
  "Payment Method",
  "Cashier",
  "Reference",
  "Status",
  "Action",
] as const;

export const PAYMENT_STATUS_FILTERS: Array<{ value: PaymentDisplayStatus | ""; label: string }> = [
  { value: "", label: "Any status" },
  { value: "recorded", label: "Recorded" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "reversed", label: "Reversed" },
];

export type PaymentSplitView = {
  amount: number;
  reference: string | null;
  paymentMethodId: string;
  methodName: string;
  methodKind: string;
};

export type PaymentRow = {
  id: string;
  receiptNumber: string | null;
  occurredAt: string;
  createdAt: string;
  status: string;
  syncState: string;
  totalAmount: number;
  reference: string | null;
  notes: string | null;
  customerId: string | null;
  customerName: string | null;
  cashierName: string | null;
  invoiceNumber: string | null;
  paymentMethods: string | null;
  deviceId: string | null;
  branchId: string;
  direction: string;
  splits: PaymentSplitView[];
};

export function defaultPaymentDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function parsePaymentSummary(raw: Record<string, unknown> | null | undefined): PaymentRegisterSummary {
  return {
    recordedCount: Number(raw?.recordedCount ?? 0) || 0,
    recordedAmount: Number(raw?.recordedAmount ?? 0) || 0,
    pendingCount: Number(raw?.pendingCount ?? 0) || 0,
    failedCount: Number(raw?.failedCount ?? 0) || 0,
    reversedCount: Number(raw?.reversedCount ?? 0) || 0,
    todayCount: Number(raw?.todayCount ?? 0) || 0,
    todayAmount: Number(raw?.todayAmount ?? 0) || 0,
  };
}

export function parsePaymentRow(row: Record<string, unknown>): PaymentRow {
  const splitsRaw = Array.isArray(row.splits) ? row.splits : [];
  const splits: PaymentSplitView[] = [];
  for (const raw of splitsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    splits.push({
      amount: Number(s.amount ?? 0) || 0,
      reference: (s.reference as string | null) ?? null,
      paymentMethodId: String(s.paymentMethodId ?? ""),
      methodName: String(s.methodName ?? "Payment"),
      methodKind: String(s.methodKind ?? ""),
    });
  }
  return {
    id: String(row.id ?? ""),
    receiptNumber: (row.receiptNumber as string | null) ?? null,
    occurredAt: String(row.occurredAt ?? row.occurred_at ?? ""),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    status: String(row.status ?? "posted"),
    syncState: String(row.syncState ?? row.sync_state ?? "synced"),
    totalAmount: Number(row.totalAmount ?? row.total_amount ?? 0) || 0,
    reference: (row.reference as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    customerId: row.customerId ? String(row.customerId) : row.customer_id ? String(row.customer_id) : null,
    customerName: (row.customerName as string | null) ?? null,
    cashierName: (row.cashierName as string | null) ?? null,
    invoiceNumber: (row.invoiceNumber as string | null) ?? null,
    paymentMethods: (row.paymentMethods as string | null) ?? null,
    deviceId: (row.deviceId as string | null | undefined) ?? (row.device_id as string | null) ?? null,
    branchId: String(row.branchId ?? row.branch_id ?? ""),
    direction: String(row.direction ?? "receive"),
    splits,
  };
}

export function paymentNumber(row: Pick<PaymentRow, "receiptNumber" | "occurredAt">): string {
  const label = row.receiptNumber?.trim();
  if (label) return label;
  if (row.occurredAt) {
    const t = new Date(row.occurredAt);
    if (!Number.isNaN(t.getTime())) {
      return `Payment ${t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
  }
  return "Payment";
}

export function paymentStatusTone(row: Pick<PaymentRow, "status" | "syncState">): POSBadgeTone {
  const view = paymentDisplayStatus(row);
  if (view === "recorded") return "success";
  if (view === "pending") return "warning";
  if (view === "failed") return "danger";
  return "neutral";
}

export function paymentStatusText(row: Pick<PaymentRow, "status" | "syncState">): string {
  return paymentDisplayLabel(row);
}

export function paymentBackendHint(row: Pick<PaymentRow, "status" | "syncState">): string {
  return `${row.status} · ${row.syncState}`;
}

export function methodSettlementNote(kind: string): string | null {
  if (isRecordOnlyPaymentKind(kind)) {
    return "Recorded locally — no gateway settlement";
  }
  if (kind === "credit" || kind === "installment") {
    return "Credit/installment — does not collect cash";
  }
  return null;
}

export function rowHasRecordOnlyMethod(row: PaymentRow): boolean {
  return row.splits.some((s) => isRecordOnlyPaymentKind(s.methodKind));
}

export { PAYMENT_DISPLAY_STATUS_LABEL, isRecordOnlyPaymentKind, paymentDisplayStatus };
