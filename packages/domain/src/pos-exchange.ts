/**
 * POS exchange plan — return posting + replacement sale posting.
 * Does not add a third writer. Difference is the net of those two real legs.
 */

import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";
import {
  prepareSaleReturn,
  type PrepareSaleReturnInput,
  type PreparedSaleReturn,
  type ReturnLineInput,
  type ReturnableLine,
} from "./pos-return.js";

export type ExchangeReplacementLine = {
  productId: string;
  unitId: string;
  name?: string;
  qty: number;
  unitPrice: number;
  stockAvailable?: number | null;
};

export type PreparedPosExchange = {
  preparedReturn: PreparedSaleReturn;
  replacementTotal: number;
  returnValue: number;
  /** replacementTotal − returnValue. Positive = collect; negative = net refund. */
  difference: number;
  collectAmount: number;
  refundAmount: number;
  settlement: "collect" | "refund" | "even";
};

export function preparePosExchange(input: {
  reasonCode: PrepareSaleReturnInput["reasonCode"];
  reasonDetail?: string;
  refundMethod?: PrepareSaleReturnInput["refundMethod"];
  hasCustomer: boolean;
  returnDisposition: "refund" | "credit";
  returnable: ReturnableLine[];
  returnLines: ReturnLineInput[];
  replacements: ExchangeReplacementLine[];
}): PreparedPosExchange {
  if (!input.replacements.length) {
    throw new ValidationDomainError("Add at least one replacement item");
  }
  for (const line of input.replacements) {
    if (!line.productId) {
      throw new ValidationDomainError("Replacement product is required");
    }
    if (!(line.qty > 0) || !Number.isFinite(line.qty)) {
      throw new ValidationDomainError("Replacement quantity must be positive");
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new ValidationDomainError("Replacement price is invalid");
    }
    if (line.stockAvailable != null && Number.isFinite(line.stockAvailable)) {
      if (line.qty - line.stockAvailable > 1e-9) {
        throw new ValidationDomainError(
          `Replacement qty ${line.qty} exceeds available stock ${line.stockAvailable}`,
        );
      }
    }
  }

  const preparedReturn = prepareSaleReturn({
    disposition: input.returnDisposition,
    reasonCode: input.reasonCode,
    reasonDetail: input.reasonDetail,
    refundMethod: input.returnDisposition === "refund" ? input.refundMethod : "customer_credit",
    hasCustomer: input.hasCustomer,
    returnable: input.returnable,
    lines: input.returnLines.map((line) => ({ ...line, exchangeProductId: null })),
  });

  const replacementTotal = roundMoney(
    input.replacements.reduce((sum, line) => sum + roundMoney(line.qty * line.unitPrice), 0),
  );
  const returnValue = preparedReturn.refundAmount;
  const difference = roundMoney(replacementTotal - returnValue);

  return {
    preparedReturn,
    replacementTotal,
    returnValue,
    difference,
    collectAmount: replacementTotal,
    refundAmount: returnValue,
    settlement: difference > 1e-9 ? "collect" : difference < -1e-9 ? "refund" : "even",
  };
}
