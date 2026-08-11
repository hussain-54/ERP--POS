import { addDecimal, compareDecimal, subtractDecimal, type LedgerEntryType } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

/** Customer balance: positive = customer owes us (receivable). */
export function applyCustomerLedgerEffect(
  currentOutstanding: string,
  entryType: LedgerEntryType,
  amount: string,
): { debit: string; credit: string; balanceAfter: string } {
  if (compareDecimal(amount, "0") <= 0) {
    throw new ValidationDomainError("Ledger amount must be positive");
  }
  switch (entryType) {
    case "sale":
    case "adjustment":
    case "debit_note":
      return {
        debit: amount,
        credit: "0",
        balanceAfter: addDecimal(currentOutstanding, amount),
      };
    case "payment":
    case "return":
    case "discount":
    case "credit_note":
      return {
        debit: "0",
        credit: amount,
        balanceAfter: subtractDecimal(currentOutstanding, amount),
      };
    case "purchase":
      throw new ValidationDomainError("purchase is not a customer ledger entry");
    default: {
      const _e: never = entryType;
      throw new ValidationDomainError(`Unsupported entry: ${_e}`);
    }
  }
}

/** Supplier balance: positive = we owe supplier (payable). */
export function applySupplierLedgerEffect(
  currentPayable: string,
  entryType: LedgerEntryType,
  amount: string,
): { debit: string; credit: string; balanceAfter: string } {
  if (compareDecimal(amount, "0") <= 0) {
    throw new ValidationDomainError("Ledger amount must be positive");
  }
  switch (entryType) {
    case "purchase":
    case "adjustment":
    case "debit_note":
      return {
        debit: amount,
        credit: "0",
        balanceAfter: addDecimal(currentPayable, amount),
      };
    case "payment":
    case "return":
    case "discount":
    case "credit_note":
      return {
        debit: "0",
        credit: amount,
        balanceAfter: subtractDecimal(currentPayable, amount),
      };
    case "sale":
      throw new ValidationDomainError("sale is not a supplier ledger entry");
    default: {
      const _e: never = entryType;
      throw new ValidationDomainError(`Unsupported entry: ${_e}`);
    }
  }
}
