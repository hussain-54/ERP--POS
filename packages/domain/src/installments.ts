import { addDecimal, compareDecimal, subtractDecimal } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";
import { roundMoney, finiteMoney } from "./money.js";

export type InstallmentFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface InstallmentPlanInput {
  totalAmount: string;
  downPayment: string;
  installmentCount: number;
  startDate: string; // YYYY-MM-DD
  frequency?: InstallmentFrequency;
  /** Percent of installment amount charged when overdue. */
  lateFeePercent?: number;
  /** Fixed late fee per overdue installment. */
  lateFeeFixed?: string;
}

export interface GeneratedInstallment {
  sequenceNo: number;
  dueDate: string;
  amount: string;
  status: "pending" | "overdue";
  lateFee?: string;
}

export function periodMonths(frequency: InstallmentFrequency): number {
  if (frequency === "weekly") return 7 / 30.4375; // approximated via days helper
  if (frequency === "biweekly") return 14 / 30.4375;
  if (frequency === "quarterly") return 3;
  return 1;
}

export function addInstallmentPeriod(isoDate: string, frequency: InstallmentFrequency, periods: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  if (frequency === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7 * periods);
  } else if (frequency === "biweekly") {
    d.setUTCDate(d.getUTCDate() + 14 * periods);
  } else if (frequency === "quarterly") {
    d.setUTCMonth(d.getUTCMonth() + 3 * periods);
  } else {
    d.setUTCMonth(d.getUTCMonth() + periods);
  }
  return d.toISOString().slice(0, 10);
}

/** Late fee for one installment line. */
export function computeInstallmentLateFee(input: {
  installmentAmount: string;
  lateFeePercent?: number;
  lateFeeFixed?: string;
  isOverdue: boolean;
}): string {
  if (!input.isOverdue) return "0";
  const base = finiteMoney(input.installmentAmount);
  const pct = Math.max(0, finiteMoney(input.lateFeePercent, 0));
  const fixed = Math.max(0, finiteMoney(input.lateFeeFixed, 0));
  return String(roundMoney((base * pct) / 100 + fixed));
}

export function buildInstallmentPlan(input: InstallmentPlanInput): {
  remainingAmount: string;
  monthlyAmount: string;
  frequency: InstallmentFrequency;
  lateFeePercent: number;
  lateFeeFixed: string;
  schedule: GeneratedInstallment[];
} {
  if (input.installmentCount <= 0) {
    throw new ValidationDomainError("Installment count must be positive");
  }
  if (compareDecimal(input.downPayment, input.totalAmount) > 0) {
    throw new ValidationDomainError("Down payment cannot exceed total");
  }
  const remaining = subtractDecimal(input.totalAmount, input.downPayment);
  if (compareDecimal(remaining, "0") <= 0) {
    throw new ValidationDomainError("Remaining amount must be positive for installments");
  }

  const frequency: InstallmentFrequency = input.frequency ?? "monthly";
  const lateFeePercent = Math.max(0, finiteMoney(input.lateFeePercent, 0));
  const lateFeeFixed = String(roundMoney(Math.max(0, finiteMoney(input.lateFeeFixed, 0))));
  const count = input.installmentCount;
  const base = (Number(remaining) / count).toFixed(2);
  const schedule: GeneratedInstallment[] = [];
  let allocated = "0";

  for (let i = 1; i <= count; i += 1) {
    const dueDate = addInstallmentPeriod(input.startDate, frequency, i - 1);
    let amount = base;
    if (i === count) {
      amount = subtractDecimal(remaining, allocated);
    } else {
      allocated = addDecimal(allocated, amount);
    }
    schedule.push({
      sequenceNo: i,
      dueDate,
      amount,
      status: "pending",
      lateFee: "0",
    });
  }

  return {
    remainingAmount: remaining,
    monthlyAmount: schedule[0]?.amount ?? "0",
    frequency,
    lateFeePercent,
    lateFeeFixed,
    schedule,
  };
}

export function markOverdueSchedule(
  schedule: GeneratedInstallment[],
  asOfDate: string,
  opts?: { lateFeePercent?: number; lateFeeFixed?: string },
): GeneratedInstallment[] {
  return schedule.map((item) => {
    if ((item.status === "pending" || item.status === "overdue") && item.dueDate < asOfDate) {
      const lateFee = computeInstallmentLateFee({
        installmentAmount: item.amount,
        lateFeePercent: opts?.lateFeePercent,
        lateFeeFixed: opts?.lateFeeFixed,
        isOverdue: true,
      });
      return { ...item, status: "overdue" as const, lateFee };
    }
    return item;
  });
}

export type InstallmentLineProgress = {
  sequenceNo: number;
  dueDate: string;
  amount: string;
  paid: string;
  remaining: string;
  status: string;
};

/** Paid / remaining / next due from stored plan + schedule. Does not post payments. */
export function installmentPlanProgress(input: {
  totalAmount: string;
  downPayment: string;
  planStatus: string;
  schedule: Array<{
    sequenceNo: number;
    dueDate: string;
    amount: string;
    paidAmount?: string;
    status: string;
  }>;
  asOfDate: string;
}): {
  paid: string;
  remaining: string;
  nextDueDate: string | null;
  status: string;
  lines: InstallmentLineProgress[];
} {
  const total = String(roundMoney(Math.max(0, finiteMoney(input.totalAmount))));
  const down = String(roundMoney(Math.max(0, finiteMoney(input.downPayment))));
  const lines: InstallmentLineProgress[] = input.schedule
    .slice()
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .map((item) => {
      const amount = String(roundMoney(Math.max(0, finiteMoney(item.amount))));
      const paidAmt = String(roundMoney(Math.max(0, finiteMoney(item.paidAmount, 0))));
      const remaining = subtractDecimal(amount, paidAmt);
      const remainingNum = Number(remaining);
      let status = item.status;
      if (remainingNum <= 1e-9) status = "paid";
      else if (item.status === "paid") status = Number(paidAmt) > 0 ? "partial" : "pending";
      if ((status === "pending" || status === "partial" || status === "overdue") && item.dueDate < input.asOfDate) {
        status = "overdue";
      }
      return {
        sequenceNo: item.sequenceNo,
        dueDate: item.dueDate,
        amount,
        paid: paidAmt,
        remaining: remainingNum < 0 ? "0" : remaining,
        status,
      };
    });

  const schedulePaid = lines.reduce((sum, line) => addDecimal(sum, line.paid), "0");
  const paid = addDecimal(down, schedulePaid);
  const remainingRaw = subtractDecimal(total, paid);
  const remaining = Number(remainingRaw) < 0 ? "0" : remainingRaw;
  const nextOpen = lines.find((line) => line.status !== "paid" && line.status !== "waived");
  const closed = ["completed", "cancelled", "defaulted"].includes(input.planStatus);
  const status = closed
    ? input.planStatus
    : Number(remaining) <= 1e-9
      ? "completed"
      : lines.some((line) => line.status === "overdue")
        ? "overdue"
        : input.planStatus || "active";

  return {
    paid,
    remaining,
    nextDueDate: nextOpen?.dueDate ?? null,
    status,
    lines,
  };
}
