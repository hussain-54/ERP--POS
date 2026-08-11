import { describe, expect, it, vi } from "vitest";
import { OfflinePosStore } from "./pos-store.js";
import { SyncEngine } from "@electronic-erp/sync";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const unit = "55555555-5555-4555-8555-555555555555";
const device = "66666666-6666-4666-8666-666666666666";

describe("offline POS", () => {
  it("creates offline sale with metadata and blocks duplicates", () => {
    const store = new OfflinePosStore();
    const key = "77777777-7777-4777-8777-777777777777";
    const sale = {
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      items: [{ productId: product, unitId: unit, qty: 1.25, unitPrice: 80, discount: 0, tax: 0 }],
      payments: [],
      discounts: [],
      idempotencyKey: key,
      operationId: key,
    };
    const first = store.postSale({
      sale,
      deviceId: device,
      offlineTransactionId: "88888888-8888-4888-8888-888888888888",
      entityId: "99999999-9999-4999-8999-999999999999",
    });
    const second = store.postSale({
      sale,
      deviceId: device,
      offlineTransactionId: "88888888-8888-4888-8888-888888888888",
      entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(first.id).toBe(second.id);
    expect(first.syncState).toBe("pending");
    expect(first.deviceId).toBe(device);
    expect(first.grandTotal).toBe(100);
  });

  it("holds and resumes bills across restarts (in-memory mirror)", () => {
    const store = new OfflinePosStore();
    store.holdBill({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      organizationId: org,
      branchId: branch,
      holdLabel: "Customer A",
      cartSnapshot: { items: [1] },
      heldAt: new Date().toISOString(),
      deviceId: device,
      status: "held",
    });
    expect(store.listHeld(branch)).toHaveLength(1);
    store.resume("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(store.listHeld(branch)).toHaveLength(0);
  });

  it("stores offline return / exchange with device metadata", () => {
    const store = new OfflinePosStore();
    const key = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const first = store.postReturn({
      organizationId: org,
      originalSaleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      returnType: "exchange",
      reason: "defective",
      items: [{ qty: 1, unitPrice: 80 }],
      idempotencyKey: key,
      offlineTransactionId: "11111111-1111-4111-8111-111111111111",
      deviceId: device,
      entityId: "22222222-2222-4222-8222-222222222222",
      payload: { returnType: "exchange" },
    });
    const dup = store.postReturn({
      organizationId: org,
      originalSaleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      returnType: "exchange",
      reason: "defective",
      items: [{ qty: 1, unitPrice: 80 }],
      idempotencyKey: key,
      offlineTransactionId: "11111111-1111-4111-8111-111111111111",
      deviceId: device,
      entityId: "33333333-3333-4333-8333-333333333333",
      payload: { returnType: "exchange" },
    });
    expect(first.id).toBe(dup.id);
    expect(first.refundAmount).toBe(80);
    expect(store.listPendingReturns()).toHaveLength(1);
  });

  it("flushes offline sales through sync abstraction", async () => {
    const store = new OfflinePosStore();
    const key = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    store.postSale({
      sale: {
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 10, discount: 0, tax: 0 }],
        payments: [],
        discounts: [],
        idempotencyKey: key,
      },
      deviceId: device,
      offlineTransactionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      entityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });
    const push = vi.fn(async () => ({ accepted: 1, conflicts: 0 }));
    const engine = new SyncEngine({
      push,
      pull: async () => ({ cursor: null, rows: [] }),
    });
    expect(await store.flush(engine)).toBe(1);
    expect(store.listPendingSales()).toHaveLength(0);
  });
});
