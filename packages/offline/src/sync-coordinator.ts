import type { SyncPullRequest, SyncPushRequest } from "@electronic-erp/contracts";
import {
  detectVersionConflict,
  resolveConflict,
  type ConflictStrategy,
  type SyncEngine,
} from "@electronic-erp/sync";
import type { LocalDatabase, OutboxOperation } from "./local-database.js";

export type SyncUiStatus =
  | "online"
  | "offline"
  | "syncing"
  | "synced"
  | "pending"
  | "failed"
  | "conflict";

export interface SyncProgress {
  status: SyncUiStatus;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  pushed: number;
  pulled: number;
}

export interface SyncCoordinatorOptions {
  organizationId: string;
  defaultStrategy?: ConflictStrategy;
  batchSize?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
}

/**
 * Bidirectional sync: SQLite outbox → API → Supabase, and change log → inbox → SQLite.
 * Crash-safe: outbox persists; processing rows requeue on open; idempotency prevents dupes.
 */
export class SyncCoordinator {
  private status: SyncUiStatus = "offline";
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private pushed = 0;
  private pulled = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  constructor(
    private readonly db: LocalDatabase,
    private readonly engine: SyncEngine,
    private readonly options: SyncCoordinatorOptions,
  ) {}

  getProgress(): SyncProgress {
    const pending = this.db.listOutbox("pending").length;
    const failed = this.db.listOutbox("failed").length;
    const conflicts = this.db.listConflicts("pending").length;
    let status = this.status;
    if (!this.engine.isOnline()) status = "offline";
    else if (this.syncing) status = "syncing";
    else if (conflicts > 0) status = "conflict";
    else if (failed > 0) status = "failed";
    else if (pending > 0) status = "pending";
    else if (this.lastSyncAt) status = "synced";
    else status = "online";

    return {
      status,
      pendingCount: pending + failed,
      failedCount: failed,
      conflictCount: conflicts,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      pushed: this.pushed,
      pulled: this.pulled,
    };
  }

  setOnline(online: boolean): void {
    this.engine.setOnline(online);
    this.status = online ? "online" : "offline";
  }

  /** Automatic / background sync with interval. */
  startBackgroundSync(intervalMs = 15_000): void {
    this.stopBackgroundSync();
    this.timer = setInterval(() => {
      void this.syncAll().catch(() => undefined);
    }, intervalMs);
  }

