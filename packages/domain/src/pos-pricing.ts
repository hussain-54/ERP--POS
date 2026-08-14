import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";
import { applyDiscount, type DiscountMode } from "./pos-discount.js";
import { computeLineTax, type PosTaxRateInput } from "./pos-tax.js";

export type PosPriceSourceKind =
  | "retail"
  | "wholesale"
  | "dealer"
  | "customer"
  | "quantity"
  | "promotion"
  | "manual";

export type QuantityPriceBreak = {
  /** Inclusive minimum qty (sale unit). */
  minQty: number;
  unitPrice: number;
};

export type ResolvePosUnitPriceInput = {
  retailPrice: number;
  wholesalePrice: number;
  dealerPrice: number;
  /** Customer-specific contract price when available. */
  customerPrice?: number | null;
  /** Active promotion unit price when available. */
  promotionPrice?: number | null;
  quantityBreaks?: QuantityPriceBreak[];
  /** Selected POS tier when no higher-priority source applies. */
  priceLevel: "retail" | "wholesale" | "dealer";
  qty: number | string;
  unitId?: string;
  /** Cashier/manager manual override (requires authorization outside). */
  manualOverride?: number | null;
  allowManualOverride?: boolean;
  minimumSalePrice?: number;
};

export type ResolvePosUnitPriceResult = {
  unitPrice: number;
  source: PosPriceSourceKind;
  /** Price-level (retail/wholesale/dealer) before promo/qty/customer/manual. */
  basePrice: number;
  unitId?: string;
  discountEligible: boolean;
  reason: string;
};

function finiteMoney(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickTierPrice(
  input: Pick<ResolvePosUnitPriceInput, "retailPrice" | "wholesalePrice" | "dealerPrice" | "priceLevel">,
): number {
  if (input.priceLevel === "wholesale") return finiteMoney(input.wholesalePrice);
  if (input.priceLevel === "dealer") return finiteMoney(input.dealerPrice);
  return finiteMoney(input.retailPrice);
}

function quantityBreakPrice(
  breaks: QuantityPriceBreak[] | undefined,
  qty: number,
): number | null {
  if (!breaks?.length || !(qty > 0)) return null;
  const sorted = [...breaks]
    .filter((b) => Number.isFinite(b.minQty) && Number.isFinite(b.unitPrice) && b.minQty > 0)
    .sort((a, b) => b.minQty - a.minQty);
  const hit = sorted.find((b) => qty + 1e-9 >= b.minQty);
  return hit ? finiteMoney(hit.unitPrice) : null;
}

/**
 * Resolve sell unit price for a POS line.
 * Priority: manual → promotion → quantity break → customer → price level.
 */
export function resolvePosUnitPrice(input: ResolvePosUnitPriceInput): ResolvePosUnitPriceResult {
  const qty = finiteMoney(input.qty);
  const basePrice = roundMoney(Math.max(0, pickTierPrice(input)));
  if (input.manualOverride != null && input.manualOverride !== undefined) {
    if (!input.allowManualOverride) {
      throw new ValidationDomainError("Manual price override is not authorized");
    }
    const unitPrice = roundMoney(finiteMoney(input.manualOverride));
    if (unitPrice < 0) throw new ValidationDomainError("Price cannot be negative");
    const min = finiteMoney(input.minimumSalePrice, 0);
    if (unitPrice + 1e-9 < min) {
      throw new ValidationDomainError("Price below minimum sale price");
    }
    return {
      unitPrice,
      source: "manual",
      basePrice,
      unitId: input.unitId,
      discountEligible: true,
      reason: "Manual unit price override",
    };
  }

  if (input.promotionPrice != null && Number.isFinite(Number(input.promotionPrice))) {
    const unitPrice = roundMoney(Math.max(0, finiteMoney(input.promotionPrice)));
    return {
      unitPrice,
      source: "promotion",
      basePrice,
      unitId: input.unitId,
      discountEligible: true,
      reason: "Active promotion unit price",
    };
  }

  const qtyPrice = quantityBreakPrice(input.quantityBreaks, qty);
  if (qtyPrice != null) {
    return {
      unitPrice: roundMoney(Math.max(0, qtyPrice)),
      source: "quantity",
      basePrice,
      unitId: input.unitId,
      discountEligible: true,
      reason: "Quantity-break unit price",
    };
  }

  if (input.customerPrice != null && Number.isFinite(Number(input.customerPrice))) {
    return {
      unitPrice: roundMoney(Math.max(0, finiteMoney(input.customerPrice))),
      source: "customer",
      basePrice,
      unitId: input.unitId,
      discountEligible: true,
      reason: "Customer-specific product price",
    };
  }

  const tier = roundMoney(Math.max(0, basePrice));
  return {
    unitPrice: tier,
    source: input.priceLevel,
    basePrice,
    unitId: input.unitId,
    discountEligible: true,
    reason: `Price level ${input.priceLevel}`,
  };
}

export type PreparePosSaleLineInput = {
  qty: number;
  pricing: ResolvePosUnitPriceInput;
  discountMode?: DiscountMode;
  discountValue?: number;
  taxRate?: PosTaxRateInput | null;
};

export type PreparePosSaleLineResult = {
  unitPrice: number;
  source: PosPriceSourceKind;
  basePrice: number;
  discount: number;
  discountPercent: number;
  tax: number;
  lineTotal: number;
  reason: string;
};

/**
 * Authoritative line economics: resolved unit price → line discount → tax.
 */
export function preparePosSaleLine(input: PreparePosSaleLineInput): PreparePosSaleLineResult {
  const qty = finiteMoney(input.qty);
  if (!(qty > 0)) throw new ValidationDomainError("Invalid quantity");
  const resolved = resolvePosUnitPrice({ ...input.pricing, qty });
  const gross = roundMoney(qty * resolved.unitPrice);
  let discount = 0;
  let discountPercent = 0;
  if (input.discountValue != null && input.discountValue > 0) {
    const applied = applyDiscount({
      base: gross,
      mode: input.discountMode ?? "fixed",
      value: input.discountValue,
    });
    discount = applied.amount;
    discountPercent = applied.percent;
  }
  const net = roundMoney(Math.max(0, gross - discount));
  const tax = computeLineTax({ amount: net, rate: input.taxRate ?? null }).tax;
  return {
    unitPrice: resolved.unitPrice,
    source: resolved.source,
    basePrice: resolved.basePrice,
    discount,
    discountPercent,
    tax,
    lineTotal: roundMoney(net + tax),
    reason: resolved.reason,
  };
}
