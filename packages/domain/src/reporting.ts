import type { ReportPeriodPreset } from "@electronic-erp/contracts";

export type DateRange = { from: string; to: string; label: string };

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function iso(d: Date): string {
  return d.toISOString();
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Resolve UI period presets into inclusive ISO date-time bounds (UTC). */
export function resolveDateRange(
  period: ReportPeriodPreset,
  from?: string | null,
  to?: string | null,
  now = new Date(),
): DateRange {
  const today = startOfUtcDay(now);
  if (period === "custom") {
    const f = from ? startOfUtcDay(new Date(`${from}T00:00:00.000Z`)) : startOfUtcDay(addUtcDays(today, -30));
    const t = to ? endOfUtcDay(new Date(`${to}T00:00:00.000Z`)) : endOfUtcDay(today);
    return { from: iso(f), to: iso(t), label: "custom" };
  }
  if (period === "today") {
    return { from: iso(today), to: iso(endOfUtcDay(today)), label: "today" };
  }
  if (period === "yesterday") {
    const y = addUtcDays(today, -1);
    return { from: iso(y), to: iso(endOfUtcDay(y)), label: "yesterday" };
  }
  if (period === "week") {
    const f = addUtcDays(today, -6);
    return { from: iso(f), to: iso(endOfUtcDay(today)), label: "week" };
  }
  if (period === "month") {
    const f = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: iso(startOfUtcDay(f)), to: iso(endOfUtcDay(today)), label: "month" };
  }
  // year
  const f = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  return { from: iso(startOfUtcDay(f)), to: iso(endOfUtcDay(today)), label: "year" };
}

/** Prior window of equal length immediately before `range`. */
export function previousPeriodRange(range: DateRange): DateRange {
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  const span = Math.max(to - from, 1);
  const prevTo = new Date(from - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from: iso(prevFrom), to: iso(prevTo), label: "previous" };
}

export function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcGrowthPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return money(((current - previous) / Math.abs(previous)) * 100);
}

export function calcMarginPct(revenue: number, cost: number): number {
  if (revenue === 0) return 0;
  return money(((revenue - cost) / revenue) * 100);
}

export function inventoryTurnover(cogs: number, avgInventoryValue: number): number {
  if (avgInventoryValue <= 0) return 0;
  return money(cogs / avgInventoryValue);
}

export type NamedAmount = { key: string; label: string; amount: number; qty?: number; meta?: Record<string, number | string> };

