import {
  calculatePosCartTotals,
  enrichHeldSale,
  filterHeldSales,
  lineTotal,
  type HeldSaleFilter,
  type HeldSaleLifecycleView,
  type HeldSaleRecord,
  type PosCartLine,
} from "@electronic-erp/domain";

/** Navigation payload from Hold / Resume or POS support screens into New Sale — not persisted. */
export type PosHoldNavigationState = {
  resumeSnapshot?: Record<string, unknown>;
  checkout?: boolean;
  openHolds?: boolean;
  salesmanUserId?: string;
  commissionPercent?: number;
  referenceId?: string;
};

export type HoldTab = "all_pending" | "active" | "expiring" | "expired" | "today";

export type HoldStats = {
  active: number;
  expiring: number;
  expired: number;
  today: number;
  mine: number;
  totalValue: number;
};

const HOLD_TABS: Array<{ id: HoldTab; label: string }> = [
  { id: "all_pending", label: "All Holds" },
  { id: "active", label: "Active Holds" },
  { id: "expiring", label: "Expiring Soon" },
  { id: "expired", label: "Expired" },
  { id: "today", label: "Today's Holds" },
];

export { HOLD_TABS };

export function parseHeldSale(row: Record<string, unknown>): HeldSaleRecord {
  const snapshot =
    row.cartSnapshot && typeof row.cartSnapshot === "object"
      ? (row.cartSnapshot as Record<string, unknown>)
      : row.cart_snapshot && typeof row.cart_snapshot === "object"
        ? (row.cart_snapshot as Record<string, unknown>)
        : {};
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organizationId ?? row.organization_id ?? ""),
    branchId: String(row.branchId ?? row.branch_id ?? ""),
    saleId: String(row.saleId ?? row.sale_id ?? ""),
    holdLabel: (row.holdLabel as string | null | undefined) ?? (row.hold_label as string | null) ?? null,
    holdReason: (row.holdReason as string | null | undefined) ?? (row.hold_reason as string | null) ?? null,
    notes: (row.notes as string | null | undefined) ?? null,
    heldBy: (row.heldBy as string | null | undefined) ?? (row.held_by as string | null) ?? null,
    customerId: (row.customerId as string | null | undefined) ?? (row.customer_id as string | null) ?? null,
    customerName: (row.customerName as string | null | undefined) ?? null,
    cartSnapshot: snapshot,
    heldAt: String(row.heldAt ?? row.held_at ?? ""),
    expiresAt: (row.expiresAt as string | null | undefined) ?? (row.expires_at as string | null) ?? null,
    resumedAt: (row.resumedAt as string | null | undefined) ?? (row.resumed_at as string | null) ?? null,
    status: (row.status as HeldSaleRecord["status"]) ?? "held",
    deviceId: (row.deviceId as string | null | undefined) ?? (row.device_id as string | null) ?? null,
  };
}

export function viewHeldSale(row: Record<string, unknown>, now = new Date()): HeldSaleLifecycleView {
  return enrichHeldSale(parseHeldSale(row), now);
}

