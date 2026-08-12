import { describe, expect, it, vi } from "vitest";
import { PurchaseTransactionService } from "./purchase-transaction.js";
import { applyPurchaseToSupplierPrice, compareSupplierPrices } from "./supplier-pricing.js";
import { assertTransferTransition } from "./transfer-lifecycle.js";
import { assertDeliveryTransition } from "./delivery-lifecycle.js";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const supplier = "44444444-4444-4444-8444-444444444444";
const product = "55555555-5555-4555-8555-555555555555";
const unit = "66666666-6666-4666-8666-666666666666";
const key = "77777777-7777-4777-8777-777777777777";

describe("supplier pricing", () => {
  it("tracks last and average purchase rate", () => {
    const first = applyPurchaseToSupplierPrice(null, 100, 2);
    const second = applyPurchaseToSupplierPrice(first, 80, 2);
    expect(second.lastPurchaseRate).toBe(80);
    expect(second.averagePurchaseRate).toBe(90);
    expect(compareSupplierPrices([
      { supplierId: "a", lastPurchaseRate: 100, averagePurchaseRate: 100, supplierPrice: 100 },
      { supplierId: "b", lastPurchaseRate: 80, averagePurchaseRate: 85, supplierPrice: 80 },
    ])[0]!.supplierId).toBe("b");
  });
});

describe("transfer + delivery lifecycle", () => {
  it("enforces transfer Request → Approval → Dispatch → In Transit → Receiving", () => {
    expect(() => assertTransferTransition("requested", "approved")).not.toThrow();
    expect(() => assertTransferTransition("approved", "dispatched")).not.toThrow();
    expect(() => assertTransferTransition("dispatched", "in_transit")).not.toThrow();
    expect(() => assertTransferTransition("in_transit", "received")).not.toThrow();
    expect(() => assertTransferTransition("requested", "received")).toThrow(/transition/i);
  });

  it("enforces delivery Pending → Packed → Dispatched → In Transit → Delivered", () => {
    expect(() => assertDeliveryTransition("pending", "packed")).not.toThrow();
    expect(() => assertDeliveryTransition("packed", "dispatched")).not.toThrow();
    expect(() => assertDeliveryTransition("dispatched", "in_transit")).not.toThrow();
    expect(() => assertDeliveryTransition("in_transit", "delivered")).not.toThrow();
    expect(() => assertDeliveryTransition("pending", "delivered")).toThrow(/transition/i);
  });
});

describe("PurchaseTransactionService", () => {
  it("posts purchase → stock increase → supplier ledger → accounts", async () => {
    const calls: string[] = [];
    const ports = {
      findByIdempotency: vi.fn(async () => null),
      postPurchaseRecord: vi.fn(async () => {
        calls.push("purchase");
        return { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", invoiceNumber: "PINV-1" };
      }),
      postPurchaseItems: vi.fn(async () => {
        calls.push("items");
      }),
      postStockPurchase: vi.fn(async () => {
        calls.push("stock");
      }),
      postSupplierLedger: vi.fn(async () => {
        calls.push("ledger");
      }),
      getSupplierPrice: vi.fn(async () => null),
      upsertSupplierPrice: vi.fn(async () => {
        calls.push("price");
      }),
      postPriceHistory: vi.fn(async () => {
        calls.push("history");
      }),
      postJournal: vi.fn(async () => {
        calls.push("accounts");
      }),
    };
    const service = new PurchaseTransactionService(ports);
    const result = await service.postPurchase({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      supplierId: supplier,
      invoiceNumber: "PINV-1",
      items: [{ productId: product, unitId: unit, qty: 5, unitCost: 40, discount: 0, tax: 0 }],
      discountTotal: 0,
      paidTotal: 0,
      idempotencyKey: key,
    });
    expect(result.totals.grandTotal).toBe(200);
    expect(ports.postStockPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ qty: "5", unitCost: "40" }),
    );
    expect(ports.postSupplierLedger).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "200", supplierId: supplier }),
    );
    expect(calls).toContain("stock");
    expect(calls).toContain("ledger");
    expect(calls).toContain("accounts");
  });

  it("is idempotent on duplicate sync", async () => {
    const ports = {
      findByIdempotency: vi.fn(async () => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        invoice_number: "PINV-DUP",
      })),
      postPurchaseRecord: vi.fn(),
      postPurchaseItems: vi.fn(),
      postStockPurchase: vi.fn(),
      postSupplierLedger: vi.fn(),
      getSupplierPrice: vi.fn(),
      upsertSupplierPrice: vi.fn(),
      postPriceHistory: vi.fn(),
      postJournal: vi.fn(),
    };
    const service = new PurchaseTransactionService(ports);
    const result = await service.postPurchase({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      supplierId: supplier,
      invoiceNumber: "PINV-DUP",
      items: [{ productId: product, unitId: unit, qty: 1, unitCost: 10, discount: 0, tax: 0 }],
      idempotencyKey: key,
    });
    expect(result.duplicate).toBe(true);
    expect(ports.postStockPurchase).not.toHaveBeenCalled();
  });
});
