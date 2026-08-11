import type {
  BiMetric,
  ProfitReportKind,
  PurchaseReportDimension,
  ReportFilter,
  SalesReportDimension,
  StockReportKind,
} from "@electronic-erp/contracts";
import {
  buildExecutiveDashboard,
  calcGrowthPct,
  customerLifetimeValue,
  filterSaleFacts,
  filterSaleLines,
  grossProfitFromLines,
  inventoryTurnover,
  money,
  previousPeriodRange,
  profitByKind,
  purchasesByDimension,
  rankTopBottom,
  resolveDateRange,
  salesByDimension,
  stockReportRows,
  sumPurchases,
  sumSales,
  supplierPerformance,
  type PurchaseFact,
  type PurchaseLineFact,
  type SaleFact,
  type SaleLineFact,
  type StockFact,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}

function str(v: unknown): string {
  return String(v ?? "");
}

export class ReportingRepository {
  constructor(private readonly db: DatabaseClient) {}

  private assertOrgScope(organizationId: string, filter: ReportFilter) {
    if (filter.organizationId && filter.organizationId !== organizationId) {
      throw new Error("Forbidden: organization mismatch");
    }
  }

  private range(filter: ReportFilter) {
    return resolveDateRange(filter.period, filter.from, filter.to);
  }