export function aggregateByKey(
  rows: Array<{ key: string; label: string; amount: number; qty?: number }>,
): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const r of rows) {
    const cur = map.get(r.key) ?? { key: r.key, label: r.label, amount: 0, qty: 0 };
    cur.amount = money(cur.amount + r.amount);
    cur.qty = money((cur.qty ?? 0) + (r.qty ?? 0));
    map.set(r.key, cur);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function rankTopBottom(
  rows: NamedAmount[],
  take = 10,
): { top: NamedAmount[]; bottom: NamedAmount[] } {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  return {
    top: sorted.slice(0, take),
    bottom: [...sorted].reverse().slice(0, take),
  };
}

export type SaleFact = {
  id: string;
  postedAt: string;
  branchId: string;
  warehouseId: string;
  customerId?: string | null;
  salesmanUserId?: string | null;
  grandTotal: number;
  paidTotal: number;
  remainingTotal: number;
  paymentStatus: string;
  costTotal: number;
};

export type SaleLineFact = {
  saleId: string;
  productId?: string | null;
  productName: string;
  brandId?: string | null;
  brandName?: string;
  categoryId?: string | null;
  categoryName?: string;
  qty: number;
  lineTotal: number;
  costTotal: number;
  postedAt: string;
  branchId: string;
  warehouseId: string;
  customerId?: string | null;
  salesmanUserId?: string | null;
};

export type PurchaseFact = {
  id: string;
  postedAt: string;
  branchId: string;
  warehouseId: string;
  supplierId: string;
  supplierName?: string;
  grandTotal: number;
  remainingTotal: number;
};

export type PurchaseLineFact = {
  purchaseId: string;
  productId: string;
  productName: string;
  brandId?: string | null;
  brandName?: string;
  categoryId?: string | null;
  categoryName?: string;
  qty: number;
  lineTotal: number;
  branchId: string;
  supplierId: string;
  supplierName?: string;
  postedAt: string;
};

export type StockFact = {
  productId: string;
  productName: string;
  brandId?: string | null;
  categoryId?: string | null;
  branchId: string;
  warehouseId: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyDamaged: number;
  qtyInTransit: number;
  reorderLevel: number;
  overstockLevel?: number | null;
  averageUnitCost: number;
};

export function filterSaleFacts(facts: SaleFact[], range: DateRange): SaleFact[] {
  const f = new Date(range.from).getTime();
  const t = new Date(range.to).getTime();
  return facts.filter((s) => {
    const at = new Date(s.postedAt).getTime();
    return at >= f && at <= t;
  });
}

export function filterSaleLines(facts: SaleLineFact[], range: DateRange): SaleLineFact[] {
  const f = new Date(range.from).getTime();
  const t = new Date(range.to).getTime();
  return facts.filter((s) => {
    const at = new Date(s.postedAt).getTime();
    return at >= f && at <= t;
  });
}

export function sumSales(facts: SaleFact[]): number {
  return money(facts.reduce((a, s) => a + s.grandTotal, 0));
}

export function sumPurchases(facts: PurchaseFact[]): number {
  return money(facts.reduce((a, s) => a + s.grandTotal, 0));
}

export function grossProfitFromLines(lines: SaleLineFact[]): number {
  return money(lines.reduce((a, l) => a + (l.lineTotal - l.costTotal), 0));
}

export function salesByDimension(
  lines: SaleLineFact[],
  sales: SaleFact[],
  dimension: string,
): NamedAmount[] {
  if (dimension === "daily") {
    return aggregateByKey(
      sales.map((s) => ({
        key: s.postedAt.slice(0, 10),
        label: s.postedAt.slice(0, 10),
        amount: s.grandTotal,
      })),
    );
  }
  if (dimension === "weekly") {
    return aggregateByKey(
      sales.map((s) => {
        const d = new Date(s.postedAt);
        const week = `${d.getUTCFullYear()}-W${String(Math.ceil((d.getUTCDate() + 6) / 7)).padStart(2, "0")}`;
        return { key: week, label: week, amount: s.grandTotal };
      }),
    );
  }
  if (dimension === "monthly") {
    return aggregateByKey(
      sales.map((s) => {
        const key = s.postedAt.slice(0, 7);
        return { key, label: key, amount: s.grandTotal };
      }),
    );
  }
  if (dimension === "yearly") {
    return aggregateByKey(
      sales.map((s) => {
        const key = s.postedAt.slice(0, 4);
        return { key, label: key, amount: s.grandTotal };
      }),
    );
  }
  if (dimension === "product") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.productId ?? l.productName,
        label: l.productName,
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  if (dimension === "brand") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.brandId ?? "none",
        label: l.brandName ?? "Unbranded",
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  if (dimension === "category") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.categoryId ?? "none",
        label: l.categoryName ?? "Uncategorized",
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  if (dimension === "customer") {
    return aggregateByKey(
      sales.map((s) => ({
        key: s.customerId ?? "walk-in",
        label: s.customerId ?? "Walk-in",
        amount: s.grandTotal,
      })),
    );
  }
  if (dimension === "salesman") {
    return aggregateByKey(
      sales.map((s) => ({
        key: s.salesmanUserId ?? "none",
        label: s.salesmanUserId ?? "Unassigned",
        amount: s.grandTotal,
      })),
    );
  }
  if (dimension === "branch") {
    return aggregateByKey(
      sales.map((s) => ({
        key: s.branchId,
        label: s.branchId,
        amount: s.grandTotal,
      })),
    );
  }
  if (dimension === "warehouse") {
    return aggregateByKey(
      sales.map((s) => ({
        key: s.warehouseId,
        label: s.warehouseId,
        amount: s.grandTotal,
      })),
    );
  }
  if (dimension === "cash") {
    const paid = sales.filter((s) => s.paymentStatus === "paid" && s.remainingTotal <= 0);
    return [{ key: "cash", label: "Cash / fully paid", amount: sumSales(paid), qty: paid.length }];
  }
  if (dimension === "credit") {
    const credit = sales.filter((s) => s.remainingTotal > 0);
    return [
      {
        key: "credit",
        label: "Credit outstanding sales",
        amount: money(credit.reduce((a, s) => a + s.remainingTotal, 0)),
        qty: credit.length,
      },
    ];
  }
  if (dimension === "installment") {
    // Installment sales approximated by partial payment with remaining balance.
    const inst = sales.filter((s) => s.paymentStatus === "partial" && s.remainingTotal > 0);
    return [
      {
        key: "installment",
        label: "Installment / partial",
        amount: sumSales(inst),
        qty: inst.length,
      },
    ];
  }
  return [];
}

export function purchasesByDimension(lines: PurchaseLineFact[], dimension: string): NamedAmount[] {
  if (dimension === "supplier") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.supplierId,
        label: l.supplierName ?? l.supplierId,
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  if (dimension === "product") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.productId,
        label: l.productName,
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  if (dimension === "brand") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.brandId ?? "none",
        label: l.brandName ?? "Unbranded",
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  if (dimension === "category") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.categoryId ?? "none",
        label: l.categoryName ?? "Uncategorized",
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  if (dimension === "branch") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.branchId,
        label: l.branchId,
        amount: l.lineTotal,
        qty: l.qty,
      })),
    );
  }
  return [];
}

