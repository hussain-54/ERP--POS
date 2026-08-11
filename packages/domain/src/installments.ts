import { addDecimal, compareDecimal, subtractDecimal } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface InstallmentPlanInput {
  totalAmount: string;
  downPayment: string;
  installmentCount: number;
  startDate: string; // YYYY-MM-DD
}

export interface GeneratedInstallment {
  sequenceNo: number;
  dueDate: string;
  amount: string;
  status: "pending" | "overdue";
}

export function buildInstallmentPlan(input: InstallmentPlanInput): {
  remainingAmount: string;
  monthlyAmount: string;
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

  const count = input.installmentCount;
  const base = (Number(remaining) / count).toFixed(2);
  const schedule: GeneratedInstallment[] = [];
  let allocated = "0";

  for (let i = 1; i <= count; i += 1) {
    const dueDate = addMonths(input.startDate, i - 1);
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
    });
  }

  return {
    remainingAmount: remaining,
    monthlyAmount: schedule[0]?.amount ?? "0",
    schedule,
  };
}

export function markOverdueSchedule(
  schedule: GeneratedInstallment[],
  asOfDate: string,
): GeneratedInstallment[] {
  return schedule.map((item) => {
    if (item.status === "pending" && item.dueDate < asOfDate) {
      return { ...item, status: "overdue" as const };
    }
    return item;
  });
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
