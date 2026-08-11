import { ValidationDomainError } from "./errors.js";
import type { ApproverRole } from "@electronic-erp/contracts";

/** Cashier max 5%, Manager max 15%, Owner unlimited (configured). */
export const DISCOUNT_LIMITS: Record<ApproverRole, number> = {
  cashier: 5,
  manager: 15,
  owner: Number.POSITIVE_INFINITY,
};

export function maxDiscountPercentForRole(role: ApproverRole): number {
  return DISCOUNT_LIMITS[role];
}

export function assertDiscountAllowed(
  role: ApproverRole,
  percent: number,
  ownerUnlimited = true,
): void {
  if (percent < 0) throw new ValidationDomainError("Discount percent cannot be negative");
  const max = role === "owner" && ownerUnlimited ? Number.POSITIVE_INFINITY : DISCOUNT_LIMITS[role];
  if (percent - max > 1e-9) {
    throw new ValidationDomainError(
      `Discount ${percent}% exceeds ${role} limit of ${max === Number.POSITIVE_INFINITY ? "unlimited" : `${max}%`}`,
    );
  }
}

export function effectiveDiscountPercent(amount: number, base: number): number {
  if (base <= 0) return 0;
  return Math.round((amount / base) * 10000) / 100;
}