export function holdNumber(hold: Pick<HeldSaleRecord, "holdLabel" | "heldAt">): string {
  const label = hold.holdLabel?.trim();
  if (label) return label;
  if (hold.heldAt) {
    const t = new Date(hold.heldAt);
    if (!Number.isNaN(t.getTime())) {
      return `Hold ${t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
  }
  return "Hold";
}

export function holdStatusLabel(hold: HeldSaleLifecycleView): string {
  if (hold.status === "expired" || hold.bucket === "expired") return "Expired";
  if (hold.bucket === "expiring") return "Expiring soon";
  if (hold.status === "cancelled") return "Cancelled";
  if (hold.status === "discarded") return "Discarded";
  if (hold.status === "resumed") return "Resumed";
  return "Active";
}

export function holdStatusTone(
  hold: HeldSaleLifecycleView,
): "primary" | "warning" | "danger" | "neutral" | "success" {
  if (hold.status === "expired" || hold.bucket === "expired") return "danger";
  if (hold.bucket === "expiring") return "warning";
  if (hold.status === "resumed") return "success";
  if (hold.status === "cancelled" || hold.status === "discarded") return "neutral";
  return "primary";
}

export function canResumeHold(hold: HeldSaleLifecycleView): boolean {
  return hold.status === "held" && hold.bucket !== "expired";
}

export function snapshotCartLines(snapshot: Record<string, unknown> | undefined): PosCartLine[] {
  const cart = snapshot?.cart;
  if (!Array.isArray(cart)) return [];
  const lines: PosCartLine[] = [];
  for (const raw of cart) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.name !== "string") continue;
    const qty = row.qty == null ? "1" : String(row.qty);
    const unitPrice = Number(row.unitPrice ?? 0);
    if (!Number.isFinite(unitPrice)) continue;
    lines.push({
      key: String(row.key ?? `${row.productId ?? row.name}-${lines.length}`),
      productId: typeof row.productId === "string" ? row.productId : undefined,
      name: row.name,
      nameUr: typeof row.nameUr === "string" ? row.nameUr : null,
      sku: typeof row.sku === "string" ? row.sku : null,
      unitId: typeof row.unitId === "string" ? row.unitId : "",
      unitName: typeof row.unitName === "string" ? row.unitName : null,
      qty,
      unitPrice,
      discount: Number(row.discount ?? 0) || 0,
      tax: Number(row.tax ?? 0) || 0,
      warrantyDays: Number(row.warrantyDays ?? 0) || 0,
      isManual: Boolean(row.isManual),
    });
  }
  return lines;
}

export function snapshotTotals(snapshot: Record<string, unknown> | undefined) {
  const lines = snapshotCartLines(snapshot);
  const invoiceDiscount =
    typeof snapshot?.invoiceDiscount === "string" || typeof snapshot?.invoiceDiscount === "number"
      ? snapshot.invoiceDiscount
      : "0";
  try {
    return calculatePosCartTotals(lines, invoiceDiscount);
  } catch {
    return null;
  }
}

export function lineAmount(line: PosCartLine): number {
  try {
    return lineTotal(line);
  } catch {
    return 0;
  }
}

export const HOLD_PAGE_SIZE = 25;

export const HOLD_TABLE_COLUMNS = [
  "Hold #",
  "Customer",
  "Cashier",
  "Items",
  "Total Amount",
  "Hold Time",
  "Reason",
  "Status",
  "Action",
] as const;

export const HOLD_KPI_CARDS = [
  { id: "active", label: "Active Holds", tab: "active" as HoldTab, mineOnly: false, tone: "neutral" as const },
  { id: "expiring", label: "Expiring Soon", tab: "expiring" as HoldTab, mineOnly: false, tone: "warning" as const },
  { id: "expired", label: "Expired Holds", tab: "expired" as HoldTab, mineOnly: false, tone: "danger" as const },
  { id: "today", label: "Today's Holds", tab: "today" as HoldTab, mineOnly: false, tone: "neutral" as const },
  { id: "mine", label: "Your Holds", tab: "all_pending" as HoldTab, mineOnly: true, tone: "primary" as const },
  { id: "value", label: "Total Held Value", tab: "all_pending" as HoldTab, mineOnly: false, tone: "primary" as const },
] as const;

export function parkedHoldValue(holds: HeldSaleRecord[], now = new Date()): number {
  const parked = [
    ...filterHeldSales(holds, "active", { now }),
    ...filterHeldSales(holds, "expiring", { now }),
  ];
  let total = 0;
  for (const hold of parked) {
    total += snapshotTotals(hold.cartSnapshot)?.grand ?? 0;
  }
  return total;
}

export function computeHoldStats(holds: HeldSaleRecord[], userId?: string | null, now = new Date()): HoldStats {
  return {
    active: filterHeldSales(holds, "active", { now }).length,
    expiring: filterHeldSales(holds, "expiring", { now }).length,
    expired: filterHeldSales(holds, "expired", { now }).length,
    today: filterHeldSales(holds, "today", { now }).length,
    mine: userId ? filterHeldSales(holds, "mine", { now, userId }).length : 0,
    totalValue: parkedHoldValue(holds, now),
  };
}

export function filterHoldTable(
  holds: HeldSaleRecord[],
  tab: HoldTab,
  opts: { mineOnly?: boolean; userId?: string | null; cashierId?: string | null; now?: Date } = {},
): HeldSaleLifecycleView[] {
  const now = opts.now ?? new Date();
  const filter: HeldSaleFilter = tab;
  let rows = filterHeldSales(holds, filter, { now, userId: opts.userId });
  if (opts.mineOnly && opts.userId) {
    rows = rows.filter((h) => h.heldBy === opts.userId);
  }
  if (opts.cashierId) {
    rows = rows.filter((h) => h.heldBy === opts.cashierId);
  }
  return rows;
}

export function paginateHoldRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number = HOLD_PAGE_SIZE,
): { items: T[]; page: number; pageCount: number; total: number } {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), page: safePage, pageCount, total };
}

export function snapshotCustomerName(snapshot: Record<string, unknown> | undefined): string | null {
  if (!snapshot) return null;
  const name = snapshot.customerName ?? snapshot.customer_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export function uniqueHoldIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function displayCustomerName(
  hold: Pick<HeldSaleLifecycleView, "customerName" | "customerId" | "cartSnapshot">,
  names: Record<string, string>,
): string {
  if (hold.customerName?.trim()) return hold.customerName.trim();
  const fromSnap = snapshotCustomerName(hold.cartSnapshot);
  if (fromSnap) return fromSnap;
  if (hold.customerId && names[hold.customerId]) return names[hold.customerId];
  if (!hold.customerId) return "Walk-in";
  return "Customer";
}

export function displayCashierName(
  hold: Pick<HeldSaleLifecycleView, "heldBy">,
  names: Record<string, string>,
): string {
  if (hold.heldBy && names[hold.heldBy]) return names[hold.heldBy];
  if (!hold.heldBy) return "—";
  return "Cashier";
}

export function matchesHoldSearch(
  hold: HeldSaleLifecycleView,
  query: string,
  extras: { customerName?: string | null; cashierName?: string | null },
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    holdNumber(hold),
    hold.holdLabel,
    hold.holdReason,
    hold.customerName,
    extras.customerName,
    extras.cashierName,
    hold.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}
