import { describe, expect, it } from "vitest";
import { applySaleInBaseUnit, convertQuantity } from "./unit-conversion.js";

const roll = "11111111-1111-4111-8111-111111111111";
const meter = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";

describe("unit conversion", () => {
  const rules = [
    { productId, fromUnitId: roll, toUnitId: meter, factor: "90" },
  ];

  it("converts roll to meter", () => {
    expect(convertQuantity("1", roll, meter, rules, productId)).toBe("90");
  });

  it("applies 5 meter sale against 90 meter stock", () => {
    const result = applySaleInBaseUnit("90", "5", meter, meter, rules, productId);
    expect(result.remainingBase).toBe("85");
  });
});
