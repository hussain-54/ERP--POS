import { describe, expect, it } from "vitest";
import { applyCustomerLedgerEffect, applySupplierLedgerEffect } from "./party-ledger.js";
import { evaluateCredit, assertCreditAllowed, isOverdue } from "./credit.js";
import { assertSplitMatchesBill, creditPortion, sumSplits } from "./split-payment.js";
import { buildInstallmentPlan, markOverdueSchedule } from "./installments.js";

describe("party ledger balances", () => {
  it("tracks customer sale/payment/return/discount/adjustment", () => {
    let bal = "0";
    bal = applyCustomerLedgerEffect(bal, "sale", "50000").balanceAfter;
    expect(bal).toBe("50000");
    bal = applyCustomerLedgerEffect(bal, "payment", "30000").balanceAfter;
    expect(bal).toBe("20000");
    bal = applyCustomerLedgerEffect(bal, "return", "5000").balanceAfter;
    expect(bal).toBe("15000");
    bal = applyCustomerLedgerEffect(bal, "discount", "1000").balanceAfter;
    expect(bal).toBe("14000");
    bal = applyCustomerLedgerEffect(bal, "adjustment", "500").balanceAfter;
    expect(bal).toBe("14500");
  });

  it("tracks supplier purchase and payment", () => {
    let bal = "0";
    bal = applySupplierLedgerEffect(bal, "purchase", "10000").balanceAfter;
    bal = applySupplierLedgerEffect(bal, "payment", "4000").balanceAfter;
    expect(bal).toBe("6000");
  });
});

describe("credit limits", () => {
  it("requires approval when exceeding limit", () => {
    const result = evaluateCredit({
      creditLimit: "10000",
      outstanding: "8000",
      additionalCredit: "5000",
      creditDays: 30,
      isBlocked: false,
    });
    expect(result.requiresApproval).toBe(true);
    expect(() => assertCreditAllowed(result, false)).toThrow(/approval/i);
    expect(() => assertCreditAllowed(result, true)).not.toThrow();
  });

  it("detects overdue", () => {
    expect(isOverdue("2026-01-01", "2026-02-01")).toBe(true);
    expect(isOverdue("2026-03-01", "2026-02-01")).toBe(false);
  });
});

describe("split payments", () => {
  it("supports 50k = 20k cash + 20k bank + 10k credit", () => {
    const splits = [
      { paymentMethodId: "1", amount: "20000", kind: "cash" as const },
      { paymentMethodId: "2", amount: "20000", kind: "bank" as const },
      { paymentMethodId: "3", amount: "10000", kind: "credit" as const },
    ];
    expect(sumSplits(splits)).toBe("50000");
    expect(assertSplitMatchesBill(splits, "50000")).toBe("50000");
    expect(creditPortion(splits, new Map())).toBe("10000");
  });
});

describe("installment schedules", () => {
  it("generates complete schedule with down payment", () => {
    const plan = buildInstallmentPlan({
      totalAmount: "120000",
      downPayment: "20000",
      installmentCount: 4,
      startDate: "2026-01-15",
    });
    expect(plan.remainingAmount).toBe("100000");
    expect(plan.schedule).toHaveLength(4);
    expect(plan.schedule[0]?.dueDate).toBe("2026-01-15");
    expect(plan.schedule[3]?.dueDate).toBe("2026-04-15");
    const sum = plan.schedule.reduce((a, s) => a + Number(s.amount), 0);
    expect(sum).toBeCloseTo(100000, 2);
  });

  it("marks overdue installments", () => {
    const plan = buildInstallmentPlan({
      totalAmount: "10000",
      downPayment: "0",
      installmentCount: 2,
      startDate: "2026-01-01",
    });
    const marked = markOverdueSchedule(plan.schedule, "2026-02-15");
    expect(marked[0]?.status).toBe("overdue");
  });
});
