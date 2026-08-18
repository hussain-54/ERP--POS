import { describe, expect, it } from "vitest";
import {
  parseCashShift,
  registerVariance,
  SUPPORTED_REGISTER_ACTIONS,
} from "./register-shift";

describe("register shift helpers", () => {
  it("exposes only backend-backed shift actions", () => {
    expect(SUPPORTED_REGISTER_ACTIONS).toEqual(["open", "close", "cash_count", "reconcile"]);
    expect(SUPPORTED_REGISTER_ACTIONS).not.toContain("cash_in");
    expect(SUPPORTED_REGISTER_ACTIONS).not.toContain("cash_out");
  });

  it("parses snake_case shift rows from the cash-shift API", () => {
    const shift = parseCashShift({
      id: "sh1",
      status: "open",
      branch_id: "b1",
      opened_by: "u1",
      opening_float: 500,
      cash_sales_total: 1200,
      expense_total: 50,
      expected_cash: 1650,
      opened_at: "2026-08-16T08:00:00.000Z",
    });
    expect(shift?.openingFloat).toBe(500);
    expect(shift?.cashSalesTotal).toBe(1200);
    expect(shift?.expectedCash).toBe(1650);
  });

  it("computes drawer variance from counted vs expected without posting", () => {
    expect(registerVariance(1600, 1650)).toBe(-50);
    expect(registerVariance(null, 1650)).toBeNull();
  });
});
