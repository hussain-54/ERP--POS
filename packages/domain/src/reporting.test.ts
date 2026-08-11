import { describe, expect, it } from "vitest";
import {
  aggregateByKey,
  buildExecutiveDashboard,
  calcGrowthPct,
  calcMarginPct,
  inventoryTurnover,
  previousPeriodRange,
  profitByKind,
  resolveDateRange,
  salesByDimension,
  stockReportRows,
  type SaleFact,
  type SaleLineFact,
  type StockFact,
} from "./reporting.js";

describe("reporting date ranges", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");

  it("resolves today / week / month / year / custom", () => {
    expect(resolveDateRange("today", null, null, now).label).toBe("today");
    expect(resolveDateRange("week", null, null, now).label).toBe("week");
    expect(resolveDateRange("month", null, null, now).from.startsWith("2026-08-01")).toBe(true);
    expect(resolveDateRange("year", null, null, now).from.startsWith("2026-01-01")).toBe(true);
    const custom = resolveDateRange("custom", "2026-01-01", "2026-01-31", now);
    expect(custom.label).toBe("custom");
    expect(custom.from.startsWith("2026-01-01")).toBe(true);
  });

  it("builds equal-length previous period for growth", () => {
    const range = resolveDateRange("month", null, null, now);
    const prev = previousPeriodRange(range);
    const span = new Date(range.to).getTime() - new Date(range.from).getTime();
    const prevSpan = new Date(prev.to).getTime() - new Date(prev.from).getTime();
    expect(Math.abs(span - prevSpan)).toBeLessThan(2);
  });
});

describe("reporting metrics", () => {
  it("calculates growth, margin, turnover", () => {
    expect(calcGrowthPct(120, 100)).toBe(20);
    expect(calcGrowthPct(50, 0)).toBe(100);
    expect(calcMarginPct(200, 150)).toBe(25);
    expect(inventoryTurnover(1000, 250)).toBe(4);
  });

  it("aggregates and ranks sales dimensions", () => {
    const sales: SaleFact[] = [
      {
        id: "s1",
        postedAt: "2026-08-01T10:00:00.000Z",
        branchId: "b1",
        warehouseId: "w1",
        customerId: "c1",
        salesmanUserId: "u1",
        grandTotal: 100,
        paidTotal: 100,
        remainingTotal: 0,
        paymentStatus: "paid",
        costTotal: 60,
      },
      {
        id: "s2",
        postedAt: "2026-08-02T10:00:00.000Z",
        branchId: "b1",
        warehouseId: "w1",
        customerId: "c1",
        salesmanUserId: "u1",
        grandTotal: 50,
        paidTotal: 0,
        remainingTotal: 50,
        paymentStatus: "unpaid",
        costTotal: 20,
      },
    ];
    const lines: SaleLineFact[] = [
      {
        saleId: "s1",
        productId: "p1",
        productName: "Wire",
        brandId: "br1",
        brandName: "ABB",
        categoryId: "cat1",
        categoryName: "Cables",
        qty: 2,
        lineTotal: 100,
        costTotal: 60,
        postedAt: "2026-08-01T10:00:00.000Z",
        branchId: "b1",
        warehouseId: "w1",
        customerId: "c1",
        salesmanUserId: "u1",
      },
    ];
    const byProduct = salesByDimension(lines, sales, "product");
    expect(byProduct[0]?.amount).toBe(100);
    const profit = profitByKind(lines, sales, "product");
    expect(profit[0]?.amount).toBe(40);
    const cash = salesByDimension(lines, sales, "cash");
    expect(cash[0]?.amount).toBe(100);
  });

  it("classifies stock report kinds", () => {
    const facts: StockFact[] = [
      {
        productId: "p1",
        productName: "A",
        branchId: "b1",
        warehouseId: "w1",
        qtyOnHand: 2,
        qtyReserved: 1,
        qtyDamaged: 0,
        qtyInTransit: 0,
        reorderLevel: 5,
        overstockLevel: 100,
        averageUnitCost: 10,
      },
      {
        productId: "p2",
        productName: "B",
        branchId: "b1",
        warehouseId: "w1",
        qtyOnHand: 0,
        qtyReserved: 0,
        qtyDamaged: 3,
        qtyInTransit: 4,
        reorderLevel: 1,
        averageUnitCost: 5,
      },
    ];
    expect(stockReportRows(facts, "low")).toHaveLength(1);
    expect(stockReportRows(facts, "out")).toHaveLength(1);
    expect(stockReportRows(facts, "damaged")[0]?.amount).toBe(3);
    expect(stockReportRows(facts, "in_transit")[0]?.amount).toBe(4);
    expect(stockReportRows(facts, "valuation")[0]?.amount).toBe(20);
  });

  it("builds executive dashboard totals", () => {
    const dash = buildExecutiveDashboard({
      sales: 1000.555,
      purchases: 400,
      grossProfit: 300,
      netProfit: 250,
      cash: 50,
      bank: 150,
      receivables: 80,
      payables: 40,
      stockValue: 500,
      lowStock: 2,
      outOfStock: 1,
      overstock: 0,
      todayExpenses: 25,
      installmentsDue: 10,
      customerOutstanding: 80,
      supplierOutstanding: 40,
      pendingApprovals: 3,
      pendingDeliveries: 1,
      pendingRepairs: 2,
      warrantyClaims: 1,
      onlineOrders: 0,
      salesGrowth: 12.345,
      purchaseGrowth: -5,
      profitSeries: aggregateByKey([{ key: "2026-08", label: "2026-08", amount: 300 }]),
      recentTransactions: [],
    });
    expect(dash.sales).toBe(1000.56);
    expect(dash.salesGrowth).toBe(12.35);
  });
});
