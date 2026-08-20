import { describe, expect, it } from "vitest";
import { clampPosSearchLimit } from "./pos-product-search";
import { POS_PRODUCT_SEARCH_LIMIT, POS_PRODUCT_SEARCH_LIMIT_MAX } from "./pos-catalog-load";

describe("clampPosSearchLimit", () => {
  it("uses the canonical first-page size when omitted", () => {
    expect(clampPosSearchLimit()).toBe(POS_PRODUCT_SEARCH_LIMIT);
    expect(clampPosSearchLimit(0)).toBe(POS_PRODUCT_SEARCH_LIMIT);
    expect(clampPosSearchLimit(Number.NaN)).toBe(POS_PRODUCT_SEARCH_LIMIT);
  });

  it("caps at the POS search max instead of dumping the catalog", () => {
    expect(clampPosSearchLimit(24)).toBe(24);
    expect(clampPosSearchLimit(50)).toBe(POS_PRODUCT_SEARCH_LIMIT_MAX);
    expect(clampPosSearchLimit(500)).toBe(POS_PRODUCT_SEARCH_LIMIT_MAX);
  });
});
