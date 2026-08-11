import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemoryCloudTransport, SyncEngine } from "@electronic-erp/sync";
import { MemoryDurableStorage } from "./durable-storage.js";
import { LocalDatabase } from "./local-database.js";
import { OfflinePosEngine } from "./offline-pos-engine.js";
import { SyncCoordinator } from "./sync-coordinator.js";

const org = "11111111-1111-4111-8111-111111111111";
const branch = "22222222-2222-4222-8222-222222222222";
const warehouse = "33333333-3333-4333-8333-333333333333";
const product = "44444444-4444-4444-8444-444444444444";
const unit = "55555555-5555-4555-8555-555555555555";

function saleInput(idempotencyKey: string) {
  return {
    organizationId: org,
    branchId: branch,
    warehouseId: warehouse,
    items: [{ productId: product, unitId: unit, qty: 1, unitPrice: 100, discount: 0, tax: 0 }],
    payments: [],
    discounts: [],
    idempotencyKey,
  };
}

describe("Phase 10 offline sync engine", () => {
  it("OFF→20 bills→restart→ON→exactly 20 cloud bills; duplicate has no second effect", async () => {
    const storage = new MemoryDurableStorage();
    const db = new LocalDatabase(storage);
    await db.open();
    const deviceId = await db.ensureDeviceId();
    await db.saveDevice({
      id: deviceId,
      organizationId: org,
      branchId: branch,
      deviceKey: await db.ensureDeviceKey(),
      name: "POS-1",
      platform: "electron",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const cloud = new MemoryCloudTransport();
    const engine = new SyncEngine(cloud);
    engine.setOnline(false);
    const pos = new OfflinePosEngine(db);
    const keys: string[] = [];

    for (let i = 0; i < 20; i++) {
      const key = randomUUID();
      keys.push(key);
      await pos.postSale({ sale: saleInput(key), deviceId });
    }
    expect(db.listSales()).toHaveLength(20);
    expect(db.pendingOutboxCount()).toBe(20);

    // Crash / restart: new LocalDatabase on same durable storage
    const db2 = new LocalDatabase(storage);
    await db2.open();
    await db2.requeueFailedReady();
    expect(db2.listSales()).toHaveLength(20);
    expect(db2.listOutbox("pending").length + db2.listOutbox("processing").length).toBeGreaterThanOrEqual(20);

    const permanentId = await db2.ensureDeviceId();
    expect(permanentId).toBe(deviceId);

    engine.setOnline(true);
    const coordinator = new SyncCoordinator(db2, engine, { organizationId: org, batchSize: 100 });
    const progress = await coordinator.syncAll();
    expect(progress.pendingCount).toBe(0);
    expect(cloud.bills.size).toBe(20);

    // Duplicate push of same idempotency keys
    for (const key of keys) {
      await db2.enqueueOutbox({
        entityType: "sales",
        entityId: randomUUID(),
        operationType: "upsert",
        payload: saleInput(key) as unknown as Record<string, unknown>,
        deviceId,
        idempotencyKey: key,
      });
    }
    // enqueueOutbox is idempotent — no new rows for same keys
    expect(db2.listOutbox().filter((o) => o.status === "pending")).toHaveLength(0);
    expect(cloud.bills.size).toBe(20);
  });

  it("failed network retries with exponential backoff; partial sync resumes", async () => {
    const storage = new MemoryDurableStorage();
    const db = new LocalDatabase(storage);
    await db.open();
    const deviceId = await db.ensureDeviceId();
    const cloud = new MemoryCloudTransport();
    const engine = new SyncEngine(cloud);
    const pos = new OfflinePosEngine(db);
    const coordinator = new SyncCoordinator(db, engine, {
      organizationId: org,
      batchSize: 5,
      baseBackoffMs: 10,
    });

    for (let i = 0; i < 5; i++) {
      await pos.postSale({ sale: saleInput(randomUUID()), deviceId });
    }

    cloud.failNextPush = true;
    await expect(coordinator.pushOutbox()).rejects.toThrow(/network failed/);
    expect(db.listOutbox("failed").length).toBeGreaterThan(0);

    // Force retries ready
    for (const op of db.listOutbox("failed")) {
      op.nextRetryAt = new Date(0).toISOString();
      op.status = "pending";
    }
    await db.persist();

    cloud.partialAccept = 2;
    await coordinator.pushOutbox();
    expect(cloud.bills.size).toBe(2);

    await coordinator.pushOutbox();
    expect(cloud.bills.size).toBe(5);
  });

  it("crash mid-sync requeues processing ops without losing them", async () => {
    const storage = new MemoryDurableStorage();
    const db = new LocalDatabase(storage);
    await db.open();
    const deviceId = await db.ensureDeviceId();
    const pos = new OfflinePosEngine(db);
    await pos.postSale({ sale: saleInput(randomUUID()), deviceId });
    const op = db.listOutbox("pending")[0]!;
    await db.markOutboxProcessing([op.id]);
    expect(db.listOutbox("processing")).toHaveLength(1);

    const restarted = new LocalDatabase(storage);
    await restarted.open();
    const n = await restarted.requeueFailedReady();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(restarted.listOutbox("pending")).toHaveLength(1);
  });

  it("Phase 17 multi-device: Device A + B concurrent sales sync without duplicate cloud bills", async () => {
    const cloud = new MemoryCloudTransport();
    const engine = new SyncEngine(cloud);
    engine.setOnline(true);

    async function devicePos(name: string, storage: MemoryDurableStorage) {
      const db = new LocalDatabase(storage);
      await db.open();
      const deviceId = await db.ensureDeviceId();
      await db.saveDevice({
        id: deviceId,
        organizationId: org,
        branchId: branch,
        deviceKey: await db.ensureDeviceKey(),
        name,
        platform: "electron",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return { db, deviceId, pos: new OfflinePosEngine(db) };
    }

    const a = await devicePos("POS-A", new MemoryDurableStorage());
    const b = await devicePos("POS-B", new MemoryDurableStorage());
    expect(a.deviceId).not.toBe(b.deviceId);

    const keysA = [randomUUID(), randomUUID()];
    const keysB = [randomUUID(), randomUUID(), randomUUID()];
    for (const key of keysA) await a.pos.postSale({ sale: saleInput(key), deviceId: a.deviceId });
    for (const key of keysB) await b.pos.postSale({ sale: saleInput(key), deviceId: b.deviceId });

    const coordA = new SyncCoordinator(a.db, engine, { organizationId: org, batchSize: 50 });
    const coordB = new SyncCoordinator(b.db, engine, { organizationId: org, batchSize: 50 });
    await Promise.all([coordA.syncAll(), coordB.syncAll()]);

    expect(cloud.bills.size).toBe(5);
    expect(a.db.pendingOutboxCount()).toBe(0);
    expect(b.db.pendingOutboxCount()).toBe(0);

    // Shared idempotency key across devices must not create a second cloud bill
    const sharedKey = randomUUID();
    await a.pos.postSale({ sale: saleInput(sharedKey), deviceId: a.deviceId });
    await coordA.syncAll();
    expect(cloud.bills.size).toBe(6);
    await b.pos.postSale({ sale: saleInput(sharedKey), deviceId: b.deviceId });
    await coordB.syncAll();
    expect(cloud.bills.size).toBe(6);
  });

  it("conflicting customer edits create conflict; stock uses movement reconciliation", async () => {
    const storage = new MemoryDurableStorage();
    const db = new LocalDatabase(storage);
    await db.open();
    const deviceId = await db.ensureDeviceId();

    await db.addConflict({
      entityType: "customers",
      entityId: randomUUID(),
      serverVersion: 3,
      clientVersion: 2,
      serverPayload: { name: "Server" },
      clientPayload: { name: "Client" },
      conflictType: "version",
      resolution: "pending",
    });
    expect(db.listConflicts("pending")).toHaveLength(1);

    // Concurrent sales: append both stock events
    await db.appendStockMovement({
      id: randomUUID(),
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      productId: product,
      qtyDelta: "-5",
      movementType: "sale",
      sourceType: "sale",
      sourceId: randomUUID(),
      operationId: randomUUID(),
      deviceId,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncState: "pending",
      payload: {},
    });
    await db.appendStockMovement({
      id: randomUUID(),
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      productId: product,
      qtyDelta: "-3",
      movementType: "sale",
      sourceType: "sale",
      sourceId: randomUUID(),
      operationId: randomUUID(),
      deviceId,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncState: "pending",
      payload: {},
    });
    expect(db.computeStockOnHand(warehouse, product)).toBe(-8);

    const cloud = new MemoryCloudTransport();
    const engine = new SyncEngine(cloud);
    const coordinator = new SyncCoordinator(db, engine, { organizationId: org });
    // Pull a remote movement and append (reconcile)
    cloud.changeLog.push({
      id: randomUUID(),
      entityType: "stock_movements",
      entityId: randomUUID(),
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: {
        id: randomUUID(),
        organizationId: org,
        branchId: branch,
        warehouseId: warehouse,
        productId: product,
        qtyDelta: "-1",
        movementType: "sale",
        sourceType: "sale",
        sourceId: randomUUID(),
        operationId: randomUUID(),
      },
    });
    await coordinator.pullChanges("stock_movements");
    expect(db.computeStockOnHand(warehouse, product)).toBe(-9);
  });

  it("supports offline return and payment outbox entries", async () => {
    const storage = new MemoryDurableStorage();
    const db = new LocalDatabase(storage);
    await db.open();
    const deviceId = await db.ensureDeviceId();
    const pos = new OfflinePosEngine(db);
    const sale = await pos.postSale({ sale: saleInput(randomUUID()), deviceId });
    await pos.postReturn({
      organizationId: org,
      branchId: branch,
      warehouseId: warehouse,
      originalSaleId: sale.id,
      productId: product,
      qty: 1,
      deviceId,
      idempotencyKey: randomUUID(),
      reason: "offline return",
    });
    await pos.postPayment({
      organizationId: org,
      branchId: branch,
      amount: 50,
      deviceId,
      idempotencyKey: randomUUID(),
      sourceId: sale.id,
    });
    const types = new Set(db.listOutbox().map((o) => o.entityType));
    expect(types.has("sales")).toBe(true);
    expect(types.has("sale_returns")).toBe(true);
    expect(types.has("payments")).toBe(true);
  });
});
