import type {
  CreateBatchInput,
  CreateReservationInput,
  CreateSerialInput,
  CreateStockAdjustmentInput,
  CreateStockCountSessionInput,
  CreateWarehouseInput,
  PostStockMovementInput,
  StockBalance,
  StockMovement,
  UpsertStockCountLineInput,
} from "@electronic-erp/contracts";
import {
  applyMovementToBalance,
  assertStockMovementQty,
  computeStockMetrics,
  differenceQty,
  qtyToBaseUnits,
  updateMovingAverageCost,
  ValidationDomainError,
  type UnitConversionRule,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";

type Row = Record<string, unknown>;

export class InventoryRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createWarehouse(input: CreateWarehouseInput & { allowNegativeStock?: boolean }) {
    const { data, error } = await this.db
      .from("warehouses")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        code: input.code,
        name: input.name,
        warehouse_type: input.warehouseType ?? "branch",
        is_default: input.isDefault ?? false,
        allow_negative_stock: input.allowNegativeStock ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listWarehouses(organizationId: string) {
    const { data, error } = await this.db
      .from("warehouses")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  async ensureCostingSettings(organizationId: string, method = "moving_average") {
    const { data: existing } = await this.db
      .from("inventory_costing_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await this.db
      .from("inventory_costing_settings")
      .insert({ organization_id: organizationId, costing_method: method })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async getOrCreateBalance(input: {
    organizationId: string;
    branchId: string;
    warehouseId: string;
    productId: string;
    variantId?: string | null;
  }): Promise<Row> {
    let q = this.db
      .from("stock_balances")
      .select("*")
      .eq("warehouse_id", input.warehouseId)
      .eq("product_id", input.productId);
    q = input.variantId ? q.eq("variant_id", input.variantId) : q.is("variant_id", null);
    const { data: existing } = await q.maybeSingle();
    if (existing) return existing;

    const { data, error } = await this.db
      .from("stock_balances")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listBalances(organizationId: string, filters: { warehouseId?: string; productId?: string } = {}) {
    let q = this.db.from("stock_balances").select("*").eq("organization_id", organizationId);
    if (filters.warehouseId) q = q.eq("warehouse_id", filters.warehouseId);
    if (filters.productId) q = q.eq("product_id", filters.productId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapBalance);
  }

  async listMovements(
    organizationId: string,
    filters: { productId?: string; warehouseId?: string; serialNumberId?: string; limit?: number } = {},
  ) {
    let q = this.db
      .from("stock_movements")
      .select("*")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(filters.limit ?? 100);
    if (filters.productId) q = q.eq("product_id", filters.productId);
    if (filters.warehouseId) q = q.eq("warehouse_id", filters.warehouseId);
    if (filters.serialNumberId) q = q.eq("serial_number_id", filters.serialNumberId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapMovement);
  }

  async postMovement(input: PostStockMovementInput, userId?: string | null): Promise<StockMovement> {
    const { data: existingOp } = await this.db
      .from("stock_movements")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("operation_id", input.operationId)
      .maybeSingle();
    if (existingOp) return mapMovement(existingOp);

    const { data: warehouse } = await this.db
      .from("warehouses")
      .select("*")
      .eq("id", input.warehouseId)
      .single();
    if (!warehouse) throw new ValidationDomainError("Warehouse not found");

    const { data: product } = await this.db
      .from("products")
      .select("id,base_unit_id,organization_id")
      .eq("id", input.productId)
      .maybeSingle();
    if (!product) throw new ValidationDomainError("Invalid product");
    if (String(product.organization_id) !== input.organizationId) {
      throw new ValidationDomainError("Invalid product");
    }
    const baseUnitId = String(product.base_unit_id);
    if (!input.unitId) throw new ValidationDomainError("Missing unit");

    const rules = await this.listConversionRules(input.organizationId, input.productId);
    const qtyBase = qtyToBaseUnits({
      qty: String(input.qtyDelta),
      fromUnitId: input.unitId,
      baseUnitId,
      rules,
      productId: input.productId,
    });
    assertStockMovementQty(input.movementType, qtyBase);

    const balance = await this.getOrCreateBalance({
      organizationId: input.organizationId,
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      variantId: input.variantId,
    });

    if (
      input.expectedBalanceVersion != null &&
      Number(balance.version) !== input.expectedBalanceVersion
    ) {
      throw new ValidationDomainError("Concurrent stock update conflict");
    }

    const current = {
      qtyOnHand: String(balance.qty_on_hand ?? "0"),
      qtyReserved: String(balance.qty_reserved ?? "0"),
      qtyDamaged: String(balance.qty_damaged ?? "0"),
      qtyInTransit: String(balance.qty_in_transit ?? "0"),
    };

    const allowNegative =
      input.allowNegative ?? Boolean(warehouse.allow_negative_stock);

    const { before, after } = applyMovementToBalance(
      current,
      input.movementType,
      qtyBase,
      allowNegative,
    );

    let averageUnitCost = String(balance.average_unit_cost ?? "0");
    if (
      ["opening", "purchase", "sale_return", "transfer_in", "warranty_replacement"].includes(
        input.movementType,
      ) &&
      input.unitCost
    ) {
      averageUnitCost = updateMovingAverageCost(
        before.qtyOnHand,
        averageUnitCost,
        String(Math.abs(Number(qtyBase))),
        input.unitCost,
      );
    }

    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const movementPayload = {
      organization_id: input.organizationId,
      branch_id: input.branchId,
      warehouse_id: input.warehouseId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      batch_id: input.batchId ?? null,
      serial_number_id: input.serialNumberId ?? null,
      unit_id: baseUnitId,
      movement_type: input.movementType,
      qty_delta: qtyBase,
      qty_before: before.qtyOnHand,
      qty_after: after.qtyOnHand,
      unit_cost: input.unitCost ?? null,
      source_type: input.sourceType,
      source_id: input.sourceId,
      reason: input.reason ?? null,
      occurred_at: occurredAt,
      device_id: input.deviceId ?? null,
      offline_transaction_id: input.offlineTransactionId ?? null,
      operation_id: input.operationId,
      sync_state: input.offlineTransactionId ? "pending" : "synced",
      created_by: userId ?? null,
    };

    const atomic = await this.applyMovementAtomic({
      movement: movementPayload,
      balanceId: String(balance.id),
      expectedVersion: Number(balance.version),
      qtyOnHand: after.qtyOnHand,
      qtyReserved: after.qtyReserved,
      qtyDamaged: after.qtyDamaged,
      qtyInTransit: after.qtyInTransit,
      averageUnitCost,
      occurredAt,
    });

    if (input.serialNumberId) {
      await this.db.from("stock_serial_movements").insert({
        organization_id: input.organizationId,
        serial_id: input.serialNumberId,
        stock_movement_id: atomic.id,
        from_status: null,
        to_status: serialStatusForMovement(input.movementType),
        occurred_at: occurredAt,
        created_by: userId ?? null,
      });
      await this.db
        .from("stock_serials")
        .update({
          status: serialStatusForMovement(input.movementType),
          warehouse_id: input.warehouseId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.serialNumberId);
    }

    return atomic;
  }

  private async listConversionRules(
    organizationId: string,
    productId: string,
  ): Promise<UnitConversionRule[]> {
    const { data, error } = await this.db
      .from("unit_conversions")
      .select("product_id,from_unit_id,to_unit_id,factor")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);
    if (error) throw error;
    return (data ?? [])
      .filter((r) => !r.product_id || String(r.product_id) === productId)
      .map((r) => ({
        productId: r.product_id ? String(r.product_id) : null,
        fromUnitId: String(r.from_unit_id),
        toUnitId: String(r.to_unit_id),
        factor: String(r.factor),
      }));
  }

  /**
   * Prefer Postgres RPC (one transaction). If the function is not deployed, fall back
   * to two sequential writes — that fallback is NOT atomic.
   */
  private async applyMovementAtomic(input: {
    movement: Row;
    balanceId: string;
    expectedVersion: number;
    qtyOnHand: string;
    qtyReserved: string;
    qtyDamaged: string;
    qtyInTransit: string;
    averageUnitCost: string;
    occurredAt: string;
  }): Promise<StockMovement> {
    const jsonMovement: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.movement)) {
      jsonMovement[k] = v == null ? "" : String(v);
    }

    const rpc = await this.db.rpc("apply_stock_movement_atomic", {
      p_movement: jsonMovement,
      p_balance_id: input.balanceId,
      p_expected_version: input.expectedVersion,
      p_qty_on_hand: Number(input.qtyOnHand),
      p_qty_reserved: Number(input.qtyReserved),
      p_qty_damaged: Number(input.qtyDamaged),
      p_qty_in_transit: Number(input.qtyInTransit),
      p_average_unit_cost: Number(input.averageUnitCost),
      p_occurred_at: input.occurredAt,
    });

    if (!rpc.error && rpc.data) {
      return mapMovement(rpc.data as Row);
    }

    const missingFn =
      rpc.error &&
      (/apply_stock_movement_atomic/i.test(rpc.error.message) ||
        rpc.error.code === "PGRST202" ||
        rpc.error.code === "42883");
    if (!missingFn) {
      const msg = rpc.error?.message ?? "Stock movement failed";
      if (/concurrent stock update conflict/i.test(msg)) {
        throw new ValidationDomainError("Concurrent stock update conflict");
      }
      throw rpc.error;
    }

    const { data: movement, error: movErr } = await this.db
      .from("stock_movements")
      .insert(input.movement)
      .select("*")
      .single();
    if (movErr) throw movErr;

    const { data: updated, error: balErr } = await this.db
      .from("stock_balances")
      .update({
        qty_on_hand: input.qtyOnHand,
        qty_reserved: input.qtyReserved,
        qty_damaged: input.qtyDamaged,
        qty_in_transit: input.qtyInTransit,
        average_unit_cost: input.averageUnitCost,
        last_movement_at: input.occurredAt,
        updated_at: new Date().toISOString(),
        version: input.expectedVersion + 1,
      })
      .eq("id", input.balanceId)
      .eq("version", input.expectedVersion)
      .select("*")
      .maybeSingle();
    if (balErr) throw balErr;
    if (!updated) {
      throw new ValidationDomainError("Concurrent stock update conflict");
    }
    return mapMovement(movement);
  }

  async createAdjustmentRequest(input: CreateStockAdjustmentInput, userId?: string | null) {
    const balance = await this.getOrCreateBalance(input);
    const qtyBefore = String(balance.qty_on_hand ?? "0");
    const qtyAfter = input.qtyAfter;
    const qtyDifference = differenceQty(qtyBefore, qtyAfter);
    if (Number(qtyDifference) === 0) {
      throw new ValidationDomainError("Adjustment difference cannot be zero");
    }

    const { data, error } = await this.db
      .from("stock_adjustment_requests")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        unit_id: input.unitId,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        qty_difference: qtyDifference,
        reason: input.reason,
        status: input.requiresApproval === false ? "approved" : "pending",
        requested_by: userId ?? null,
        requires_approval: input.requiresApproval ?? true,
        idempotency_key: input.idempotencyKey,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (input.requiresApproval === false) {
      return this.approveAdjustment(String(data.id), userId, true);
    }
    return data;
  }

  async approveAdjustment(id: string, userId?: string | null, autoPost = true) {
    const { data: req, error } = await this.db
      .from("stock_adjustment_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (!req) throw new ValidationDomainError("Adjustment not found");
    if (req.status === "posted") return req;

    await this.db
      .from("stock_adjustment_requests")
      .update({
        status: "approved",
        approved_by: userId ?? null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (!autoPost) {
      const { data } = await this.db.from("stock_adjustment_requests").select("*").eq("id", id).single();
      return data;
    }

    const movement = await this.postMovement(
      {
        organizationId: String(req.organization_id),
        branchId: String(req.branch_id),
        warehouseId: String(req.warehouse_id),
        productId: String(req.product_id),
        variantId: (req.variant_id as string | null) ?? undefined,
        unitId: String(req.unit_id),
        movementType: "adjustment",
        qtyDelta: String(req.qty_difference),
        sourceType: "stock_adjustment",
        sourceId: String(req.id),
        reason: String(req.reason),
        operationId: String(req.idempotency_key),
      },
      userId,
    );

    const { data: posted, error: postErr } = await this.db
      .from("stock_adjustment_requests")
      .update({
        status: "posted",
        posted_movement_id: movement.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (postErr) throw postErr;
    return posted;
  }

  async createBatch(input: CreateBatchInput) {
    const { data, error } = await this.db
      .from("stock_batches")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        batch_number: input.batchNumber,
        manufacturing_date: input.manufacturingDate ?? null,
        expiry_date: input.expiryDate ?? null,
        warranty_start: input.warrantyStart ?? null,
        warranty_end: input.warrantyEnd ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async createSerial(input: CreateSerialInput) {
    const { data, error } = await this.db
      .from("stock_serials")
      .insert({
        organization_id: input.organizationId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        batch_id: input.batchId ?? null,
        serial_number: input.serialNumber,
        warehouse_id: input.warehouseId ?? null,
        manufacturing_date: input.manufacturingDate ?? null,
        expiry_date: input.expiryDate ?? null,
        warranty_start: input.warrantyStart ?? null,
        warranty_end: input.warrantyEnd ?? null,
        status: "in_stock",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listSerialHistory(serialId: string) {
    const { data, error } = await this.db
      .from("stock_serial_movements")
      .select("*")
      .eq("serial_id", serialId)
      .order("occurred_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async createReservation(input: CreateReservationInput, userId?: string | null) {
    const movement = await this.postMovement(
      {
        organizationId: input.organizationId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        variantId: input.variantId,
        batchId: input.batchId,
        serialNumberId: input.serialId,
        unitId: input.unitId,
        movementType: "reservation",
        qtyDelta: input.qty,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        operationId: input.operationId,
      },
      userId,
    );

    const { data, error } = await this.db
      .from("stock_reservations")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        product_id: input.productId,
        variant_id: input.variantId ?? null,
        batch_id: input.batchId ?? null,
        serial_id: input.serialId ?? null,
        unit_id: input.unitId,
        qty: input.qty,
        source_type: input.sourceType,
        source_id: input.sourceId,
        status: "active",
        expires_at: input.expiresAt ?? null,
        reserve_movement_id: movement.id,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async releaseReservation(reservationId: string, operationId: string, userId?: string | null) {
    const { data: reservation, error } = await this.db
      .from("stock_reservations")
      .select("*")
      .eq("id", reservationId)
      .single();
    if (error) throw error;
    if (!reservation || reservation.status !== "active") {
      throw new ValidationDomainError("Reservation is not active");
    }

    const movement = await this.postMovement(
      {
        organizationId: String(reservation.organization_id),
        branchId: String(reservation.branch_id),
        warehouseId: String(reservation.warehouse_id),
        productId: String(reservation.product_id),
        variantId: (reservation.variant_id as string | null) ?? undefined,
        batchId: (reservation.batch_id as string | null) ?? undefined,
        serialNumberId: (reservation.serial_id as string | null) ?? undefined,
        unitId: String(reservation.unit_id),
        movementType: "release_reservation",
        qtyDelta: String(reservation.qty),
        sourceType: String(reservation.source_type),
        sourceId: String(reservation.source_id),
        operationId,
      },
      userId,
    );

    const { data, error: updErr } = await this.db
      .from("stock_reservations")
      .update({
        status: "released",
        released_at: new Date().toISOString(),
        release_movement_id: movement.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return data;
  }

  async createCountSession(input: CreateStockCountSessionInput, userId?: string | null) {
    const { data, error } = await this.db
      .from("stock_count_sessions")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        code: input.code,
        notes: input.notes ?? null,
        status: "in_progress",
        started_at: new Date().toISOString(),
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async upsertCountLine(input: UpsertStockCountLineInput) {
    const variance = differenceQty(input.expectedQty, input.countedQty);
    const { data, error } = await this.db
      .from("stock_count_lines")
      .upsert(
        {
          organization_id: input.organizationId,
          session_id: input.sessionId,
          product_id: input.productId,
          variant_id: input.variantId ?? null,
          batch_id: input.batchId ?? null,
          serial_number: input.serialNumber ?? null,
          barcode_scanned: input.barcodeScanned ?? null,
          expected_qty: input.expectedQty,
          counted_qty: input.countedQty,
          variance_qty: variance,
          unit_id: input.unitId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id,product_id" },
      )
      .select("*")
      .single();
    if (error) {
      // fallback insert when unique index expression prevents upsert conflict target
      const { data: inserted, error: insErr } = await this.db
        .from("stock_count_lines")
        .insert({
          organization_id: input.organizationId,
          session_id: input.sessionId,
          product_id: input.productId,
          variant_id: input.variantId ?? null,
          batch_id: input.batchId ?? null,
          serial_number: input.serialNumber ?? null,
          barcode_scanned: input.barcodeScanned ?? null,
          expected_qty: input.expectedQty,
          counted_qty: input.countedQty,
          variance_qty: variance,
          unit_id: input.unitId,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;
      return inserted;
    }
    return data;
  }

  async listCountLines(sessionId: string) {
    const { data, error } = await this.db
      .from("stock_count_lines")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  }

  async approveAndPostCount(sessionId: string, userId?: string | null) {
    const { data: session, error } = await this.db
      .from("stock_count_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (error) throw error;
    if (!session) throw new ValidationDomainError("Count session not found");

    const lines = await this.listCountLines(sessionId);
    const movements: StockMovement[] = [];
    for (const line of lines) {
      const variance = String(line.variance_qty ?? "0");
      if (Number(variance) === 0) continue;
      const movement = await this.postMovement(
        {
          organizationId: String(session.organization_id),
          branchId: String(session.branch_id),
          warehouseId: String(session.warehouse_id),
          productId: String(line.product_id),
          variantId: (line.variant_id as string | null) ?? undefined,
          batchId: (line.batch_id as string | null) ?? undefined,
          unitId: String(line.unit_id),
          movementType: "stock_count",
          qtyDelta: variance,
          sourceType: "stock_count",
          sourceId: String(session.id),
          reason: `Stock count ${String(session.code)}`,
          operationId: cryptoRandomUuid(),
        },
        userId,
      );
      movements.push(movement);
    }

    const { data: updated, error: updErr } = await this.db
      .from("stock_count_sessions")
      .update({
        status: "posted",
        approved_by: userId ?? null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return { session: updated, movements };
  }
}

function serialStatusForMovement(type: string): string {
  switch (type) {
    case "sale":
      return "sold";
    case "reservation":
      return "reserved";
    case "release_reservation":
    case "sale_return":
    case "purchase":
    case "opening":
    case "transfer_in":
      return "in_stock";
    case "damage":
      return "damaged";
    case "transfer_out":
      return "in_transit";
    default:
      return "in_stock";
  }
}

function mapBalance(row: Row): StockBalance {
  const buckets = {
    qtyOnHand: String(row.qty_on_hand ?? "0"),
    qtyReserved: String(row.qty_reserved ?? "0"),
    qtyDamaged: String(row.qty_damaged ?? "0"),
    qtyInTransit: String(row.qty_in_transit ?? "0"),
  };
  const metrics = computeStockMetrics(
    buckets,
    String(row.reorder_level ?? "0"),
    row.overstock_level == null ? null : String(row.overstock_level),
  );
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    branchId: String(row.branch_id),
    warehouseId: String(row.warehouse_id),
    productId: String(row.product_id),
    variantId: (row.variant_id as string | null) ?? null,
    ...metrics,
    reorderLevel: String(row.reorder_level ?? "0"),
    overstockLevel: row.overstock_level == null ? null : String(row.overstock_level),
    averageUnitCost: String(row.average_unit_cost ?? "0"),
    lastMovementAt: (row.last_movement_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    version: Number(row.version ?? 1),
  };
}

function mapMovement(row: Row): StockMovement {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    branchId: String(row.branch_id),
    warehouseId: String(row.warehouse_id),
    productId: String(row.product_id),
    variantId: (row.variant_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    serialNumberId: (row.serial_number_id as string | null) ?? null,
    unitId: String(row.unit_id),
    movementType: row.movement_type as StockMovement["movementType"],
    qtyDelta: String(row.qty_delta),
    qtyBefore: String(row.qty_before),
    qtyAfter: String(row.qty_after),
    unitCost: row.unit_cost == null ? null : String(row.unit_cost),
    sourceType: String(row.source_type),
    sourceId: String(row.source_id),
    reason: (row.reason as string | null) ?? null,
    occurredAt: String(row.occurred_at),
    deviceId: (row.device_id as string | null) ?? null,
    offlineTransactionId: (row.offline_transaction_id as string | null) ?? null,
    operationId: (row.operation_id as string | null) ?? null,
    syncState: (row.sync_state as StockMovement["syncState"]) ?? "synced",
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    version: Number(row.version ?? 1),
  };
}

function cryptoRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}