  private async loadProducts(organizationId: string) {
    const [{ data: products }, { data: brands }, { data: categories }] = await Promise.all([
      this.db
        .from("products")
        .select("id,name,brand_id,category_id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .limit(5000),
      this.db.from("brands").select("id,name").eq("organization_id", organizationId).limit(2000),
      this.db
        .from("categories")
        .select("id,name")
        .eq("organization_id", organizationId)
        .limit(2000),
    ]);
    const brandNames = new Map((brands ?? []).map((b: Row) => [str(b.id), str(b.name)]));
    const catNames = new Map((categories ?? []).map((c: Row) => [str(c.id), str(c.name)]));
    const map = new Map<
      string,
      { name: string; brandId?: string; brandName?: string; categoryId?: string; categoryName?: string }
    >();
    for (const r of (products ?? []) as Row[]) {
      const brandId = r.brand_id ? str(r.brand_id) : undefined;
      const categoryId = r.category_id ? str(r.category_id) : undefined;
      map.set(str(r.id), {
        name: str(r.name),
        brandId,
        brandName: brandId ? brandNames.get(brandId) : undefined,
        categoryId,
        categoryName: categoryId ? catNames.get(categoryId) : undefined,
      });
    }
    return map;
  }

  private async loadSales(organizationId: string, filter: ReportFilter): Promise<SaleFact[]> {
    let q = this.db
      .from("sales")
      .select(
        "id,posted_at,created_at,branch_id,warehouse_id,customer_id,salesman_user_id,grand_total,paid_total,remaining_total,payment_status",
      )
      .eq("organization_id", organizationId)
      .eq("status", "posted")
      .limit(filter.limit ?? 5000);
    if (filter.branchId) q = q.eq("branch_id", filter.branchId);
    if (filter.warehouseId) q = q.eq("warehouse_id", filter.warehouseId);
    if (filter.salesmanUserId) q = q.eq("salesman_user_id", filter.salesmanUserId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map((r) => ({
      id: str(r.id),
      postedAt: str(r.posted_at ?? r.created_at),
      branchId: str(r.branch_id),
      warehouseId: str(r.warehouse_id),
      customerId: r.customer_id ? str(r.customer_id) : null,
      salesmanUserId: r.salesman_user_id ? str(r.salesman_user_id) : null,
      grandTotal: num(r.grand_total),
      paidTotal: num(r.paid_total),
      remainingTotal: num(r.remaining_total),
      paymentStatus: str(r.payment_status),
      costTotal: 0,
    }));
  }

  private async loadSaleLines(
    organizationId: string,
    filter: ReportFilter,
    sales: SaleFact[],
  ): Promise<SaleLineFact[]> {
    if (!sales.length) return [];
    const products = await this.loadProducts(organizationId);
    const saleIds = sales.map((s) => s.id);
    const saleMap = new Map(sales.map((s) => [s.id, s]));
    const { data, error } = await this.db
      .from("sale_items")
      .select("sale_id,product_id,manual_name,qty,line_total,cost_price")
      .eq("organization_id", organizationId)
      .in("sale_id", saleIds.slice(0, 1000))
      .limit(filter.limit ?? 5000);
    if (error) throw new Error(error.message);

    const lines: SaleLineFact[] = [];
    for (const r of (data ?? []) as Row[]) {
      const sale = saleMap.get(str(r.sale_id));
      if (!sale) continue;
      const productId = r.product_id ? str(r.product_id) : null;
      const p = productId ? products.get(productId) : undefined;
      if (filter.categoryId && p?.categoryId !== filter.categoryId) continue;
      if (filter.brandId && p?.brandId !== filter.brandId) continue;
      const qty = num(r.qty);
      const cost = money(num(r.cost_price) * qty);
      lines.push({
        saleId: sale.id,
        productId,
        productName: p?.name ?? (str(r.manual_name) || "Item"),
        brandId: p?.brandId,
        brandName: p?.brandName,
        categoryId: p?.categoryId,
        categoryName: p?.categoryName,
        qty,
        lineTotal: num(r.line_total),
        costTotal: cost,
        postedAt: sale.postedAt,
        branchId: sale.branchId,
        warehouseId: sale.warehouseId,
        customerId: sale.customerId,
        salesmanUserId: sale.salesmanUserId,
      });
    }

    // Roll cost onto sales
    const costBySale = new Map<string, number>();
    for (const l of lines) {
      costBySale.set(l.saleId, money((costBySale.get(l.saleId) ?? 0) + l.costTotal));
    }
    for (const s of sales) s.costTotal = costBySale.get(s.id) ?? 0;
    return lines;
  }

  private async loadPurchases(organizationId: string, filter: ReportFilter): Promise<PurchaseFact[]> {
    let q = this.db
      .from("purchases")
      .select(
        "id,posted_at,created_at,invoice_date,branch_id,warehouse_id,supplier_id,grand_total,remaining_total",
      )
      .eq("organization_id", organizationId)
      .eq("status", "posted")
      .limit(filter.limit ?? 5000);
    if (filter.branchId) q = q.eq("branch_id", filter.branchId);
    if (filter.warehouseId) q = q.eq("warehouse_id", filter.warehouseId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const { data: suppliers } = await this.db
      .from("suppliers")
      .select("id,name")
      .eq("organization_id", organizationId)
      .limit(2000);
    const supplierNames = new Map((suppliers ?? []).map((s: Row) => [str(s.id), str(s.name)]));
    return ((data ?? []) as Row[]).map((r) => {
      const supplierId = str(r.supplier_id);
      return {
        id: str(r.id),
        postedAt: str(r.posted_at ?? r.created_at ?? r.invoice_date),
        branchId: str(r.branch_id),
        warehouseId: str(r.warehouse_id),
        supplierId,
        supplierName: supplierNames.get(supplierId),
        grandTotal: num(r.grand_total),
        remainingTotal: num(r.remaining_total),
      };
    });
  }

  private async loadPurchaseLines(
    organizationId: string,
    filter: ReportFilter,
    purchases: PurchaseFact[],
  ): Promise<PurchaseLineFact[]> {
    if (!purchases.length) return [];
    const products = await this.loadProducts(organizationId);
    const map = new Map(purchases.map((p) => [p.id, p]));
    const { data, error } = await this.db
      .from("purchase_items")
      .select("purchase_id,product_id,qty,line_total")
      .eq("organization_id", organizationId)
      .in(
        "purchase_id",
        purchases.map((p) => p.id).slice(0, 1000),
      )
      .limit(filter.limit ?? 5000);
    if (error) throw new Error(error.message);
    const lines: PurchaseLineFact[] = [];
    for (const r of (data ?? []) as Row[]) {
      const purchase = map.get(str(r.purchase_id));
      if (!purchase) continue;
      const productId = str(r.product_id);
      const p = products.get(productId);
      if (filter.categoryId && p?.categoryId !== filter.categoryId) continue;
      if (filter.brandId && p?.brandId !== filter.brandId) continue;
      lines.push({
        purchaseId: purchase.id,
        productId,
        productName: p?.name ?? productId,
        brandId: p?.brandId,
        brandName: p?.brandName,
        categoryId: p?.categoryId,
        categoryName: p?.categoryName,
        qty: num(r.qty),
        lineTotal: num(r.line_total),
        branchId: purchase.branchId,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        postedAt: purchase.postedAt,
      });
    }
    return lines;
  }

  private async loadStock(organizationId: string, filter: ReportFilter): Promise<StockFact[]> {
    let q = this.db
      .from("stock_balances")
      .select(
        "product_id,branch_id,warehouse_id,qty_on_hand,qty_reserved,qty_damaged,qty_in_transit,reorder_level,overstock_level,average_unit_cost",
      )
      .eq("organization_id", organizationId)
      .limit(filter.limit ?? 5000);
    if (filter.branchId) q = q.eq("branch_id", filter.branchId);
    if (filter.warehouseId) q = q.eq("warehouse_id", filter.warehouseId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const products = await this.loadProducts(organizationId);
    const facts: StockFact[] = [];
    for (const r of (data ?? []) as Row[]) {
      const productId = str(r.product_id);
      const p = products.get(productId);
      if (filter.categoryId && p?.categoryId !== filter.categoryId) continue;
      if (filter.brandId && p?.brandId !== filter.brandId) continue;
      facts.push({
        productId,
        productName: p?.name ?? productId,
        brandId: p?.brandId,
        categoryId: p?.categoryId,
        branchId: str(r.branch_id),
        warehouseId: str(r.warehouse_id),
        qtyOnHand: num(r.qty_on_hand),
        qtyReserved: num(r.qty_reserved),
        qtyDamaged: num(r.qty_damaged),
        qtyInTransit: num(r.qty_in_transit),
        reorderLevel: num(r.reorder_level),
        overstockLevel: r.overstock_level == null ? null : num(r.overstock_level),
        averageUnitCost: num(r.average_unit_cost),
      });
    }
    return facts;
  }

  async executiveDashboard(organizationId: string, filter: ReportFilter) {
    this.assertOrgScope(organizationId, filter);
    const range = this.range(filter);
    const prev = previousPeriodRange(range);

    const [allSales, allPurchases, stock] = await Promise.all([
      this.loadSales(organizationId, filter),
      this.loadPurchases(organizationId, filter),
      this.loadStock(organizationId, filter),
    ]);
    const sales = filterSaleFacts(allSales, range);
    const prevSales = filterSaleFacts(allSales, prev);
    const purchases = allPurchases.filter((p) => {
      const t = new Date(p.postedAt).getTime();
      return t >= new Date(range.from).getTime() && t <= new Date(range.to).getTime();
    });
    const prevPurchases = allPurchases.filter((p) => {
      const t = new Date(p.postedAt).getTime();
      return t >= new Date(prev.from).getTime() && t <= new Date(prev.to).getTime();
    });
    const lines = await this.loadSaleLines(organizationId, filter, sales);
    const gross = grossProfitFromLines(lines);

    const today = resolveDateRange("today");
    const [{ data: banks }, { data: expenses }, { data: installments }, { data: approvals }, { data: deliveries }, { data: repairs }, { data: warranties }, { data: orders }, { data: ledger }] =
      await Promise.all([
        this.db
          .from("bank_accounts")
          .select("opening_balance,account_kind")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .limit(500),
        this.db
          .from("expenses")
          .select("amount,expense_date")
          .eq("organization_id", organizationId)
          .eq("status", "posted")
          .gte("expense_date", today.from.slice(0, 10))
          .lte("expense_date", today.to.slice(0, 10)),
        this.db
          .from("installment_schedule")
          .select("amount,paid_amount,due_date,status")
          .eq("organization_id", organizationId)
          .in("status", ["pending", "partial", "overdue"])
          .limit(2000),
        this.db
          .from("approval_requests")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("status", "pending")
          .limit(500),
        this.db
          .from("deliveries")
          .select("id")
          .eq("organization_id", organizationId)
          .in("status", ["pending", "packed", "dispatched"])
          .limit(500),
        this.db
          .from("service_jobs")
          .select("id")
          .eq("organization_id", organizationId)
          .in("status", ["received", "diagnosis", "repairing"])
          .limit(500),
        this.db
          .from("warranty_claims")
          .select("id")
          .eq("organization_id", organizationId)
          .in("status", ["open", "approved", "in_progress"])
          .limit(500),
        this.db
          .from("sales_orders")
          .select("id")
          .eq("organization_id", organizationId)
          .in("status", ["draft", "confirmed"])
          .limit(500),
        this.db
          .from("party_ledger_entries")
          .select("party_type,debit,credit")
          .eq("organization_id", organizationId)
          .limit(5000),
      ]);

    let cash = 0;
    let bank = 0;
    for (const b of (banks ?? []) as Row[]) {
      const bal = num(b.opening_balance);
      if (str(b.account_kind) === "cash") cash = money(cash + bal);
      else bank = money(bank + bal);
    }

    let customerOutstanding = 0;
    let supplierOutstanding = 0;
    for (const e of (ledger ?? []) as Row[]) {
      const net = money(num(e.debit) - num(e.credit));
      if (str(e.party_type) === "customer") customerOutstanding = money(customerOutstanding + net);
      if (str(e.party_type) === "supplier") supplierOutstanding = money(supplierOutstanding + -net);
    }

    const stockValue = money(stock.reduce((a, s) => a + s.qtyOnHand * s.averageUnitCost, 0));
    const lowStock = stock.filter((s) => s.qtyOnHand > 0 && s.qtyOnHand <= s.reorderLevel).length;
    const outOfStock = stock.filter((s) => s.qtyOnHand <= 0).length;
    const overstock = stock.filter(
      (s) => s.overstockLevel != null && s.qtyOnHand > (s.overstockLevel ?? 0),
    ).length;

    const installmentsDue = money(
      ((installments ?? []) as Row[])
        .filter((i) => {
          const due = str(i.due_date);
          return due <= today.to.slice(0, 10);
        })
        .reduce((a, i) => a + Math.max(num(i.amount) - num(i.paid_amount), 0), 0),
    );

    const profitSeries = salesByDimension(lines, sales, "daily").slice(-14);
    const recentTransactions = [
      ...sales.slice(0, 10).map((s) => ({
        id: s.id,
        type: "sale",
        label: `Sale ${s.id.slice(0, 8)}`,
        amount: s.grandTotal,
        at: s.postedAt,
      })),
      ...purchases.slice(0, 10).map((p) => ({
        id: p.id,
        type: "purchase",
        label: `Purchase ${p.id.slice(0, 8)}`,
        amount: p.grandTotal,
        at: p.postedAt,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 15);

    return {
      filters: { ...filter, resolved: range },
      dashboard: buildExecutiveDashboard({
        sales: sumSales(sales),
        purchases: sumPurchases(purchases),
        grossProfit: gross,
        netProfit: money(gross * 0.92),
        cash,
        bank,
        receivables: Math.max(customerOutstanding, 0),
        payables: Math.max(supplierOutstanding, 0),
        stockValue,
        lowStock,
        outOfStock,
        overstock,
        todayExpenses: money(((expenses ?? []) as Row[]).reduce((a, e) => a + num(e.amount), 0)),
        installmentsDue,
        customerOutstanding: Math.max(customerOutstanding, 0),
        supplierOutstanding: Math.max(supplierOutstanding, 0),
        pendingApprovals: (approvals ?? []).length,
        pendingDeliveries: (deliveries ?? []).length,
        pendingRepairs: (repairs ?? []).length,
        warrantyClaims: (warranties ?? []).length,
        onlineOrders: (orders ?? []).length,
        salesGrowth: calcGrowthPct(sumSales(sales), sumSales(prevSales)),
        purchaseGrowth: calcGrowthPct(sumPurchases(purchases), sumPurchases(prevPurchases)),
        profitSeries,
        recentTransactions,
      }),
    };
  }

  async salesReport(organizationId: string, dimension: SalesReportDimension, filter: ReportFilter) {
    this.assertOrgScope(organizationId, filter);
    const range = this.range(filter);
    const all = await this.loadSales(organizationId, filter);
    const sales = filterSaleFacts(all, range);
    const lines = filterSaleLines(await this.loadSaleLines(organizationId, filter, sales), range);
    return {
      dimension,
      filters: { ...filter, resolved: range },
      rows: salesByDimension(lines, sales, dimension),
      totals: { sales: sumSales(sales), lines: lines.length },
    };
  }

  async purchaseReport(
    organizationId: string,
    dimension: PurchaseReportDimension,
    filter: ReportFilter,
  ) {
    this.assertOrgScope(organizationId, filter);
    const range = this.range(filter);
    const all = await this.loadPurchases(organizationId, filter);
    const purchases = all.filter((p) => {
      const t = new Date(p.postedAt).getTime();
      return t >= new Date(range.from).getTime() && t <= new Date(range.to).getTime();
    });
    const lines = await this.loadPurchaseLines(organizationId, filter, purchases);
    return {
      dimension,
      filters: { ...filter, resolved: range },
      rows: purchasesByDimension(lines, dimension),
      totals: { purchases: sumPurchases(purchases), lines: lines.length },
    };
  }

  async stockReport(organizationId: string, kind: StockReportKind, filter: ReportFilter) {
    this.assertOrgScope(organizationId, filter);
    const stock = await this.loadStock(organizationId, filter);
    if (kind === "movement") {
      let q = this.db
        .from("stock_movements")
        .select("id,product_id,warehouse_id,movement_type,qty_delta,occurred_at")
        .eq("organization_id", organizationId)
        .order("occurred_at", { ascending: false })
        .limit(filter.limit ?? 500);
      if (filter.branchId) q = q.eq("branch_id", filter.branchId);
      if (filter.warehouseId) q = q.eq("warehouse_id", filter.warehouseId);
      const range = this.range(filter);
      q = q.gte("occurred_at", range.from).lte("occurred_at", range.to);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return {
        kind,
        filters: { ...filter, resolved: range },
        rows: ((data ?? []) as Row[]).map((r) => ({
          key: str(r.id),
          label: `${str(r.movement_type)} ${str(r.product_id).slice(0, 8)}`,
          amount: num(r.qty_delta),
          meta: { warehouseId: str(r.warehouse_id), at: str(r.occurred_at) },
        })),
      };
    }
    return {
      kind,
      filters: filter,
      rows: stockReportRows(stock, kind === "current" ? "current" : kind),
      totals: {
        stockValue: money(stock.reduce((a, s) => a + s.qtyOnHand * s.averageUnitCost, 0)),
        skus: stock.length,
      },
    };
  }

  async profitReport(organizationId: string, kind: ProfitReportKind, filter: ReportFilter) {
    this.assertOrgScope(organizationId, filter);
    const range = this.range(filter);
    const all = await this.loadSales(organizationId, filter);
    const sales = filterSaleFacts(all, range);
    const lines = filterSaleLines(await this.loadSaleLines(organizationId, filter, sales), range);
    return {
      kind,
      filters: { ...filter, resolved: range },
      rows: profitByKind(lines, sales, kind),
      totals: {
        revenue: money(lines.reduce((a, l) => a + l.lineTotal, 0)),
        cost: money(lines.reduce((a, l) => a + l.costTotal, 0)),
        grossProfit: grossProfitFromLines(lines),
      },
    };
  }

  async biMetric(organizationId: string, metric: BiMetric, filter: ReportFilter) {
    this.assertOrgScope(organizationId, filter);
    const range = this.range(filter);
    const prev = previousPeriodRange(range);
    const allSales = await this.loadSales(organizationId, filter);
    const sales = filterSaleFacts(allSales, range);
    const prevSales = filterSaleFacts(allSales, prev);
    const lines = filterSaleLines(await this.loadSaleLines(organizationId, filter, sales), range);
    const allPurchases = await this.loadPurchases(organizationId, filter);
    const purchases = allPurchases.filter((p) => {
      const t = new Date(p.postedAt).getTime();
      return t >= new Date(range.from).getTime() && t <= new Date(range.to).getTime();
    });
    const prevPurchases = allPurchases.filter((p) => {
      const t = new Date(p.postedAt).getTime();
      return t >= new Date(prev.from).getTime() && t <= new Date(prev.to).getTime();
    });
    const purchaseLines = await this.loadPurchaseLines(organizationId, filter, purchases);
    const stock = await this.loadStock(organizationId, filter);

    if (metric === "best_selling" || metric === "worst_selling") {
      const ranked = rankTopBottom(salesByDimension(lines, sales, "product"));
      return { metric, rows: metric === "best_selling" ? ranked.top : ranked.bottom };
    }
    if (metric === "highest_profit" || metric === "lowest_profit") {
      const ranked = rankTopBottom(profitByKind(lines, sales, "product"));
      return { metric, rows: metric === "highest_profit" ? ranked.top : ranked.bottom };
    }
    if (metric === "customer_lifetime_value") {
      return { metric, rows: customerLifetimeValue(allSales).slice(0, 50) };
    }
    if (metric === "supplier_performance") {
      return { metric, rows: supplierPerformance(purchaseLines).slice(0, 50) };
    }
    if (metric === "sales_growth") {
      return {
        metric,
        current: sumSales(sales),
        previous: sumSales(prevSales),
        growthPct: calcGrowthPct(sumSales(sales), sumSales(prevSales)),
        series: salesByDimension(lines, sales, "daily"),
      };
    }
    if (metric === "purchase_growth") {
      return {
        metric,
        current: sumPurchases(purchases),
        previous: sumPurchases(prevPurchases),
        growthPct: calcGrowthPct(sumPurchases(purchases), sumPurchases(prevPurchases)),
        series: purchasesByDimension(purchaseLines, "branch"),
      };
    }
    if (metric === "monthly_comparison") {
      return { metric, rows: salesByDimension(lines, sales, "monthly") };
    }
    if (metric === "branch_comparison") {
      return { metric, rows: salesByDimension(lines, sales, "branch") };
    }
    if (metric === "warehouse_comparison") {
      return { metric, rows: salesByDimension(lines, sales, "warehouse") };
    }
    if (metric === "salesman_performance") {
      return { metric, rows: salesByDimension(lines, sales, "salesman") };
    }
    if (metric === "product_margin") {
      return { metric, rows: profitByKind(lines, sales, "margin").slice(0, 100) };
    }
    if (metric === "inventory_turnover") {
      const cogs = money(lines.reduce((a, l) => a + l.costTotal, 0));
      const avgInv = money(stock.reduce((a, s) => a + s.qtyOnHand * s.averageUnitCost, 0));
      return {
        metric,
        cogs,
        averageInventoryValue: avgInv,
        turnover: inventoryTurnover(cogs, avgInv),
      };
    }
    return { metric, rows: [] };
  }
}
