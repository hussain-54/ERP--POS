import { describe, expect, it } from "vitest";
import { computeStockMetrics, assertNonNegativeStock } from "./stock-balances.js";
import {
  applyMovementToBalance,
  assertStockMovementQty,
  differenceQty,
  effectForMovement,
} from "./stock-ledger.js";
import type { StockMovementType } from "@electronic-erp/contracts";

const ALL_TYPES: StockMovementType[] = [
  "opening",
  "purchase",
  "sale",
  "sale_return",
  "purchase_return",
  "damage",
  "adjustment",
  "transfer_out",
  "transfer_in",
  "stock_count",
  "reservation",
  "release_reservation",
  "warranty_replacement",
  "repair_consumption",
];

describe("stock balance metrics", () => {
  it("computes available/reserved/damaged/in-transit/total and flags", () => {
    const m = computeStockMetrics(
      { qtyOnHand: "100", qtyReserved: "15", qtyDamaged: "5", qtyInTransit: "10" },
      "20",
      "200",
    );
    expect(m.qtyAvailable).toBe("85");
    expect(m.qtyTotal).toBe("115");
    expect(m.isLowStock).toBe(false);
    expect(m.isOutOfStock).toBe(false);
    expect(m.isOverstock).toBe(false);
  });

  it("flags low / out / overstock", () => {
    expect(computeStockMetrics({ qtyOnHand: "5", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" }, "10").isLowStock).toBe(true);
    expect(computeStockMetrics({ qtyOnHand: "0", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" }).isOutOfStock).toBe(true);
    expect(
      computeStockMetrics({ qtyOnHand: "250", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" }, "10", "200").isOverstock,
    ).toBe(true);
  });

  it("blocks negative unless allowed", () => {
    expect(() => assertNonNegativeStock("-1", false)).toThrow();
    expect(() => assertNonNegativeStock("-1", true)).not.toThrow();
  });
});

describe("stock ledger movements", () => {
  it("covers every movement type", () => {
    expect(ALL_TYPES.length).toBe(14);
    for (const type of ALL_TYPES) {
      expect(() => effectForMovement(type, "1")).not.toThrow();
    }
  });

  it("applies decimal sale against on-hand", () => {
    const { after } = applyMovementToBalance(
      { qtyOnHand: "12.5", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" },
      "sale",
      "2.75",
      false,
    );
    expect(after.qtyOnHand).toBe("9.75");
  });

  it("handles reservation and release", () => {
    const reserved = applyMovementToBalance(
      { qtyOnHand: "50", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" },
      "reservation",
      "10",
      false,
    ).after;
    expect(reserved.qtyReserved).toBe("10");
    const released = applyMovementToBalance(reserved, "release_reservation", "10", false).after;
    expect(released.qtyReserved).toBe("0");
  });

  it("moves damage into damaged bucket", () => {
    const { after } = applyMovementToBalance(
      { qtyOnHand: "20", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" },
      "damage",
      "3",
      false,
    );
    expect(after.qtyOnHand).toBe("17");
    expect(after.qtyDamaged).toBe("3");
  });

  it("tracks transfer_out in transit", () => {
    const { after } = applyMovementToBalance(
      { qtyOnHand: "40", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" },
      "transfer_out",
      "8",
      false,
    );
    expect(after.qtyOnHand).toBe("32");
    expect(after.qtyInTransit).toBe("8");
  });

  it("computes adjustment difference", () => {
    expect(differenceQty("90", "85")).toBe("-5");
    expect(differenceQty("10", "12.5")).toBe("2.5");
  });

  it("rejects inconsistent negative stock", () => {
    expect(() =>
      applyMovementToBalance(
        { qtyOnHand: "1", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" },
        "sale",
        "5",
        false,
      ),
    ).toThrow(/Negative stock|Available stock/);
  });

  it("applies converted sale qty (2 boxes = 20 pieces) to on-hand", () => {
    const { after } = applyMovementToBalance(
      { qtyOnHand: "100", qtyReserved: "0", qtyDamaged: "0", qtyInTransit: "0" },
      "sale",
      "20",
      false,
    );
    expect(after.qtyOnHand).toBe("80");
    const ret = applyMovementToBalance(after, "sale_return", "10", false);
    expect(ret.after.qtyOnHand).toBe("90");
  });

  it("rejects invalid stock movement quantities", () => {
    expect(() => assertStockMovementQty("sale", "0")).toThrow(/zero/i);
    expect(() => assertStockMovementQty("sale", "-2")).toThrow(/positive/i);
    expect(() => assertStockMovementQty("sale", "NaN")).toThrow(/invalid/i);
    expect(() => assertStockMovementQty("adjustment", "-5")).not.toThrow();
  });
});
