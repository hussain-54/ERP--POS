import type { PostStockMovementInput, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncEngine } from "./engine.js";

export const STOCK_MOVEMENT_SYNC_ENTITY = "stock_movements";

/** Queue a stock movement through the sync abstraction (never ad-hoc dual writes). */
export function enqueueStockMovement(
  engine: SyncEngine,
  deviceId: string,
  movement: PostStockMovementInput,
  idempotencyKey: string,
): Promise<{ accepted: number; conflicts: number; deferred: boolean }> {
  const request: SyncPushRequest = {
    deviceId,
    items: [
      {
        entityType: STOCK_MOVEMENT_SYNC_ENTITY,
        entityId: String(movement.operationId),
        idempotencyKey,
        payload: movement as unknown as Record<string, unknown>,
      },
    ],
  };
  return engine.push(request);
}

export function applyStockBalanceToOfflineShape(balance: {
  id: string;
  organizationId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  qtyOnHand: string;
  qtyReserved: string;
  qtyDamaged: string;
  qtyInTransit: string;
  version: number;
}): Record<string, unknown> {
  return {
    id: balance.id,
    organization_id: balance.organizationId,
    branch_id: balance.branchId,
    warehouse_id: balance.warehouseId,
    product_id: balance.productId,
    variant_id: balance.variantId ?? null,
    qty_on_hand: balance.qtyOnHand,
    qty_reserved: balance.qtyReserved,
    qty_damaged: balance.qtyDamaged,
    qty_in_transit: balance.qtyInTransit,
    version: balance.version,
  };
}
