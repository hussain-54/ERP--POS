import {
  addDecimal,
  compareDecimal,
  multiplyDecimal,
  subtractDecimal,
} from "@electronic-erp/contracts";
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

export type PosUnitOption = {
  unitId: string;
  unitName: string;
  /** Decimal places allowed for this unit (units.symbol_places). */
  symbolPlaces: number;
  /** Multiply sale qty by this to get base-unit qty for stock checks. Default 1. */
  factorToBase?: string;
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
  /** Decimal places for current unit. */
  unitSymbolPlaces?: number;
  qty: string;
  unitPrice: number;
  discount: number;
  tax: number;
  warrantyDays: number;
  isManual?: boolean;
  /** Available stock in base units (warehouse-scoped when known). */
  stock?: string;
  imageUrl?: string | null;
  /** Alternate units for this line (unit selection). */
  unitOptions?: PosUnitOption[];
  minQty?: string;
  maxQty?: string;
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
  saleTotals: SaleTotals | null;
}

export type CartOpResult = {
  cart: PosCartLine[];
  ok: boolean;
  error?: string;
};

const MONEY_SCALE = 2;
const DEFAULT_MAX_QTY = "999999";

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function moneyNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function pickPriceLevel(p: PosPriceSource, priceLevel: PosPriceLevel): number {
  if (priceLevel === "wholesale") return roundMoney(moneyNumber(p.wholesalePrice));
  if (priceLevel === "dealer") return roundMoney(moneyNumber(p.dealerPrice));
  return roundMoney(moneyNumber(p.retailPrice));
}

export function taxForLineNet(
  net: number,
  rate: PosTaxRate | null | undefined,
): { tax: number; displayNet: number } {
  const safeNet = roundMoney(Math.max(0, moneyNumber(net)));
  if (!rate || rate.isExempt || rate.ratePercent <= 0 || safeNet <= 0) {
    return { tax: 0, displayNet: safeNet };
  }
  if (rate.pricingMode === "inclusive") {
    const taxable = roundMoney(safeNet / (1 + rate.ratePercent / 100));
    return { tax: roundMoney(safeNet - taxable), displayNet: taxable };
  }
  return { tax: roundMoney((safeNet * rate.ratePercent) / 100), displayNet: safeNet };
}

export function lineTaxAmount(
  qty: number | string,
  unitPrice: number,
  discount: number,
  rate: PosTaxRate | null | undefined,
): number {
  const q = moneyNumber(qty);
  const price = roundMoney(moneyNumber(unitPrice));
  const disc = roundMoney(Math.max(0, moneyNumber(discount)));
  const net = Math.max(0, roundMoney(q * price) - disc);
  return taxForLineNet(net, rate).tax;
}

export function lineTotal(line: PosCartLine): number {
  const q = moneyNumber(line.qty);
  const price = roundMoney(moneyNumber(line.unitPrice));
  const disc = roundMoney(Math.max(0, moneyNumber(line.discount)));
  const tax = roundMoney(Math.max(0, moneyNumber(line.tax)));
  return roundMoney(Math.max(0, roundMoney(q * price) - disc + tax));
}

export function toSaleItems(cart: PosCartLine[]) {
  return cart.map((c) => ({
    productId: c.productId,
    unitId: c.unitId,
    qty: c.qty,
    unitPrice: roundMoney(moneyNumber(c.unitPrice)),
    discount: roundMoney(moneyNumber(c.discount)),
    tax: roundMoney(moneyNumber(c.tax)),
    warrantyDays: c.warrantyDays,
    isManual: Boolean(c.isManual),
    manualName: c.isManual ? c.name : undefined,
  }));
}

