/**
 * POS transaction workspace display.
 * Cart qty/price/discount/tax stay in domain. This file only maps those results
 * for the right-side UI so checkout and the summary cannot diverge.
 */
import type { PosCartLine } from "@electronic-erp/domain";
import { lineTotal } from "@electronic-erp/domain";
import { productImageUrl } from "./pos-catalog-load";
import type { LocaleMode } from "./pos-types";

/** Delivery is a sale flag only — checkout does not add a fee. */
export const POS_DELIVERY_CHARGES = 0;
/** Round-off is not part of POS checkout math yet. */
export const POS_ROUND_OFF = 0;

export type PosTotalsSource = {
  items: number;
  qty: number;
  subtotal: number;
  itemDiscount?: number;
  invoiceDiscount?: number;
  discount: number;
  tax: number;
  grand: number;
  taxInvoice?: { taxableAmount: number; taxTotal: number } | null;
};

export type PosTransactionSummary = {
  items: number;
  qty: number;
  subtotal: number;
  itemDiscount: number;
  invoiceDiscount: number;
  totalDiscount: number;
  taxableAmount: number;
  salesTax: number;
  deliveryCharges: number;
  roundOff: number;
  grand: number;
};

export function toPosTransactionSummary(totals: PosTotalsSource): PosTransactionSummary {
  return {
    items: totals.items,
    qty: totals.qty,
    subtotal: totals.subtotal,
    itemDiscount: totals.itemDiscount ?? 0,
    invoiceDiscount: totals.invoiceDiscount ?? 0,
    totalDiscount: totals.discount,
    taxableAmount: totals.taxInvoice?.taxableAmount ?? 0,
    salesTax: totals.tax,
    deliveryCharges: POS_DELIVERY_CHARGES,
    roundOff: POS_ROUND_OFF,
    grand: totals.grand,
  };
}

export function cartLineDisplayTotal(line: PosCartLine): number {
  return lineTotal(line);
}

export function cartLineImageUrl(line: Pick<PosCartLine, "imageUrl">): string | null {
  return productImageUrl(line);
}

export function cartLineTitle(line: Pick<PosCartLine, "name" | "nameUr">, locale: LocaleMode): string {
  if (locale === "ur" && line.nameUr) return line.nameUr;
  if (locale === "en_ur" && line.nameUr) return `${line.name} / ${line.nameUr}`;
  return line.name;
}
