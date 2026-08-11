import { addDecimal, compareDecimal, subtractDecimal, type DecimalString } from "@electronic-erp/contracts";
import { ValidationDomainError } from "./errors.js";

export interface BalanceBuckets {
  qtyOnHand: DecimalString;
  qtyReserved: DecimalString;
  qtyDamaged: DecimalString;
  qtyInTransit: DecimalString;
}

export interface ComputedStockMetrics extends BalanceBuckets {
  qtyAvailable: DecimalString;
  qtyTotal: DecimalString;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isOverstock: boolean;
}

export function computeAvailable(onHand: string, reserved: string): string {
  return subtractDecimal(onHand, reserved);
}

export function computeTotal(buckets: BalanceBuckets): string {
  return addDecimal(
    addDecimal(buckets.qtyOnHand, buckets.qtyDamaged),
    buckets.qtyInTransit,
  );
}

export function computeStockMetrics(
  buckets: BalanceBuckets,
  reorderLevel = "0",
  overstockLevel?: string | null,
): ComputedStockMetrics {
  const qtyAvailable = computeAvailable(buckets.qtyOnHand, buckets.qtyReserved);
  const qtyTotal = computeTotal(buckets);
  return {
    ...buckets,
    qtyAvailable,
    qtyTotal,
    isLowStock: compareDecimal(qtyAvailable, reorderLevel) <= 0 && compareDecimal(qtyAvailable, "0") > 0,
    isOutOfStock: compareDecimal(qtyAvailable, "0") <= 0,
    isOverstock: overstockLevel
      ? compareDecimal(qtyAvailable, overstockLevel) >= 0
      : false,
  };
}

export function assertNonNegativeStock(
  nextOnHand: string,
  allowNegative: boolean,
): void {
  if (!allowNegative && compareDecimal(nextOnHand, "0") < 0) {
    throw new ValidationDomainError("Negative stock is not allowed");
  }
}

export function assertReservationFeasible(available: string, qty: string): void {
  if (compareDecimal(available, qty) < 0) {
    throw new ValidationDomainError("Insufficient available stock to reserve");
  }
}
