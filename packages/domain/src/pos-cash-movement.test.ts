import { describe, expect, it } from "vitest";
import {
  assertPosCashMovementInput,
  cashMovementVariance,
  expectedShiftCash,
} from "./pos-cash-movement";

describe("pos cash movements", () => {
  it("rejects invalid cash movement payloads", () => {
    expect(() =>
      assertPosCashMovementInput({ kind: "cash_in", amount: 0, reason: "float" }),
    ).toThrow(/greater than zero/i);
    expect(() =>
      assertPosCashMovementInput({ kind: "cash_out", amount: 10, reason: "  " }),
    ).toThrow(/reason/i);
  });

  it("computes expected drawer cash and variance", () => {
    expect(
      expectedShiftCash({
        openingFloat: 1000,
        cashSalesTotal: 500,
        cashInTotal: 200,
        cashOutTotal: 50,
        cashRefundTotal: 25,
      }),
    ).toBe(1625);
    expect(cashMovementVariance(1600, 1625)).toBe(-25);
  });
});
