import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";
import type { DiscountKind } from "@electronic-erp/contracts";

export type DiscountMode = "percentage" | "fixed";

export type AppliedDiscount = {
  amount: number;
  percent: number;
  kind: DiscountKind;
  capped: boolean;
};

function finite(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/** Line / invoice gross before this discount (must be >= 0). */
export function assertNonNegativeBase(base: number, label = "Base"): void {
  if (!Number.isFinite(base) || base < 0) {
    throw new ValidationDomainError(`${label} cannot be negative or invalid`);
  }
}

/**
 * Apply an item or invoice discount.
 * Caps amount so discount never exceeds base; never returns NaN/negative.
 */
export function applyDiscount(input: {
  base: number;
  mode: DiscountMode;
  /** Percent 0–100 or fixed money amount depending on mode. */
  value: number;
  kind?: DiscountKind;
}): AppliedDiscount {
  assertNonNegativeBase(input.base);
  const value = finite(input.value);
  if (value < 0) throw new ValidationDomainError("Discount cannot be negative");

  const kind: DiscountKind = input.kind ?? (input.mode === "percentage" ? "percentage" : "fixed");
  let amount = 0;
  let percent = 0;
  let capped = false;

  if (input.mode === "percentage") {
    if (value > 100) throw new ValidationDomainError("Discount percent cannot exceed 100");
    percent = roundMoney(value);
    amount = roundMoney((input.base * percent) / 100);
  } else {
    amount = roundMoney(value);
    percent = input.base > 0 ? roundMoney((amount / input.base) * 100) : 0;
  }

  if (amount - input.base > 1e-9) {
    amount = roundMoney(input.base);
    percent = input.base > 0 ? 100 : 0;
    capped = true;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationDomainError("Invalid discount amount");
  }

  return { amount, percent, kind, capped };
}

export function applyCustomerDiscount(base: number, customerPercent: number): AppliedDiscount {
  return applyDiscount({
    base,
    mode: "percentage",
    value: customerPercent,
    kind: "customer",
  });
}

export function applyPromotionDiscount(base: number, amountOrPercent: {
  mode: DiscountMode;
  value: number;
}): AppliedDiscount {
  return applyDiscount({
    base,
    mode: amountOrPercent.mode,
    value: amountOrPercent.value,
    kind: "promotion",
  });
}

export type BulkBreak = { minQty: number; percent: number };

/** Highest matching bulk percent for qty. */
export function resolveBulkDiscountPercent(qty: number, breaks: BulkBreak[]): number {
  if (!(qty > 0) || !breaks.length) return 0;
  const sorted = [...breaks]
    .filter((b) => b.minQty > 0 && b.percent >= 0)
    .sort((a, b) => b.minQty - a.minQty);
  const hit = sorted.find((b) => qty + 1e-9 >= b.minQty);
  return hit ? finite(hit.percent) : 0;
}

export function applyBulkDiscount(base: number, qty: number, breaks: BulkBreak[]): AppliedDiscount {
  const percent = resolveBulkDiscountPercent(qty, breaks);
  return applyDiscount({ base, mode: "percentage", value: percent, kind: "bulk" });
}

/** Ensure line discount money does not exceed qty * unitPrice. */
export function capLineDiscount(qty: number, unitPrice: number, discount: number): number {
  const gross = roundMoney(Math.max(0, finite(qty)) * Math.max(0, finite(unitPrice)));
  const disc = roundMoney(Math.max(0, finite(discount)));
  if (!Number.isFinite(disc)) return 0;
  return disc > gross ? gross : disc;
}

/**
 * Stack policy for POS: item discounts first, then optional customer/promo/bulk on remaining,
 * then invoice discount on cart subtotal after item discounts.
 * This helper only computes amounts — cart orchestration calls it.
 */
export function computeStackedLineDiscount(input: {
  qty: number;
  unitPrice: number;
  item?: { mode: DiscountMode; value: number };
  customerPercent?: number;
  promotion?: { mode: DiscountMode; value: number };
  bulkBreaks?: BulkBreak[];
}): { discountTotal: number; parts: AppliedDiscount[] } {
  const gross = roundMoney(Math.max(0, finite(input.qty)) * Math.max(0, finite(input.unitPrice)));
  let remaining = gross;
  const parts: AppliedDiscount[] = [];

  const applyPart = (part: AppliedDiscount) => {
    const take = Math.min(part.amount, remaining);
    if (take <= 0) return;
    parts.push({ ...part, amount: roundMoney(take) });
    remaining = roundMoney(remaining - take);
  };

  if (input.item && input.item.value > 0) {
    applyPart(applyDiscount({ base: remaining, ...input.item, kind: input.item.mode === "percentage" ? "percentage" : "fixed" }));
  }
  if (input.customerPercent && input.customerPercent > 0) {
    applyPart(applyCustomerDiscount(remaining, input.customerPercent));
  }
  if (input.promotion && input.promotion.value > 0) {
    applyPart(applyPromotionDiscount(remaining, input.promotion));
  }
  if (input.bulkBreaks?.length) {
    applyPart(applyBulkDiscount(remaining, input.qty, input.bulkBreaks));
  }

  const discountTotal = roundMoney(parts.reduce((s, p) => s + p.amount, 0));
  if (discountTotal - gross > 1e-9) {
    throw new ValidationDomainError("Stacked discounts exceed line amount");
  }
  return { discountTotal, parts };
}
