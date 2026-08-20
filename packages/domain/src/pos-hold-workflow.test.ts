/**
 * Hold → Resume → Checkout workflow (domain authority).
 * UI applies restoreHoldTransaction; SaleTransactionService posts the resumed cart.
 */
import { describe, expect, it, vi } from "vitest";
import {
  assertHoldActionAllowed,
  buildHoldSnapshot,
  classifyHeldSale,
  nextStatusForAction,
  restoreHoldTransaction,
  type HeldSaleRecord,
} from "./pos-hold.js";
import { calculatePosCartTotals, type PosCartLine } from "./pos-cart.js";
import { SaleTransactionService, type SaleTransactionPorts } from "./sale-transaction.js";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const unit = "55555555-5555-4555-8555-555555555555";
const customer = "66666666-6666-4666-8666-666666666666";
const cashier = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const method = "77777777-7777-4777-8777-777777777777";
const holdId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function line(): PosCartLine {
  return {
    key: "line-1",
    productId: product,
    name: "LED Bulb 12W",
    sku: "LED-12",
    unitId: unit,
    unitName: "pcs",
    qty: "2",
    unitPrice: 250,
    discount: 20,
    discountPercent: 0,
    tax: 48,
    taxPricingMode: "exclusive",
    warrantyDays: 365,
    retailPrice: 250,
  };
}

