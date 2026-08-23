import { preparePosPayments, type PosPaymentLineInput } from "@electronic-erp/domain";
import type { PosPaymentKind, PosPaymentLine } from "../types";
import { tenderToMethodKind } from "../types";

export function toPaymentInputs(lines: PosPaymentLine[]): PosPaymentLineInput[] {
  return lines
    .filter((l) => l.paymentMethodId && (l.amount > 0 || (l.amountReceived ?? 0) > 0))
    .map((l) => ({
      paymentMethodId: l.paymentMethodId!,
      kind: tenderToMethodKind(l.kind),
      amount: l.amount,
      amountReceived: l.amountReceived,
      reference: l.reference,
    }));
}

export function validatePosPayment(input: {
  grandTotal: number;
  lines: PosPaymentLine[];
  paymentKind: PosPaymentKind;
  walkIn: boolean;
  hasCustomer: boolean;
  useInstallment?: boolean;
}) {
  const allowRemaining =
    input.paymentKind === "credit" ||
    input.paymentKind === "installment" ||
    input.paymentKind === "partial";
  const allowCreditDue = input.hasCustomer && allowRemaining;

  return preparePosPayments({
    grandTotal: input.grandTotal,
    lines: toPaymentInputs(input.lines),
    walkIn: input.walkIn,
    hasCustomer: input.hasCustomer,
    allowCreditDue,
    useInstallment: input.useInstallment ?? input.paymentKind === "installment",
    allowRemaining: allowRemaining,
  });
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}