export function stockReportRows(facts: StockFact[], kind: string): NamedAmount[] {
  const value = (s: StockFact) => money(s.qtyOnHand * s.averageUnitCost);
  if (kind === "current" || kind === "valuation") {
    return facts
      .map((s) => ({
        key: `${s.warehouseId}:${s.productId}`,
        label: s.productName,
        amount: kind === "valuation" ? value(s) : s.qtyOnHand,
        qty: s.qtyOnHand,
        meta: { warehouseId: s.warehouseId, unitCost: s.averageUnitCost, value: value(s) },
      }))
      .sort((a, b) => b.amount - a.amount);
  }
  if (kind === "low") {
    return facts
      .filter((s) => s.qtyOnHand > 0 && s.qtyOnHand <= s.reorderLevel)
      .map((s) => ({
        key: s.productId,
        label: s.productName,
        amount: s.qtyOnHand,
        qty: s.reorderLevel,
      }));
  }
  if (kind === "out") {
    return facts
      .filter((s) => s.qtyOnHand <= 0)
      .map((s) => ({ key: s.productId, label: s.productName, amount: 0, qty: 0 }));
  }
  if (kind === "damaged") {
    return facts
      .filter((s) => s.qtyDamaged > 0)
      .map((s) => ({ key: s.productId, label: s.productName, amount: s.qtyDamaged }));
  }
  if (kind === "reserved") {
    return facts
      .filter((s) => s.qtyReserved > 0)
      .map((s) => ({ key: s.productId, label: s.productName, amount: s.qtyReserved }));
  }
  if (kind === "in_transit") {
    return facts
      .filter((s) => s.qtyInTransit > 0)
      .map((s) => ({ key: s.productId, label: s.productName, amount: s.qtyInTransit }));
  }
  return [];
}

