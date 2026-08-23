/** Date filter presets for the POS sales register. */

export type SalesDatePreset = "today" | "yesterday" | "week" | "month" | "custom";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolveSalesDateRange(
  preset: SalesDatePreset,
  customFrom?: string,
  customTo?: string,
): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  if (preset === "custom") {
    return {
      dateFrom: customFrom || undefined,
      dateTo: customTo || undefined,
    };
  }
  if (preset === "today") {
    return { dateFrom: toDateInput(now), dateTo: toDateInput(now) };
  }
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { dateFrom: toDateInput(y), dateTo: toDateInput(y) };
  }
  if (preset === "week") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 6);
    return { dateFrom: toDateInput(from), dateTo: toDateInput(endOfDay(now)) };
  }
  // month
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: toDateInput(from), dateTo: toDateInput(now) };
}

export const SALES_DATE_PRESETS: Array<{ id: SalesDatePreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];
