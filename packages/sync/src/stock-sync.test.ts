import { describe, expect, it, vi } from "vitest";
import { SyncEngine } from "./engine.js";
import { applyStockBalanceToOfflineShape, enqueueStockMovement, STOCK_MOVEMENT_SYNC_ENTITY } from "./stock-sync.js";

describe("stock sync abstraction", () => {
  it("maps balance rows for offline", () => {
    const row = applyStockBalanceToOfflineShape({
      id: "11111111-1111-4111-8111-111111111111",
      organizationId: "22222222-2222-4222-8222-222222222222",
      branchId: "33333333-3333-4333-8333-333333333333",
      warehouseId: "44444444-4444-4444-8444-444444444444",
      productId: "55555555-5555-4555-8555-555555555555",
      qtyOnHand: "10",
      qtyReserved: "2",
      qtyDamaged: "0",
      qtyInTransit: "1",
      version: 3,
    });
    expect(row.qty_on_hand).toBe("10");
    expect(row.version).toBe(3);
  });

  it("enqueues stock movements via SyncEngine", async () => {
    const push = vi.fn(async () => ({ accepted: 1, conflicts: 0 }));
    const engine = new SyncEngine({
      push,
      pull: async () => ({ cursor: null, rows: [] }),
    });
    const operationId = "66666666-6666-4666-8666-666666666666";
    await enqueueStockMovement(
      engine,
      "77777777-7777-4777-8777-777777777777",
      {
        organizationId: "11111111-1111-4111-8111-111111111111",
        branchId: "22222222-2222-4222-8222-222222222222",
        warehouseId: "33333333-3333-4333-8333-333333333333",
        productId: "44444444-4444-4444-8444-444444444444",
        unitId: "55555555-5555-4555-8555-555555555555",
        movementType: "purchase",
        qtyDelta: "12.5",
        sourceType: "purchase",
        sourceId: "88888888-8888-4888-8888-888888888888",
        operationId,
      },
      operationId,
    );
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ entityType: STOCK_MOVEMENT_SYNC_ENTITY, entityId: operationId })],
      }),
    );
  });
});
