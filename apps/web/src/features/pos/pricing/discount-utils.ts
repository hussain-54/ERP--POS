import type { ApproverRole } from "@electronic-erp/contracts";
import { evaluateDiscountApproval, roundMoney } from "@electronic-erp/domain";
import type { DiscountMode } from "../types";
import { money } from "../format";

export type DiscountSection =
  | "item"
  | "invoice"
  | "override"
  | "promotion"
  | "coupon"
  | "customer"
  | "referral"
  | "approval";

export function discountTypeLabel(mode: DiscountMode): string {
  switch (mode) {
    case "percentage":
      return "Percentage";
    case "fixed":
      return "Fixed amount";
    case "coupon":
      return "Coupon";
    case "promotion":
      return "Promotion";
    default:
      return mode;
  }
}

export function computeDiscountPreview(input: {
  mode: DiscountMode;
  base: number;
  percent: number;
  amount: number;
  actingRole: ApproverRole;
}) {
  const base = Math.max(0, input.base);
  let discountValue = "";
  let disc = 0;

  if (input.mode === "percentage" || input.mode === "promotion") {
    const pct = Math.min(100, Math.max(0, input.percent));
    disc = roundMoney((base * pct) / 100);
    discountValue = `${pct}%`;
  } else if (input.mode === "fixed") {
    disc = roundMoney(Math.min(Math.max(0, input.amount), base));
    discountValue = money(disc);
  } else if (input.mode === "coupon") {
    disc = roundMoney(Math.min(Math.max(0, input.amount), base));
    discountValue = input.amount > 0 ? money(disc) : "—";
  }

  const decision = evaluateDiscountApproval({
    discountAmount: disc,
    baseAmount: base || 1,
    actingRole: input.actingRole,
  });

  const finalAmount = Math.max(0, base - disc);

  return {
    currentAmount: base,
    discountType: discountTypeLabel(input.mode),
    discountValue,
    discountAmount: disc,
    finalAmount,
    decision,
    isNegativeTotal: finalAmount < 0,
    exceedsBase: disc > base + 1e-9,
    invalidPercent: (input.mode === "percentage" || input.mode === "promotion") && (input.percent < 0 || input.percent > 100),
  };
}

export type DiscountPreviewResult = ReturnType<typeof computeDiscountPreview>;

export const DISCOUNT_APPROVAL_LADDER: Array<{ role: string; maxPercent: number }> = [
  { role: "cashier", maxPercent: 5 },
  { role: "supervisor", maxPercent: 10 },
  { role: "manager", maxPercent: 20 },
  { role: "owner", maxPercent: 50 },
  { role: "special", maxPercent: 100 },
];
