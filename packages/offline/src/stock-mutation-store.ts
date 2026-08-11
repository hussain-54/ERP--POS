import type { OfflineStockMutation, PostStockMovementInput, StockBalance } from "@electronic-erp/contracts";
import { applyMovementToBalance, computeStockMetrics } from "@electronic-erp/domain";
import { enqueueStockMovement } from "@electronic-erp/sync";
import type { SyncEngine } from "@electronic-erp/sync";

type BalanceKey = string;

function balanceKey(warehouseId: string, productId: string, variantId?: string | null): BalanceKey {
  return `${warehouseId}:${productId}:${variantId ?? ""}`;
}

/** In-memory offline inventory engine used by sync abstraction tests and POS stubs. */
export class OfflineStockMutationStore {
  private readonly balances = new Map<BalanceKey, StockBalance>();
  private readonly mutations: OfflineStockMutation[] = [];
  private readonly movements = new Map<string, PostStockMovementInput>();

  getBalance(warehouseId: string, productId: string, variantId?: string | null): StockBalance | null {
    return this.balances.get(balanceKey(warehouseId, productId, variantId)) ?? null;
  }

  seedBalance(balance: StockBalance): void {
    this.balances.set(balanceKey(balance.warehouseId, balance.productId, balance.variantId), balance);
  }

  applyOfflineMovement(input: {
    movement: PostStockMovementInput;
    deviceId: string;
    offlineTransactionId: string;
    entityId: string;
    allowNegative?: boolean;
  }): OfflineStockMutation {
    const { movement } = input;
    if (this.movements.has(movement.operationId!)) {
      const existing = this.mutations.find((m) => m.operationId === movement.operationId);
      if (existing) return existing;
    }

    const key = balanceKey(movement.warehouseId, movement.productId, movement.variantId);
    const current =
      this.balances.get(key) ??
      ({
        id: input.entityId,
        organizationId: movement.organizationId,
        branchId: movement.branchId,
        warehouseId: movement.warehouseId,
        productId: movement.productId,
        variantId: movement.variantId ?? null,
        qtyOnHand: "0",
        qtyReserved: "0",
        qtyDamaged: "0",
        qtyInTransit: "0",
        qtyAvailable: "0",
        qtyTotal: "0",
        reorderLevel: "0",
        isLowStock: false,
        isOutOfStock: true,
        isOverstock: false,
        averageUnitCost: "0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      } satisfies StockBalance);

    if (
      movement.expectedBalanceVersion != null &&
      movement.expectedBalanceVersion !== current.version
    ) {
      throw new Error("Concurrent stock update conflict");
    }

    const { after } = applyMovementToBalance(
      {
        qtyOnHand: current.qtyOnHand,
        qtyReserved: current.qtyReserved,
        qtyDamaged: current.qtyDamaged,
        qtyInTransit: current.qtyInTransit,
      },
      movement.movementType,
      movement.qtyDelta,
      input.allowNegative ?? false,
    );
    const metrics = computeStockMetrics(after, current.reorderLevel, current.overstockLevel);
    const next: StockBalance = {
      ...current,
      ...metrics,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    this.balances.set(key, next);
    this.movements.set(movement.operationId!, movement);

    const mutation: OfflineStockMutation = {
      id: input.entityId,
      organizationId: movement.organizationId,
      deviceId: input.deviceId,
      offlineTransactionId: input.offlineTransactionId,
      operationId: movement.operationId!,
      entityId: input.entityId,
      entityType: "stock_movement",
      payload: movement as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
      version: next.version,
      syncState: "pending",
    };
    this.mutations.push(mutation);
    return mutation;
  }

  listPending(): OfflineStockMutation[] {
    return this.mutations.filter((m) => m.syncState === "pending");
  }

  async flush(engine: SyncEngine): Promise<number> {
    let accepted = 0;
    for (const mutation of this.listPending()) {
      const result = await enqueueStockMovement(
        engine,
        mutation.deviceId,
        mutation.payload as unknown as PostStockMovementInput,
        mutation.operationId,
      );
      if (!result.deferred && result.accepted > 0) {
        mutation.syncState = "synced";
        accepted += 1;
      }
    }
    return accepted;
  }
}