export function calculatePosCartTotals(
  cart: PosCartLine[],
  invoiceDiscount: number | string = 0,
): PosCartTotals {
  const invoiceDisc = Math.max(0, roundMoney(moneyNumber(invoiceDiscount)));
  let qtySum = 0;
  let itemDiscount = 0;
  for (const line of cart) {
    qtySum += moneyNumber(line.qty);
    itemDiscount += roundMoney(moneyNumber(line.discount));
  }
  qtySum = roundMoney(qtySum);
  itemDiscount = roundMoney(itemDiscount);

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
    qty: qtySum,
    subtotal: saleTotals.subtotal,
    itemDiscount,
    invoiceDiscount: invoiceDisc,
    discount: saleTotals.discountTotal,
    tax: saleTotals.taxTotal,
    grand: saleTotals.grandTotal,
    saleTotals,
  };
}

export function qtyRulesForLine(line: Pick<
  PosCartLine,
  "unitSymbolPlaces" | "minQty" | "maxQty" | "stock" | "isManual" | "unitOptions" | "unitId"
>): {
  allowDecimal: boolean;
  decimalPlaces: number;
  minQty: string;
  maxQty: string;
} {
  const opt = line.unitOptions?.find((u) => u.unitId === line.unitId);
  const places = Math.max(
    0,
    Math.min(4, opt?.symbolPlaces ?? line.unitSymbolPlaces ?? 0),
  );
  const allowDecimal = places > 0;
  const minQty = line.minQty ?? (allowDecimal ? `0.${"0".repeat(places - 1)}1` : "1");
  let maxQty = line.maxQty ?? DEFAULT_MAX_QTY;
  if (!line.isManual && line.stock != null && line.stock !== "") {
    const stock = normalizeQtyString(line.stock, places);
    if (stock && compareDecimal(stock, "0") >= 0) {
      // Cap by stock in base units when factor is 1; otherwise leave stock check to validateStock
      maxQty = stock;
    }
  }
  return { allowDecimal, decimalPlaces: places, minQty, maxQty };
}

/** Normalize qty string; reject NaN / negative / excess decimals. */
export function normalizeQtyString(raw: string, decimalPlaces: number): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || trimmed === ".") return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  const [, frac = ""] = trimmed.split(".");
  if (decimalPlaces <= 0) {
    if (frac.length > 0 && Number(frac) !== 0) return null;
    return String(Math.trunc(n));
  }
  if (frac.length > decimalPlaces) return null;
  // Canonicalize via decimal helpers
  try {
    return addDecimal(trimmed, "0", Math.max(decimalPlaces, MONEY_SCALE));
  } catch {
    return null;
  }
}

export function validateQtyAgainstRules(
  raw: string,
  rules: ReturnType<typeof qtyRulesForLine>,
): { ok: true; qty: string } | { ok: false; error: string } {
  const qty = normalizeQtyString(raw, rules.decimalPlaces);
  if (qty == null) {
    return {
      ok: false,
      error: rules.allowDecimal
        ? `Invalid quantity (max ${rules.decimalPlaces} decimal places)`
        : "Quantity must be a positive whole number",
    };
  }
  if (compareDecimal(qty, "0") <= 0) {
    return { ok: false, error: "Quantity must be greater than zero" };
  }
  if (compareDecimal(qty, rules.minQty) < 0) {
    return { ok: false, error: `Minimum quantity is ${rules.minQty}` };
  }
  if (compareDecimal(qty, rules.maxQty) > 0) {
    return { ok: false, error: `Maximum quantity is ${rules.maxQty}` };
  }
  return { ok: true, qty };
}

function baseQtyForLine(line: PosCartLine, saleQty: string): string {
  const opt = line.unitOptions?.find((u) => u.unitId === line.unitId);
  const factor = opt?.factorToBase ?? "1";
  return multiplyDecimal(saleQty, factor, 6);
}

/** Total base qty for a product already in the cart (excluding a key). */
export function cartBaseQtyForProduct(
  cart: PosCartLine[],
  productId: string,
  excludeKey?: string,
): string {
  let total = "0";
  for (const line of cart) {
    if (!line.productId || line.productId !== productId || line.isManual) continue;
    if (excludeKey && line.key === excludeKey) continue;
    total = addDecimal(total, baseQtyForLine(line, line.qty || "0"), 6);
  }
  return total;
}

