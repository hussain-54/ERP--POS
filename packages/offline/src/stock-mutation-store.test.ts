import { describe, expect, it, vi } from "vitest";
import { OfflineStockMutationStore } from "./stock-mutation-store.js";
import { SyncEngine } from "@electronic-erp/sync";
import type { StockBalance } from "@electronic-erp/contracts";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const unit = "55555555-5555-4555-8555-555555555555";
const device = "66666666-6666-4666-8666-666666666666";

function seed(): StockBalance {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    organizationId: org,
    branchId: branch,
    warehouseId: warehouse,
    productId: product,
    qtyOnHand: "90",
    qtyReserved: "0",
    qtyDamaged: "0",
    qtyInTransit: "0",
    qtyAvailable: "90",
    qtyTotal: "90",
    reorderLevel: "10",
    isLowStock: false,
    isOutOfStock: false,
    isOverstock: false,
    averageUnitCost: "100",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

describe("offline stock mutations", () => {
  it("applies offline sale with full mutation metadata", () => {
    const store = new OfflineStockMutationStore();
    store.seedBalance(seed());
    const operationId = "88888888-8888-4888-8888-888888888888";
    const offlineTransactionId = "99999999-9999-4999-8999-999999999999";
    const mutation = store.applyOfflineMovement({
      deviceId: device,
      offlineTransactionId,
      entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      movement: {
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        productId: product,
        unitId: unit,
        movementType: "sale",
        qtyDelta: "5",
        sourceType: "pos",
        sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        operationId,
        expectedBalanceVersion: 1,
      },
    });

    expect(mutation.deviceId).toBe(device);
    expect(mutation.offlineTransactionId).toBe(offlineTransactionId);
    expect(mutation.operationId).toBe(operationId);
    expect(mutation.syncState).toBe("pending");
    expect(mutation.version).toBe(2);
    expect(store.getBalance(warehouse, product)?.qtyOnHand).toBe("85");
  });

  it("detects concurrent version conflicts", () => {
    const store = new OfflineStockMutationStore();
    store.seedBalance(seed());
    expect(() =>
      store.applyOfflineMovement({
        deviceId: device,
        offlineTransactionId: "99999999-9999-4999-8999-999999999999",
        entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        movement: {
          organizationId: org,
          branchId: branch,
          warehouseId: warehouse,
          productId: product,
          unitId: unit,
          movementType: "sale",
          qtyDelta: "1",
          sourceType: "pos",
          sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          expectedBalanceVersion: 99,
        },
      }),
    ).toThrow(/Concurrent/);
  });

  it("flushes pending mutations through sync abstraction", async () => {
    const store = new OfflineStockMutationStore();
    store.seedBalance(seed());
    store.applyOfflineMovement({
      deviceId: device,
      offlineTransactionId: "99999999-9999-4999-8999-999999999999",
      entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      movement: {
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        productId: product,
        unitId: unit,
        movementType: "sale",
        qtyDelta: "1",
        sourceType: "pos",
        sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    });
    const push = vi.fn(async () => ({ accepted: 1, conflicts: 0 }));
    const engine = new SyncEngine({
      push,
      pull: async () => ({ cursor: null, rows: [] }),
    });
    const accepted = await store.flush(engine);
    expect(accepted).toBe(1);
    expect(store.listPending()).toHaveLength(0);
    expect(push).toHaveBeenCalled();
  });
});
