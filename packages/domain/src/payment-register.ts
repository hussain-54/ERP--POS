/**
 * Payment register display — maps stored payment fields.
 * Does not post, void, reverse, or talk to a payment gateway.
 */

export const RECORD_ONLY_PAYMENT_KINDS = [
  "card",
  "jazzcash",
  "easypaisa",
  "sadapay",
  "online",
  "other",
] as const;

export type PaymentDisplayStatus = "recorded" | "pending" | "failed" | "reversed";

export const PAYMENT_DISPLAY_STATUS_LABEL: Record<PaymentDisplayStatus, string> = {
  recorded: "Recorded",
  pending: "Pending",
  failed: "Failed",
  reversed: "Reversed",
};

export type PaymentRegisterRow = {
  id?: string;
  receiptNumber?: string | null;
  status?: string | null;
  syncState?: string | null;
  customerName?: string | null;
  invoiceNumber?: string | null;
  cashierName?: string | null;
  paymentMethods?: string | null;
  reference?: string | null;
  totalAmount?: string | number | null;
  occurredAt?: string | null;
};

/** Wallet/card/online kinds are stored receipts only — no PSP settlement. */
export function isRecordOnlyPaymentKind(kind: string | null | undefined): boolean {
  return (RECORD_ONLY_PAYMENT_KINDS as readonly string[]).includes(String(kind ?? "").toLowerCase());
}

/**
 * Display bucket from real `payments.status` + `payments.sync_state`.
 * void → Reversed; conflict/rejected → Failed; draft or pending sync → Pending; else Recorded.
 */
export function paymentDisplayStatus(row: {
  status?: string | null;
  syncState?: string | null;
}): PaymentDisplayStatus {
  const status = String(row.status ?? "");
  const sync = String(row.syncState ?? "synced");
  if (status === "void") return "reversed";
  if (sync === "conflict" || sync === "rejected") return "failed";
  if (status === "draft" || sync === "pending") return "pending";
  return "recorded";
}

export function paymentDisplayLabel(row: { status?: string | null; syncState?: string | null }): string {
  return PAYMENT_DISPLAY_STATUS_LABEL[paymentDisplayStatus(row)];
}

export function matchesPaymentRegister(
  row: PaymentRegisterRow,
  query?: string,
  view?: string,
): boolean {
  if (view?.trim()) {
    if (paymentDisplayStatus(row) !== view.trim()) return false;
  }
  const needle = query?.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.receiptNumber,
    row.invoiceNumber,
    row.customerName,
    row.cashierName,
    row.paymentMethods,
    row.reference,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export type PaymentRegisterSummary = {
  recordedCount: number;
  recordedAmount: number;
  pendingCount: number;
  failedCount: number;
  reversedCount: number;
  todayCount: number;
  todayAmount: number;
};

export function emptyPaymentSummary(): PaymentRegisterSummary {
  return {
    recordedCount: 0,
    recordedAmount: 0,
    pendingCount: 0,
    failedCount: 0,
    reversedCount: 0,
    todayCount: 0,
    todayAmount: 0,
  };
}

export function summarizePaymentRegister(
  rows: PaymentRegisterRow[],
  now = new Date(),
): PaymentRegisterSummary {
  const summary = emptyPaymentSummary();
  const today = now.toISOString().slice(0, 10);
  for (const row of rows) {
    const amount = Number(row.totalAmount ?? 0) || 0;
    const view = paymentDisplayStatus(row);
    if (view === "recorded") {
      summary.recordedCount += 1;
      summary.recordedAmount += amount;
    } else if (view === "pending") summary.pendingCount += 1;
    else if (view === "failed") summary.failedCount += 1;
    else summary.reversedCount += 1;
    const occurred = String(row.occurredAt ?? "").slice(0, 10);
    if (occurred === today) {
      summary.todayCount += 1;
      summary.todayAmount += amount;
    }
  }
  summary.recordedAmount = Math.round(summary.recordedAmount * 100) / 100;
  summary.todayAmount = Math.round(summary.todayAmount * 100) / 100;
  return summary;
}