export function profitByKind(
  lines: SaleLineFact[],
  sales: SaleFact[],
  kind: string,
): NamedAmount[] {
  if (kind === "product" || kind === "brand" || kind === "category") {
    const dim = kind;
    return aggregateByKey(
      lines.map((l) => {
        const profit = money(l.lineTotal - l.costTotal);
        const key =
          dim === "product"
            ? (l.productId ?? l.productName)
            : dim === "brand"
              ? (l.brandId ?? "none")
              : (l.categoryId ?? "none");
        const label =
          dim === "product"
            ? l.productName
            : dim === "brand"
              ? (l.brandName ?? "Unbranded")
              : (l.categoryName ?? "Uncategorized");
        return { key, label, amount: profit, qty: l.qty };
      }),
    );
  }
  if (kind === "invoice") {
    return aggregateByKey(
      sales.map((s) => ({
        key: s.id,
        label: s.id,
        amount: money(s.grandTotal - s.costTotal),
      })),
    );
  }
  if (kind === "daily") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.postedAt.slice(0, 10),
        label: l.postedAt.slice(0, 10),
        amount: money(l.lineTotal - l.costTotal),
      })),
    );
  }
  if (kind === "monthly") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.postedAt.slice(0, 7),
        label: l.postedAt.slice(0, 7),
        amount: money(l.lineTotal - l.costTotal),
      })),
    );
  }
  if (kind === "gross" || kind === "net") {
    const gross = grossProfitFromLines(lines);
    const revenue = money(lines.reduce((a, l) => a + l.lineTotal, 0));
    const net = kind === "net" ? money(gross * 0.92) : gross; // net approx after opex allocation placeholder
    return [
      {
        key: kind,
        label: kind === "gross" ? "Gross profit" : "Net profit (approx)",
        amount: net,
        meta: { revenue, marginPct: calcMarginPct(revenue, revenue - gross) },
      },
    ];
  }
  if (kind === "margin") {
    return aggregateByKey(
      lines.map((l) => ({
        key: l.productId ?? l.productName,
        label: l.productName,
        amount: calcMarginPct(l.lineTotal, l.costTotal),
        qty: l.qty,
      })),
    );
  }
  return [];
}

export type ExecutiveDashboardInput = {
  sales: number;
  purchases: number;
  grossProfit: number;
  netProfit: number;
  cash: number;
  bank: number;
  receivables: number;
  payables: number;
  stockValue: number;
  lowStock: number;
  outOfStock: number;
  overstock: number;
  todayExpenses: number;
  installmentsDue: number;
  customerOutstanding: number;
  supplierOutstanding: number;
  pendingApprovals: number;
  pendingDeliveries: number;
  pendingRepairs: number;
  warrantyClaims: number;
  onlineOrders: number;
  salesGrowth: number;
  purchaseGrowth: number;
  profitSeries: NamedAmount[];
  recentTransactions: Array<{ id: string; type: string; label: string; amount: number; at: string }>;
};

export function buildExecutiveDashboard(input: ExecutiveDashboardInput): ExecutiveDashboardInput {
  return {
    ...input,
    sales: money(input.sales),
    purchases: money(input.purchases),
    grossProfit: money(input.grossProfit),
    netProfit: money(input.netProfit),
    cash: money(input.cash),
    bank: money(input.bank),
    receivables: money(input.receivables),
    payables: money(input.payables),
    stockValue: money(input.stockValue),
    todayExpenses: money(input.todayExpenses),
    installmentsDue: money(input.installmentsDue),
    customerOutstanding: money(input.customerOutstanding),
    supplierOutstanding: money(input.supplierOutstanding),
    salesGrowth: money(input.salesGrowth),
    purchaseGrowth: money(input.purchaseGrowth),
  };
}

export function customerLifetimeValue(
  sales: SaleFact[],
): NamedAmount[] {
  return aggregateByKey(
    sales
      .filter((s) => s.customerId)
      .map((s) => ({
        key: s.customerId!,
        label: s.customerId!,
        amount: s.grandTotal,
      })),
  );
}

export function supplierPerformance(lines: PurchaseLineFact[]): NamedAmount[] {
  return aggregateByKey(
    lines.map((l) => ({
      key: l.supplierId,
      label: l.supplierName ?? l.supplierId,
      amount: l.lineTotal,
      qty: l.qty,
    })),
  );
}
