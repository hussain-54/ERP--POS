import type { CreatePurchaseInput, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncEngine } from "./engine.js";

export const PURCHASE_SYNC_ENTITY = "purchases";

export function enqueuePurchase(
  engine: SyncEngine,
  deviceId: string,
  purchase: CreatePurchaseInput,
  idempotencyKey: string,
): Promise<{ accepted: number; conflicts: number; deferred: boolean }> {
  const request: SyncPushRequest = {
    deviceId,
    items: [
      {
        entityType: PURCHASE_SYNC_ENTITY,
        entityId: String(purchase.operationId ?? purchase.idempotencyKey),
        idempotencyKey,
        payload: purchase as unknown as Record<string, unknown>,
      },
    ],
  };
  return engine.push(request);
}
