import { calculateSaleTotals, type SaleTotals } from "./sale-totals.js";
import { ValidationDomainError } from "./errors.js";

/** Price tier used at the POS terminal (maps to product_prices levels). */
export type PosPriceLevel = "retail" | "wholesale" | "dealer";

export type PosTaxRate = {
  id: string;
  ratePercent: number;
  pricingMode: "inclusive" | "exclusive";
  isExempt: boolean;
};

/**
 * Terminal cart line — UI session shape.
 * Persisted sales use SaleItemInput via toSaleItems(); do not write DB from UI.
 */
export interface PosCartLine {
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

export interface PosPriceSource {
  retailPrice: number;
  wholesalePrice: number;
  dealerPrice: number;
}

export interface PosCartTotals {
  items: number;
  qty: number;
  subtotal: number;
  itemDiscount: number;
  invoiceDiscount: number;
  discount: number;
  tax: number;
  grand: number;
  /** Same numbers as SaleTransactionService / calculateSaleTotals when cart non-empty. */
  saleTotals: SaleTotals | null;
}

const roundMoney = (n: number): number => Math.round(n * 100) / 100;

export function pickPriceLevel(p: PosPriceSource, priceLevel: PosPriceLevel): number {
  if (priceLevel === "wholesale") return Number(p.wholesalePrice) || 0;
  if (priceLevel === "dealer") return Number(p.dealerPrice) || 0;
  return Number(p.retailPrice) || 0;
}

/** Apply tax to a line net (qty * price - discount). Exclusive adds tax; inclusive extracts. */
export function taxForLineNet(
  net: number,
  rate: PosTaxRate | null | undefined,
): { tax: number; displayNet: number } {
  if (!rate || rate.isExempt || rate.ratePercent <= 0 || net <= 0) {
    return { tax: 0, displayNet: net };
  }
  if (rate.pricingMode === "inclusive") {
    const taxable = roundMoney(net / (1 + rate.ratePercent / 100));
    return { tax: roundMoney(net - taxable), displayNet: taxable };
  }
  return { tax: roundMoney((net * rate.ratePercent) / 100), displayNet: net };
}

export function lineTaxAmount(
  qty: number,
  unitPrice: number,
  discount: number,
  rate: PosTaxRate | null | undefined,
): number {
  const net = Math.max(0, qty * unitPrice - discount);
  return taxForLineNet(net, rate).tax;
}

export function lineTotal(line: PosCartLine): number {
  return Math.max(0, Number(line.qty) * line.unitPrice - line.discount + line.tax);
}

export function toSaleItems(cart: PosCartLine[]) {
  return cart.map((c) => ({
    productId: c.productId,
    unitId: c.unitId,
    qty: c.qty,
    unitPrice: c.unitPrice,
    discount: c.discount,
    tax: c.tax,
    warrantyDays: c.warrantyDays,
    isManual: Boolean(c.isManual),
    manualName: c.isManual ? c.name : undefined,
  }));
}

/**
 * Single cart totals calculator for the POS terminal.
 * Delegates grand/subtotal/tax/discount to calculateSaleTotals when cart has lines
 * so UI and SaleTransactionService cannot drift.
 */
export function calculatePosCartTotals(
  cart: PosCartLine[],
  invoiceDiscount: number | string = 0,
): PosCartTotals {
  const invoiceDisc = Math.max(0, Number(invoiceDiscount) || 0);
  let qty = 0;
  let itemDiscount = 0;
  for (const line of cart) {
    qty += Number(line.qty) || 0;
    itemDiscount += line.discount;
  }

  if (cart.length === 0) {
    return {
      items: 0,
      qty: 0,
      subtotal: 0,
      itemDiscount: 0,
      invoiceDiscount: invoiceDisc,
      discount: invoiceDisc,
      tax: 0,
      grand: 0,
      saleTotals: null,
    };
  }

  const saleTotals = calculateSaleTotals(toSaleItems(cart), invoiceDisc);
  return {
    items: cart.length,
    qty,
    subtotal: saleTotals.subtotal,
    itemDiscount,
    invoiceDiscount: invoiceDisc,
    discount: saleTotals.discountTotal,
    tax: saleTotals.taxTotal,
    grand: saleTotals.grandTotal,
    saleTotals,
  };
}

export function createCartLineFromProduct(input: {
  key: string;
  productId: string;
  name: string;
  nameUr?: string | null;
  sku?: string | null;
  unitId: string;
  unitName?: string | null;
  unitPrice: number;
  warrantyDays?: number;
  stock?: string;
  imageUrl?: string | null;
  taxRate?: PosTaxRate | null;
}): PosCartLine {
  const unitPrice = Number(input.unitPrice) || 0;
  return {
    key: input.key,
    productId: input.productId,
    name: input.name,
    nameUr: input.nameUr,
    sku: input.sku,
    unitId: input.unitId,
    unitName: input.unitName,
    qty: "1",
    unitPrice,
    discount: 0,
    tax: lineTaxAmount(1, unitPrice, 0, input.taxRate),
    warrantyDays: input.warrantyDays ?? 0,
    stock: input.stock,
    imageUrl: input.imageUrl,
  };
}

export function createManualCartLine(input: {
  key: string;
  unitId: string;
  name?: string;
}): PosCartLine {
  return {
    key: input.key,
    name: input.name ?? "Manual item",
    unitId: input.unitId,
    qty: "1",
    unitPrice: 0,
    discount: 0,
    tax: 0,
    warrantyDays: 0,
    isManual: true,
  };
}

/** Pure cart mutations — no React, no DB. */
export function addOrIncrementProduct(
  cart: PosCartLine[],
  line: PosCartLine,
  taxRate?: PosTaxRate | null,
): PosCartLine[] {
  const existing = cart.find((x) => x.productId && x.productId === line.productId && !x.isManual);
  if (!existing) return [...cart, line];
  return cart.map((x) => {
    if (x.key !== existing.key) return x;
    const qty = Number(x.qty || 0) + 1;
    return {
      ...x,
      qty: String(qty),
      tax: lineTaxAmount(qty, x.unitPrice, x.discount, taxRate),
    };
  });
}

export function updateCartLineQty(
  cart: PosCartLine[],
  key: string,
  qty: string,
  taxRate?: PosTaxRate | null,
): PosCartLine[] {
  return cart.map((x) =>
    x.key === key
      ? { ...x, qty, tax: lineTaxAmount(Number(qty || 0), x.unitPrice, x.discount, taxRate) }
      : x,
  );
}

export function updateCartLinePrice(
  cart: PosCartLine[],
  key: string,
  unitPrice: number,
  taxRate?: PosTaxRate | null,
): PosCartLine[] {
  if (unitPrice < 0) throw new ValidationDomainError("Price cannot be negative");
  return cart.map((x) =>
    x.key === key
      ? {
          ...x,
          unitPrice,
          tax: lineTaxAmount(Number(x.qty || 0), unitPrice, x.discount, taxRate),
        }
      : x,
  );
}

export function updateCartLineDiscount(
  cart: PosCartLine[],
  key: string,
  discount: number,
  taxRate?: PosTaxRate | null,
): PosCartLine[] {
  if (discount < 0) throw new ValidationDomainError("Discount cannot be negative");
  return cart.map((x) =>
    x.key === key
      ? {
          ...x,
          discount,
          tax: lineTaxAmount(Number(x.qty || 0), x.unitPrice, discount, taxRate),
        }
      : x,
  );
}

export function removeCartLine(cart: PosCartLine[], key: string): PosCartLine[] {
  return cart.filter((x) => x.key !== key);
}

export function clearCartLines(): PosCartLine[] {
  return [];
}
