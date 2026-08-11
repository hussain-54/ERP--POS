import { describe, expect, it } from "vitest";
import { resolveIssueUnitCost, updateMovingAverageCost } from "./inventory-valuation.js";

describe("inventory valuation architecture", () => {
  it("supports configurable costing methods", () => {
    const layers = [
      { id: "1", qtyRemaining: "10", unitCost: "100", receivedAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", qtyRemaining: "5", unitCost: "120", receivedAt: "2026-02-01T00:00:00.000Z" },
    ];
    expect(resolveIssueUnitCost({ method: "moving_average", averageUnitCost: "110", layers }, "1").unitCost).toBe("110");
    expect(resolveIssueUnitCost({ method: "fifo", averageUnitCost: "0", layers }, "1").unitCost).toBe("100");
    expect(resolveIssueUnitCost({ method: "lifo", averageUnitCost: "0", layers }, "1").unitCost).toBe("120");
    expect(
      resolveIssueUnitCost({ method: "specific", averageUnitCost: "0", layers }, "1", "99").unitCost,
    ).toBe("99");
    expect(
      resolveIssueUnitCost({ method: "standard", averageUnitCost: "0", layers, standardUnitCost: "95" }, "1")
        .unitCost,
    ).toBe("95");
  });

  it("updates moving average with decimals", () => {
    expect(updateMovingAverageCost("10", "100", "10", "120")).toBe("110");
  });
});
