export type RegisterAction = "open" | "close" | "cash_count" | "reconcile";

/** Backend-backed shift actions only. Cash in/out have no POS API. */
export const SUPPORTED_REGISTER_ACTIONS: RegisterAction[] = [
  "open",
  "close",
  "cash_count",
  "reconcile",
];

export type CashShift = {
  id: string;
  status: string;
  branchId: string;
  openedBy: string | null;
  closedBy: string | null;
  openingFloat: number;
  salesTotal: number;
  cashSalesTotal: number;
  expenseTotal: number;
  expectedCash: number | null;
  variance: number | null;
  closingCounted: number | null;
  notes: string | null;
  openedAt: string | null;
  closedAt: string | null;
};

function num(row: Record<string, unknown>, camel: string, snake: string): number | null {
  const v = row[camel] ?? row[snake];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(row: Record<string, unknown>, camel: string, snake: string): string | null {
  const v = row[camel] ?? row[snake];
  if (v == null || v === "") return null;
  return String(v);
}

export function parseCashShift(row: Record<string, unknown> | null | undefined): CashShift | null {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id ?? "");
  if (!id) return null;
  return {
    id,
    status: String(row.status ?? "open"),
    branchId: String(row.branchId ?? row.branch_id ?? ""),
    openedBy: str(row, "openedBy", "opened_by"),
    closedBy: str(row, "closedBy", "closed_by"),
    openingFloat: num(row, "openingFloat", "opening_float") ?? 0,
    salesTotal: num(row, "salesTotal", "sales_total") ?? 0,
    cashSalesTotal: num(row, "cashSalesTotal", "cash_sales_total") ?? 0,
    expenseTotal: num(row, "expenseTotal", "expense_total") ?? 0,
    expectedCash: num(row, "expectedCash", "expected_cash"),
    variance: num(row, "variance", "variance"),
    closingCounted: num(row, "closingCounted", "closing_counted"),
    notes: str(row, "notes", "notes"),
    openedAt: str(row, "openedAt", "opened_at"),
    closedAt: str(row, "closedAt", "closed_at"),
  };
}

export function formatRegisterMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function registerVariance(counted: number | null, expected: number | null): number | null {
  if (counted == null || expected == null || !Number.isFinite(counted) || !Number.isFinite(expected)) {
    return null;
  }
  return Math.round((counted - expected) * 100) / 100;
}

export const REGISTER_METRIC_LABELS = [
  "Current Register",
  "Branch",
  "Terminal",
  "Cashier",
  "Shift",
  "Opening Balance",
  "Current Cash",
  "Cash Sales",
  "Card Sales",
  "Other Payments",
  "Refunds",
  "Expected Cash",
  "Variance",
] as const;
