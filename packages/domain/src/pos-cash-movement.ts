/** Cash drawer movement math — feeds shift expected cash. */
import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";

export type PosCashMovementKind = "cash_in" | "cash_out";

export function assertPosCashMovementInput(input: {
  kind: PosCashMovementKind;
  amount: number;
  reason: string;
}): { kind: PosCashMovementKind; amount: number; reason: string } {
  if (input.kind !== "cash_in" && input.kind !== "cash_out") {
    throw new ValidationDomainError("Cash movement kind must be cash_in or cash_out");
  }
  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationDomainError("Cash movement amount must be greater than zero");
  }
  const reason = input.reason.trim();
  if (!reason) throw new ValidationDomainError("Cash movement reason is required");
  return { kind: input.kind, amount, reason };
}

/**
 * Expected drawer cash for a shift.
 * opening + cash sales + cash in − cash out − cash refunds.
 */
export function expectedShiftCash(input: {
  openingFloat: number;
  cashSalesTotal: number;
  cashInTotal: number;
  cashOutTotal: number;
  cashRefundTotal?: number;
}): number {
  return roundMoney(
    roundMoney(input.openingFloat) +
      roundMoney(input.cashSalesTotal) +
      roundMoney(input.cashInTotal) -
      roundMoney(input.cashOutTotal) -
      roundMoney(input.cashRefundTotal ?? 0),
  );
}

export function cashMovementVariance(counted: number, expected: number): number {
  return roundMoney(counted - expected);
}
