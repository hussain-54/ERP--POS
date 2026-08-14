import { describe, expect, it } from "vitest";
import { applySaleInBaseUnit, convertQuantity, qtyToBaseUnits } from "./unit-conversion.js";

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

  it("converts box sale qty to base pieces", () => {
    const pcs = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const box = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const boxRules = [{ productId, fromUnitId: box, toUnitId: pcs, factor: "10" }];
    expect(qtyToBaseUnits({ qty: "2", fromUnitId: box, baseUnitId: pcs, rules: boxRules, productId })).toBe(
      "20",
    );
    expect(qtyToBaseUnits({ qty: "1", fromUnitId: pcs, baseUnitId: pcs, rules: boxRules, productId })).toBe(
      "1",
    );
    expect(convertQuantity("1", box, pcs, boxRules, productId)).toBe("10");
  });

  it("rejects invalid quantity and conversion factor", () => {
    const pcs = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const box = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(() =>
      qtyToBaseUnits({
        qty: "NaN",
        fromUnitId: box,
        baseUnitId: pcs,
        rules: [{ productId, fromUnitId: box, toUnitId: pcs, factor: "10" }],
        productId,
      }),
    ).toThrow(/invalid/i);
    expect(() =>
      convertQuantity("2", box, pcs, [{ productId, fromUnitId: box, toUnitId: pcs, factor: "0" }], productId),
    ).toThrow(/factor/i);
    expect(() =>
      convertQuantity("2", box, pcs, [{ productId, fromUnitId: box, toUnitId: pcs, factor: "-1" }], productId),
    ).toThrow(/factor/i);
    expect(() => convertQuantity("2", box, pcs, [], productId)).toThrow(/conversion rule/i);
  });
});
