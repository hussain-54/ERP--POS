/** Day-closing summary — aggregates shift/sale figures into an auditable close record. */
import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";
import { cashMovementVariance } from "./pos-cash-movement.js";

export type PosDayCloseTotals = {
  businessDate: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  bankSales: number;
  walletSales: number;
  creditSales: number;
  refunds: number;
  cashIn: number;
  cashOut: number;
  openingCash: number;
  expectedCash: number;
};

export function buildDayCloseTotals(input: {
  businessDate: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  bankSales: number;
  walletSales: number;
  creditSales: number;
  refunds: number;
  cashIn: number;
  cashOut: number;
  openingCash: number;
}): PosDayCloseTotals {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) {
    throw new ValidationDomainError("businessDate must be YYYY-MM-DD");
  }
  const openingCash = roundMoney(input.openingCash);
  const cashIn = roundMoney(input.cashIn);
  const cashOut = roundMoney(input.cashOut);
  const cashSales = roundMoney(input.cashSales);
  const refunds = roundMoney(input.refunds);
  const expectedCash = roundMoney(openingCash + cashSales + cashIn - cashOut - refunds);
  return {
    businessDate: input.businessDate,
    totalSales: roundMoney(input.totalSales),
    cashSales,
    cardSales: roundMoney(input.cardSales),
    bankSales: roundMoney(input.bankSales),
    walletSales: roundMoney(input.walletSales),
    creditSales: roundMoney(input.creditSales),
    refunds,
    cashIn,
    cashOut,
    openingCash,
    expectedCash,
  };
}

export function finalizeDayClose(input: {
  totals: PosDayCloseTotals;
  actualCash: number;
}): PosDayCloseTotals & { actualCash: number; variance: number } {
  const actualCash = roundMoney(input.actualCash);
  if (!Number.isFinite(actualCash) || actualCash < 0) {
    throw new ValidationDomainError("Actual cash cannot be negative");
  }
  return {
    ...input.totals,
    actualCash,
    variance: cashMovementVariance(actualCash, input.totals.expectedCash),
  };
}
