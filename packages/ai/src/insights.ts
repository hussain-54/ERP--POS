/** Isolated AI business intelligence engines — explainable, source-traceable. */

export interface DailySalesPoint {
  date: string; // YYYY-MM-DD
  amount: number;
  qty?: number;
}

export interface ProductVelocityInput {
  productId: string;
  productName: string;
  qtySold: number;
  lastSoldAt?: string | null;
  qtyOnHand: number;
  minStock?: number;
  maxStock?: number;
  avgUnitCost?: number;
  retailPrice?: number;
  preferredSupplierId?: string | null;
  preferredSupplierName?: string | null;
  lastPurchaseRate?: number | null;
  leadTimeDays?: number;
}

export interface VelocityConfig {
  fastDays: number;
  slowDays: number;
  stagnantDays: number;
}

export type VelocityClass = "fast_moving" | "slow_moving" | "stagnant";

export interface TraceableInsight<T> {
  kind: string;
  generatedAt: string;
  data: T;
  explanations: string[];
  sources: Array<{ table: string; field?: string; note: string }>;
}

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Simple linear trend + seasonal weekly average for sales prediction. */
export function predictFutureSales(
  history: DailySalesPoint[],
  horizonDays = 30,
): TraceableInsight<{
  horizonDays: number;
  predictedTotal: number;
  daily: Array<{ date: string; predicted: number }>;
  method: string;
}> {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const avg =
    sorted.length === 0
      ? 0
      : sorted.reduce((s, p) => s + p.amount, 0) / sorted.length;

  const n = sorted.length;
  let slope = 0;
  if (n >= 2) {
    const mid = Math.floor(n / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid);
    const a1 = first.reduce((s, p) => s + p.amount, 0) / Math.max(first.length, 1);
    const a2 = second.reduce((s, p) => s + p.amount, 0) / Math.max(second.length, 1);
    slope = (a2 - a1) / Math.max(mid, 1);
  }

  const dow = new Array(7).fill(0);
  const dowN = new Array(7).fill(0);
  for (const p of sorted) {
    const d = new Date(p.date + "T00:00:00Z").getUTCDay();
    dow[d] += p.amount;
    dowN[d] += 1;
  }
  const dowAvg = dow.map((v, i) => (dowN[i] ? v / dowN[i] : avg));

  const start = sorted.length
    ? new Date(sorted[sorted.length - 1]!.date + "T00:00:00Z")
    : new Date();
  const daily: Array<{ date: string; predicted: number }> = [];
  let predictedTotal = 0;
  for (let i = 1; i <= horizonDays; i++) {
    const dt = new Date(start.getTime() + i * 86_400_000);
    const iso = dt.toISOString().slice(0, 10);
    const seasonal = dowAvg[dt.getUTCDay()] || avg;
    const trend = avg + slope * i;
    const predicted = money(Math.max(0, seasonal * 0.6 + trend * 0.4));
    predictedTotal += predicted;
    daily.push({ date: iso, predicted });
  }

  return {
    kind: "sales_prediction",
    generatedAt: new Date().toISOString(),
    data: {
      horizonDays,
      predictedTotal: money(predictedTotal),
      daily,
      method: "linear_trend_plus_dow_seasonality",
    },
    explanations: [
      `Baseline daily average ${money(avg)} from ${sorted.length} sales days.`,
      `Trend slope ${money(slope)}/day blended 40% with day-of-week seasonality 60%.`,
      `Forecast horizon ${horizonDays} days → ${money(predictedTotal)}.`,
    ],
    sources: [
      { table: "sales", field: "grand_total / posted_at", note: "Historical posted sales aggregates" },
    ],
  };
}

