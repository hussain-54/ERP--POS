import type { ProductSearchResult } from "@electronic-erp/contracts";

export type PriceLevel = "retail" | "wholesale" | "dealer";
export type PaySplit = { id: string; paymentMethodId: string; amount: string };
export type LocaleMode = "en" | "ur" | "en_ur";
export type PosMode = "easy" | "advanced";
export type ProductTab = "recent" | "favorites" | "categories" | "results";

export interface CartLine {
  key: string;
  productId?: string;
  name: string;
  nameUr?: string | null;
  sku?: string | null;
  unitId: string;
  unitName?: string | null;
  qty: string;
  unitPrice: number;
  discount: number;
  tax: number;
  warrantyDays: number;
  isManual?: boolean;
  stock?: string;
  imageUrl?: string | null;
}

export interface PosCustomerSummary {
  id: string;
  name: string;
  mobile?: string | null;
  customerType?: string;
  creditLimit?: string;
  outstanding?: string;
}

export function uuid() {
  return crypto.randomUUID();
}

export function pickPrice(p: ProductSearchResult, priceLevel: PriceLevel): number {
  if (priceLevel === "wholesale") return p.wholesalePrice;
  if (priceLevel === "dealer") return p.dealerPrice;
  return p.retailPrice;
}

export function lineTotal(line: CartLine): number {
  return Math.max(0, Number(line.qty) * line.unitPrice - line.discount + line.tax);
}

export type PosTaxRate = {
  id: string;
  ratePercent: number;
  pricingMode: "inclusive" | "exclusive";
  isExempt: boolean;
};

/** Apply tax to a line net (qty * price - discount). Exclusive adds tax; inclusive extracts. */
export function taxForLineNet(
  net: number,
  rate: PosTaxRate | null,
): { tax: number; displayNet: number } {
  if (!rate || rate.isExempt || rate.ratePercent <= 0 || net <= 0) {
    return { tax: 0, displayNet: net };
  }
  if (rate.pricingMode === "inclusive") {
    const taxable = Math.round((net / (1 + rate.ratePercent / 100)) * 100) / 100;
    return { tax: Math.round((net - taxable) * 100) / 100, displayNet: taxable };
  }
  return { tax: Math.round(((net * rate.ratePercent) / 100) * 100) / 100, displayNet: net };
}

export function calcTotals(cart: CartLine[], invoiceDiscount: string) {
  let subtotal = 0;
  let itemDiscount = 0;
  let tax = 0;
  let qty = 0;
  for (const line of cart) {
    const q = Number(line.qty) || 0;
    qty += q;
    subtotal += q * line.unitPrice;
    itemDiscount += line.discount;
    tax += line.tax;
  }
  const invoiceDisc = Number(invoiceDiscount || 0);
  const discount = itemDiscount + invoiceDisc;
  const grand = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);
  return {
    items: cart.length,
    qty,
    subtotal,
    itemDiscount,
    invoiceDiscount: invoiceDisc,
    discount,
    tax,
    grand,
  };
}

export const POS_SHORTCUTS = [
  { key: "F1", label: "New sale / clear focus" },
  { key: "F2", label: "Hold / resume" },
  { key: "F3", label: "Focus customer" },
  { key: "F5", label: "Invoice discount" },
  { key: "F7", label: "Clear cart" },
  { key: "F8", label: "Cancel / clear sale" },
] as const;
