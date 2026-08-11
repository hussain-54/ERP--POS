import type { Customer, CustomerSearchHit, CustomerType } from "@electronic-erp/contracts";
import { priceBookForCustomerType } from "./commerce.js";
import { evaluateCredit, type CreditCheckResult } from "./credit.js";
import { ValidationDomainError } from "./errors.js";

/** POS customer selection mode for the current sale. */
export type PosCustomerMode = "walk_in" | "existing" | "new";

export type PosPriceLevelFromCustomer = "retail" | "wholesale" | "dealer";

/** Session-safe customer summary — sensitive fields masked / optional. */
export type PosCustomerProfile = {
  id: string;
  code: string;
  name: string;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  /** Masked CNIC for display (never full unless explicitly revealed). */
  cnicMasked?: string | null;
  customerType: CustomerType;
  creditLimit: string;
  creditDays: number;
  outstanding: string;
  isBlocked: boolean;
  loyaltyPoints?: number | null;
  priceLevel: PosPriceLevelFromCustomer;
};

export function priceLevelForCustomerType(customerType: CustomerType): PosPriceLevelFromCustomer {
  return priceBookForCustomerType(customerType);
}

export function maskCnicSimple(cnic: string | null | undefined): string | null {
  if (!cnic?.trim()) return null;
  const t = cnic.trim();
  if (t.length <= 4) return "****";
  return `${"*".repeat(Math.min(t.length - 4, 12))}${t.slice(-4)}`;
}

export function toCustomerSearchHit(c: Pick<Customer, "id" | "code" | "name" | "mobile" | "customerType">): CustomerSearchHit {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    mobile: c.mobile ?? null,
    customerType: c.customerType,
  };
}

export function toPosCustomerProfile(
  c: Customer,
  opts?: { loyaltyPoints?: number | null; revealCnic?: boolean },
): PosCustomerProfile {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    mobile: c.mobile ?? null,
    email: c.email ?? null,
    address: c.address ?? null,
    cnicMasked: opts?.revealCnic ? (c.cnic ?? null) : maskCnicSimple(c.cnic),
    customerType: c.customerType,
    creditLimit: c.creditLimit,
    creditDays: c.creditDays,
    outstanding: c.outstanding,
    isBlocked: c.isBlocked,
    loyaltyPoints: opts?.loyaltyPoints ?? null,
    priceLevel: priceLevelForCustomerType(c.customerType),
  };
}

export function resolvePosCustomerMode(input: {
  walkIn: boolean;
  customerId?: string | null;
  isNewSelection?: boolean;
}): PosCustomerMode {
  if (input.walkIn || !input.customerId) return "walk_in";
  if (input.isNewSelection) return "new";
  return "existing";
}

export function assertPosCustomerForSale(input: {
  mode: PosCustomerMode;
  customer?: PosCustomerProfile | null;
}): void {
  if (input.mode === "walk_in") return;
  if (!input.customer?.id) {
    throw new ValidationDomainError("Select a customer or use Walk-in");
  }
  if (input.customer.isBlocked) {
    throw new ValidationDomainError("Customer is blocked");
  }
}

export function evaluatePosCustomerCredit(input: {
  customer: PosCustomerProfile;
  additionalCredit: string;
}): CreditCheckResult {
  return evaluateCredit({
    creditLimit: input.customer.creditLimit,
    outstanding: input.customer.outstanding,
    additionalCredit: input.additionalCredit,
    creditDays: input.customer.creditDays,
    isBlocked: input.customer.isBlocked,
  });
}

/** Normalize empty email to undefined for create payloads. */
export function normalizeCustomerEmail(email?: string | null): string | undefined {
  const t = email?.trim();
  if (!t) return undefined;
  return t;
}
