import { describe, expect, it, vi } from "vitest";
import { OfflineWarehouseOpsStore } from "./warehouse-ops-store.js";
import { SyncEngine } from "@electronic-erp/sync";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const supplier = "44444444-4444-4444-8444-444444444444";
const product = "55555555-5555-4555-8555-555555555555";
const unit = "66666666-6666-4666-8666-666666666666";
const device = "77777777-7777-4777-8777-777777777777";

describe("offline warehouse ops", () => {
  it("creates offline purchase with stock-ready payload and blocks duplicates", () => {
    const store = new OfflineWarehouseOpsStore();
    const key = "88888888-8888-4888-8888-888888888888";
    const purchase = {
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      supplierId: supplier,
      invoiceNumber: "OFF-PINV-1",
      items: [{ productId: product, unitId: unit, qty: 3, unitCost: 25, discount: 0, tax: 0 }],
      discountTotal: 0,
      paidTotal: 0,
      idempotencyKey: key,
      operationId: key,
    };
    const first = store.postPurchase({
      purchase,
      deviceId: device,
      offlineTransactionId: "99999999-9999-4999-8999-999999999999",
      entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const second = store.postPurchase({
      purchase,
      deviceId: device,
      offlineTransactionId: "99999999-9999-4999-8999-999999999999",
      entityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(first.id).toBe(second.id);
    expect(first.grandTotal).toBe(75);
    expect(first.syncState).toBe("pending");
  });

  it("flushes offline purchases through sync", async () => {
    const store = new OfflineWarehouseOpsStore();
    const key = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    store.postPurchase({
      purchase: {
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        supplierId: supplier,
        invoiceNumber: "OFF-PINV-2",
        items: [{ productId: product, unitId: unit, qty: 1, unitCost: 10, discount: 0, tax: 0 }],
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
    expect(store.listPendingPurchases()).toHaveLength(0);
  });
});
