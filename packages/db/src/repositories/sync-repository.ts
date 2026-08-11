import type {
  RegisterDeviceInput,
  ResolveSyncConflictInput,
  SyncPullRequest,
  SyncPushRequest,
} from "@electronic-erp/contracts";
import { CreateSaleReturnSchema, CreateSaleSchema } from "@electronic-erp/contracts";
import { ValidationDomainError } from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";
import { PosRepository } from "./pos-repository.js";

type Row = Record<string, unknown>;

export class SyncRepository {
  constructor(private readonly db: DatabaseClient) {}

  async registerDevice(input: RegisterDeviceInput) {
    const { data: existing } = await this.db
      .from("devices")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("device_key", input.deviceKey)
      .maybeSingle();
    if (existing) {
      const { data, error } = await this.db
        .from("devices")
        .update({
          name: input.name,
          platform: input.platform,
          branch_id: input.branchId,
          status: "active",
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.db
      .from("devices")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        device_key: input.deviceKey,
        name: input.name,
        platform: input.platform,
        status: "active",
        registered_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async push(organizationId: string, request: SyncPushRequest, userId?: string | null) {
    const { data: device } = await this.db
      .from("devices")
      .select("*")
      .eq("id", request.deviceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!device) throw new ValidationDomainError("Device not registered");

    let accepted = 0;
    let conflicts = 0;
    let duplicateSkipped = 0;
    const pos = new PosRepository(this.db);

    for (const item of request.items) {
      const { data: ack } = await this.db
        .from("sync_operation_acks")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("idempotency_key", item.idempotencyKey)
        .maybeSingle();
      if (ack) {
        duplicateSkipped += 1;
        continue;
      }

      const operationId = String(
        (item.payload.operationId as string | undefined) ?? item.idempotencyKey,
      );

      if (item.entityType === "customers" || item.entityType === "products") {
        const clientVersion = Number(item.payload.version ?? 1);
        const serverVersion = Number(item.payload.serverVersion ?? 0);
        if (serverVersion > 0 && serverVersion !== clientVersion) {
          await this.db.from("sync_conflicts").insert({
            organization_id: organizationId,
            device_id: request.deviceId,
            entity_type: item.entityType,
            entity_id: item.entityId,
            server_version: serverVersion,
            client_version: clientVersion,
            server_payload: item.payload.serverPayload ?? {},
            client_payload: item.payload,
            conflict_type: "version",
            resolution: "pending",
          });
          await this.db.from("sync_operation_acks").insert({
            organization_id: organizationId,
            device_id: request.deviceId,
            operation_id: operationId,
            idempotency_key: item.idempotencyKey,
            entity_type: item.entityType,
            entity_id: item.entityId,
            status: "conflict",
          });
          conflicts += 1;
          continue;
        }
      }

      // Apply business entities BEFORE ack so retries can still materialize after failures.
      let resultPayload: Record<string, unknown> = { accepted: true };
      try {
        if (item.entityType === "sales") {
          const parsed = CreateSaleSchema.parse({
            ...item.payload,
            organizationId,
            idempotencyKey: item.idempotencyKey,
            deviceId: String(item.payload.deviceId ?? request.deviceId),
            operationId,
            offlineTransactionId:
              typeof item.payload.offlineTransactionId === "string"
                ? item.payload.offlineTransactionId
                : item.entityId,
          });
          const sale = await pos.postSale(parsed, userId);
          resultPayload = {
            accepted: true,
            applied: "sale",
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
          };
        } else if (item.entityType === "sale_returns") {
          const parsed = CreateSaleReturnSchema.parse({
            ...item.payload,
            organizationId,
            idempotencyKey: item.idempotencyKey,
            deviceId: String(item.payload.deviceId ?? request.deviceId),
            operationId,
          });
          const ret = await pos.postReturn(parsed, userId);
          resultPayload = {
            accepted: true,
            applied: "sale_return",
            returnId: (ret as { id?: string }).id ?? item.entityId,
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Apply failed";
        // Do NOT ack on failure — client must retry. Record a pending conflict for operators.
        await this.db.from("sync_conflicts").insert({
          organization_id: organizationId,
          device_id: request.deviceId,
          entity_type: item.entityType,
          entity_id: item.entityId,
          server_version: 0,
          client_version: Number(item.payload.version ?? 1),
          server_payload: { error: message },
          client_payload: item.payload,
          conflict_type: "manual",
          resolution: "pending",
        });
        conflicts += 1;
        continue;
      }

      await this.db.from("sync_operation_acks").insert({
        organization_id: organizationId,
        device_id: request.deviceId,
        operation_id: operationId,
        idempotency_key: item.idempotencyKey,
        entity_type: item.entityType,
        entity_id: item.entityId,
        status: "accepted",
        result_payload: resultPayload,
      });

      await this.db.from("sync_change_log").insert({
        organization_id: organizationId,
        entity_type: item.entityType,
        entity_id: item.entityId,
        operation: "upsert",
        version: Number(item.payload.version ?? 1),
        payload: item.payload,
        device_id: request.deviceId,
      });

      accepted += 1;
    }

    await this.db
      .from("devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", request.deviceId);

    await this.db.from("sync_metadata").upsert(
      {
        organization_id: organizationId,
        device_id: request.deviceId,
        table_name: "_push",
        last_pushed_at: new Date().toISOString(),
        client_cursor: new Date().toISOString(),
      },
      { onConflict: "device_id,table_name" },
    );

    return { accepted, conflicts, duplicateSkipped };
  }

  async pull(organizationId: string, request: SyncPullRequest) {
    let q = this.db
      .from("sync_change_log")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("entity_type", request.tableName)
      .order("occurred_at")
      .limit(request.limit ?? 100);
    if (request.cursor) q = q.gt("occurred_at", request.cursor);
    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []).map((r: Row) => ({
      operationId: String(r.id),
      entityType: String(r.entity_type),
      entityId: String(r.entity_id),
      version: Number(r.version ?? 1),
      payload: (r.payload as Record<string, unknown>) ?? {},
    }));
    const last = data?.[data.length - 1] as Row | undefined;
    const cursor = last ? String(last.occurred_at) : request.cursor ?? null;

    await this.db.from("sync_metadata").upsert(
      {
        organization_id: organizationId,
        device_id: request.deviceId,
        table_name: request.tableName,
        last_pulled_at: new Date().toISOString(),
        server_cursor: cursor,
      },
      { onConflict: "device_id,table_name" },
    );

    return { cursor, rows };
  }

  async listConflicts(organizationId: string) {
    const { data, error } = await this.db
      .from("sync_conflicts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("resolution", "pending")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async resolveConflict(
    id: string,
    input: ResolveSyncConflictInput,
    userId?: string | null,
  ) {
    const { data, error } = await this.db
      .from("sync_conflicts")
      .update({
        resolution: input.resolution,
        remarks: input.remarks ?? null,
        resolved_by: userId ?? null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async status(organizationId: string, deviceId?: string) {
    let ackQ = this.db
      .from("sync_operation_acks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    if (deviceId) ackQ = ackQ.eq("device_id", deviceId);
    const { count: pendingAcks } = await ackQ;

    const { count: openConflicts } = await this.db
      .from("sync_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("resolution", "pending");

    let lastPushAt: string | null = null;
    let lastPullAt: string | null = null;
    if (deviceId) {
      const { data: meta } = await this.db
        .from("sync_metadata")
        .select("*")
        .eq("device_id", deviceId);
      for (const m of meta ?? []) {
        if (m.table_name === "_push") lastPushAt = (m.last_pushed_at as string) ?? lastPushAt;
        else lastPullAt = (m.last_pulled_at as string) ?? lastPullAt;
      }
    }

    return {
      deviceId: deviceId ?? null,
      pendingAcks: pendingAcks ?? 0,
      openConflicts: openConflicts ?? 0,
      lastPushAt,
      lastPullAt,
    };
  }
}
