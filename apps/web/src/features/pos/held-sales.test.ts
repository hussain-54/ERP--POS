import { describe, expect, it } from "vitest";
import {
  computeHoldStats,
  displayCashierName,
  displayCustomerName,
  filterHoldTable,
  holdNumber,
  holdStatusLabel,
  matchesHoldSearch,
  paginateHoldRows,
  parseHeldSale,
  snapshotCartLines,
  snapshotCustomerName,
  snapshotTotals,
  viewHeldSale,
} from "./held-sales";
import type { HeldSaleRecord } from "@electronic-erp/domain";

const now = new Date("2026-08-12T12:00:00.000Z");

const base: HeldSaleRecord = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  organizationId: "11111111-1111-4111-8111-111111111111",
  branchId: "22222222-2222-4222-8222-222222222222",
  saleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  holdLabel: "HOLD-1001",
  holdReason: "Customer stepped out",
  notes: "Call back",
  heldBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  customerName: "Ahmed Traders",
  cartSnapshot: {
    cart: [
      {
        key: "1",
        name: "LED Bulb",
        sku: "LED-12",
        qty: "2",
        unitId: "11111111-1111-4111-8111-111111111111",
        unitName: "pcs",
        unitPrice: 250,
        discount: 0,
        tax: 0,
        warrantyDays: 0,
      },
    ],
    invoiceDiscount: "0",
  },
  heldAt: "2026-08-12T08:00:00.000Z",
  expiresAt: "2026-08-13T08:00:00.000Z",
  status: "held",
};

describe("Hold / Resume display helpers", () => {
  it("uses hold label as hold # and never requires pasting an id", () => {
    expect(holdNumber(base)).toBe("HOLD-1001");
    expect(holdNumber({ holdLabel: null, heldAt: "2026-08-12T08:05:00.000Z" })).toMatch(/^Hold /);
  });

  it("classifies stats from existing hold fields (no invented expiry rules)", () => {
    const holds: HeldSaleRecord[] = [
      base,
      {
        ...base,
        id: "e1",
        holdLabel: "HOLD-EXP",
        expiresAt: "2026-08-12T13:00:00.000Z",
      },
      {
        ...base,
        id: "e2",
        holdLabel: "HOLD-OLD",
        status: "expired",
        expiresAt: "2026-08-12T10:00:00.000Z",
      },
    ];
    const stats = computeHoldStats(holds, base.heldBy, now);
    expect(stats.active).toBe(1);
    expect(stats.expiring).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.today).toBe(3);
    expect(stats.mine).toBe(3);
    expect(stats.totalValue).toBe(1000);
    expect(filterHoldTable(holds, "active", { now }).map((h) => h.holdLabel)).toEqual(["HOLD-1001"]);
    expect(
      filterHoldTable(holds, "all_pending", { now, cashierId: "other" }).map((h) => h.holdLabel),
    ).toEqual([]);
    expect(holdStatusLabel(viewHeldSale({ ...base, expiresAt: "2026-08-12T13:00:00.000Z" } as unknown as Record<string, unknown>, now))).toBe(
      "Expiring soon",
    );
  });

  it("paginates hold rows without extra API calls", () => {
    const rows = Array.from({ length: 26 }, (_, i) => i);
    const first = paginateHoldRows(rows, 1, 25);
    expect(first.items).toHaveLength(25);
    expect(first.pageCount).toBe(2);
    expect(first.total).toBe(26);
    expect(paginateHoldRows(rows, 2, 25).items).toEqual([25]);
    expect(paginateHoldRows(rows, 9, 25).page).toBe(2);
  });

  it("resolves customer names from the hold or snapshot, not invented rows", () => {
    expect(displayCustomerName(base, {})).toBe("Ahmed Traders");
    expect(displayCustomerName({ ...base, customerName: null, customerId: null }, {})).toBe("Walk-in");
    expect(
      snapshotCustomerName({ customerName: "From snapshot" }),
    ).toBe("From snapshot");
    expect(displayCashierName(base, { [base.heldBy!]: "Sara" })).toBe("Sara");
    expect(displayCashierName({ heldBy: null }, {})).toBe("—");
  });

  it("reads cart snapshot lines and totals from the parked cart", () => {
    const lines = snapshotCartLines(base.cartSnapshot);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.name).toBe("LED Bulb");
    expect(lines[0]?.sku).toBe("LED-12");
    const totals = snapshotTotals(base.cartSnapshot);
    expect(totals?.items).toBe(1);
    expect(totals?.qty).toBe(2);
    expect(totals?.grand).toBe(500);
  });

  it("searches hold #, customer, and cashier names", () => {
    const view = viewHeldSale(base as unknown as Record<string, unknown>, now);
    expect(matchesHoldSearch(view, "HOLD-1001", { customerName: "Ahmed Traders", cashierName: "Sara" })).toBe(
      true,
    );
    expect(matchesHoldSearch(view, "ahmed", { customerName: "Ahmed Traders", cashierName: "Sara" })).toBe(true);
    expect(matchesHoldSearch(view, "sara", { customerName: "Ahmed Traders", cashierName: "Sara" })).toBe(true);
    expect(matchesHoldSearch(view, "missing", { customerName: "Ahmed Traders", cashierName: "Sara" })).toBe(
      false,
    );
  });

  it("parses API rows without exposing raw JSON to callers", () => {
    const parsed = parseHeldSale({
      id: base.id,
      hold_label: "HOLD-API",
      hold_reason: "Wait",
      held_at: base.heldAt,
      expires_at: base.expiresAt,
      held_by: base.heldBy,
      customer_id: base.customerId,
      status: "held",
      cart_snapshot: base.cartSnapshot,
      organization_id: base.organizationId,
      branch_id: base.branchId,
      sale_id: base.saleId,
    });
    expect(parsed.holdLabel).toBe("HOLD-API");
    expect(parsed.holdReason).toBe("Wait");
    expect(parsed.cartSnapshot).toEqual(base.cartSnapshot);
  });
});
