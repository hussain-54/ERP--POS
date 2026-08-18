/**
 * POS payment dock display helpers.
 * Settlement math stays in domain preparePosPayments — this file only labels and orders methods.
 */
import { isRecordOnlyPaymentKind } from "@electronic-erp/domain";
import type { PaySplit } from "./pos-types";

/** Visual order for the industrial payment pad. Unknown kinds append last. */
export const POS_PAYMENT_KIND_ORDER = [
  "cash",
  "card",
  "bank",
  "jazzcash",
  "easypaisa",
  "sadapay",
  "online",
  "other",
  "credit",
  "installment",
] as const;

const KIND_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank: "Bank Transfer",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  sadapay: "SadaPay",
  online: "Other Wallet",
  other: "Other Wallet",
  credit: "Credit / Udhar",
  installment: "Installment",
};

export type PosPaymentMethod = {
  id: string;
  name: string;
  code?: string;
  kind?: string;
};

export function paymentMethodKind(method: PosPaymentMethod | undefined): string {
  return String(method?.kind ?? method?.code ?? "").toLowerCase();
}

export function paymentMethodLabel(method: PosPaymentMethod): string {
  const kind = paymentMethodKind(method);
  return KIND_LABEL[kind] ?? method.name;
}

export function isCashPaymentKind(kind: string | null | undefined): boolean {
  return String(kind ?? "").toLowerCase() === "cash";
}

export function isCreditPaymentKind(kind: string | null | undefined): boolean {
  const value = String(kind ?? "").toLowerCase();
  return value === "credit" || value === "udhar";
}

export function isInstallmentPaymentKind(kind: string | null | undefined): boolean {
  return String(kind ?? "").toLowerCase() === "installment";
}

export function isCreditLikePaymentKind(kind: string | null | undefined): boolean {
  return isCreditPaymentKind(kind) || isInstallmentPaymentKind(kind);
}

export function paymentMethodSettlementNote(kind: string | null | undefined): string | null {
  const value = String(kind ?? "").toLowerCase();
  if (isRecordOnlyPaymentKind(value)) {
    return "Recorded locally — no gateway settlement";
  }
  if (isCreditPaymentKind(value)) {
    return "Credit / Udhar — records AR, does not collect cash";
  }
  if (isInstallmentPaymentKind(value)) {
    return "Installment — uses the existing installment plan, not a card processor";
  }
  return null;
}

export function sortPosPaymentMethods(methods: readonly PosPaymentMethod[]): PosPaymentMethod[] {
  const rank = new Map(POS_PAYMENT_KIND_ORDER.map((kind, index) => [kind, index]));
  return [...methods].sort((a, b) => {
    const aRank = rank.get(paymentMethodKind(a) as (typeof POS_PAYMENT_KIND_ORDER)[number]) ?? 100;
    const bRank = rank.get(paymentMethodKind(b) as (typeof POS_PAYMENT_KIND_ORDER)[number]) ?? 100;
    if (aRank !== bRank) return aRank - bRank;
    return paymentMethodLabel(a).localeCompare(paymentMethodLabel(b));
  });
}

export function selectedPaymentMethodId(payments: readonly PaySplit[]): string | null {
  const active = payments.find((line) => Number(line.amount || 0) > 0) ?? payments[0];
  return active?.paymentMethodId ?? null;
}

export function selectedPaymentKind(
  payments: readonly PaySplit[],
  methods: readonly PosPaymentMethod[],
): string {
  const id = selectedPaymentMethodId(payments);
  const method = methods.find((item) => item.id === id);
  return paymentMethodKind(method) || String(payments[0]?.methodKind ?? "");
}
