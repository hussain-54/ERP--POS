import type { PostSplitPaymentInput, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncEngine } from "./engine.js";

export const PAYMENT_SYNC_ENTITY = "payments";

export function enqueuePayment(
  engine: SyncEngine,
  deviceId: string,
  payment: PostSplitPaymentInput,
  idempotencyKey: string,
): Promise<{ accepted: number; conflicts: number; deferred: boolean }> {
  const request: SyncPushRequest = {
    deviceId,
    items: [
      {
        entityType: PAYMENT_SYNC_ENTITY,
        entityId: String(payment.operationId ?? payment.idempotencyKey),
        idempotencyKey,
        payload: payment as unknown as Record<string, unknown>,
      },
    ],
  };
  return engine.push(request);
}
