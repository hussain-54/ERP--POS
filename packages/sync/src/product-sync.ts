import type { ProductMaster, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncEngine } from "./engine.js";

export const PRODUCT_SYNC_ENTITY = "products";

/** Queue a product upsert through the sync abstraction (never ad-hoc dual writes). */
export function enqueueProductUpsert(
  engine: SyncEngine,
  deviceId: string,
  product: ProductMaster,
  idempotencyKey: string,
): Promise<{ accepted: number; conflicts: number; deferred: boolean }> {
  const request: SyncPushRequest = {
    deviceId,
    items: [
      {
        entityType: PRODUCT_SYNC_ENTITY,
        entityId: product.id,
        idempotencyKey,
        payload: product as unknown as Record<string, unknown>,
      },
    ],
  };
  return engine.push(request);
}

export function applyProductRowToOfflineShape(product: ProductMaster): Record<string, unknown> {
  return {
    id: product.id,
    organization_id: product.organizationId,
    product_code: product.productCode,
    sku: product.sku,
    name: product.name,
    name_ur: product.nameUr ?? null,
    category_id: product.categoryId ?? null,
    subcategory_id: product.subcategoryId ?? null,
    brand_id: product.brandId ?? null,
    company_id: product.companyId ?? null,
    product_type_id: product.productTypeId ?? null,
    model_id: product.modelId ?? null,
    base_unit_id: product.baseUnitId,
    warranty_days: product.warrantyDays,
    reorder_level: product.reorderLevel,
    status: product.status,
    is_active: product.isActive ? 1 : 0,
    cost_price: String(product.costPrice),
    retail_price: String(product.retailPrice),
    wholesale_price: String(product.wholesalePrice),
    dealer_price: String(product.dealerPrice),
    special_price: product.specialPrice == null ? null : String(product.specialPrice),
    minimum_sale_price: String(product.minimumSalePrice),
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    version: product.version,
    deleted_at: product.deletedAt ?? null,
  };
}
