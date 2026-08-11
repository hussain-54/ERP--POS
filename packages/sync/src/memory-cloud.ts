import type { SyncPullRequest, SyncPushRequest } from "@electronic-erp/contracts";
import type { SyncTransport } from "./engine.js";

/** In-memory cloud stand-in for offline sync tests (simulates Node API + Supabase). */
export class MemoryCloudTransport implements SyncTransport {
  readonly bills = new Map<string, Record<string, unknown>>();
  readonly acks = new Set<string>();
  readonly changeLog: Array<{
    id: string;
    entityType: string;
    entityId: string;
    occurredAt: string;
    payload: Record<string, unknown>;
    version: number;
  }> = [];
  readonly conflicts: Array<Record<string, unknown>> = [];
  failNextPush = false;
  partialAccept = 0;

  async push(request: SyncPushRequest) {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error("network failed");
    }

    let accepted = 0;
    let conflicts = 0;
    let duplicateSkipped = 0;
    const limit =
      this.partialAccept > 0 ? this.partialAccept : request.items.length;
    if (this.partialAccept > 0) this.partialAccept = 0;

    for (const item of request.items.slice(0, limit)) {
      if (this.acks.has(item.idempotencyKey)) {
        duplicateSkipped += 1;
        continue;
      }

      if (
        (item.entityType === "customers" || item.entityType === "products") &&
        Number(item.payload.serverVersion ?? 0) > 0 &&
        Number(item.payload.serverVersion) !== Number(item.payload.version ?? 1)
      ) {
        this.conflicts.push({
          entityType: item.entityType,
          entityId: item.entityId,
          serverVersion: item.payload.serverVersion,
          clientVersion: item.payload.version,
        });
        this.acks.add(item.idempotencyKey);
        conflicts += 1;
        continue;
      }

      this.acks.add(item.idempotencyKey);
      if (item.entityType === "sales") {
        this.bills.set(item.idempotencyKey, item.payload);
      }
      this.changeLog.push({
        id: item.idempotencyKey,
        entityType: item.entityType,
        entityId: item.entityId,
        occurredAt: new Date().toISOString(),
        payload: item.payload,
        version: Number(item.payload.version ?? 1),
      });
      accepted += 1;
    }

    return { accepted, conflicts, duplicateSkipped };
  }

  async pull(request: SyncPullRequest) {
    const rows = this.changeLog
      .filter((r) => r.entityType === request.tableName)
      .filter((r) => !request.cursor || r.occurredAt > request.cursor)
      .slice(0, request.limit ?? 100)
      .map((r) => ({
        operationId: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        version: r.version,
        payload: r.payload,
      }));
    const cursor = rows.length
      ? this.changeLog.find((c) => c.id === (rows[rows.length - 1] as { operationId: string }).operationId)
          ?.occurredAt ?? null
      : request.cursor ?? null;
    return { cursor, rows };
  }
}
