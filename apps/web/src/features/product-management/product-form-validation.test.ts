import { describe, expect, it } from "vitest";
import { firstProductFormError, validateProductForm } from "./product-form-validation";

const valid = {
  productCode: "P-1",
  sku: "SKU-1",
  name: "Switch",
  baseUnitId: "11111111-1111-4111-8111-111111111111",
  costPrice: "10",
  retailPrice: "20",
  wholesalePrice: "15",
  dealerPrice: "12",
  minimumSalePrice: "10",
  specialPrice: "",
  warrantyDays: "0",
  primaryBarcode: "",
};

describe("validateProductForm", () => {
  it("requires core identity fields", () => {
    const errors = validateProductForm({
      ...valid,
      productCode: "",
      sku: " ",
      name: "",
      baseUnitId: "",
    });
    expect(errors.productCode).toMatch(/required/i);
    expect(errors.sku).toMatch(/required/i);
    expect(errors.name).toMatch(/required/i);
    expect(errors.baseUnitId).toMatch(/required/i);
    expect(firstProductFormError(errors)).toBeTruthy();
  });

  it("accepts a complete form", () => {
    expect(validateProductForm(valid)).toEqual({});
  });

  it("rejects negative prices", () => {
    const errors = validateProductForm({ ...valid, retailPrice: "-1" });
    expect(errors.retailPrice).toMatch(/negative/i);
  });
});
