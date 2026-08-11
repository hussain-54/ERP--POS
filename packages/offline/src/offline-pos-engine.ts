import { randomUUID } from "node:crypto";
import type { CreateSaleInput } from "@electronic-erp/contracts";
import { calculateSaleTotals } from "@electronic-erp/domain";
import type { LocalDatabase, LocalSaleRow } from "./local-database.js";

/** Production offline POS — writes SQLite projection + outbox, never dual business model. */
export class OfflinePosEngine {
  constructor(private readonly db: LocalDatabase) {}

  async postSale(input: {
    sale: CreateSaleInput;
    deviceId: string;
    entityId?: string;
    offlineTransactionId?: string;
  }): Promise<LocalSaleRow> {
    const existing = this.db.getSaleByIdempotency(input.sale.idempotencyKey);
    if (existing) return existing;

    const items = input.sale.items.map((i) => ({
      ...i,
      qty: typeof i.qty === "number" ? i.qty : Number(i.qty),
      discount: i.discount ?? 0,
      tax: i.tax ?? 0,
    }));
    const totals = calculateSaleTotals(items as never, input.sale.discountTotal ?? 0);
    const now = new Date().toISOString();
    const id = input.entityId ?? randomUUID();
    const offlineTransactionId = input.offlineTransactionId ?? randomUUID();
    const operationId = input.sale.operationId ?? input.sale.idempotencyKey;

    const sale: LocalSaleRow = {
      id,
      organizationId: input.sale.organizationId,
      branchId: input.sale.branchId,
      invoiceNumber: `OFF-${Date.now()}-${id.slice(0, 8)}`,
      idempotencyKey: input.sale.idempotencyKey,
      offlineTransactionId,
      operationId,
      deviceId: input.deviceId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncState: "pending",
      lastSyncedAt: null,
      grandTotal: totals.grandTotal,
      payload: {
        ...input.sale,
        id,
        deviceId: input.deviceId,
        offlineTransactionId,
        operationId,
        idempotencyKey: input.sale.idempotencyKey,
      },
    };

    await this.db.upsertSale(sale);

    // Stock movements as events (never overwrite balances)
    for (const item of items) {
      if (!item.productId) continue;
      const qty = typeof item.qty === "number" ? item.qty : Number(item.qty);
      await this.db.appendStockMovement({
        id: randomUUID(),
        organizationId: input.sale.organizationId,
        branchId: input.sale.branchId,
        warehouseId: input.sale.warehouseId,
        productId: item.productId,
        qtyDelta: String(-Math.abs(qty)),
        movementType: "sale",
        sourceType: "sale",
        sourceId: id,
        operationId: randomUUID(),
        deviceId: input.deviceId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncState: "pending",
        lastSyncedAt: null,
        payload: { saleId: id, productId: item.productId, qty },
      });
    }

    await this.db.enqueueOutbox({
      entityType: "sales",
      entityId: id,
      operationType: "upsert",
      payload: sale.payload,
      deviceId: input.deviceId,
      idempotencyKey: input.sale.idempotencyKey,
      operationId,
    });

    return sale;
  }

  async postReturn(input: {
    organizationId: string;
    branchId: string;
    warehouseId: string;
    originalSaleId: string;
    productId: string;
    qty: number;
    deviceId: string;
    idempotencyKey: string;
    reason: string;
  }) {
    const existing = this.db.listOutbox().find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;

    const id = randomUUID();
    const now = new Date().toISOString();
    await this.db.appendStockMovement({
      id: randomUUID(),
      organizationId: input.organizationId,
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      qtyDelta: String(Math.abs(input.qty)),
      movementType: "sale_return",
      sourceType: "sale_return",
      sourceId: id,
      operationId: randomUUID(),
      deviceId: input.deviceId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncState: "pending",
      lastSyncedAt: null,
      payload: { ...input, id },
    });

    return this.db.enqueueOutbox({
      entityType: "sale_returns",
      entityId: id,
      operationType: "upsert",
      payload: { ...input, id },
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async postPayment(input: {
    organizationId: string;
    branchId: string;
    amount: number;
    deviceId: string;
    idempotencyKey: string;
    customerId?: string;
    sourceId?: string;
  }) {
    const id = randomUUID();
    return this.db.enqueueOutbox({
      entityType: "payments",
      entityId: id,
      operationType: "upsert",
      payload: { ...input, id },
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  listPendingSales(): LocalSaleRow[] {
    return this.db.listSales().filter((s) => s.syncState === "pending");
  }
}
