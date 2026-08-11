import { describe, expect, it } from "vitest";
import {
  DecimalStringSchema,
  addDecimal,
  compareDecimal,
  multiplyDecimal,
  subtractDecimal,
} from "./decimal.js";

describe("decimal precision", () => {
  it("accepts decimal quantity strings", () => {
    for (const v of ["0.5", "1.25", "2.75", "12.5", "100"]) {
      expect(DecimalStringSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid decimals", () => {
    expect(() => DecimalStringSchema.parse("-1")).toThrow();
    expect(() => DecimalStringSchema.parse("1.2345678")).toThrow();
  });

  it("multiplies and subtracts without float drift for roll/meter case", () => {
    expect(multiplyDecimal("1", "90")).toBe("90");
    expect(subtractDecimal("90", "5")).toBe("85");
    expect(addDecimal("1.25", "2.75")).toBe("4");
    expect(compareDecimal("12.5", "12.50")).toBe(0);
  });

  it("supports signed ledger deltas in arithmetic", () => {
    expect(addDecimal("12.5", "-2.75")).toBe("9.75");
    expect(addDecimal("10", "-10")).toBe("0");
    expect(compareDecimal("-1", "0")).toBe(-1);
  });
});
