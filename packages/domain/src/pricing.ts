import { ValidationDomainError } from "./errors.js";

export interface ProductPricing {
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  dealerPrice: number;
  specialPrice?: number | null;
  minimumSalePrice: number;
  lastPurchasePrice: number;
  averagePurchasePrice: number;
}

export function expectedProfit(pricing: ProductPricing): number {
  const sell = pricing.specialPrice ?? pricing.retailPrice;
  return Math.round((sell - pricing.costPrice) * 100) / 100;
}

export function profitMarginPercent(pricing: ProductPricing): number {
  const sell = pricing.specialPrice ?? pricing.retailPrice;
  if (sell <= 0) return 0;
  return Math.round(((sell - pricing.costPrice) / sell) * 10000) / 100;
}

export function assertSalePriceAllowed(unitPrice: number, minimumSalePrice: number): void {
  if (unitPrice < 0) throw new ValidationDomainError("Price cannot be negative");
  if (unitPrice + 1e-9 < minimumSalePrice) {
    throw new ValidationDomainError("Price below minimum sale price");
  }
}

export function validatePricing(pricing: ProductPricing): void {
  for (const [key, value] of Object.entries(pricing)) {
    if (typeof value === "number" && value < 0) {
      throw new ValidationDomainError(`Invalid ${key}`);
    }
  }
  if (pricing.retailPrice + 1e-9 < pricing.minimumSalePrice) {
    throw new ValidationDomainError("Retail price cannot be below minimum sale price");
  }
}
