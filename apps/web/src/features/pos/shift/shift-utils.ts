export type ShiftView = {
  id: string;
  status: string;
  openingFloat: number;
  expectedCash: number;
  salesTotal: number;
  cashSalesTotal: number;
  expenseTotal: number;
  closingCounted: number | null;
  variance: number | null;
  openedAt: string | null;
  closedAt: string | null;
  openedBy: string | null;
  notes: string | null;
};

export type ShiftWorkspaceMode =
  | "dashboard"
  | "open"
  | "opening-cash"
  | "cash-in"
  | "cash-out"
  | "drawer"
  | "transfer"
  | "expenses"
  | "close"
  | "reconcile";

export function mapShiftRow(row: Record<string, unknown> | null): ShiftView | null {
  if (!row) return null;
  return {
    id: String(row.id),
    status: String(row.status ?? "open"),
    openingFloat: Number(row.opening_float ?? 0),
    expectedCash: Number(row.expected_cash ?? 0),
    salesTotal: Number(row.sales_total ?? 0),
    cashSalesTotal: Number(row.cash_sales_total ?? 0),
    expenseTotal: Number(row.expense_total ?? 0),
    closingCounted: row.closing_counted != null ? Number(row.closing_counted) : null,
    variance: row.variance != null ? Number(row.variance) : null,
    openedAt: row.opened_at ? String(row.opened_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    openedBy: row.opened_by ? String(row.opened_by) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

export function sumCashMovements(items: Array<Record<string, unknown>>) {
  let cashIn = 0;
  let cashOut = 0;
  for (const row of items) {
    const amount = Number(row.amount ?? 0);
    if (row.kind === "cash_in") cashIn += amount;
    if (row.kind === "cash_out") cashOut += amount;
  }
  return { cashIn, cashOut };
}

export function otherPaymentsTotal(shift: ShiftView): number {
  return Math.max(0, shift.salesTotal - shift.cashSalesTotal);
}

export function shiftDifference(actual: number, expected: number): number {
  return Math.round((actual - expected) * 100) / 100;
}

export function formatShiftDuration(openedAt: string | null): string {
  if (!openedAt) return "—";
  const ms = Date.now() - new Date(openedAt).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function reconciliationLines(shift: ShiftView, cashIn: number, cashOut: number) {
  return [
    { label: "Opening cash", value: shift.openingFloat },
    { label: "Cash sales", value: shift.cashSalesTotal },
    { label: "Other payments (non-cash sales)", value: otherPaymentsTotal(shift) },
    { label: "Cash in", value: cashIn },
    { label: "Cash out", value: cashOut },
    { label: "Expected cash", value: shift.expectedCash, emphasis: true },
  ];
}
