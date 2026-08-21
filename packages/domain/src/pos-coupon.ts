/**
 * POS coupon evaluation — pure domain.
 * Applies through existing invoice-discount / sale-totals path. Do not invent a second cart engine.
 */
import { applyDiscount } from "./pos-discount.js";
import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";

export type PosCouponRecord = {
  id: string;
  code: string;
  discountMode: "percentage" | "fixed";
  discountValue: number;
  minPurchase: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  customerRedemptionCount: number;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

export type PosCouponEvaluation = {
  couponId: string;
  code: string;
  amount: number;
  percent: number;
  mode: "percentage" | "fixed";
  capped: boolean;
};

function parseTime(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Validate a coupon against cart subtotal (after line discounts, before invoice discount).
 */
export function evaluatePosCoupon(input: {
  coupon: PosCouponRecord;
  /** Eligible purchase base (usually subtotal − item discounts). */
  purchaseBase: number;
  now?: Date;
}): PosCouponEvaluation {
  const coupon = input.coupon;
  const now = (input.now ?? new Date()).getTime();
  const code = normalizeCouponCode(coupon.code);
  if (!code) throw new ValidationDomainError("Coupon code is required");
  if (!coupon.isActive) throw new ValidationDomainError("Coupon is inactive");

  const from = parseTime(coupon.validFrom);
  const to = parseTime(coupon.validTo);
  if (from != null && now < from) throw new ValidationDomainError("Coupon is not valid yet");
  if (to != null && now > to) throw new ValidationDomainError("Coupon has expired");

  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    throw new ValidationDomainError("Coupon usage limit reached");
  }
  if (
    coupon.perCustomerLimit != null &&
    coupon.customerRedemptionCount >= coupon.perCustomerLimit
  ) {
    throw new ValidationDomainError("Customer coupon usage limit reached");
  }

  const base = roundMoney(Math.max(0, input.purchaseBase));
  if (base + 1e-9 < roundMoney(Math.max(0, coupon.minPurchase))) {
    throw new ValidationDomainError(
      `Minimum purchase of ${roundMoney(coupon.minPurchase).toFixed(2)} required for this coupon`,
    );
  }

  const applied = applyDiscount({
    base,
    mode: coupon.discountMode,
    value: coupon.discountValue,
    kind: "coupon",
  });

  let amount = applied.amount;
  let capped = applied.capped;
  if (coupon.maxDiscount != null && amount - coupon.maxDiscount > 1e-9) {
    amount = roundMoney(coupon.maxDiscount);
    capped = true;
  }

  return {
    couponId: coupon.id,
    code,
    amount,
    percent: applied.percent,
    mode: coupon.discountMode,
    capped,
  };
}
