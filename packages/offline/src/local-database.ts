import { randomUUID } from "node:crypto";
import type { DurableStorage } from "./durable-storage.js";
import { SYNC_SCHEMA_MIGRATION_ID } from "./sync-schema.js";

export type SyncState = "pending" | "synced" | "conflict" | "rejected" | "failed";
export type OutboxStatus = "pending" | "processing" | "done" | "failed";

export interface OutboxOperation {
  id: string;
  operationId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  payload: Record<string, unknown>;
  deviceId: string;
  idempotencyKey: string;
  timestamp: string;
  retryCount: number;
  status: OutboxStatus;
  lastError?: string | null;
  nextRetryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxOperation {
  id: string;
  operationId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  serverCursor?: string | null;
  receivedAt: string;
  appliedAt?: string | null;
  status: "pending" | "applied" | "ignored";
}

export interface LocalConflict {
  id: string;
  entityType: string;
  entityId: string;
  serverVersion: number;
  clientVersion: number;
  serverPayload: Record<string, unknown>;
  clientPayload: Record<string, unknown>;
  conflictType: "version" | "stock" | "financial" | "manual";
  resolution:
    | "pending"
    | "server_wins"
    | "client_wins"
    | "latest_version"
    | "merged"
    | "manual"
    | "transaction_reconcile";
  createdAt: string;
  updatedAt: string;
  remarks?: string | null;
}

export interface LocalDevice {
  id: string;
  organizationId: string;
  branchId: string;
  deviceKey: string;
  name: string;
  platform: "electron" | "web" | "mobile";
  status: "pending" | "active" | "revoked";
  registeredAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSaleRow {
  id: string;
  organizationId: string;
  branchId: string;
  invoiceNumber: string;
  idempotencyKey: string;
  offlineTransactionId: string;
  operationId: string;
  deviceId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncState: SyncState;
  lastSyncedAt?: string | null;
  payload: Record<string, unknown>;
  grandTotal: number;
}

export interface LocalStockMovementRow {
  id: string;
  organizationId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  qtyDelta: string;
  movementType: string;
  sourceType: string;
  sourceId: string;
  operationId: string;
  deviceId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncState: SyncState;
  lastSyncedAt?: string | null;
  payload: Record<string, unknown>;
}

interface DbShape {
  migrations: string[];
  settings: Record<string, string>;
  device: LocalDevice | null;
  outbox: OutboxOperation[];
  inbox: InboxOperation[];
  conflicts: LocalConflict[];
  sales: LocalSaleRow[];
  stockMovements: LocalStockMovementRow[];
  syncMetadata: Array<{
    id: string;
    organizationId: string;
    deviceId: string;
    tableName: string;
    lastPulledAt?: string | null;
    lastPushedAt?: string | null;
    serverCursor?: string | null;
    clientCursor?: string | null;
  }>;
}

function emptyDb(): DbShape {
  return {
    migrations: [],
    settings: {},
    device: null,
    outbox: [],
    inbox: [],
    conflicts: [],
    sales: [],
    stockMovements: [],
    syncMetadata: [],
  };
}

/**
 * Local ERP database — SQLite logical model with durable persistence.
 * Electron can replace the DurableStorage with a better-sqlite3-backed adapter
 * without changing domain sync logic.
 */
export class LocalDatabase {
  private db: DbShape = emptyDb();
  private loaded = false;

  constructor(private readonly storage: DurableStorage) {}

  async open(): Promise<void> {
    const raw = await this.storage.read();
    this.db = { ...emptyDb(), ...(raw as Partial<DbShape>) };
    if (!this.db.migrations.includes(SYNC_SCHEMA_MIGRATION_ID)) {
      this.db.migrations.push(SYNC_SCHEMA_MIGRATION_ID);
    }
    this.loaded = true;
    await this.persist();
  }

  /** Crash-safe flush of current state. */
  async persist(): Promise<void> {
    if (!this.loaded) throw new Error("LocalDatabase not open");
    await this.storage.write(this.db as unknown as Record<string, unknown>);
  }

  getSetting(key: string): string | null {
    return this.db.settings[key] ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.db.settings[key] = value;
    await this.persist();
  }

