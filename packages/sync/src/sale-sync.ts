import type { CreateSaleInput, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncEngine } from "./engine.js";

export const SALE_SYNC_ENTITY = "sales";

export function enqueueSale(
  engine: SyncEngine,
  deviceId: string,
  sale: CreateSaleInput,
  idempotencyKey: string,
): Promise<{ accepted: number; conflicts: number; deferred: boolean }> {
  const request: SyncPushRequest = {
    deviceId,
    items: [
      {
        entityType: SALE_SYNC_ENTITY,
        entityId: String(sale.operationId ?? sale.idempotencyKey),
        idempotencyKey,
        payload: sale as unknown as Record<string, unknown>,
      },
    ],
  };
  return engine.push(request);
}
