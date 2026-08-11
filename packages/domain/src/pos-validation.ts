import { effectiveDiscountPercent, maxDiscountPercentForRole } from "./discount-policy.js";
import type { ApproverRole } from "@electronic-erp/contracts";
import type { PosCartLine, PosCartTotals } from "./pos-cart.js";
import { ValidationDomainError } from "./errors.js";

export type PosCheckoutValidation = {
  ok: boolean;
  errors: string[];
};

/**
 * Validate terminal cart + payment before calling posApi.postSale.
 * Does not touch DB — UI and API both may call this.
 */
export function validatePosCheckout(input: {
  cart: PosCartLine[];
  totals: PosCartTotals;
  branchId?: string | null;
  warehouseId?: string | null;
  walkIn: boolean;
  customerId?: string | null;
  paidTotal: number;
  allowCreditDue: boolean;
}): PosCheckoutValidation {
  const errors: string[] = [];
  if (!input.branchId) errors.push("Branch is required");
  if (!input.warehouseId) errors.push("Warehouse is required");
  if (!input.cart.length) errors.push("Cart is empty");

  for (const line of input.cart) {
    if (!line.unitId) errors.push(`Line "${line.name}" is missing unit`);
    if ((Number(line.qty) || 0) <= 0) errors.push(`Line "${line.name}" has invalid quantity`);
    if (line.unitPrice < 0) errors.push(`Line "${line.name}" has invalid price`);
    if (!line.isManual && !line.productId) errors.push(`Line "${line.name}" is missing product`);
    if (line.isManual && !line.name.trim()) errors.push("Manual line requires a name");
  }

  const grand = input.totals.grand;
  const paid = input.paidTotal;
  if (input.walkIn || !input.customerId) {
    if (paid + 1e-9 < grand) {
      errors.push("Walk-in sales must be paid in full");
    }
  } else if (!input.allowCreditDue && paid + 1e-9 < grand) {
    errors.push("Payment is less than grand total");
  }

  if (paid <= 0 && !(input.allowCreditDue && !input.walkIn && input.customerId && grand > 0)) {
    errors.push("Enter payment amount or select customer for credit");
  }

  return { ok: errors.length === 0, errors };
}

export function assertPosCheckout(input: Parameters<typeof validatePosCheckout>[0]): void {
  const result = validatePosCheckout(input);
  if (!result.ok) {
    throw new ValidationDomainError(result.errors[0] ?? "Checkout validation failed");
  }
}

/** Whether invoice discount needs a higher role than the acting cashier. */
export function invoiceDiscountNeedsApproval(input: {
  invoiceDiscount: number;
  subtotal: number;
  actingRole: ApproverRole;
}): { needsApproval: boolean; percent: number; maxAllowed: number } {
  const percent = effectiveDiscountPercent(input.invoiceDiscount, input.subtotal);
  const maxAllowed = maxDiscountPercentForRole(input.actingRole);
  return {
    needsApproval: percent - maxAllowed > 1e-9,
    percent,
    maxAllowed,
  };
}

/** Map session permissions to ApproverRole for discount policy. */
export function approverRoleFromPermissions(perms: {
  owner: boolean;
  manager: boolean;
  cashier: boolean;
}): ApproverRole {
  if (perms.owner) return "owner";
  if (perms.manager) return "manager";
  return "cashier";
}
