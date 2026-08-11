import {
  addDecimal,
  compareDecimal,
  subtractDecimal,
  type StockMovementType,
} from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";
import {
  assertNonNegativeStock,
  computeAvailable,
  type BalanceBuckets,
} from "./stock-balances.js";

/** Effects each movement type has on balance buckets (in base unit qty). */
export type LedgerEffect = {
  onHand: string;
  reserved: string;
  damaged: string;
  inTransit: string;
};

const ZERO = "0";

export function signedDelta(qtyDelta: string): string {
  return qtyDelta;
}

/**
 * Apply movement semantics.
 * qtyDelta is signed from the caller's perspective for adjustment/opening/stock_count,
 * and magnitude-oriented for typed inflows/outflows (positive amounts).
 */
export function effectForMovement(type: StockMovementType, qtyDelta: string): LedgerEffect {
  const abs = compareDecimal(qtyDelta, ZERO) < 0 ? qtyDelta.replace("-", "") : qtyDelta;
  const neg = compareDecimal(qtyDelta, ZERO) < 0 ? qtyDelta : `-${abs}`;
  const pos = compareDecimal(qtyDelta, ZERO) < 0 ? abs : qtyDelta;

  switch (type) {
    case "opening":
    case "purchase":
    case "sale_return":
    case "transfer_in":
    case "warranty_replacement":
      return { onHand: pos, reserved: ZERO, damaged: ZERO, inTransit: ZERO };
    case "sale":
    case "purchase_return":
    case "repair_consumption":
      return { onHand: neg.startsWith("-") ? neg : `-${pos}`, reserved: ZERO, damaged: ZERO, inTransit: ZERO };
    case "damage":
      // move from on-hand into damaged (net onHand decreases, damaged increases)
      return {
        onHand: `-${abs}`,
        reserved: ZERO,
        damaged: abs,
        inTransit: ZERO,
      };
    case "adjustment":
    case "stock_count":
      return { onHand: qtyDelta, reserved: ZERO, damaged: ZERO, inTransit: ZERO };
    case "transfer_out":
      return {
        onHand: `-${abs}`,
        reserved: ZERO,
        damaged: ZERO,
        inTransit: abs,
      };
    case "reservation":
      return { onHand: ZERO, reserved: abs, damaged: ZERO, inTransit: ZERO };
    case "release_reservation":
      return { onHand: ZERO, reserved: `-${abs}`, damaged: ZERO, inTransit: ZERO };
    default: {
      const _exhaustive: never = type;
      throw new ValidationDomainError(`Unsupported movement type: ${_exhaustive}`);
    }
  }
}

export function applyLedgerEffect(
  current: BalanceBuckets,
  effect: LedgerEffect,
  allowNegative: boolean,
): BalanceBuckets {
  const next: BalanceBuckets = {
    qtyOnHand: addDecimal(current.qtyOnHand, effect.onHand),
    qtyReserved: addDecimal(current.qtyReserved, effect.reserved),
    qtyDamaged: addDecimal(current.qtyDamaged, effect.damaged),
    qtyInTransit: addDecimal(current.qtyInTransit, effect.inTransit),
  };

  assertNonNegativeStock(next.qtyOnHand, allowNegative);
  if (compareDecimal(next.qtyReserved, ZERO) < 0) {
    throw new ValidationDomainError("Reserved quantity cannot be negative");
  }
  if (compareDecimal(next.qtyDamaged, ZERO) < 0) {
    throw new ValidationDomainError("Damaged quantity cannot be negative");
  }
  if (compareDecimal(next.qtyInTransit, ZERO) < 0) {
    throw new ValidationDomainError("In-transit quantity cannot be negative");
  }
  if (compareDecimal(computeAvailable(next.qtyOnHand, next.qtyReserved), ZERO) < 0 && !allowNegative) {
    throw new ValidationDomainError("Available stock would become negative");
  }
  return next;
}

export function applyMovementToBalance(
  current: BalanceBuckets,
  type: StockMovementType,
  qtyDelta: string,
  allowNegative: boolean,
): { before: BalanceBuckets; after: BalanceBuckets; effect: LedgerEffect } {
  const effect = effectForMovement(type, qtyDelta);
  const after = applyLedgerEffect(current, effect, allowNegative);
  return { before: current, after, effect };
}

/** Normalize typed outbound magnitudes to negative on-hand deltas for sale-like types when caller passes positive qty. */
export function normalizeQtyDelta(type: StockMovementType, qtyDelta: string): string {
  if (
    (type === "sale" ||
      type === "purchase_return" ||
      type === "repair_consumption" ||
      type === "transfer_out" ||
      type === "damage" ||
      type === "reservation") &&
    compareDecimal(qtyDelta, ZERO) > 0
  ) {
    // effectForMovement already treats magnitude; keep positive input for those types
    return qtyDelta;
  }
  if (
    (type === "release_reservation") &&
    compareDecimal(qtyDelta, ZERO) > 0
  ) {
    return qtyDelta;
  }
  return qtyDelta;
}

export function differenceQty(before: string, after: string): string {
  return subtractDecimal(after, before);
}
