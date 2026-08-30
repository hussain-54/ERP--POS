import { money } from "./product-form-state";

export function formatCurrency(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface ProductPriceFields {
  retailPrice?: number | null;
  specialPrice?: number | null;
}

export interface ProductMarginFields extends ProductPriceFields {
  costPrice?: number | null;
  profitMarginPercent?: number | null;
}

export interface ProductStatusFields {
  isActive?: boolean | null;
  status?: string | null;
}

export interface ProductStockFields {
  stockAvailable?: number | null;
  reorderLevel?: string | number | null;
  trackInventory?: boolean | null;
}

/** Effective customer-facing sale unit price from real catalog fields. */
export function resolveSalePrice(product: ProductPriceFields): number {
  const special = product.specialPrice;
  if (special != null && Number(special) > 0) return Number(special);
  return Number(product.retailPrice ?? 0);
}

/** Discount amount when special price is below retail; otherwise zero. */
export function resolveDiscountAmount(product: ProductPriceFields): number {
  const retail = Number(product.retailPrice ?? 0);
  const sale = resolveSalePrice(product);
  if (hasSpecialPrice(product) && sale < retail) return retail - sale;
  return 0;
}

export function hasSpecialPrice(product: Pick<ProductPriceFields, "specialPrice"> | { specialPrice?: number | null }): boolean {
  return product.specialPrice != null && Number(product.specialPrice) > 0;
}

export function specialIsActive(
  product: { specialPrice?: number | null; isActive?: boolean | null },
): boolean {
  return Boolean(product.isActive && hasSpecialPrice(product));
}

export function resolveMarginPercent(product: ProductMarginFields): number | null {
  if (product.profitMarginPercent != null && Number.isFinite(product.profitMarginPercent)) {
    return product.profitMarginPercent;
  }
  const cost = Number(product.costPrice ?? 0);
  const sale = resolveSalePrice(product);
  if (sale <= 0) return null;
  return ((sale - cost) / sale) * 100;
}

export function statusTone(product: ProductStatusFields): "success" | "warning" | "neutral" {
  if (product.isActive === false || product.status === "inactive") return "neutral";
  if (product.status === "draft") return "warning";
  return "success";
}

export function stockTone(item: ProductStockFields): "success" | "warning" | "danger" | "neutral" {
  if (!item.trackInventory) return "neutral";
  const avail = Number(item.stockAvailable ?? 0);
  const reorder = Number(item.reorderLevel ?? 0);
  if (avail <= 0) return "danger";
  if (avail <= reorder) return "warning";
  return "success";
}

export { money };
