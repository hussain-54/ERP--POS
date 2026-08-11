import { describe, expect, it } from "vitest";
import {
  assertJournalBalanced,
  buildExpenseJournalLines,
  buildPurchaseJournalLines,
  buildPurchaseReturnJournalLines,
  buildSaleJournalLines,
  buildSaleReturnJournalLines,
  STANDARD_COA,
} from "./accounting-posting.js";
import {
  buildProfitAndLoss,
  buildTrialBalance,
  expenseReportByPeriod,
} from "./finance-reports.js";

describe("accounting posting", () => {
  it("seeds a complete standard chart covering required roles", () => {
    const roles = new Set(STANDARD_COA.map((a) => a.systemRole));
    for (const role of [
      "cash",
      "bank",
      "customer_receivable",
      "supplier_payable",
      "sales",
      "purchases",
      "expenses",
      "income",
      "discounts",
      "sales_returns",
      "purchase_returns",
      "tax_input",
      "tax_output",
      "inventory",
      "cogs",
    ]) {
      expect(roles.has(role)).toBe(true);
    }
  });

  it("posts balanced sale with tax, discount, COGS, and cash settlement", () => {
    const lines = buildSaleJournalLines({
      subtotal: 1000,
      discountTotal: 100,
      taxTotal: 50,
      grandTotal: 950,
      cogs: 400,
      paidCash: 200,
    });
    assertJournalBalanced(lines);
    expect(lines.some((l) => l.code === "4000" && l.credit === 1000)).toBe(true);
    expect(lines.some((l) => l.code === "4200" && l.debit === 100)).toBe(true);
    expect(lines.some((l) => l.code === "2100" && l.credit === 50)).toBe(true);
    expect(lines.some((l) => l.code === "5000" && l.debit === 400)).toBe(true);
    expect(lines.some((l) => l.code === "1000" && l.debit === 200)).toBe(true);
    const ar = lines.find((l) => l.code === "1100");
    expect(ar?.debit).toBe(750);
  });

  it("posts balanced purchase with tax and cash payment", () => {
    const lines = buildPurchaseJournalLines({
      inventoryAmount: 800,
      taxTotal: 80,
      grandTotal: 880,
      paidCash: 300,
    });
    assertJournalBalanced(lines);
    expect(lines.some((l) => l.code === "1300" && l.debit === 800)).toBe(true);
    expect(lines.some((l) => l.code === "1200" && l.debit === 80)).toBe(true);
    expect(lines.some((l) => l.code === "2000" && l.credit === 580)).toBe(true);
    expect(lines.some((l) => l.code === "1000" && l.credit === 300)).toBe(true);
  });

  it("reverses sale and purchase returns", () => {
    const saleReturn = buildSaleReturnJournalLines({ refundAmount: 250, taxTotal: 25, cogs: 100 });
    assertJournalBalanced(saleReturn);
    expect(saleReturn.some((l) => l.code === "4100" && l.debit === 225)).toBe(true);

    const purchaseReturn = buildPurchaseReturnJournalLines({ refundAmount: 440, taxTotal: 40 });
    assertJournalBalanced(purchaseReturn);
    expect(purchaseReturn.some((l) => l.code === "2000" && l.debit === 440)).toBe(true);
    expect(purchaseReturn.some((l) => l.code === "1300" && l.credit === 400)).toBe(true);
  });

  it("posts expense voucher lines", () => {
    const lines = buildExpenseJournalLines({
      amount: 5000,
      taxAmount: 0,
      expenseCode: "6100",
      expenseName: "Rent Expense",
      payFromCode: "1010",
    });
    assertJournalBalanced(lines);
    expect(lines).toHaveLength(2);
  });
});

describe("finance reports", () => {
  it("builds trial balance and P&L from journal lines", () => {
    const sale = buildSaleJournalLines({
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 100,
      cogs: 40,
    });
    const tb = buildTrialBalance(
      sale.map((l) => ({
        accountCode: l.code,
        accountName: l.name,
        accountType: l.accountType,
        debit: l.debit,
        credit: l.credit,
      })),
    );
    const debit = tb.reduce((s, r) => s + r.debit, 0);
    const credit = tb.reduce((s, r) => s + r.credit, 0);
    expect(Math.abs(debit - credit)).toBeLessThan(0.01);

    const pl = buildProfitAndLoss(
      sale.map((l) => ({
        accountCode: l.code,
        accountName: l.name,
        accountType: l.accountType,
        debit: l.debit,
        credit: l.credit,
      })),
    );
    expect(pl.income).toBe(100);
    expect(pl.cogs).toBe(40);
    expect(pl.grossProfit).toBe(60);
    expect(pl.netProfit).toBe(60);
  });

  it("groups expenses by period", () => {
    const rows = expenseReportByPeriod(
      [
        { date: "2026-08-01", amount: 100, category: "rent" },
        { date: "2026-08-15", amount: 50, category: "rent" },
        { date: "2026-09-01", amount: 20, category: "petrol" },
      ],
      "monthly",
    );
    expect(rows.find((r) => r.period === "2026-08" && r.category === "rent")?.total).toBe(150);
  });
});
