import type { CreateProductMasterInput, ProductMaster } from "@electronic-erp/contracts";

export type ProductFormState = {
  productCode: string;
  sku: string;
  /** Primary business / display name shown on invoices and POS. */
  name: string;
  nameUr: string;
  shortDescription: string;
  description: string;
  baseUnitId: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  companyId: string;
  warrantyDays: string;
  status: "draft" | "active" | "inactive";
  trackInventory: boolean;
  trackSerial: boolean;
  trackBatch: boolean;
  reorderLevel: string;
  costPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  dealerPrice: string;
  minimumSalePrice: string;
  specialPrice: string;
  primaryBarcode: string;
  size: string;
  color: string;
  watt: string;
  voltage: string;
  material: string;
};

export type TaxonomyOption = { value: string; label: string };

export type SubcategoryOption = TaxonomyOption & { categoryId?: string };

export const EMPTY_PRODUCT_FORM: ProductFormState = {
  productCode: "",
  sku: "",
  name: "",
  nameUr: "",
  shortDescription: "",
  description: "",
  baseUnitId: "",
  categoryId: "",
  subcategoryId: "",
  brandId: "",
  companyId: "",
  warrantyDays: "0",
  status: "active",
  trackInventory: true,
  trackSerial: false,
  trackBatch: false,
  reorderLevel: "0",
  costPrice: "0",
  retailPrice: "0",
  wholesalePrice: "0",
  dealerPrice: "0",
  minimumSalePrice: "0",
  specialPrice: "",
  primaryBarcode: "",
  size: "",
  color: "",
  watt: "",
  voltage: "",
  material: "",
};

export function slugTaxonomyCode(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `item-${Date.now()}`;
}

export function productToForm(product: ProductMaster): ProductFormState {
  return {
    productCode: product.productCode,
    sku: product.sku,
    name: product.name,
    nameUr: product.nameUr ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    baseUnitId: product.baseUnitId,
    categoryId: product.categoryId ?? "",
    subcategoryId: product.subcategoryId ?? "",
    brandId: product.brandId ?? "",
    companyId: product.companyId ?? "",
    warrantyDays: String(product.warrantyDays),
    status: product.status,
    trackInventory: product.trackInventory,
    trackSerial: product.trackSerial,
    trackBatch: product.trackBatch,
    reorderLevel: String(product.reorderLevel ?? 0),
    costPrice: String(product.costPrice),
    retailPrice: String(product.retailPrice),
    wholesalePrice: String(product.wholesalePrice),
    dealerPrice: String(product.dealerPrice),
    minimumSalePrice: String(product.minimumSalePrice),
    specialPrice: product.specialPrice == null ? "" : String(product.specialPrice),
    primaryBarcode: "",
    size: "",
    color: "",
    watt: "",
    voltage: "",
    material: "",
  };
}

export function buildProductPayload(
  form: ProductFormState,
): Omit<CreateProductMasterInput, "organizationId"> {
  return {
    productCode: form.productCode.trim(),
    sku: form.sku.trim(),
    name: form.name.trim(),
    nameUr: form.nameUr.trim() || undefined,
    shortDescription: form.shortDescription.trim() || undefined,
    description: form.description.trim() || undefined,
    baseUnitId: form.baseUnitId,
    categoryId: form.categoryId || undefined,
    subcategoryId: form.subcategoryId || undefined,
    brandId: form.brandId || undefined,
    companyId: form.companyId || undefined,
    warrantyDays: Number(form.warrantyDays || 0),
    status: form.status,
    trackInventory: form.trackInventory,
    trackSerial: form.trackSerial,
    trackBatch: form.trackBatch,
    reorderLevel: String(form.reorderLevel || 0),
    costPrice: Number(form.costPrice || 0),
    retailPrice: Number(form.retailPrice || 0),
    wholesalePrice: Number(form.wholesalePrice || 0),
    dealerPrice: Number(form.dealerPrice || 0),
    minimumSalePrice: Number(form.minimumSalePrice || 0),
    specialPrice: form.specialPrice === "" ? undefined : Number(form.specialPrice),
    primaryBarcode: form.primaryBarcode.trim() || undefined,
    specifications: {
      size: form.size || undefined,
      color: form.color || undefined,
      watt: form.watt || undefined,
      voltage: form.voltage || undefined,
      material: form.material || undefined,
    },
  };
}

export function mapTaxonomyOptions(items: Array<Record<string, unknown>>): TaxonomyOption[] {
  return items.map((x) => ({ value: String(x.id), label: String(x.name) }));
}

export function mapSubcategoryOptions(items: Array<Record<string, unknown>>): SubcategoryOption[] {
  return items.map((x) => ({
    value: String(x.id),
    label: String(x.name),
    categoryId: String(x.category_id ?? x.categoryId ?? ""),
  }));
}

export function labelForOption(options: TaxonomyOption[], id?: string | null): string {
  if (!id) return "—";
  return options.find((o) => o.value === id)?.label ?? id.slice(0, 8);
}

export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v.toFixed(2) : "0.00";
}