export function assertStockAvailable(
  line: PosCartLine,
  nextSaleQty: string,
  cart: PosCartLine[],
): void {
  if (line.isManual || !line.productId) return;
  if (line.stock == null || line.stock === "") return;
  const stock = normalizeQtyString(line.stock, 6) ?? "0";
  const others = cartBaseQtyForProduct(cart, line.productId, line.key);
  const nextBase = addDecimal(others, baseQtyForLine(line, nextSaleQty), 6);
  if (compareDecimal(stock, "0") <= 0) {
    throw new ValidationDomainError("Product is out of stock");
  }
  if (compareDecimal(nextBase, stock) > 0) {
    throw new ValidationDomainError(
      `Insufficient stock (available ${stock}, requested ${nextBase})`,
    );
  }
}

function withRecalc(
  line: PosCartLine,
  patch: Partial<PosCartLine>,
  taxRate?: PosTaxRate | null,
): PosCartLine {
  const next = { ...line, ...patch };
  next.unitPrice = roundMoney(moneyNumber(next.unitPrice));
  next.discount = roundMoney(Math.max(0, moneyNumber(next.discount)));
  next.tax = lineTaxAmount(next.qty, next.unitPrice, next.discount, taxRate);
  return next;
}

export function createCartLineFromProduct(input: {
  key: string;
  productId: string;
  name: string;
  nameUr?: string | null;
  sku?: string | null;
  unitId: string;
  unitName?: string | null;
  unitSymbolPlaces?: number;
  unitPrice: number;
  warrantyDays?: number;
  stock?: string;
  imageUrl?: string | null;
  taxRate?: PosTaxRate | null;
  unitOptions?: PosUnitOption[];
  minQty?: string;
  maxQty?: string;
  qty?: string;
}): PosCartLine {
  const places = Math.max(0, Math.min(4, input.unitSymbolPlaces ?? 0));
  const qty = input.qty ?? (places > 0 ? "1" : "1");
  const unitPrice = roundMoney(moneyNumber(input.unitPrice));
  const line: PosCartLine = {
    key: input.key,
    productId: input.productId,
    name: input.name,
    nameUr: input.nameUr,
    sku: input.sku,
    unitId: input.unitId,
    unitName: input.unitName,
    unitSymbolPlaces: places,
    qty,
    unitPrice,
    discount: 0,
    tax: lineTaxAmount(qty, unitPrice, 0, input.taxRate),
    warrantyDays: input.warrantyDays ?? 0,
    stock: input.stock,
    imageUrl: input.imageUrl,
    unitOptions:
      input.unitOptions ??
      (input.unitId
        ? [
            {
              unitId: input.unitId,
              unitName: input.unitName ?? "Unit",
              symbolPlaces: places,
              factorToBase: "1",
            },
          ]
        : undefined),
    minQty: input.minQty,
    maxQty: input.maxQty,
  };
  return line;
}

export function createManualCartLine(input: {
  key: string;
  unitId: string;
  name?: string;
  unitSymbolPlaces?: number;
}): PosCartLine {
  return {
    key: input.key,
    name: input.name ?? "Manual item",
    unitId: input.unitId,
    unitName: "Manual",
    unitSymbolPlaces: input.unitSymbolPlaces ?? 0,
    qty: "1",
    unitPrice: 0,
    discount: 0,
    tax: 0,
    warrantyDays: 0,
    isManual: true,
  };
}

function fail(cart: PosCartLine[], error: string): CartOpResult {
  return { cart, ok: false, error };
}

function ok(cart: PosCartLine[]): CartOpResult {
  return { cart, ok: true };
}

