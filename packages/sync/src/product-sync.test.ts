import { describe, expect, it, vi } from "vitest";
import { SyncEngine } from "./engine.js";
import { applyProductRowToOfflineShape, enqueueProductUpsert, PRODUCT_SYNC_ENTITY } from "./product-sync.js";
import type { ProductMaster } from "@electronic-erp/contracts";

const product: ProductMaster = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  productCode: "P-1",
  sku: "SKU-1",
  name: "Cable",
  baseUnitId: "33333333-3333-4333-8333-333333333333",
  warrantyDays: 0,
  trackInventory: true,
  trackSerial: false,
  trackBatch: false,
  reorderLevel: "0",
  status: "active",
  isActive: true,
  costPrice: 10,
  retailPrice: 15,
  wholesalePrice: 14,
  dealerPrice: 13,
  minimumSalePrice: 12,
  lastPurchasePrice: 10,
  averagePurchasePrice: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
};

describe("product sync abstraction", () => {
  it("maps product to offline row shape", () => {
    const row = applyProductRowToOfflineShape(product);
    expect(row.sku).toBe("SKU-1");
    expect(row.organization_id).toBe(product.organizationId);
    expect(row.is_active).toBe(1);
  });

  it("enqueues upsert through SyncEngine when online", async () => {
    const push = vi.fn(async () => ({ accepted: 1, conflicts: 0 }));
    const engine = new SyncEngine({
      push,
      pull: async () => ({ cursor: null, rows: [] }),
    });
    const result = await enqueueProductUpsert(engine, "device-1", product, "idem-1");
    expect(result.deferred).toBe(false);
    expect(result.accepted).toBe(1);
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "device-1",
        items: [
          expect.objectContaining({
            entityType: PRODUCT_SYNC_ENTITY,
            entityId: product.id,
            idempotencyKey: "idem-1",
          }),
        ],
      }),
    );
  });

  it("defers when offline", async () => {
    const engine = new SyncEngine({
      push: async () => ({ accepted: 1, conflicts: 0 }),
      pull: async () => ({ cursor: null, rows: [] }),
    });
    engine.setOnline(false);
    const result = await enqueueProductUpsert(engine, "device-1", product, "idem-2");
    expect(result.deferred).toBe(true);
    expect(result.accepted).toBe(0);
  });
});
