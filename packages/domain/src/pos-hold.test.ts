import { describe, expect, it } from "vitest";
import {
  assertHoldActionAllowed,
  assertHoldCartNonEmpty,
  buildHoldSnapshot,
  cartItemCountFromSnapshot,
  cartLinesForResume,
  classifyHeldSale,
  computeHoldExpiresAt,
  filterHeldSales,
  holdMustNotReduceInventory,
  holdsDueForExpiry,
  nextStatusForAction,
  restoreHoldTransaction,
  statusAfterExpiry,
  type HeldSaleRecord,
} from "./pos-hold.js";

const base: HeldSaleRecord = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  organizationId: "11111111-1111-4111-8111-111111111111",
  branchId: "22222222-2222-4222-8222-222222222222",
  saleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  holdLabel: "Hold 1",
  holdReason: "Customer stepped out",
  notes: "Call back",
  heldBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  cartSnapshot: {
    cart: [
      { productId: "p1", qty: 1, unitPrice: 100 },
      { productId: "p2", qty: 2, unitPrice: 50 },
    ],
  },
  heldAt: "2026-08-12T08:00:00.000Z",
  expiresAt: "2026-08-13T08:00:00.000Z",
  status: "held",
};

describe("pos hold lifecycle", () => {
  it("builds hold snapshot with reason/notes/cart and rejects empty cart", () => {
    const snap = buildHoldSnapshot({
      cart: [{ productId: "p1", qty: 1 }],
      customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      notes: "waiting",
    });
    expect(cartItemCountFromSnapshot(snap)).toBe(1);
    expect(() => assertHoldCartNonEmpty({ cart: [] })).toThrow(/empty cart/i);
    expect(holdMustNotReduceInventory()).toBe(true);
  });

  it("classifies active, expiring, and expired holds", () => {
    const now = new Date("2026-08-13T07:00:00.000Z"); // 1h before expiry
    expect(classifyHeldSale(base, now)).toBe("expiring");
    expect(classifyHeldSale(base, new Date("2026-08-12T12:00:00.000Z"))).toBe("active");
    expect(classifyHeldSale(base, new Date("2026-08-13T09:00:00.000Z"))).toBe("expired");
    expect(classifyHeldSale({ ...base, status: "expired" }, now)).toBe("expired");
  });

  it("filters pending sales: active, expiring, expired, today, mine", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    const holds: HeldSaleRecord[] = [
      base,
      {
        ...base,
        id: "e1",
        heldAt: "2026-08-12T10:00:00.000Z",
        expiresAt: "2026-08-12T13:00:00.000Z",
        heldBy: "other",
      },
      {
        ...base,
        id: "e2",
        status: "expired",
        heldAt: "2026-08-11T10:00:00.000Z",
        expiresAt: "2026-08-12T10:00:00.000Z",
        heldBy: base.heldBy,
      },
    ];
    expect(filterHeldSales(holds, "active", { now }).map((h) => h.id)).toEqual([base.id]);
    expect(filterHeldSales(holds, "expiring", { now }).map((h) => h.id)).toEqual(["e1"]);
    expect(filterHeldSales(holds, "expired", { now }).map((h) => h.id)).toEqual(["e2"]);
    expect(filterHeldSales(holds, "today", { now }).length).toBe(2);
    expect(filterHeldSales(holds, "mine", { now, userId: base.heldBy }).map((h) => h.id)).toEqual([
      base.id,
      "e2",
    ]);
  });

  it("detects holds due for auto-expiry", () => {
    const due = holdsDueForExpiry(
      [base, { ...base, id: "x", expiresAt: "2026-08-12T07:00:00.000Z" }],
      new Date("2026-08-12T08:00:00.000Z"),
    );
    expect(due.map((h) => h.id)).toEqual(["x"]);
    expect(statusAfterExpiry()).toBe("expired");
    expect(computeHoldExpiresAt("2026-08-12T08:00:00.000Z", 3600_000)).toBe(
      "2026-08-12T09:00:00.000Z",
    );
  });

  it("enforces hold actions and ownership", () => {
    const now = new Date("2026-08-12T09:00:00.000Z");
    expect(() => assertHoldActionAllowed(base, "resume", { actorUserId: base.heldBy, now })).not.toThrow();
    expect(() =>
      assertHoldActionAllowed(base, "resume", { actorUserId: "other", now }),
    ).toThrow(/another cashier/i);
    expect(() =>
      assertHoldActionAllowed(base, "resume", { actorUserId: "other", resumeAny: true, now }),
    ).not.toThrow();
    expect(() =>
      assertHoldActionAllowed(
        { ...base, expiresAt: "2026-08-12T07:00:00.000Z" },
        "resume",
        { now: new Date("2026-08-12T08:00:00.000Z"), actorUserId: base.heldBy },
      ),
    ).toThrow(/expired/i);
    expect(() =>
      assertHoldActionAllowed({ ...base, status: "expired" }, "discard"),
    ).not.toThrow();
    expect(() =>
      assertHoldActionAllowed({ ...base, status: "cancelled" }, "resume"),
    ).toThrow(/Cannot resume/i);
    expect(nextStatusForAction("cancel")).toBe("cancelled");
    expect(nextStatusForAction("discard")).toBe("discarded");
    expect(nextStatusForAction("resume_and_checkout")).toBe("resumed");
  });

  it("resume replaces cart lines without duplication", () => {
    const lines = cartLinesForResume(base.cartSnapshot);
    expect(lines).toHaveLength(2);
    // replace semantics: caller must assign returned array, not concat
    const existing = [{ productId: "old" }];
    const replaced = cartLinesForResume(base.cartSnapshot);
    expect([...existing, ...replaced]).toHaveLength(3); // concat would duplicate — don't do this
    expect(replaced).toHaveLength(2); // correct replace path
  });

  it("round-trips full transaction snapshot for exact resume", () => {
    const snap = buildHoldSnapshot({
      cart: [
        {
          key: "1",
          productId: "p1",
          name: "LED",
          qty: "2",
          unitId: "u1",
          unitPrice: 100,
          discount: 10,
          discountPercent: 5,
          tax: 17,
          taxPricingMode: "exclusive",
          warrantyDays: 30,
        },
      ],
      customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      customerName: "Ahmed Traders",
      walkIn: false,
      invoiceDiscount: "20",
      invoiceDiscountKind: "fixed",
      invoiceDiscountPercent: 0,
      notes: "waiting",
      payments: [{ id: "pay1", paymentMethodId: "cash", amount: "50", methodKind: "cash" }],
      cashReceived: "50",
      delivery: true,
      priceLevel: "wholesale",
      salesmanUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      commissionPercent: 2,
      referenceId: "ref-1",
      locale: "ur",
      mode: "advanced",
      useInstallment: false,
      isAdvance: false,
      totals: {
        items: 1,
        qty: 2,
        subtotal: 200,
        itemDiscount: 10,
        invoiceDiscount: 20,
        discount: 30,
        tax: 17,
        grand: 187,
        taxableAmount: 170,
      },
    });
    const restored = restoreHoldTransaction(snap);
    expect(restored.customerId).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(restored.customerName).toBe("Ahmed Traders");
    expect(restored.invoiceDiscount).toBe("20");
    expect(restored.invoiceDiscountKind).toBe("fixed");
    expect(restored.payments).toHaveLength(1);
    expect(restored.cashReceived).toBe("50");
    expect(restored.priceLevel).toBe("wholesale");
    expect(restored.locale).toBe("ur");
    expect(restored.mode).toBe("advanced");
    expect(restored.delivery).toBe(true);
    expect(restored.totals?.grand).toBe(187);
    expect(restored.cart).toHaveLength(1);
    expect((restored.cart[0] as { discountPercent?: number }).discountPercent).toBe(5);
  });

  it("blocks duplicate resume and concurrent foreign cashier without resume_any", () => {
    const now = new Date("2026-08-12T09:00:00.000Z");
    expect(() =>
      assertHoldActionAllowed({ ...base, status: "resumed" }, "resume", {
        actorUserId: base.heldBy,
        now,
      }),
    ).toThrow(/Cannot resume/i);
    expect(() =>
      assertHoldActionAllowed({ ...base, status: "cancelled" }, "resume", {
        actorUserId: base.heldBy,
        now,
      }),
    ).toThrow(/Cannot resume/i);
    expect(() =>
      assertHoldActionAllowed(base, "resume", { actorUserId: "other-cashier", now }),
    ).toThrow(/another cashier/i);
    expect(() =>
      assertHoldActionAllowed(base, "resume", {
        actorUserId: "other-cashier",
        resumeAny: true,
        now,
      }),
    ).not.toThrow();
  });

  it("supports edit, duplicate, transfer, cancel action gates", () => {
    const now = new Date("2026-08-12T09:00:00.000Z");
    expect(() => assertHoldActionAllowed(base, "edit", { actorUserId: base.heldBy, now })).not.toThrow();
    expect(() => assertHoldActionAllowed(base, "duplicate", { now })).not.toThrow();
    expect(() =>
      assertHoldActionAllowed(base, "transfer", { actorUserId: base.heldBy, now }),
    ).not.toThrow();
    expect(() =>
      assertHoldActionAllowed(base, "cancel", { actorUserId: base.heldBy, now }),
    ).not.toThrow();
    expect(() =>
      assertHoldActionAllowed(base, "cancel", { actorUserId: "other", now }),
    ).toThrow(/another cashier/i);
    expect(() =>
      assertHoldActionAllowed(base, "discard", { actorUserId: "other", now }),
    ).toThrow(/another cashier/i);
    expect(() =>
      assertHoldActionAllowed(base, "cancel", { actorUserId: "other", resumeAny: true, now }),
    ).not.toThrow();
  });
});