/** Add product or increment duplicate (same productId + unitId). */
export function addOrIncrementProduct(
  cart: PosCartLine[],
  line: PosCartLine,
  taxRate?: PosTaxRate | null,
): CartOpResult {
  if (!line.isManual && !line.productId) {
    return fail(cart, "Invalid product");
  }
  if (!line.unitId) return fail(cart, "Unit is required");

  if (!line.isManual && line.stock != null && line.stock !== "") {
    const stock = normalizeQtyString(line.stock, 6) ?? "0";
    if (compareDecimal(stock, "0") <= 0) {
      return fail(cart, "Product is out of stock");
    }
  }

  const existing = cart.find(
    (x) =>
      x.productId &&
      x.productId === line.productId &&
      !x.isManual &&
      x.unitId === line.unitId,
  );

  if (!existing) {
    const rules = qtyRulesForLine(line);
    const parsed = validateQtyAgainstRules(line.qty || rules.minQty, rules);
    if (!parsed.ok) return fail(cart, parsed.error);
    try {
      assertStockAvailable({ ...line, qty: parsed.qty }, parsed.qty, cart);
    } catch (err) {
      return fail(cart, err instanceof Error ? err.message : "Stock validation failed");
    }
    return ok([...cart, withRecalc(line, { qty: parsed.qty }, taxRate)]);
  }

  const step = line.qty && compareDecimal(line.qty, "0") > 0 ? line.qty : "1";
  let nextQty: string;
  try {
    nextQty = addDecimal(existing.qty || "0", step, existing.unitSymbolPlaces ?? 0);
  } catch {
    return fail(cart, "Invalid quantity");
  }
  const rules = qtyRulesForLine(existing);
  const parsed = validateQtyAgainstRules(nextQty, rules);
  if (!parsed.ok) return fail(cart, parsed.error);
  try {
    assertStockAvailable(existing, parsed.qty, cart);
  } catch (err) {
    return fail(cart, err instanceof Error ? err.message : "Stock validation failed");
  }
  return ok(
    cart.map((x) =>
      x.key === existing.key ? withRecalc(x, { qty: parsed.qty, stock: line.stock ?? x.stock }, taxRate) : x,
    ),
  );
}

/** Legacy unwrap — throws on failure (tests / callers that prefer exceptions). */
export function addOrIncrementProductOrThrow(
  cart: PosCartLine[],
  line: PosCartLine,
  taxRate?: PosTaxRate | null,
): PosCartLine[] {
  const result = addOrIncrementProduct(cart, line, taxRate);
  if (!result.ok) throw new ValidationDomainError(result.error ?? "Cart add failed");
  return result.cart;
}

export function updateCartLineQty(
  cart: PosCartLine[],
  key: string,
  qty: string,
  taxRate?: PosTaxRate | null,
): CartOpResult {
  const line = cart.find((x) => x.key === key);
  if (!line) return fail(cart, "Line not found");
  const rules = qtyRulesForLine(line);
  const parsed = validateQtyAgainstRules(qty, rules);
  if (!parsed.ok) return fail(cart, parsed.error);
  try {
    assertStockAvailable(line, parsed.qty, cart);
  } catch (err) {
    return fail(cart, err instanceof Error ? err.message : "Stock validation failed");
  }
  return ok(cart.map((x) => (x.key === key ? withRecalc(x, { qty: parsed.qty }, taxRate) : x)));
}

export function increaseCartLineQty(
  cart: PosCartLine[],
  key: string,
  taxRate?: PosTaxRate | null,
  step?: string,
): CartOpResult {
  const line = cart.find((x) => x.key === key);
  if (!line) return fail(cart, "Line not found");
  const rules = qtyRulesForLine(line);
  const delta = step ?? rules.minQty;
  let next: string;
  try {
    next = addDecimal(line.qty || "0", delta, rules.decimalPlaces);
  } catch {
    return fail(cart, "Invalid quantity");
  }
  return updateCartLineQty(cart, key, next, taxRate);
}

export function decreaseCartLineQty(
  cart: PosCartLine[],
  key: string,
  taxRate?: PosTaxRate | null,
  step?: string,
): CartOpResult {
  const line = cart.find((x) => x.key === key);
  if (!line) return fail(cart, "Line not found");
  const rules = qtyRulesForLine(line);
  const delta = step ?? rules.minQty;
  let next: string;
  try {
    next = subtractDecimal(line.qty || "0", delta, rules.decimalPlaces);
  } catch {
    return fail(cart, "Invalid quantity");
  }
  if (compareDecimal(next, "0") <= 0) {
    return ok(removeCartLine(cart, key));
  }
  return updateCartLineQty(cart, key, next, taxRate);
}

