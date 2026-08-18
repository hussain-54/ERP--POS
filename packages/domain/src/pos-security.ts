import type { ApproverRole, CreateSaleInput } from "@electronic-erp/contracts";
import { permissionSatisfied } from "./rbac-catalog.js";
import { ForbiddenDomainError, ValidationDomainError } from "./errors.js";
import { assertCreditAllowed, evaluateCredit, type CreditCheckResult } from "./credit.js";
import { calculateSaleTotals } from "./sale-totals.js";
import { preparePosPayments } from "./pos-payment.js";

/**
 * POS sensitive-action map against the existing RBAC catalog.
 * Do not invent keys here — missing product capabilities are listed as unavailable.
 */
export const POS_SENSITIVE_PERMISSIONS = {
  sell: "pos.sell",
  hold: "pos.hold",
  resumeAny: "pos.resume_any",
  return: "pos.return",
  viewInvoices: "pos.view_invoices",
  shift: "pos.shift",
  configure: "pos.configure",
  discountCashier: "pos.discount_cashier",
  discountSupervisor: "pos.discount_supervisor",
  discountManager: "pos.discount_manager",
  discountOwner: "pos.discount_owner",
  discountSpecial: "pos.discount_special",
  creditApprove: "credit.approve",
  installmentsManage: "installments.manage",
  paymentsReceive: "payments.receive",
  cashDrawerOpen: "cash_drawer.open",
} as const;

export const POS_DISCOUNT_PERMISSIONS = [
  POS_SENSITIVE_PERMISSIONS.discountSpecial,
  POS_SENSITIVE_PERMISSIONS.discountOwner,
  POS_SENSITIVE_PERMISSIONS.discountManager,
  POS_SENSITIVE_PERMISSIONS.discountSupervisor,
  POS_SENSITIVE_PERMISSIONS.discountCashier,
] as const;

export const POS_PRICE_OVERRIDE_PERMISSIONS = [
  POS_SENSITIVE_PERMISSIONS.discountManager,
  POS_SENSITIVE_PERMISSIONS.discountOwner,
  POS_SENSITIVE_PERMISSIONS.discountSpecial,
] as const;

/** Capabilities with no live mutation — do not invent keys or endpoints for these. */
export const POS_UNAVAILABLE_SENSITIVE_ACTIONS = [
  "void_posted_sale",
  "cash_in",
  "cash_out",
  "payment_reversal",
] as const;

export function grantedHas(granted: readonly string[], required: string): boolean {
  return permissionSatisfied([...granted], required);
}

export function canPosDiscount(granted: readonly string[]): boolean {
  return POS_DISCOUNT_PERMISSIONS.some((key) => grantedHas(granted, key));
}

export function canPosPriceOverride(granted: readonly string[]): boolean {
  return POS_PRICE_OVERRIDE_PERMISSIONS.some((key) => grantedHas(granted, key));
}

export function posDiscountRoleFromPermissions(granted: readonly string[]): ApproverRole | null {
  if (grantedHas(granted, POS_SENSITIVE_PERMISSIONS.discountSpecial)) return "special";
  if (grantedHas(granted, POS_SENSITIVE_PERMISSIONS.discountOwner)) return "owner";
  if (grantedHas(granted, POS_SENSITIVE_PERMISSIONS.discountManager)) return "manager";
  if (grantedHas(granted, POS_SENSITIVE_PERMISSIONS.discountSupervisor)) return "supervisor";
  if (grantedHas(granted, POS_SENSITIVE_PERMISSIONS.discountCashier)) return "cashier";
  return null;
}

export function canMutateForeignHold(granted: readonly string[]): boolean {
  return grantedHas(granted, POS_SENSITIVE_PERMISSIONS.resumeAny);
}

export function canActOnOwnedOrForeignHold(input: {
  heldBy?: string | null;
  actorUserId?: string | null;
  granted: readonly string[];
}): boolean {
  if (!input.heldBy || !input.actorUserId) return true;
  if (input.heldBy === input.actorUserId) return true;
  return canMutateForeignHold(input.granted);
}

export function assertPosInstallmentSaleAllowed(canManage: boolean, creating: boolean): void {
  if (creating && !canManage) {
    throw new ForbiddenDomainError("Missing permission: installments.manage");
  }
}

export function assertPosCreditRemainderAllowed(input: {
  remaining: number;
  customerId?: string | null;
  credit: CreditCheckResult | null;
  canApproveOverLimit: boolean;
}): void {
  if (!(input.remaining > 0.009)) return;
  if (!input.customerId) {
    throw new ValidationDomainError("Credit remainder requires a customer");
  }
  if (!input.credit) {
    throw new ValidationDomainError("Customer credit profile is required");
  }
  if (input.credit.reason === "Customer is blocked") {
    throw new ValidationDomainError(input.credit.reason);
  }
  if (input.credit.requiresApproval && !input.canApproveOverLimit) {
    throw new ForbiddenDomainError("Missing permission: credit.approve");
  }
  assertCreditAllowed(input.credit, input.canApproveOverLimit);
}

export function estimatePostedSaleRemaining(input: CreateSaleInput): number {
  const totals = calculateSaleTotals(input.items, input.discountTotal ?? 0);
  const prep = preparePosPayments({
    grandTotal: totals.grandTotal,
    lines: (input.payments ?? []).map((p) => ({
      paymentMethodId: p.paymentMethodId,
      amount: typeof p.amount === "number" ? p.amount : Number(p.amount),
      amountReceived: p.amountReceived != null ? Number(p.amountReceived) : null,
      reference: p.reference,
      kind: p.methodKind,
    })),
    walkIn: !input.customerId,
    hasCustomer: Boolean(input.customerId),
    allowCreditDue: Boolean(input.customerId),
    useInstallment: Boolean(input.createInstallment),
    isAdvance: Boolean(input.isAdvancePayment),
    allowRemaining: Boolean(input.customerId),
  });
  return prep.remaining;
}

export function evaluateCustomerCreditForRemainder(input: {
  creditLimit: string;
  outstanding: string;
  creditDays: number;
  isBlocked: boolean;
  remaining: number;
}): CreditCheckResult {
  return evaluateCredit({
    creditLimit: input.creditLimit,
    outstanding: input.outstanding,
    additionalCredit: String(input.remaining),
    creditDays: input.creditDays,
    isBlocked: input.isBlocked,
  });
}