export function classifyVelocity(
  input: ProductVelocityInput,
  config: VelocityConfig,
  asOf = new Date().toISOString(),
): { classification: VelocityClass; daysSinceSale: number | null; explanation: string } {
  const last = input.lastSoldAt;
  const daysSinceSale = last ? daysBetween(last.slice(0, 10), asOf.slice(0, 10)) : null;

  if (input.qtySold <= 0 || daysSinceSale == null || daysSinceSale >= config.stagnantDays) {
    return {
      classification: "stagnant",
      daysSinceSale,
      explanation: `No/low movement within stagnant window (${config.stagnantDays}d); qtySold=${input.qtySold}.`,
    };
  }
  if (daysSinceSale <= config.fastDays && input.qtySold > 0) {
    return {
      classification: "fast_moving",
      daysSinceSale,
      explanation: `Sold within fast window (${config.fastDays}d); qtySold=${input.qtySold}.`,
    };
  }
  if (daysSinceSale <= config.slowDays) {
    return {
      classification: "slow_moving",
      daysSinceSale,
      explanation: `Last sale within slow window (${config.slowDays}d).`,
    };
  }
  return {
    classification: "stagnant",
    daysSinceSale,
    explanation: `Last sale older than slow window; treating as stagnant.`,
  };
}

export function classifyAllVelocities(
  products: ProductVelocityInput[],
  config: VelocityConfig,
): TraceableInsight<{
  config: VelocityConfig;
  fast: Array<ProductVelocityInput & { daysSinceSale: number | null }>;
  slow: Array<ProductVelocityInput & { daysSinceSale: number | null }>;
  stagnant: Array<ProductVelocityInput & { daysSinceSale: number | null }>;
}> {
  const fast: Array<ProductVelocityInput & { daysSinceSale: number | null }> = [];
  const slow: Array<ProductVelocityInput & { daysSinceSale: number | null }> = [];
  const stagnant: Array<ProductVelocityInput & { daysSinceSale: number | null }> = [];
  for (const p of products) {
    const c = classifyVelocity(p, config);
    const row = { ...p, daysSinceSale: c.daysSinceSale };
    if (c.classification === "fast_moving") fast.push(row);
    else if (c.classification === "slow_moving") slow.push(row);
    else stagnant.push(row);
  }
  return {
    kind: "velocity",
    generatedAt: new Date().toISOString(),
    data: { config, fast, slow, stagnant },
    explanations: [
      `Configurable windows: fast≤${config.fastDays}d, slow≤${config.slowDays}d, stagnant≥${config.stagnantDays}d.`,
      `Classified ${products.length} products → fast ${fast.length}, slow ${slow.length}, stagnant ${stagnant.length}.`,
    ],
    sources: [
      { table: "sale_items", field: "qty", note: "Units sold in lookback" },
      { table: "sales", field: "posted_at", note: "Last sale date per product" },
      { table: "stock_balances", field: "qty_on_hand", note: "Current ERP stock" },
    ],
  };
}

export function forecastDemand(
  history: DailySalesPoint[],
  productSeries: Array<{ productId: string; productName: string; points: DailySalesPoint[] }>,
): TraceableInsight<{
  nextWeek: number;
  nextMonth: number;
  seasonalIndex: Array<{ month: number; index: number }>;
  byProduct: Array<{
    productId: string;
    productName: string;
    nextWeekQty: number;
    nextMonthQty: number;
  }>;
}> {
  const week = predictFutureSales(history, 7);
  const month = predictFutureSales(history, 30);

  const monthBuckets = new Array(12).fill(0);
  const monthN = new Array(12).fill(0);
  for (const p of history) {
    const m = new Date(p.date + "T00:00:00Z").getUTCMonth();
    monthBuckets[m] += p.amount;
    monthN[m] += 1;
  }
  const overall =
    history.reduce((s, p) => s + p.amount, 0) / Math.max(history.length, 1) || 1;
  const seasonalIndex = monthBuckets.map((v, i) => ({
    month: i + 1,
    index: money(monthN[i] ? v / monthN[i] / overall : 1),
  }));

  const byProduct = productSeries.map((ps) => {
    const qtyHist = ps.points.map((p) => ({ date: p.date, amount: p.qty ?? p.amount }));
    const w = predictFutureSales(qtyHist, 7);
    const m = predictFutureSales(qtyHist, 30);
    return {
      productId: ps.productId,
      productName: ps.productName,
      nextWeekQty: money(w.data.predictedTotal),
      nextMonthQty: money(m.data.predictedTotal),
    };
  });

  return {
    kind: "demand_forecast",
    generatedAt: new Date().toISOString(),
    data: {
      nextWeek: week.data.predictedTotal,
      nextMonth: month.data.predictedTotal,
      seasonalIndex,
      byProduct: byProduct.slice(0, 50),
    },
    explanations: [
      `Next-week demand (value) ${week.data.predictedTotal}; next-month ${month.data.predictedTotal}.`,
      "Seasonal index = month avg / overall daily avg from sales history.",
      "Per-product qty forecast uses same trend+DOW method on unit quantities.",
    ],
    sources: [
      { table: "sales", note: "Org sales totals for week/month value forecast" },
      { table: "sale_items", note: "Per-product qty series" },
    ],
  };
}

