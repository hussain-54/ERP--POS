import { describe, expect, it } from "vitest";
import {
  PaymentAttemptGate,
  classifyPosPaymentType,
  classifySaleSettlement,
  preparePosPayments,
  resolveCashTender,
  resolveCheckoutIdempotencyKey,
  validatePosCreditPayment,
} from "./pos-payment.js";
import { buildInstallmentPlan, computeInstallmentLateFee, markOverdueSchedule } from "./installments.js";

const cash = "11111111-1111-4111-8111-111111111111";
const bank = "22222222-2222-4222-8222-222222222222";
const card = "33333333-3333-4333-8333-333333333333";
const jazz = "44444444-4444-4444-8444-444444444444";
const easy = "55555555-5555-4555-8555-555555555555";
const sada = "66666666-6666-4666-8666-666666666666";
const credit = "77777777-7777-4777-8777-777777777777";

describe("pos-payment methods and types", () => {
  it("cash: amount received + change", () => {
    const tender = resolveCashTender({ grandTotal: 1000, amountReceived: 1200 });
    expect(tender.applied).toBe(1000);
    expect(tender.change).toBe(200);

    const prep = preparePosPayments({
      grandTotal: 1000,
      lines: [{ paymentMethodId: cash, kind: "cash", amount: 1200, amountReceived: 1200 }],
      walkIn: true,
      hasCustomer: false,
      allowCreditDue: false,
    });
    expect(prep.ok).toBe(true);
    expect(prep.paymentType).toBe("cash");
    expect(prep.paidTowardBill).toBe(1000);
    expect(prep.change).toBe(200);
    expect(prep.splits[0]?.amount).toBe("1000");
    expect(prep.paymentStatus).toBe("paid");
  });

  it("full payment via bank / card / wallets", () => {
    const other = "88888888-8888-4888-8888-888888888888";
    for (const [id, kind] of [
      [bank, "bank"],
      [card, "card"],
      [jazz, "jazzcash"],
      [easy, "easypaisa"],
      [sada, "sadapay"],
      [other, "other"],
    ] as const) {
      const prep = preparePosPayments({
        grandTotal: 500,
        lines: [{ paymentMethodId: id, kind, amount: 500 }],
        walkIn: true,
        hasCustomer: false,
        allowCreditDue: false,
      });
      expect(prep.ok).toBe(true);
      expect(prep.paymentStatus).toBe("paid");
      expect(prep.paidTowardBill).toBe(500);
    }
  });

  it("partial: paid + remaining", () => {
    const prep = preparePosPayments({
      grandTotal: 1000,
      lines: [{ paymentMethodId: cash, kind: "cash", amount: 400 }],
      walkIn: false,
      hasCustomer: true,
      allowCreditDue: true,
    });
    expect(prep.ok).toBe(true);
    expect(prep.paymentType).toBe("partial");
    expect(prep.paidTowardBill).toBe(400);
    expect(prep.remaining).toBe(600);
    expect(prep.paymentStatus).toBe("partial");
  });

  it("split: multiple methods reconcile", () => {
    const prep = preparePosPayments({
      grandTotal: 1000,
      lines: [
        { paymentMethodId: cash, kind: "cash", amount: 400 },
        { paymentMethodId: bank, kind: "bank", amount: 300 },
        { paymentMethodId: jazz, kind: "jazzcash", amount: 300 },
      ],
      walkIn: true,
      hasCustomer: false,
      allowCreditDue: false,
    });
    expect(prep.ok).toBe(true);
    expect(prep.paymentType).toBe("split");
    expect(prep.paidTowardBill).toBe(1000);
    expect(prep.splits).toHaveLength(3);
  });

  it("advance payment type", () => {
    const prep = preparePosPayments({
      grandTotal: 2000,
      lines: [{ paymentMethodId: bank, kind: "bank", amount: 500 }],
      walkIn: false,
      hasCustomer: true,
      allowCreditDue: true,
      isAdvance: true,
    });
    expect(prep.paymentType).toBe("advance");
    expect(prep.remaining).toBe(1500);
  });

  it("credit/udhar validates customer rules", () => {
    const prep = preparePosPayments({
      grandTotal: 800,
      lines: [{ paymentMethodId: credit, kind: "credit", amount: 0 }],
      walkIn: false,
      hasCustomer: true,
      allowCreditDue: true,
    });
    expect(prep.paymentType).toBe("credit");
    expect(prep.paidTowardBill).toBe(0);
    expect(prep.remaining).toBe(800);

    expect(() =>
      validatePosCreditPayment({
        creditLimit: "1000",
        outstanding: "900",
        creditDays: 30,
        isBlocked: false,
        additionalCredit: "200",
        hasApproval: false,
      }),
    ).toThrow(/approval/i);

    expect(() =>
      validatePosCreditPayment({
        creditLimit: "1000",
        outstanding: "0",
        creditDays: 30,
        isBlocked: true,
        additionalCredit: "100",
        hasApproval: true,
      }),
    ).toThrow(/blocked/i);
  });

  it("installment plan: down payment, count, frequency, due dates, monthly, late fee", () => {
    const plan = buildInstallmentPlan({
      totalAmount: "12000",
      downPayment: "3000",
      installmentCount: 3,
      startDate: "2026-01-15",
      frequency: "monthly",
      lateFeePercent: 2,
      lateFeeFixed: "50",
    });
    expect(Number(plan.remainingAmount)).toBe(9000);
    expect(plan.schedule).toHaveLength(3);
    expect(plan.schedule[0]?.dueDate).toBe("2026-01-15");
    expect(plan.schedule[1]?.dueDate).toBe("2026-02-15");
    expect(plan.monthlyAmount).toBe(plan.schedule[0]?.amount);

    const overdue = markOverdueSchedule(plan.schedule, "2026-03-01", {
      lateFeePercent: 2,
      lateFeeFixed: "50",
    });
    expect(overdue.filter((s) => s.status === "overdue").length).toBeGreaterThanOrEqual(2);
    expect(Number(overdue[0]?.lateFee ?? 0)).toBeGreaterThan(0);
    expect(computeInstallmentLateFee({
      installmentAmount: "1000",
      lateFeePercent: 5,
      lateFeeFixed: "10",
      isOverdue: true,
    })).toBe("60");
  });

  it("walk-in unpaid is rejected", () => {
    const prep = preparePosPayments({
      grandTotal: 100,
      lines: [],
      walkIn: true,
      hasCustomer: false,
      allowCreditDue: false,
    });
    expect(prep.ok).toBe(false);
  });

  it("payment attempt gate prevents duplicate pending submission", () => {
    const gate = new PaymentAttemptGate();
    const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(gate.begin(key).status).toBe("pending");
    expect(() => gate.begin(key)).toThrow(/duplicate|in progress/i);
    gate.fail(key, "network");
    expect(gate.retry(key).status).toBe("retry");
    gate.begin(key);
    expect(gate.succeed(key).status).toBe("success");
    expect(gate.begin(key).status).toBe("success");
  });

  it("classifyPosPaymentType covers full", () => {
    expect(
      classifyPosPaymentType({
        lines: [{ paymentMethodId: bank, kind: "bank", amount: 100 }],
        grandTotal: 100,
        paidTowardBill: 100,
      }),
    ).toBe("full");
  });

  it("insufficient payment is rejected unless credit remainder is allowed", () => {
    const walkIn = preparePosPayments({
      grandTotal: 1000,
      lines: [{ paymentMethodId: cash, kind: "cash", amount: 400 }],
      walkIn: true,
      hasCustomer: false,
      allowCreditDue: false,
    });
    expect(walkIn.ok).toBe(false);
    expect(walkIn.errors.join(" ")).toMatch(/walk-in|full|less than grand/i);

    const noCredit = preparePosPayments({
      grandTotal: 1000,
      lines: [{ paymentMethodId: cash, kind: "cash", amount: 400 }],
      walkIn: false,
      hasCustomer: true,
      allowCreditDue: false,
      allowRemaining: false,
    });
    expect(noCredit.ok).toBe(false);
    expect(noCredit.errors.join(" ")).toMatch(/less than grand/i);
  });

  it("installment and credit method rows are informational — they do not post payment splits", () => {
    const installment = "99999999-9999-4999-8999-999999999999";
    const prep = preparePosPayments({
      grandTotal: 800,
      lines: [
        { paymentMethodId: cash, kind: "cash", amount: 200 },
        { paymentMethodId: installment, kind: "installment", amount: 600 },
      ],
      walkIn: false,
      hasCustomer: true,
      allowCreditDue: true,
      useInstallment: true,
      allowRemaining: true,
    });
    expect(prep.ok).toBe(true);
    expect(prep.paymentType).toBe("installment");
    expect(prep.paidTowardBill).toBe(200);
    expect(prep.remaining).toBe(600);
    expect(prep.splits).toHaveLength(1);
    expect(prep.splits[0]?.kind).toBe("cash");
  });

  it("classifySaleSettlement splits cash vs bank/record-only tenders", () => {
    expect(classifySaleSettlement([{ amount: 100 }])).toEqual({ paidCash: 100, paidBank: 0 });
    expect(
      classifySaleSettlement([
        { amount: 40, kind: "cash" },
        { amount: 30, kind: "bank" },
        { amount: 30, kind: "jazzcash" },
      ]),
    ).toEqual({ paidCash: 40, paidBank: 60 });
    expect(classifySaleSettlement([{ amount: 50, kind: "card" }])).toEqual({
      paidCash: 0,
      paidBank: 50,
    });
  });

  it("keeps the checkout UUID on failure/retry and rotates only after posted or new-sale", () => {
    const current = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(resolveCheckoutIdempotencyKey({ currentKey: current, event: "failed" })).toEqual({
      keep: current,
    });
    expect(resolveCheckoutIdempotencyKey({ currentKey: current, event: "retry" })).toEqual({
      keep: current,
    });
    expect(resolveCheckoutIdempotencyKey({ currentKey: current, event: "posted" })).toEqual({
      rotate: true,
    });
    expect(resolveCheckoutIdempotencyKey({ currentKey: current, event: "new-sale" })).toEqual({
      rotate: true,
    });
  });
});