describe("Hold / Resume → Checkout workflow", () => {
  it("New Sale → discount → hold → resume restores exact state → checkout posts once", async () => {
    const cart = [line()];
    const liveTotals = calculatePosCartTotals(cart, "10");
    expect(liveTotals.grand).toBeGreaterThan(0);

    const snapshot = buildHoldSnapshot({
      cart,
      customerId: customer,
      customerName: "Ahmed Traders",
      walkIn: false,
      invoiceDiscount: "10",
      invoiceDiscountKind: "fixed",
      notes: "Call back",
      payments: [{ id: "p1", paymentMethodId: method, amount: String(liveTotals.grand), methodKind: "cash" }],
      cashReceived: String(liveTotals.grand),
      priceLevel: "retail",
      salesmanUserId: cashier,
      commissionPercent: 0,
      totals: {
        items: liveTotals.items,
        qty: liveTotals.qty,
        subtotal: liveTotals.subtotal,
        itemDiscount: liveTotals.itemDiscount,
        invoiceDiscount: liveTotals.invoiceDiscount,
        discount: liveTotals.discount,
        tax: liveTotals.tax,
        grand: liveTotals.grand,
        taxableAmount: liveTotals.taxableAmount,
      },
    });

    const hold: HeldSaleRecord = {
      id: holdId,
      organizationId: org,
      branchId: branch,
      saleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      holdLabel: "HOLD-WF-1",
      holdReason: "Customer stepped out",
      notes: "Call back",
      heldBy: cashier,
      customerId: customer,
      customerName: "Ahmed Traders",
      cartSnapshot: snapshot,
      heldAt: "2026-08-20T10:00:00.000Z",
      expiresAt: "2026-08-21T10:00:00.000Z",
      status: "held",
    };

    expect(classifyHeldSale(hold, new Date("2026-08-20T12:00:00.000Z"))).toBe("active");
    expect(() =>
      assertHoldActionAllowed(hold, "resume", {
        actorUserId: cashier,
        now: new Date("2026-08-20T12:00:00.000Z"),
      }),
    ).not.toThrow();

    const restored = restoreHoldTransaction(hold.cartSnapshot);
    expect(restored.customerId).toBe(customer);
    expect(restored.invoiceDiscount).toBe("10");
    expect(restored.totals?.grand).toBe(liveTotals.grand);
    expect(restored.cart).toHaveLength(1);
    expect((restored.cart[0] as PosCartLine).unitPrice).toBe(250);
    expect((restored.cart[0] as PosCartLine).discount).toBe(20);
    expect((restored.cart[0] as PosCartLine).tax).toBe(48);

    const resumedTotals = calculatePosCartTotals(restored.cart as PosCartLine[], restored.invoiceDiscount);
    expect(resumedTotals.grand).toBe(liveTotals.grand);
    expect(resumedTotals.discount).toBe(liveTotals.discount);
    expect(resumedTotals.tax).toBe(liveTotals.tax);

    // Mark resumed — second resume is rejected (duplicate resume prevention).
    const closed: HeldSaleRecord = {
      ...hold,
      status: nextStatusForAction("resume")!,
      resumedAt: "2026-08-20T12:05:00.000Z",
    };
    expect(closed.status).toBe("resumed");
    expect(() =>
      assertHoldActionAllowed(closed, "resume", { actorUserId: cashier }),
    ).toThrow(/Cannot resume/i);

    const ports: SaleTransactionPorts = {
      findSaleByIdempotency: vi.fn(async () => null),
      searchStockAvailable: vi.fn(async () => "100"),
      postSaleRecord: vi.fn(async () => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
        invoiceNumber: "INV-HOLD-1",
      })),
      postSaleItems: vi.fn(async () => undefined),
      postDiscountAudits: vi.fn(async () => undefined),
      postStockSale: vi.fn(async () => undefined),
      reverseStockSale: vi.fn(async () => undefined),
      postCustomerSaleLedger: vi.fn(async () => undefined),
      postSplitPayment: vi.fn(async () => undefined),
      finalizeSaleStatus: vi.fn(async () => undefined),
      voidIncompleteSale: vi.fn(async () => undefined),
      postJournal: vi.fn(async () => undefined),
      postCommission: vi.fn(async () => undefined),
      postWarranties: vi.fn(async () => undefined),
      postAnalytics: vi.fn(async () => undefined),
      postAudit: vi.fn(async () => undefined),
    };
    const service = new SaleTransactionService(ports);
    const posted = await service.postSale({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      customerId: restored.customerId,
      items: (restored.cart as PosCartLine[]).map((c) => ({
        productId: c.productId!,
        unitId: c.unitId,
        qty: Number(c.qty),
        unitPrice: c.unitPrice,
        discount: c.discount,
        tax: c.tax,
        warrantyDays: c.warrantyDays,
      })),
      payments: [{ paymentMethodId: method, amount: resumedTotals.grand, methodKind: "cash" }],
      discountTotal: Number(restored.invoiceDiscount),
      discounts: [
        {
          scope: "invoice",
          kind: "fixed",
          amount: Number(restored.invoiceDiscount),
          approverRole: "cashier",
          reason: "POS invoice discount",
        },
      ],
      idempotencyKey: "88888888-8888-4888-8888-888888888801",
    });

    expect(posted.invoiceNumber).toBe("INV-HOLD-1");
    expect(ports.postStockSale).toHaveBeenCalledTimes(1);
    expect(ports.finalizeSaleStatus).toHaveBeenCalledTimes(1);
    expect(holdMustNotHavePostedOnHold(ports)).toBe(true);
  });

  it("expiring / expired / cancelled statuses gate resume correctly", () => {
    const now = new Date("2026-08-20T14:00:00.000Z");
    const base: HeldSaleRecord = {
      id: holdId,
      organizationId: org,
      branchId: branch,
      saleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      holdLabel: "HOLD-STATUS",
      holdReason: "Wait",
      notes: null,
      heldBy: cashier,
      customerId: customer,
      cartSnapshot: buildHoldSnapshot({ cart: [line()] }),
      heldAt: "2026-08-20T10:00:00.000Z",
      expiresAt: "2026-08-20T15:00:00.000Z",
      status: "held",
    };
    expect(classifyHeldSale(base, now)).toBe("expiring");
    expect(() => assertHoldActionAllowed(base, "resume", { actorUserId: cashier, now })).not.toThrow();

    const expiredClock = new Date("2026-08-20T16:00:00.000Z");
    expect(classifyHeldSale(base, expiredClock)).toBe("expired");
    expect(() =>
      assertHoldActionAllowed(base, "resume", { actorUserId: cashier, now: expiredClock }),
    ).toThrow(/expired/i);

    expect(() =>
      assertHoldActionAllowed({ ...base, status: "cancelled" }, "resume", {
        actorUserId: cashier,
        now,
      }),
    ).toThrow(/Cannot resume/i);
  });
});

function holdMustNotHavePostedOnHold(ports: SaleTransactionPorts): boolean {
  // Stock is only written at checkout after resume — not when parking the hold.
  return (ports.postStockSale as ReturnType<typeof vi.fn>).mock.calls.length === 1;
}