export function updateCartLinePrice(
  cart: PosCartLine[],
  key: string,
  unitPrice: number,
  taxRate?: PosTaxRate | null,
): CartOpResult {
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return fail(cart, "Price cannot be negative");
  }
  return ok(
    cart.map((x) =>
      x.key === key ? withRecalc(x, { unitPrice: roundMoney(unitPrice) }, taxRate) : x,
    ),
  );
}

export function updateCartLineDiscount(
  cart: PosCartLine[],
  key: string,
  discount: number,
  taxRate?: PosTaxRate | null,
): CartOpResult {
  if (!Number.isFinite(discount) || discount < 0) {
    return fail(cart, "Discount cannot be negative");
  }
  return ok(
    cart.map((x) =>
      x.key === key ? withRecalc(x, { discount: roundMoney(discount) }, taxRate) : x,
    ),
  );
}

export function changeCartLineUnit(
  cart: PosCartLine[],
  key: string,
  unitId: string,
  taxRate?: PosTaxRate | null,
): CartOpResult {
  const line = cart.find((x) => x.key === key);
  if (!line) return fail(cart, "Line not found");
  const opt = line.unitOptions?.find((u) => u.unitId === unitId);
  if (!opt) return fail(cart, "Unit not available for this product");
  if (line.unitId === unitId) return ok(cart);

  // Merge into existing line with same product+unit if present
  const sibling = cart.find(
    (x) =>
      x.key !== key &&
      x.productId &&
      x.productId === line.productId &&
      x.unitId === unitId &&
      !x.isManual,
  );

  const nextLine = withRecalc(
    line,
    {
      unitId: opt.unitId,
      unitName: opt.unitName,
      unitSymbolPlaces: opt.symbolPlaces,
    },
    taxRate,
  );
  const rules = qtyRulesForLine(nextLine);
  const parsed = validateQtyAgainstRules(nextLine.qty, rules);
  if (!parsed.ok) return fail(cart, parsed.error);
  nextLine.qty = parsed.qty;
  nextLine.tax = lineTaxAmount(parsed.qty, nextLine.unitPrice, nextLine.discount, taxRate);

  try {
    assertStockAvailable(nextLine, parsed.qty, cart.filter((x) => x.key !== key));
  } catch (err) {
    return fail(cart, err instanceof Error ? err.message : "Stock validation failed");
  }

  if (sibling) {
    const mergedQty = addDecimal(sibling.qty || "0", parsed.qty, opt.symbolPlaces);
    const without = cart.filter((x) => x.key !== key && x.key !== sibling.key);
    const merged = withRecalc(sibling, { qty: mergedQty }, taxRate);
    try {
      assertStockAvailable(merged, mergedQty, without);
    } catch (err) {
      return fail(cart, err instanceof Error ? err.message : "Stock validation failed");
    }
    return ok([...without, merged]);
  }

  return ok(cart.map((x) => (x.key === key ? nextLine : x)));
}

export function removeCartLine(cart: PosCartLine[], key: string): PosCartLine[] {
  return cart.filter((x) => x.key !== key);
}

export function clearCartLines(): PosCartLine[] {
  return [];
}

/** Recalculate all line taxes/totals (e.g. after tax rate change). */
export function recalculateCart(
  cart: PosCartLine[],
  taxRate?: PosTaxRate | null,
): PosCartLine[] {
  return cart.map((line) => withRecalc(line, {}, taxRate));
}

/** Exact barcode / SKU match for scanner enter-to-add. */
export function pickExactProductMatch<
  T extends { sku: string; barcode?: string | null; productId: string },
>(items: T[], q: string): T | null {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  const exactBarcode = items.find((i) => i.barcode && i.barcode.toLowerCase() === needle);
  if (exactBarcode) return exactBarcode;
  const exactSku = items.find((i) => i.sku.toLowerCase() === needle);
  if (exactSku) return exactSku;
  if (items.length === 1) return items[0];
  return null;
}
