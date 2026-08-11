import { describe, expect, it } from "vitest";
import { barcodeFromSku, ean13FromSeed, normalizeBarcode } from "./barcode.js";

describe("barcode foundation", () => {
  it("normalizes and generates from sku", () => {
    expect(normalizeBarcode("  ABC-1  ")).toBe("ABC-1");
    expect(barcodeFromSku("sku-wire-01")).toBe("SKU-WIRE-01");
  });

  it("builds valid length ean13", () => {
    const code = ean13FromSeed("123");
    expect(code).toHaveLength(13);
  });
});
