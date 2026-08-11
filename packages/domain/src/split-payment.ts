import { addDecimal, compareDecimal, type PaymentMethodKind } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface SplitLine {
  paymentMethodId: string;
  kind?: PaymentMethodKind;
  amount: string;
  reference?: string;
}

export function sumSplits(splits: SplitLine[]): string {
  return splits.reduce((acc, s) => addDecimal(acc, s.amount), "0");
}

export function assertSplitMatchesBill(splits: SplitLine[], billTotal?: string): string {
  const total = sumSplits(splits);
  if (compareDecimal(total, "0") <= 0) {
    throw new ValidationDomainError("Payment total must be positive");
  }
  if (billTotal != null && compareDecimal(total, billTotal) !== 0) {
    throw new ValidationDomainError(
      `Split payment total ${total} must equal bill total ${billTotal}`,
    );
  }
  return total;
}

export function creditPortion(splits: SplitLine[], kindByMethodId: Map<string, PaymentMethodKind>): string {
  return splits.reduce((acc, s) => {
    const kind = s.kind ?? kindByMethodId.get(s.paymentMethodId);
    if (kind === "credit" || kind === "installment") {
      return addDecimal(acc, s.amount);
    }
    return acc;
  }, "0");
}

/** Example: 50000 bill = 20000 cash + 20000 bank + 10000 credit */
export function validateClassicSplitExample(splits: SplitLine[]): void {
  assertSplitMatchesBill(splits, "50000");
}
