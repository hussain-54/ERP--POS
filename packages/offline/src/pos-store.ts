import type { CreateSaleInput } from "@electronic-erp/contracts";
import { calculateSaleTotals } from "@electronic-erp/domain";
import { enqueueSale, type SyncEngine } from "@electronic-erp/sync";

export interface OfflineSaleRecord {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  idempotencyKey: string;
  offlineTransactionId: string;
  deviceId: string;
  operationId: string;
  timestamp: string;
  syncState: "pending" | "synced" | "conflict" | "rejected";
  version: number;
  payload: CreateSaleInput;
  grandTotal: number;
}

export interface OfflineHeldBill {
  id: string;
  organizationId: string;
  branchId: string;
  holdLabel: string;
  cartSnapshot: Record<string, unknown>;
  heldAt: string;
  deviceId: string;
  status: "held" | "resumed";
}

export interface OfflineReturnRecord {
  id: string;
  organizationId: string;
  originalSaleId: string;
  returnType: "refund" | "credit" | "exchange";
  reason: string;
  refundAmount: number;
  idempotencyKey: string;
  offlineTransactionId: string;
  deviceId: string;
  syncState: "pending" | "synced";
  payload: Record<string, unknown>;
}

/**
 * In-memory POS store used by unit tests and legacy experiments.
 * ACTIVE offline path for desktop is OfflinePosEngine (SQLite + outbox) — do not use this
 * as a second production cart/sale writer. Kept for test compatibility; do not delete blindly.
 */
export class OfflinePosStore {
  private readonly sales: OfflineSaleRecord[] = [];
  private readonly held: OfflineHeldBill[] = [];
  private readonly returns: OfflineReturnRecord[] = [];
  private readonly byIdempotency = new Map<string, OfflineSaleRecord>();
  private readonly returnsByKey = new Map<string, OfflineReturnRecord>();

  postSale(input: {
    sale: CreateSaleInput;
    deviceId: string;
    offlineTransactionId: string;
    entityId: string;
  }): OfflineSaleRecord {
    const key = `${input.sale.organizationId}:${input.sale.idempotencyKey}`;
    const existing = this.byIdempotency.get(key);
    if (existing) return existing;

    const items = input.sale.items.map((i) => ({
      ...i,
      qty: typeof i.qty === "number" ? i.qty : Number(i.qty),
      unitPrice: i.unitPrice,
      discount: i.discount ?? 0,
      tax: i.tax ?? 0,
    }));
    const totals = calculateSaleTotals(items as never, input.sale.discountTotal ?? 0);
    const record: OfflineSaleRecord = {
      id: input.entityId,
      organizationId: input.sale.organizationId,
      invoiceNumber: `OFF-${Date.now()}`,
      idempotencyKey: input.sale.idempotencyKey,
      offlineTransactionId: input.offlineTransactionId,
      deviceId: input.deviceId,
      operationId: input.sale.operationId ?? input.sale.idempotencyKey,
      timestamp: new Date().toISOString(),
      syncState: "pending",
      version: 1,
      payload: {
        ...input.sale,
        deviceId: input.deviceId,
        offlineTransactionId: input.offlineTransactionId,
      },
      grandTotal: totals.grandTotal,
    };
    this.sales.push(record);
    this.byIdempotency.set(key, record);
    return record;
  }

  holdBill(input: OfflineHeldBill): OfflineHeldBill {
    this.held.push(input);
    return input;
  }

  listHeld(branchId: string): OfflineHeldBill[] {
    return this.held.filter((h) => h.branchId === branchId && h.status === "held");
  }

  resume(holdId: string): OfflineHeldBill | null {
    const bill = this.held.find((h) => h.id === holdId && h.status === "held");
    if (!bill) return null;
    bill.status = "resumed";
    return bill;
  }

  listPendingSales(): OfflineSaleRecord[] {
    return this.sales.filter((s) => s.syncState === "pending");
  }

  postReturn(input: {
    organizationId: string;
    originalSaleId: string;
    returnType: "refund" | "credit" | "exchange";
    reason: string;
    items: Array<{ qty: number | string; unitPrice: number }>;
    idempotencyKey: string;
    offlineTransactionId: string;
    deviceId: string;
    entityId: string;
    payload: Record<string, unknown>;
  }): OfflineReturnRecord {
    const key = `${input.organizationId}:${input.idempotencyKey}`;
    const existing = this.returnsByKey.get(key);
    if (existing) return existing;
    const refundAmount = input.items.reduce(
      (s, i) => s + Number(i.qty) * i.unitPrice,
      0,
    );
    const record: OfflineReturnRecord = {
      id: input.entityId,
      organizationId: input.organizationId,
      originalSaleId: input.originalSaleId,
      returnType: input.returnType,
      reason: input.reason,
      refundAmount,
      idempotencyKey: input.idempotencyKey,
      offlineTransactionId: input.offlineTransactionId,
      deviceId: input.deviceId,
      syncState: "pending",
      payload: input.payload,
    };
    this.returns.push(record);
    this.returnsByKey.set(key, record);
    return record;
  }

  listPendingReturns(): OfflineReturnRecord[] {
    return this.returns.filter((r) => r.syncState === "pending");
  }

  async flush(engine: SyncEngine): Promise<number> {
    let accepted = 0;
    for (const sale of this.listPendingSales()) {
      const result = await enqueueSale(engine, sale.deviceId, sale.payload, sale.idempotencyKey);
      if (!result.deferred && result.accepted > 0) {
        sale.syncState = "synced";
        accepted += 1;
      }
    }
    return accepted;
  }
}
