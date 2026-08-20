import { describe, expect, it } from "vitest";
import { resolvePosSearchStockAvailable } from "./pos-stock-availability.js";

describe("resolvePosSearchStockAvailable", () => {
  it("treats a missing stock_balances row as unknown, not zero", () => {
    expect(resolvePosSearchStockAvailable(undefined)).toBeUndefined();
    expect(resolvePosSearchStockAvailable(null)).toBeUndefined();
  });

  it("treats an initialized slot with no movements as unknown", () => {
    expect(
      resolvePosSearchStockAvailable({ qtyAvailable: "0", lastMovementAt: null }),
    ).toBeUndefined();
  });

  it("reports real available qty after inventory has moved", () => {
    expect(
      resolvePosSearchStockAvailable({
        qtyAvailable: "12.5",
        lastMovementAt: "2026-08-20T00:00:00.000Z",
      }),
    ).toBe("12.5");
  });

  it("reports zero after stock has been received and sold out", () => {
    expect(
      resolvePosSearchStockAvailable({
        qtyAvailable: "0",
        lastMovementAt: "2026-08-20T00:00:00.000Z",
      }),
    ).toBe("0");
  });
});
