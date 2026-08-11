import { ValidationDomainError } from "./errors.js";
import type { ApproverRole } from "@electronic-erp/contracts";

/**
 * Discount approval ladder (percent of base):
 * <5% cashier (automatic)
 * 5–10% supervisor
 * 10–20% manager
 * 20–50% owner
 * >50% special
 *
 * Limits are inclusive upper bounds for each role.
 */
export const DISCOUNT_LIMITS: Record<ApproverRole, number> = {
  cashier: 5,
  supervisor: 10,
  manager: 20,
  owner: 50,
  special: Number.POSITIVE_INFINITY,
};

const ROLE_RANK: Record<ApproverRole, number> = {
  cashier: 1,
  supervisor: 2,
  manager: 3,
  owner: 4,
  special: 5,
};

export function maxDiscountPercentForRole(role: ApproverRole): number {
  return DISCOUNT_LIMITS[role];
}

/** Lowest role that may approve this discount percent. */
export function requiredApproverRoleForPercent(percent: number): ApproverRole {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new ValidationDomainError("Discount percent cannot be negative");
  }
  if (percent <= 5) return "cashier";
  if (percent <= 10) return "supervisor";
  if (percent <= 20) return "manager";
  if (percent <= 50) return "owner";
  return "special";
}

export function roleCanApprovePercent(role: ApproverRole, percent: number): boolean {
  if (!Number.isFinite(percent) || percent < 0) return false;
  const required = requiredApproverRoleForPercent(percent);
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export function assertDiscountAllowed(
  role: ApproverRole,
  percent: number,
  _ownerUnlimited = false,
): void {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new ValidationDomainError("Discount percent cannot be negative");
  }
  if (!roleCanApprovePercent(role, percent)) {
    const max = DISCOUNT_LIMITS[role];
    throw new ValidationDomainError(
      `Discount ${percent}% exceeds ${role} limit of ${
        max === Number.POSITIVE_INFINITY ? "unlimited" : `${max}%`
      } (requires ${requiredApproverRoleForPercent(percent)})`,
    );
  }
}

export function effectiveDiscountPercent(amount: number, base: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(base) || base <= 0) return 0;
  if (amount <= 0) return 0;
  return Math.round((amount / base) * 10000) / 100;
}

export type DiscountApprovalDecision = {
  percent: number;
  requiredRole: ApproverRole;
  actingRole: ApproverRole;
  allowed: boolean;
  needsApproval: boolean;
  maxAllowed: number;
};

export function evaluateDiscountApproval(input: {
  discountAmount: number;
  baseAmount: number;
  actingRole: ApproverRole;
}): DiscountApprovalDecision {
  const percent = effectiveDiscountPercent(input.discountAmount, input.baseAmount);
  const requiredRole = requiredApproverRoleForPercent(percent);
  const maxAllowed = maxDiscountPercentForRole(input.actingRole);
  const allowed = roleCanApprovePercent(input.actingRole, percent);
  return {
    percent,
    requiredRole,
    actingRole: input.actingRole,
    allowed,
    needsApproval: !allowed && percent > 0,
    maxAllowed,
  };
}
