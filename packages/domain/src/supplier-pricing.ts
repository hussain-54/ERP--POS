import { ValidationDomainError } from "./errors.js";

export interface SupplierPriceSnapshot {
  lastPurchaseRate: number;
  averagePurchaseRate: number;
  supplierPrice: number;
  purchaseCount: number;
}

/** Rolling average after a new purchase line. */
export function applyPurchaseToSupplierPrice(
  current: SupplierPriceSnapshot | null,
  unitCost: number,
  qty: number,
): SupplierPriceSnapshot {
  if (unitCost < 0 || qty <= 0) {
    throw new ValidationDomainError("Invalid purchase rate/qty for supplier price");
  }
  if (!current || current.purchaseCount <= 0) {
    return {
      lastPurchaseRate: unitCost,
      averagePurchaseRate: unitCost,
      supplierPrice: unitCost,
      purchaseCount: 1,
    };
  }
  const nextCount = current.purchaseCount + 1;
  const weighted =
    (current.averagePurchaseRate * current.purchaseCount + unitCost) / nextCount;
  return {
    lastPurchaseRate: unitCost,
    averagePurchaseRate: Math.round(weighted * 100) / 100,
    supplierPrice: unitCost,
    purchaseCount: nextCount,
  };
}

export interface SupplierComparisonRow {
  supplierId: string;
  lastPurchaseRate: number;
  averagePurchaseRate: number;
  supplierPrice: number;
}

/** Lowest average rate wins for comparison ordering. */
export function compareSupplierPrices(rows: SupplierComparisonRow[]): SupplierComparisonRow[] {
  return [...rows].sort((a, b) => a.averagePurchaseRate - b.averagePurchaseRate);
}
