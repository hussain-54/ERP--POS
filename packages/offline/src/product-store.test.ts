import { describe, expect, it } from "vitest";
import { OfflineProductStore } from "./product-store.js";
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

describe("offline product store", () => {
  it("upserts and retrieves by sku", () => {
    const store = new OfflineProductStore();
    store.upsertFromSync(product);
    const found = store.getBySku(product.organizationId, "SKU-1");
    expect(found?.name).toBe("Cable");
    expect(store.list(product.organizationId)).toHaveLength(1);
  });

  it("hides soft-deleted products from offline retrieval", () => {
    const store = new OfflineProductStore();
    store.upsertFromSync({
      ...product,
      deletedAt: new Date().toISOString(),
      isActive: false,
    });
    expect(store.getBySku(product.organizationId, "SKU-1")).toBeNull();
    expect(store.list(product.organizationId)).toHaveLength(0);
  });
});
