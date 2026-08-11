import { addDecimal, compareDecimal } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface CreditCheckInput {
  creditLimit: string;
  outstanding: string;
  additionalCredit: string;
  creditDays: number;
  isBlocked: boolean;
  asOfDate?: string; // YYYY-MM-DD
  oldestOpenDueDate?: string | null;
}

export interface CreditCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  projectedOutstanding: string;
  isOverdue: boolean;
  dueDate: string | null;
  reason?: string;
}

export function projectDueDate(fromDate: string, creditDays: number): string {
  const d = new Date(`${fromDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + creditDays);
  return d.toISOString().slice(0, 10);
}

export function isOverdue(dueDate: string | null | undefined, asOfDate: string): boolean {
  if (!dueDate) return false;
  return dueDate < asOfDate;
}

export function evaluateCredit(input: CreditCheckInput): CreditCheckResult {
  if (input.isBlocked) {
    return {
      allowed: false,
      requiresApproval: false,
      projectedOutstanding: input.outstanding,
      isOverdue: false,
      dueDate: null,
      reason: "Customer is blocked",
    };
  }

  const asOf = input.asOfDate ?? new Date().toISOString().slice(0, 10);
  const projected = addDecimal(input.outstanding, input.additionalCredit);
  const overdue = isOverdue(input.oldestOpenDueDate, asOf);
  const dueDate = projectDueDate(asOf, input.creditDays);
  const overLimit = compareDecimal(projected, input.creditLimit) > 0;

  if (overLimit) {
    return {
      allowed: false,
      requiresApproval: true,
      projectedOutstanding: projected,
      isOverdue: overdue,
      dueDate,
      reason: "Credit limit exceeded",
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    projectedOutstanding: projected,
    isOverdue: overdue,
    dueDate,
  };
}

export function assertCreditAllowed(result: CreditCheckResult, hasApproval: boolean): void {
  if (result.reason === "Customer is blocked") {
    throw new ValidationDomainError(result.reason);
  }
  if (result.requiresApproval && !hasApproval) {
    throw new ValidationDomainError("Credit approval required: limit exceeded");
  }
  if (!result.allowed && !hasApproval) {
    throw new ValidationDomainError(result.reason ?? "Credit not allowed");
  }
}
