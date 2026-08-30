import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  hasSpecialPrice,
  resolveDiscountAmount,
  resolveMarginPercent,
  resolveSalePrice,
  specialIsActive,
  statusTone,
  stockTone,
} from "./product-display-utils";

describe("product-display-utils", () => {
  it("formats currency cleanly", () => {
    expect(formatCurrency(1250.5)).toBe("1,250.50");
    expect(formatCurrency(null)).toBe("0.00");
    expect(formatCurrency("abc")).toBe("—");
  });

  it("resolves sale price with specialPrice or retail fallback", () => {
    expect(resolveSalePrice({ retailPrice: 100, specialPrice: 80 })).toBe(80);
    expect(resolveSalePrice({ retailPrice: 100, specialPrice: 0 })).toBe(100);
    expect(resolveSalePrice({ retailPrice: 100, specialPrice: null })).toBe(100);
    expect(resolveSalePrice({ retailPrice: 100 })).toBe(100);
    expect(resolveSalePrice({})).toBe(0);
  });

  it("resolves discount amount correctly", () => {
    expect(resolveDiscountAmount({ retailPrice: 100, specialPrice: 80 })).toBe(20);
    expect(resolveDiscountAmount({ retailPrice: 100, specialPrice: 120 })).toBe(0);
    expect(resolveDiscountAmount({ retailPrice: 100, specialPrice: null })).toBe(0);
    expect(resolveDiscountAmount({ retailPrice: 100 })).toBe(0);
  });

  it("detects special price presence", () => {
    expect(hasSpecialPrice({ specialPrice: 50 })).toBe(true);
    expect(hasSpecialPrice({ specialPrice: 0 })).toBe(false);
    expect(hasSpecialPrice({ specialPrice: null })).toBe(false);
    expect(hasSpecialPrice({})).toBe(false);
  });

  it("handles active promo check with partial / optional fields", () => {
    expect(specialIsActive({ isActive: true, specialPrice: 50 })).toBe(true);
    expect(specialIsActive({ isActive: false, specialPrice: 50 })).toBe(false);
    expect(specialIsActive({ specialPrice: 50 })).toBe(false);
    expect(specialIsActive({ isActive: true })).toBe(false);
  });

  it("calculates profit margin percent accurately", () => {
    expect(resolveMarginPercent({ profitMarginPercent: 25 })).toBe(25);
    expect(resolveMarginPercent({ costPrice: 80, retailPrice: 100 })).toBeCloseTo(20);
    expect(resolveMarginPercent({ costPrice: 60, retailPrice: 100, specialPrice: 80 })).toBe(25);
    expect(resolveMarginPercent({ costPrice: 0, retailPrice: 0 })).toBeNull();
  });

  it("evaluates status tones safely", () => {
    expect(statusTone({ isActive: true, status: "active" })).toBe("success");
    expect(statusTone({ isActive: true, status: "draft" })).toBe("warning");
    expect(statusTone({ isActive: false, status: "active" })).toBe("neutral");
    expect(statusTone({ status: "inactive" })).toBe("neutral");
  });

  it("evaluates stock tones safely", () => {
    expect(stockTone({ trackInventory: false })).toBe("neutral");
    expect(stockTone({ trackInventory: true, stockAvailable: 0, reorderLevel: 5 })).toBe("danger");
    expect(stockTone({ trackInventory: true, stockAvailable: 3, reorderLevel: 5 })).toBe("warning");
    expect(stockTone({ trackInventory: true, stockAvailable: 10, reorderLevel: 5 })).toBe("success");
  });
});
