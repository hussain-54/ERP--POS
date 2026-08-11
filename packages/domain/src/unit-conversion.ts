import {
  compareDecimal,
  multiplyDecimal,
  subtractDecimal,
  type CreateUnitConversionInput,
} from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface UnitConversionRule {
  productId?: string | null;
  fromUnitId: string;
  toUnitId: string;
  factor: string;
}

/** Convert quantity from one unit to another using product-specific then org rules. */
export function convertQuantity(
  qty: string,
  fromUnitId: string,
  toUnitId: string,
  rules: UnitConversionRule[],
  productId?: string,
): string {
  if (fromUnitId === toUnitId) return qty;

  const productRules = productId
    ? rules.filter((r) => r.productId === productId)
    : [];
  const orgRules = rules.filter((r) => !r.productId);
  const pool = [...productRules, ...orgRules];

  const direct = pool.find((r) => r.fromUnitId === fromUnitId && r.toUnitId === toUnitId);
  if (direct) return multiplyDecimal(qty, direct.factor);

  const inverse = pool.find((r) => r.fromUnitId === toUnitId && r.toUnitId === fromUnitId);
  if (inverse) {
    // qty_to = qty_from / factor
    const scaled = multiplyDecimal(qty, "1", 6);
    // divide via multiply with reciprocal approximated by integer math in multiplyDecimal only —
    // use 1/factor as decimal string
    const factorNum = Number(inverse.factor);
    if (factorNum <= 0) throw new ValidationDomainError("Invalid conversion factor");
    const reciprocal = (1 / factorNum).toFixed(6).replace(/\.?0+$/, "");
    return multiplyDecimal(scaled, reciprocal);
  }

  throw new ValidationDomainError("No unit conversion rule found");
}

export function applySaleInBaseUnit(
  availableBaseQty: string,
  saleQty: string,
  saleUnitId: string,
  baseUnitId: string,
  rules: UnitConversionRule[],
  productId: string,
): { remainingBase: string; consumedBase: string } {
  const consumedBase = convertQuantity(saleQty, saleUnitId, baseUnitId, rules, productId);
  if (compareDecimal(availableBaseQty, consumedBase) < 0) {
    throw new ValidationDomainError("Insufficient stock for conversion");
  }
  return {
    consumedBase,
    remainingBase: subtractDecimal(availableBaseQty, consumedBase),
  };
}

export function validateConversionInput(input: CreateUnitConversionInput): void {
  if (input.fromUnitId === input.toUnitId) {
    throw new ValidationDomainError("Conversion units must differ");
  }
  if (Number(input.factor) <= 0) {
    throw new ValidationDomainError("Conversion factor must be positive");
  }
}