  /**
   * Permanent device ID — created once, survives restarts.
   */
  async ensureDeviceId(): Promise<string> {
    const existing = this.getSetting("device_id");
    if (existing) return existing;
    const id = randomUUID();
    await this.setSetting("device_id", id);
    return id;
  }

  async ensureDeviceKey(): Promise<string> {
    const existing = this.getSetting("device_key");
    if (existing) return existing;
    const key = `dev_${randomUUID().replace(/-/g, "")}`;
    await this.setSetting("device_key", key);
    return key;
  }

  getDevice(): LocalDevice | null {
    return this.db.device;
  }

  async saveDevice(device: LocalDevice): Promise<void> {
    this.db.device = device;
    await this.setSetting("device_id", device.id);
    await this.setSetting("device_key", device.deviceKey);
    await this.persist();
  }

  async enqueueOutbox(input: {
    entityType: string;
    entityId: string;
    operationType: string;
    payload: Record<string, unknown>;
    deviceId: string;
    idempotencyKey: string;
    operationId?: string;
  }): Promise<OutboxOperation> {
    const existing = this.db.outbox.find((o) => o.idempotencyKey === input.idempotencyKey);
    if (existing) return existing;

    const now = new Date().toISOString();
    const op: OutboxOperation = {
      id: randomUUID(),
      operationId: input.operationId ?? randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      operationType: input.operationType,
      payload: input.payload,
      deviceId: input.deviceId,
      idempotencyKey: input.idempotencyKey,
      timestamp: now,
      retryCount: 0,
      status: "pending",
      lastError: null,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.db.outbox.push(op);
    await this.persist();
    return op;
  }

  listOutbox(status?: OutboxStatus): OutboxOperation[] {
    const rows = status ? this.db.outbox.filter((o) => o.status === status) : this.db.outbox;
    return [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  pendingOutboxCount(): number {
    return this.db.outbox.filter((o) => o.status === "pending" || o.status === "failed").length;
  }

  async markOutboxProcessing(ids: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (const op of this.db.outbox) {
      if (ids.includes(op.id)) {
        op.status = "processing";
        op.updatedAt = now;
      }
    }
    await this.persist();
  }

  async markOutboxDone(operationId: string): Promise<void> {
    const op = this.db.outbox.find((o) => o.operationId === operationId || o.id === operationId);
    if (!op) return;
    op.status = "done";
    op.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async markOutboxFailed(operationId: string, error: string, backoffMs: number): Promise<void> {
    const op = this.db.outbox.find((o) => o.operationId === operationId || o.id === operationId);
    if (!op) return;
    op.status = "failed";
    op.retryCount += 1;
    op.lastError = error;
    op.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
    op.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async requeueFailedReady(): Promise<number> {
    const now = Date.now();
    let n = 0;
    for (const op of this.db.outbox) {
      if (op.status === "failed" && op.nextRetryAt && Date.parse(op.nextRetryAt) <= now) {
        op.status = "pending";
        op.updatedAt = new Date().toISOString();
        n += 1;
      }
      // Crash recovery: processing → pending
      if (op.status === "processing") {
        op.status = "pending";
        op.updatedAt = new Date().toISOString();
        n += 1;
      }
    }
    if (n) await this.persist();
    return n;
  }

  /**
   * Inbox apply — idempotent by operation_id. Never apply twice.
   */
  async receiveInbox(op: Omit<InboxOperation, "id" | "receivedAt" | "status" | "appliedAt">): Promise<{
    applied: boolean;
    duplicate: boolean;
  }> {
    const existing = this.db.inbox.find((i) => i.operationId === op.operationId);
    if (existing) {
      return { applied: existing.status === "applied", duplicate: true };
    }
    const row: InboxOperation = {
      id: randomUUID(),
      ...op,
      receivedAt: new Date().toISOString(),
      appliedAt: null,
      status: "pending",
    };
    this.db.inbox.push(row);
    await this.persist();
    return { applied: false, duplicate: false };
  }

  async applyInbox(operationId: string, applyFn: (payload: Record<string, unknown>) => void | Promise<void>): Promise<boolean> {
    const row = this.db.inbox.find((i) => i.operationId === operationId);
    if (!row) return false;
    if (row.status === "applied") return false;
    await applyFn(row.payload);
    row.status = "applied";
    row.appliedAt = new Date().toISOString();
    await this.persist();
    return true;
  }

  listInbox(status?: InboxOperation["status"]): InboxOperation[] {
    return status ? this.db.inbox.filter((i) => i.status === status) : [...this.db.inbox];
  }

  async addConflict(conflict: Omit<LocalConflict, "id" | "createdAt" | "updatedAt">): Promise<LocalConflict> {
    const now = new Date().toISOString();
    const row: LocalConflict = {
      id: randomUUID(),
      ...conflict,
      createdAt: now,
      updatedAt: now,
    };
    this.db.conflicts.push(row);
    await this.persist();
    return row;
  }

  listConflicts(resolution?: LocalConflict["resolution"]): LocalConflict[] {
    return resolution
      ? this.db.conflicts.filter((c) => c.resolution === resolution)
      : [...this.db.conflicts];
  }

  async resolveConflict(
    id: string,
    resolution: LocalConflict["resolution"],
    remarks?: string,
  ): Promise<LocalConflict | null> {
    const row = this.db.conflicts.find((c) => c.id === id);
    if (!row) return null;
    row.resolution = resolution;
    row.remarks = remarks ?? null;
    row.updatedAt = new Date().toISOString();
    await this.persist();
    return row;
  }

  async upsertSale(sale: LocalSaleRow): Promise<LocalSaleRow> {
    const byIdem = this.db.sales.find((s) => s.idempotencyKey === sale.idempotencyKey);
    if (byIdem) return byIdem;
    this.db.sales.push(sale);
    await this.persist();
    return sale;
  }

  listSales(): LocalSaleRow[] {
    return [...this.db.sales];
  }

  getSaleByIdempotency(key: string): LocalSaleRow | undefined {
    return this.db.sales.find((s) => s.idempotencyKey === key);
  }

  async markSaleSynced(id: string): Promise<void> {
    const sale = this.db.sales.find((s) => s.id === id);
    if (!sale) return;
    sale.syncState = "synced";
    sale.lastSyncedAt = new Date().toISOString();
    sale.updatedAt = sale.lastSyncedAt;
    await this.persist();
  }

  async appendStockMovement(row: LocalStockMovementRow): Promise<LocalStockMovementRow> {
    const existing = this.db.stockMovements.find((m) => m.operationId === row.operationId);
    if (existing) return existing;
    this.db.stockMovements.push(row);
    await this.persist();
    return row;
  }

  listStockMovements(): LocalStockMovementRow[] {
    return [...this.db.stockMovements];
  }

  /**
   * Stock must never be resolved by overwriting qty — sum movement events.
   */
  computeStockOnHand(warehouseId: string, productId: string): number {
    return this.db.stockMovements
      .filter((m) => m.warehouseId === warehouseId && m.productId === productId && !m.deletedAt)
      .reduce((s, m) => s + Number(m.qtyDelta), 0);
  }

  async updateSyncMetadata(input: {
    organizationId: string;
    deviceId: string;
    tableName: string;
    lastPulledAt?: string | null;
    lastPushedAt?: string | null;
    serverCursor?: string | null;
    clientCursor?: string | null;
  }): Promise<void> {
    let row = this.db.syncMetadata.find(
      (m) => m.deviceId === input.deviceId && m.tableName === input.tableName,
    );
    if (!row) {
      row = {
        id: randomUUID(),
        organizationId: input.organizationId,
        deviceId: input.deviceId,
        tableName: input.tableName,
      };
      this.db.syncMetadata.push(row);
    }
    if (input.lastPulledAt !== undefined) row.lastPulledAt = input.lastPulledAt;
    if (input.lastPushedAt !== undefined) row.lastPushedAt = input.lastPushedAt;
    if (input.serverCursor !== undefined) row.serverCursor = input.serverCursor;
    if (input.clientCursor !== undefined) row.clientCursor = input.clientCursor;
    await this.persist();
  }

  getSyncMetadata(deviceId: string, tableName: string) {
    return this.db.syncMetadata.find((m) => m.deviceId === deviceId && m.tableName === tableName);
  }
}