  stopBackgroundSync(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async syncAll(): Promise<SyncProgress> {
    if (this.syncing) return this.getProgress();
    this.syncing = true;
    this.status = "syncing";
    try {
      await this.db.requeueFailedReady();
      if (this.engine.isOnline()) {
        await this.pushOutbox();
        await this.pullChanges("sales");
        await this.pullChanges("stock_movements");
        this.lastSyncAt = new Date().toISOString();
        this.lastError = null;
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.status = "failed";
    } finally {
      this.syncing = false;
    }
    return this.getProgress();
  }

  async pushOutbox(): Promise<{ accepted: number; conflicts: number }> {
    const batchSize = this.options.batchSize ?? 50;
    const pending = this.db
      .listOutbox("pending")
      .filter((o) => !o.nextRetryAt || Date.parse(o.nextRetryAt) <= Date.now())
      .slice(0, batchSize);

    if (!pending.length) return { accepted: 0, conflicts: 0 };

    await this.db.markOutboxProcessing(pending.map((o) => o.id));

    const request: SyncPushRequest = {
      deviceId: pending[0]!.deviceId,
      items: pending.map((o) => ({
        entityType: o.entityType,
        entityId: o.entityId,
        idempotencyKey: o.idempotencyKey,
        payload: {
          ...o.payload,
          operationId: o.operationId,
          operationType: o.operationType,
        },
      })),
    };

    try {
      const result = await this.engine.push(request);
      if (result.deferred) {
        await this.db.requeueFailedReady();
        for (const op of pending) {
          const row = this.db.listOutbox().find((x) => x.operationId === op.operationId);
          if (row && row.status === "processing") {
            row.status = "pending";
            row.updatedAt = new Date().toISOString();
          }
        }
        await this.db.persist();
        return { accepted: 0, conflicts: 0 };
      }

      const acceptedCount = result.accepted;
      for (let i = 0; i < pending.length; i++) {
        const op = pending[i]!;
        if (i < acceptedCount) {
          await this.db.markOutboxDone(op.operationId);
          if (op.entityType === "sales") {
            await this.db.markSaleSynced(op.entityId);
          }
        } else {
          // Partial sync — requeue remainder without burning retries
          const row = this.db.listOutbox().find((x) => x.operationId === op.operationId);
          if (row) {
            row.status = "pending";
            row.updatedAt = new Date().toISOString();
          }
        }
      }
      await this.db.persist();
      this.pushed += result.accepted;
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const op of pending) {
        const backoff = this.backoffMs(op);
        await this.db.markOutboxFailed(op.operationId, msg, backoff);
      }
      this.lastError = msg;
      throw err;
    }
  }

  async pullChanges(tableName: string): Promise<number> {
    const device = this.db.getDevice();
    const deviceId = device?.id ?? (await this.db.ensureDeviceId());
    const meta = this.db.getSyncMetadata(deviceId, tableName);
    const request: SyncPullRequest = {
      deviceId,
      tableName,
      cursor: meta?.serverCursor ?? null,
      limit: this.options.batchSize ?? 100,
    };
    const result = await this.engine.pull(request);
    if (result.deferred) return 0;

    let applied = 0;
    for (const raw of result.rows) {
      const row = raw as {
        operationId: string;
        entityType: string;
        entityId: string;
        payload: Record<string, unknown>;
        version?: number;
      };
      const recv = await this.db.receiveInbox({
        operationId: row.operationId,
        entityType: row.entityType ?? tableName,
        entityId: row.entityId,
        payload: row.payload,
        serverCursor: result.cursor,
      });
      if (recv.duplicate) continue;

      const did = await this.db.applyInbox(row.operationId, async (payload) => {
        await this.applyPulledEntity(tableName, row.entityId, payload, row.version);
      });
      if (did) applied += 1;
    }

    await this.db.updateSyncMetadata({
      organizationId: this.options.organizationId,
      deviceId,
      tableName,
      lastPulledAt: new Date().toISOString(),
      serverCursor: result.cursor,
    });
    this.pulled += applied;
    return applied;
  }

  private async applyPulledEntity(
    tableName: string,
    entityId: string,
    payload: Record<string, unknown>,
    serverVersion?: number,
  ): Promise<void> {
    if (tableName === "stock_movements" || payload.movementType) {
      // Transaction reconcile: append movement event, never replace qty
      await this.db.appendStockMovement({
        id: String(payload.id ?? entityId),
        organizationId: String(payload.organizationId ?? this.options.organizationId),
        branchId: String(payload.branchId ?? ""),
        warehouseId: String(payload.warehouseId ?? ""),
        productId: String(payload.productId ?? ""),
        qtyDelta: String(payload.qtyDelta ?? payload.qty ?? "0"),
        movementType: String(payload.movementType ?? "adjustment"),
        sourceType: String(payload.sourceType ?? "sync"),
        sourceId: String(payload.sourceId ?? entityId),
        operationId: String(payload.operationId ?? entityId),
        deviceId: payload.deviceId ? String(payload.deviceId) : null,
        version: Number(serverVersion ?? payload.version ?? 1),
        createdAt: String(payload.createdAt ?? new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        syncState: "synced",
        lastSyncedAt: new Date().toISOString(),
        payload,
      });
      return;
    }

    if (tableName === "customers" || tableName === "products") {
      const localVersion = Number(payload.localVersion ?? 0);
      const remoteVersion = Number(serverVersion ?? payload.version ?? 1);
      if (detectVersionConflict(remoteVersion, localVersion) && localVersion > 0) {
        const decision = resolveConflict({
          entityType: tableName,
          serverVersion: remoteVersion,
          clientVersion: localVersion,
          serverUpdatedAt: payload.serverUpdatedAt as string | undefined,
          clientUpdatedAt: payload.clientUpdatedAt as string | undefined,
          strategy: this.options.defaultStrategy ?? "latest_version",
        });
        if (decision.winner === "none" || decision.resolution === "pending") {
          await this.db.addConflict({
            entityType: tableName,
            entityId,
            serverVersion: remoteVersion,
            clientVersion: localVersion,
            serverPayload: payload,
            clientPayload: { version: localVersion },
            conflictType: "version",
            resolution: "pending",
            remarks: decision.reason,
          });
          return;
        }
      }
    }
  }

  private backoffMs(op: OutboxOperation): number {
    const base = this.options.baseBackoffMs ?? 1000;
    const maxRetries = this.options.maxRetries ?? 8;
    const attempt = Math.min(op.retryCount + 1, maxRetries);
    return Math.min(60_000, base * 2 ** (attempt - 1));
  }
}
