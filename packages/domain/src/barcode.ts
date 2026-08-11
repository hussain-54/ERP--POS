import { ValidationDomainError } from "./errors.js";

export function normalizeBarcode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) throw new ValidationDomainError("Barcode cannot be empty");
  if (trimmed.length > 64) throw new ValidationDomainError("Barcode too long");
  return trimmed;
}

/** Deterministic Code128-friendly payload from SKU. */
export function barcodeFromSku(sku: string): string {
  const cleaned = sku.replace(/[^A-Za-z0-9\-]/g, "").toUpperCase();
  if (!cleaned) throw new ValidationDomainError("Cannot generate barcode from empty SKU");
  return cleaned;
}

export function qrPayloadForProduct(productId: string, sku: string): string {
  return JSON.stringify({ type: "product", productId, sku });
}

/** Very small EAN-13 check digit helper for numeric seeds. */
export function ean13FromSeed(seed: string): string {
  const digits = seed.replace(/\D/g, "").padStart(12, "0").slice(-12);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const n = Number(digits[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${digits}${check}`;
}
