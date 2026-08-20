export type ProductFormValues = {
  productCode: string;
  sku: string;
  name: string;
  baseUnitId: string;
  costPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  dealerPrice: string;
  minimumSalePrice: string;
  specialPrice: string;
  warrantyDays: string;
  primaryBarcode: string;
};

export type ProductFormFieldErrors = Partial<Record<keyof ProductFormValues, string>>;

function parseNonNegativeMoney(raw: string, label: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return `${label} must be a number`;
  if (value < 0) return `${label} cannot be negative`;
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
    return `${label} must have at most 2 decimal places`;
  }
  return null;
}

/** Client-side required-field / money checks before calling the catalog API. */
export function validateProductForm(form: ProductFormValues): ProductFormFieldErrors {
  const errors: ProductFormFieldErrors = {};

  if (!form.productCode.trim()) errors.productCode = "Product code is required";
  if (!form.sku.trim()) errors.sku = "SKU is required";
  if (!form.name.trim()) errors.name = "Product name is required";
  if (!form.baseUnitId.trim()) errors.baseUnitId = "Base unit is required";

  const moneyFields: Array<[keyof ProductFormValues, string]> = [
    ["costPrice", "Cost price"],
    ["retailPrice", "Retail price"],
    ["wholesalePrice", "Wholesale price"],
    ["dealerPrice", "Dealer price"],
    ["minimumSalePrice", "Minimum sale price"],
  ];
  for (const [key, label] of moneyFields) {
    const message = parseNonNegativeMoney(String(form[key] ?? ""), label);
    if (message) errors[key] = message;
  }
  if (form.specialPrice.trim()) {
    const message = parseNonNegativeMoney(form.specialPrice, "Special price");
    if (message) errors.specialPrice = message;
  }

  const warranty = Number(form.warrantyDays || 0);
  if (!Number.isFinite(warranty) || warranty < 0 || !Number.isInteger(warranty)) {
    errors.warrantyDays = "Warranty days must be a whole number ≥ 0";
  }

  return errors;
}

export function firstProductFormError(errors: ProductFormFieldErrors): string | null {
  const entry = Object.entries(errors)[0];
  return entry ? entry[1] : null;
}
