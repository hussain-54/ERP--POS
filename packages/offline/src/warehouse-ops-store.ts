import type { CreatePurchaseInput } from "@electronic-erp/contracts";
import { calculatePurchaseTotals } from "@electronic-erp/domain";
import { enqueuePurchase, type SyncEngine } from "@electronic-erp/sync";

export interface OfflinePurchaseRecord {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  idempotencyKey: string;
  offlineTransactionId: string;
  deviceId: string;
  syncState: "pending" | "synced";
  grandTotal: number;
  payload: CreatePurchaseInput;
}

/** Local warehouse ops for offline POS-related stock replenishment and transfers. */
export class OfflineWarehouseOpsStore {
  private readonly purchases: OfflinePurchaseRecord[] = [];
  private readonly returns: Array<Record<string, unknown>> = [];
  private readonly transfers: Array<Record<string, unknown>> = [];
  private readonly deliveries: Array<Record<string, unknown>> = [];
  private readonly byKey = new Map<string, OfflinePurchaseRecord>();

  postPurchase(input: {
    purchase: CreatePurchaseInput;
    deviceId: string;
    offlineTransactionId: string;
    entityId: string;
  }): OfflinePurchaseRecord {
    const key = `${input.purchase.organizationId}:${input.purchase.idempotencyKey}`;
    const existing = this.byKey.get(key);
    if (existing) return existing;
    const totals = calculatePurchaseTotals(
      input.purchase.items.map((i) => ({
        ...i,
        qty: typeof i.qty === "number" ? i.qty : Number(i.qty),
        discount: i.discount ?? 0,
        tax: i.tax ?? 0,
      })),
      input.purchase.discountTotal ?? 0,
    );
    const record: OfflinePurchaseRecord = {
      id: input.entityId,
      organizationId: input.purchase.organizationId,
      invoiceNumber: input.purchase.invoiceNumber,
      idempotencyKey: input.purchase.idempotencyKey,
      offlineTransactionId: input.offlineTransactionId,
      deviceId: input.deviceId,
      syncState: "pending",
      grandTotal: totals.grandTotal,
      payload: {
        ...input.purchase,
        deviceId: input.deviceId,
        offlineTransactionId: input.offlineTransactionId,
      },
    };
    this.purchases.push(record);
    this.byKey.set(key, record);
    return record;
  }

  postReturn(payload: Record<string, unknown>): Record<string, unknown> {
    this.returns.push(payload);
    return payload;
  }

  postTransfer(payload: Record<string, unknown>): Record<string, unknown> {
    this.transfers.push(payload);
    return payload;
  }

  postDelivery(payload: Record<string, unknown>): Record<string, unknown> {
    this.deliveries.push(payload);
    return payload;
  }

  listPendingPurchases(): OfflinePurchaseRecord[] {
    return this.purchases.filter((p) => p.syncState === "pending");
  }

  async flush(engine: SyncEngine): Promise<number> {
    let accepted = 0;
    for (const purchase of this.listPendingPurchases()) {
      const result = await enqueuePurchase(
        engine,
        purchase.deviceId,
        purchase.payload,
        purchase.idempotencyKey,
      );
      if (!result.deferred && result.accepted > 0) {
        purchase.syncState = "synced";
        accepted += 1;
      }
    }
    return accepted;
  }
}