export function recommendPurchases(
  products: ProductVelocityInput[],
  forecastByProduct: Map<string, { nextMonthQty: number }>,
): TraceableInsight<
  Array<{
    productId: string;
    productName: string;
    supplierId: string | null;
    supplierName: string | null;
    quantity: number;
    expectedRate: number | null;
    reasons: string[];
  }>
> {
  const rows = [];
  for (const p of products) {
    const forecast = forecastByProduct.get(p.productId)?.nextMonthQty ?? 0;
    const lead = p.leadTimeDays ?? 7;
    const min = p.minStock ?? 0;
    const max = p.maxStock ?? Math.max(min * 3, forecast);
    const cover = forecast * (lead / 30) + min;
    const need = Math.ceil(Math.max(0, cover - p.qtyOnHand));
    if (need <= 0 && p.qtyOnHand > min) continue;
    const qty = Math.max(need, p.qtyOnHand < min ? Math.ceil(min - p.qtyOnHand + forecast * 0.25) : need);
    if (qty <= 0) continue;
    const capped = max > 0 ? Math.min(qty, Math.max(0, max - p.qtyOnHand)) : qty;
    if (capped <= 0) continue;
    rows.push({
      productId: p.productId,
      productName: p.productName,
      supplierId: p.preferredSupplierId ?? null,
      supplierName: p.preferredSupplierName ?? null,
      quantity: capped,
      expectedRate: p.lastPurchaseRate ?? p.avgUnitCost ?? null,
      reasons: [
        `On hand ${p.qtyOnHand}; min ${min}; max ${max}.`,
        `Forecast next month qty ≈ ${money(forecast)}; lead time ${lead}d.`,
        `Recommended cover ${money(cover)} → order ${capped}.`,
      ],
    });
  }
  rows.sort((a, b) => b.quantity - a.quantity);

  return {
    kind: "purchase_recommendation",
    generatedAt: new Date().toISOString(),
    data: rows.slice(0, 100),
    explanations: [
      "Quantity = cover(forecast×lead/30 + minStock) − onHand, capped by maxStock.",
      "Expected rate from last purchase rate or average unit cost.",
      "Supplier from preferred supplier on product when available.",
    ],
    sources: [
      { table: "stock_balances", note: "Current stock" },
      { table: "products", field: "min_stock/max_stock", note: "Reorder bounds when present" },
      { table: "purchase_items", note: "Last rate / supplier hints" },
      { table: "sale_items", note: "Demand forecast input" },
    ],
  };
}

