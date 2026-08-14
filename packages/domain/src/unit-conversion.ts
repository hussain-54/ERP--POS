import {
  compareDecimal,
  divideDecimal,
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

export function assertStockQtyString(qty: string, label = "Quantity"): string {
  const trimmed = String(qty ?? "").trim();
  if (!trimmed || !/^-?\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new ValidationDomainError(`${label} is invalid`);
  }
  if (!Number.isFinite(Number(trimmed))) {
    throw new ValidationDomainError(`${label} is invalid`);
  }
  return trimmed;
}

/** Convert quantity from one unit to another using product-specific then org rules. */
export function convertQuantity(
  qty: string,
  fromUnitId: string,
  toUnitId: string,
  rules: UnitConversionRule[],
  productId?: string,
): string {
  const amount = assertStockQtyString(qty);
  if (!fromUnitId || !toUnitId) {
    throw new ValidationDomainError("Missing unit");
  }
  if (fromUnitId === toUnitId) return amount;

  const productRules = productId
    ? rules.filter((r) => r.productId === productId)
    : [];
  const orgRules = rules.filter((r) => !r.productId);
  const pool = [...productRules, ...orgRules];

  const direct = pool.find((r) => r.fromUnitId === fromUnitId && r.toUnitId === toUnitId);
  if (direct) {
    if (Number(direct.factor) <= 0 || !Number.isFinite(Number(direct.factor))) {
      throw new ValidationDomainError("Invalid conversion factor");
    }
    return multiplyDecimal(amount, direct.factor, 6);
  }

  const inverse = pool.find((r) => r.fromUnitId === toUnitId && r.toUnitId === fromUnitId);
  if (inverse) {
    if (Number(inverse.factor) <= 0 || !Number.isFinite(Number(inverse.factor))) {
      throw new ValidationDomainError("Invalid conversion factor");
    }
    return divideDecimal(amount, inverse.factor, 6);
  }

  throw new ValidationDomainError("No unit conversion rule found");
}

/**
 * Convert a posted movement quantity into product base units.
 * Preserves sign (adjustments may be negative). Same-unit posts are unchanged.
 */
export function qtyToBaseUnits(input: {
  qty: string;
  fromUnitId: string;
  baseUnitId: string;
  rules: UnitConversionRule[];
  productId: string;
}): string {
  if (!input.fromUnitId) throw new ValidationDomainError("Missing unit");
  if (!input.baseUnitId) throw new ValidationDomainError("Missing unit");
  if (!input.productId) throw new ValidationDomainError("Invalid product");
  const raw = assertStockQtyString(input.qty);
  const negative = raw.startsWith("-");
  const mag = negative ? raw.slice(1) : raw;
  if (compareDecimal(mag, "0") === 0) {
    throw new ValidationDomainError("Quantity cannot be zero");
  }
  const converted = convertQuantity(
    mag,
    input.fromUnitId,
    input.baseUnitId,
    input.rules,
    input.productId,
  );
  if (compareDecimal(converted, "0") <= 0) {
    throw new ValidationDomainError("Converted quantity must be positive");
  }
  return negative ? `-${converted}` : converted;
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
