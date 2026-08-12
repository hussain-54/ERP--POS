import type { ProductSearchResult } from "@electronic-erp/contracts";
import {
  calculatePosCartTotals,
  lineTotal,
  pickPriceLevel,
  taxForLineNet,
  type PosCartLine,
  type PosPriceLevel,
  type PosTaxRate,
} from "@electronic-erp/domain";

export type PriceLevel = PosPriceLevel;
export type CartLine = PosCartLine;
export type { PosTaxRate };
export type PaySplit = {
  id: string;
  paymentMethodId: string;
  amount: string;
  /** Cash tendered when method is cash. */
  amountReceived?: string;
  methodKind?: string;
};
export type LocaleMode = "en" | "ur" | "en_ur";
export type PosMode = "easy" | "advanced";
export type ProductTab = "recent" | "favorites" | "categories" | "results";

export type PosCustomerSummary = import("@electronic-erp/domain").PosCustomerProfile;

export function uuid() {
  return crypto.randomUUID();
}

/** @deprecated Prefer pickPriceLevel from @electronic-erp/domain — kept as alias for UI. */
export function pickPrice(p: ProductSearchResult, priceLevel: PriceLevel): number {
  return pickPriceLevel(p, priceLevel);
}

export { lineTotal, taxForLineNet };

/** UI-facing totals — delegates to domain calculatePosCartTotals. */
export function calcTotals(cart: CartLine[], invoiceDiscount: string) {
  return calculatePosCartTotals(cart, invoiceDiscount);
}

export const POS_SHORTCUTS = [
  { key: "F1", label: "New sale / clear focus" },
  { key: "F2", label: "Hold / resume" },
  { key: "F3", label: "Focus customer" },
  { key: "F5", label: "Invoice discount" },
  { key: "F7", label: "Clear cart" },
  { key: "F8", label: "Cancel / clear sale" },
] as const;