export function findCustomerPatterns(
  baskets: Array<{ saleId: string; productIds: string[]; productNames?: Record<string, string> }>,
  minSupport = 2,
): TraceableInsight<{
  combinations: Array<{
    products: string[];
    names: string[];
    support: number;
    relatedSuggestions: string[];
  }>;
}> {
  const pairCounts = new Map<string, { ids: [string, string]; count: number }>();
  const solo = new Map<string, number>();

  for (const b of baskets) {
    const ids = [...new Set(b.productIds)].sort();
    for (const id of ids) solo.set(id, (solo.get(id) ?? 0) + 1);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}|${ids[j]}`;
        const cur = pairCounts.get(key) ?? { ids: [ids[i]!, ids[j]!], count: 0 };
        cur.count += 1;
        pairCounts.set(key, cur);
      }
    }
  }

  const nameOf = (id: string, basketNames?: Record<string, string>) =>
    basketNames?.[id] ?? id;

  const combinations = [...pairCounts.values()]
    .filter((p) => p.count >= minSupport)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
    .map((p) => {
      const related = [...solo.entries()]
        .filter(([id]) => id !== p.ids[0] && id !== p.ids[1])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
      return {
        products: p.ids,
        names: p.ids.map((id) => nameOf(id)),
        support: p.count,
        relatedSuggestions: related,
      };
    });

  return {
    kind: "customer_patterns",
    generatedAt: new Date().toISOString(),
    data: { combinations },
    explanations: [
      `Frequent itemsets from ${baskets.length} baskets; min support ${minSupport}.`,
      "Related suggestions = other high-frequency products excluding the pair.",
    ],
    sources: [{ table: "sale_items", field: "product_id", note: "Co-purchase baskets per sale" }],
  };
}

export function optimizeProfit(
  products: Array<{
    productId: string;
    productName: string;
    revenue: number;
    cost: number;
    qtySold: number;
  }>,
): TraceableInsight<{
  highMargin: Array<{ productId: string; productName: string; marginPct: number; profit: number }>;
  lowMargin: Array<{ productId: string; productName: string; marginPct: number; profit: number }>;
  lossMaking: Array<{ productId: string; productName: string; marginPct: number; profit: number }>;
  pricingOpportunities: Array<{
    productId: string;
    productName: string;
    suggestion: string;
    marginPct: number;
  }>;
}> {
  const scored = products.map((p) => {
    const profit = money(p.revenue - p.cost);
    const marginPct = p.revenue > 0 ? money((profit / p.revenue) * 100) : 0;
    return { ...p, profit, marginPct };
  });

  const highMargin = scored
    .filter((p) => p.marginPct >= 30)
    .sort((a, b) => b.marginPct - a.marginPct)
    .slice(0, 25)
    .map(({ productId, productName, marginPct, profit }) => ({
      productId,
      productName,
      marginPct,
      profit,
    }));
  const lowMargin = scored
    .filter((p) => p.marginPct >= 0 && p.marginPct < 15 && p.qtySold > 0)
    .sort((a, b) => a.marginPct - b.marginPct)
    .slice(0, 25)
    .map(({ productId, productName, marginPct, profit }) => ({
      productId,
      productName,
      marginPct,
      profit,
    }));
  const lossMaking = scored
    .filter((p) => p.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 25)
    .map(({ productId, productName, marginPct, profit }) => ({
      productId,
      productName,
      marginPct,
      profit,
    }));
  const pricingOpportunities = [
    ...lowMargin.slice(0, 10).map((p) => ({
      productId: p.productId,
      productName: p.productName,
      marginPct: p.marginPct,
      suggestion: "Review retail price upward; margin under 15%.",
    })),
    ...lossMaking.slice(0, 10).map((p) => ({
      productId: p.productId,
      productName: p.productName,
      marginPct: p.marginPct,
      suggestion: "Loss-making — raise price or renegotiate supplier cost.",
    })),
  ];

  return {
    kind: "profit_optimization",
    generatedAt: new Date().toISOString(),
    data: { highMargin, lowMargin, lossMaking, pricingOpportunities },
    explanations: [
      "Margin% = (revenue − cost) / revenue from sale lines.",
      "High ≥30%, low 0–15%, loss = negative profit.",
      "Pricing opportunities derived from low/loss cohorts.",
    ],
    sources: [
      { table: "sale_items", field: "line_total", note: "Revenue" },
      { table: "sale_items", field: "cost_total / unit_cost", note: "COGS trace" },
    ],
  };
}
