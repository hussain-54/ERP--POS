import { describe, expect, it } from "vitest";
import { buildDayCloseTotals, finalizeDayClose } from "./pos-day-close";

describe("pos day close", () => {
  it("builds expected cash and variance for a business day", () => {
    const totals = buildDayCloseTotals({
      businessDate: "2026-08-21",
      totalSales: 10000,
      cashSales: 4000,
      cardSales: 3000,
      bankSales: 1000,
      walletSales: 500,
      creditSales: 1500,
      refunds: 200,
      cashIn: 100,
      cashOut: 50,
      openingCash: 1000,
    });
    expect(totals.expectedCash).toBe(4850);
    const closed = finalizeDayClose({ totals, actualCash: 4800 });
    expect(closed.variance).toBe(-50);
  });
});
