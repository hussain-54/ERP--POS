import type {
  AdvanceDeliveryInput,
  AssignDeliveryBoyInput,
  CreateDeliveryInput,
  CreatePurchaseInput,
  CreatePurchaseReturnInput,
  CreateStockTransferInput,
  DeliveryListFilterInput,
  DeliveryStatus,
  TransferStatus,
} from "@electronic-erp/contracts";
import {
  assertDeliveryTransition,
  assertTransferTransition,
  buildAuditRow,
  buildDeliveryStatusAudit,
  buildPurchaseReturnJournalLines,
  deliveryStatusTimestampField,
  nextTransferAfterDispatch,
  NullDeliveryTrackingAdapter,
  PurchaseTransactionService,
  resolveTrackingSnapshot,
  summarizeDeliveryReports,
  ValidationDomainError,
  type DeliveryReportRow,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";
import { InventoryRepository } from "./inventory-repository.js";
import { PartiesRepository } from "./parties-repository.js";

type Row = Record<string, unknown>;
type RackInput = { organizationId: string; warehouseId: string; code: string; name: string };
type ShelfInput = { organizationId: string; rackId: string; code: string; name: string };
type BinInput = { organizationId: string; shelfId: string; code: string; name: string };

export class PurchasesRepository {
  private readonly inventory: InventoryRepository;
  private readonly parties: PartiesRepository;

  constructor(private readonly db: DatabaseClient) {
    this.inventory = new InventoryRepository(db);
    this.parties = new PartiesRepository(db);
  }

  async postPurchase(input: CreatePurchaseInput, userId?: string | null) {
    const service = new PurchaseTransactionService(this.buildPurchasePorts(userId));
    return service.postPurchase(input, userId);
  }

  async listPurchases(organizationId: string, branchId?: string) {
    let q = this.db
      .from("purchases")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async postPurchaseReturn(input: CreatePurchaseReturnInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("purchase_returns")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    const { data: purchase } = await this.db
      .from("purchases")
      .select("*")
      .eq("id", input.originalPurchaseId)
      .maybeSingle();
    if (!purchase) throw new ValidationDomainError("Original purchase not found");

    const refundAmount = input.items.reduce(
      (s, i) => s + Number(i.qty) * i.unitCost,
      0,
    );
    const returnNumber = `PRET-${Date.now()}`;
    const { data: ret, error } = await this.db
      .from("purchase_returns")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        original_purchase_id: input.originalPurchaseId,
        supplier_id: purchase.supplier_id,
        return_number: returnNumber,
        reason: input.reason,
        refund_amount: refundAmount,
        status: "posted",
        idempotency_key: input.idempotencyKey,
        device_id: input.deviceId ?? null,
        offline_transaction_id: input.offlineTransactionId ?? null,
        operation_id: input.operationId ?? input.idempotencyKey,
        sync_state: input.offlineTransactionId ? "pending" : "synced",
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    for (const item of input.items) {
      await this.db.from("purchase_return_items").insert({
        organization_id: input.organizationId,
        purchase_return_id: ret.id,
        original_purchase_item_id: item.originalPurchaseItemId ?? null,
        product_id: item.productId,
        unit_id: item.unitId,
        qty: String(item.qty),
        unit_cost: item.unitCost,
        line_total: Number(item.qty) * item.unitCost,
      });

      await this.inventory.postMovement(
        {
          organizationId: input.organizationId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          productId: item.productId,
          unitId: item.unitId,
          movementType: "purchase_return",
          qtyDelta: String(item.qty),
          sourceType: "purchase_return",
          sourceId: String(ret.id),
          operationId: crypto.randomUUID(),
          reason: input.reason,
        },
        userId,
      );
    }

    await this.parties.postSupplierLedger({
      organizationId: input.organizationId,
      branchId: input.branchId,
      supplierId: String(purchase.supplier_id),
      entryType: "return",
      amount: String(refundAmount),
      sourceType: "purchase_return",
      sourceId: String(ret.id),
      description: `Purchase return: ${input.reason}`,
      userId,
    });

    await this.db
      .from("purchases")
      .update({ status: "returned", updated_at: new Date().toISOString() })
      .eq("id", input.originalPurchaseId);

    await this.ensureAndPostJournal({
      organizationId: input.organizationId,
      branchId: input.branchId,
      sourceType: "purchase_return",
      sourceId: String(ret.id),
      idempotencyKey: input.idempotencyKey,
      memo: `Purchase return ${returnNumber}`,
      lines: buildPurchaseReturnJournalLines({ refundAmount }),
    });

    return ret;
  }

  async listSupplierPrices(organizationId: string, productId?: string) {
    let q = this.db
      .from("supplier_product_prices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("average_purchase_rate");
    if (productId) q = q.eq("product_id", productId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listPriceHistory(organizationId: string, productId: string) {
    const { data, error } = await this.db
      .from("supplier_price_history")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("product_id", productId)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  }

  // --- Locations ---
  async createRack(input: RackInput) {
    const { data, error } = await this.db
      .from("warehouse_racks")
      .insert({
        organization_id: input.organizationId,
        warehouse_id: input.warehouseId,
        code: input.code,
        name: input.name,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async createShelf(input: ShelfInput) {
    const { data, error } = await this.db
      .from("warehouse_shelves")
      .insert({
        organization_id: input.organizationId,
        rack_id: input.rackId,
        code: input.code,
        name: input.name,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async createBin(input: BinInput) {
    const { data, error } = await this.db
      .from("warehouse_bins")
      .insert({
        organization_id: input.organizationId,
        shelf_id: input.shelfId,
        code: input.code,
        name: input.name,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listLocations(organizationId: string, warehouseId: string) {
    const { data: racks } = await this.db
      .from("warehouse_racks")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("warehouse_id", warehouseId)
      .is("deleted_at", null);
    const rackIds = (racks ?? []).map((r) => String(r.id));
    const { data: shelves } = rackIds.length
      ? await this.db.from("warehouse_shelves").select("*").in("rack_id", rackIds).is("deleted_at", null)
      : { data: [] as Row[] };
    const shelfIds = (shelves ?? []).map((s) => String(s.id));
    const { data: bins } = shelfIds.length
      ? await this.db.from("warehouse_bins").select("*").in("shelf_id", shelfIds).is("deleted_at", null)
      : { data: [] as Row[] };
    return { racks: racks ?? [], shelves: shelves ?? [], bins: bins ?? [] };
  }

  // --- Transfers ---
  async createTransfer(input: CreateStockTransferInput, userId?: string | null) {
    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw new ValidationDomainError("Source and destination must differ");
    }
    const { data: existing } = await this.db
      .from("stock_transfers")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    const transferNumber = `TR-${Date.now()}`;
    const { data: transfer, error } = await this.db
      .from("stock_transfers")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        transfer_number: transferNumber,
        source_warehouse_id: input.sourceWarehouseId,
        destination_warehouse_id: input.destinationWarehouseId,
        status: "requested",
        requested_by: userId ?? null,
        notes: input.notes ?? null,
        idempotency_key: input.idempotencyKey,
        device_id: input.deviceId ?? null,
        offline_transaction_id: input.offlineTransactionId ?? null,
        operation_id: input.operationId ?? input.idempotencyKey,
        sync_state: input.offlineTransactionId ? "pending" : "synced",
      })
      .select("*")
      .single();
    if (error) throw error;

    for (const [i, item] of input.items.entries()) {
      await this.db.from("stock_transfer_items").insert({
        organization_id: input.organizationId,
        transfer_id: transfer.id,
        line_no: i + 1,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        unit_id: item.unitId,
        qty: String(item.qty),
      });
    }
    return transfer;
  }

  async advanceTransfer(
    transferId: string,
    to: TransferStatus,
    userId?: string | null,
  ) {
    const { data: transfer, error } = await this.db
      .from("stock_transfers")
      .select("*")
      .eq("id", transferId)
      .single();
    if (error) throw error;
    const from = transfer.status as TransferStatus;
    let target = to;
    if (to === "dispatched") {
      assertTransferTransition(from, "dispatched");
      target = nextTransferAfterDispatch(from);
    } else {
      assertTransferTransition(from, to);
    }

    const { data: items } = await this.db
      .from("stock_transfer_items")
      .select("*")
      .eq("transfer_id", transferId);

    if (to === "dispatched" || target === "in_transit") {
      for (const item of items ?? []) {
        await this.inventory.postMovement(
          {
            organizationId: String(transfer.organization_id),
            branchId: String(transfer.branch_id),
            warehouseId: String(transfer.source_warehouse_id),
            productId: String(item.product_id),
            unitId: String(item.unit_id),
            movementType: "transfer_out",
            qtyDelta: String(item.qty),
            sourceType: "stock_transfer",
            sourceId: transferId,
            operationId: crypto.randomUUID(),
          },
          userId,
        );
      }
    }

    if (target === "received") {
      for (const item of items ?? []) {
        await this.inventory.postMovement(
          {
            organizationId: String(transfer.organization_id),
            branchId: String(transfer.branch_id),
            warehouseId: String(transfer.destination_warehouse_id),
            productId: String(item.product_id),
            unitId: String(item.unit_id),
            movementType: "transfer_in",
            qtyDelta: String(item.qty),
            sourceType: "stock_transfer",
            sourceId: transferId,
            operationId: crypto.randomUUID(),
          },
          userId,
        );
      }
    }

    const patch: Row = {
      status: target,
      updated_at: new Date().toISOString(),
    };
    if (target === "approved") {
      patch.approved_by = userId ?? null;
      patch.approved_at = new Date().toISOString();
    }
    if (to === "dispatched" || target === "in_transit") {
      patch.dispatched_by = userId ?? null;
      patch.dispatched_at = new Date().toISOString();
      patch.status = "in_transit";
    }
    if (target === "received") {
      patch.received_by = userId ?? null;
      patch.received_at = new Date().toISOString();
    }
    if (target === "cancelled") {
      patch.status = "cancelled";
    }

    const { data: updated, error: updErr } = await this.db
      .from("stock_transfers")
      .update(patch)
      .eq("id", transferId)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return updated;
  }

  async listTransfers(organizationId: string, branchId?: string) {
    let q = this.db
      .from("stock_transfers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  // --- Deliveries ---
  private readonly trackingPort = new NullDeliveryTrackingAdapter();

  async createDelivery(input: CreateDeliveryInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("deliveries")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    const deliveryNumber = `DEL-${Date.now()}`;
    const { data: delivery, error } = await this.db
      .from("deliveries")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId ?? null,
        delivery_number: deliveryNumber,
        sale_id: input.saleId ?? null,
        customer_id: input.customerId ?? null,
        address: input.address ?? null,
        mobile: input.mobile ?? null,
        delivery_boy_user_id: input.deliveryBoyUserId ?? null,
        expected_date: input.expectedDate ?? null,
        instructions: input.instructions ?? null,
        status: "pending",
        notes: input.notes ?? null,
        idempotency_key: input.idempotencyKey,
        device_id: input.deviceId ?? null,
        offline_transaction_id: input.offlineTransactionId ?? null,
        operation_id: input.operationId ?? input.idempotencyKey,
        sync_state: input.offlineTransactionId ? "pending" : "synced",
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    for (const [i, item] of input.items.entries()) {
      await this.db.from("delivery_items").insert({
        organization_id: input.organizationId,
        delivery_id: delivery.id,
        line_no: i + 1,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        unit_id: item.unitId,
        qty: String(item.qty),
      });
    }

    await this.recordDeliveryHistory({
      organizationId: input.organizationId,
      deliveryId: String(delivery.id),
      fromStatus: null,
      toStatus: "pending",
      changedBy: userId,
      reason: "Delivery created",
    });
    await this.db.from("audit_logs").insert(
      buildAuditRow({
        organizationId: input.organizationId,
        branchId: input.branchId,
        actorUserId: userId,
        actorKind: "creator",
        action: "delivery.create",
        entityType: "delivery",
        entityId: String(delivery.id),
        after: { status: "pending", deliveryNumber },
      }),
    );

    return delivery;
  }

  private async recordDeliveryHistory(input: {
    organizationId: string;
    deliveryId: string;
    fromStatus: string | null;
    toStatus: DeliveryStatus;
    changedBy?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await this.db.from("delivery_status_history").insert({
      organization_id: input.organizationId,
      delivery_id: input.deliveryId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      changed_by: input.changedBy ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
  }

  async getDelivery(organizationId: string, deliveryId: string) {
    const { data, error } = await this.db
      .from("deliveries")
      .select("*, delivery_items(*), customers(name,mobile)")
      .eq("id", deliveryId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Delivery not found");
    return data;
  }

  async assignDeliveryBoy(
    organizationId: string,
    deliveryId: string,
    input: AssignDeliveryBoyInput,
    userId?: string | null,
  ) {
    const delivery = await this.getDelivery(organizationId, deliveryId);
    if (delivery.status === "cancelled" || delivery.status === "delivered") {
      throw new ValidationDomainError("Cannot assign delivery boy to a closed delivery");
    }
    const { data, error } = await this.db
      .from("deliveries")
      .update({
        delivery_boy_user_id: input.deliveryBoyUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deliveryId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) throw error;
    await this.db.from("audit_logs").insert(
      buildAuditRowForDeliveryAssign({
        organizationId,
        branchId: String(delivery.branch_id),
        deliveryId,
        actorUserId: userId,
        deliveryBoyUserId: input.deliveryBoyUserId,
      }),
    );
    return data;
  }

  async advanceDelivery(
    organizationId: string,
    deliveryId: string,
    input: AdvanceDeliveryInput,
    userId?: string | null,
  ) {
    const { data: delivery, error } = await this.db
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .eq("organization_id", organizationId)
      .single();
    if (error) throw error;
    const from = delivery.status as DeliveryStatus;
    const to = input.status;
    assertDeliveryTransition(from, to);
    const patch: Row = { status: to, updated_at: new Date().toISOString() };
    const tsField = deliveryStatusTimestampField(to);
    if (tsField) patch[tsField] = new Date().toISOString();
    const { data: updated, error: updErr } = await this.db
      .from("deliveries")
      .update(patch)
      .eq("id", deliveryId)
      .select("*")
      .single();
    if (updErr) throw updErr;

    await this.recordDeliveryHistory({
      organizationId,
      deliveryId,
      fromStatus: from,
      toStatus: to,
      changedBy: userId,
      reason: input.reason ?? null,
    });
    await this.db.from("audit_logs").insert(
      buildDeliveryStatusAudit({
        organizationId,
        branchId: String(delivery.branch_id),
        deliveryId,
        actorUserId: userId,
        fromStatus: from,
        toStatus: to,
        reason: input.reason,
      }),
    );
    return updated;
  }

  async listDeliveries(organizationId: string, branchId?: string) {
    let q = this.db
      .from("deliveries")
      .select("*, customers(name,mobile)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async searchDeliveries(input: DeliveryListFilterInput) {
    let q = this.db
      .from("deliveries")
      .select("*, customers(name,mobile)", { count: "exact" })
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: false });
    if (input.branchId) q = q.eq("branch_id", input.branchId);
    if (input.status) q = q.eq("status", input.status);
    if (input.deliveryBoyUserId) q = q.eq("delivery_boy_user_id", input.deliveryBoyUserId);
    if (input.dateFrom) q = q.gte("created_at", input.dateFrom);
    if (input.dateTo) q = q.lte("created_at", `${input.dateTo}T23:59:59.999Z`);
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const { data, error, count } = await q.range(offset, offset + limit - 1);
    if (error) throw error;
    return { items: data ?? [], total: count ?? 0, limit, offset };
  }

  async getDeliveryHistory(organizationId: string, deliveryId: string) {
    const { data, error } = await this.db
      .from("delivery_status_history")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("delivery_id", deliveryId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getDeliveryTracking(organizationId: string, deliveryId: string) {
    const delivery = await this.getDelivery(organizationId, deliveryId);
    const snapshot = await resolveTrackingSnapshot({
      trackingConfigured: Boolean(delivery.tracking_configured),
      trackingProvider: delivery.tracking_provider as string | null,
      trackingReference: delivery.tracking_reference as string | null,
      port: this.trackingPort,
      deliveryId,
    });
    const history = await this.trackingPort.getLocationHistory(deliveryId);
    return { snapshot, locationHistory: history, statusHistory: await this.getDeliveryHistory(organizationId, deliveryId) };
  }

  async deliveryReports(organizationId: string, branchId?: string) {
    let q = this.db
      .from("deliveries")
      .select(
        "id,delivery_number,status,delivery_boy_user_id,created_at,dispatched_at,delivered_at,packed_at,in_transit_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;

    const boyIds = [
      ...new Set((data ?? []).map((d) => d.delivery_boy_user_id).filter(Boolean).map(String)),
    ];
    const names = new Map<string, string>();
    if (boyIds.length) {
      const { data: profiles } = await this.db
        .from("user_profiles")
        .select("id,full_name,email")
        .in("id", boyIds);
      for (const p of profiles ?? []) {
        names.set(String(p.id), String(p.full_name ?? p.email ?? p.id));
      }
    }

    const rows: DeliveryReportRow[] = (data ?? []).map((d) => ({
      id: String(d.id),
      deliveryNumber: String(d.delivery_number),
      status: d.status as DeliveryStatus,
      deliveryBoyUserId: d.delivery_boy_user_id ? String(d.delivery_boy_user_id) : null,
      deliveryBoyName: d.delivery_boy_user_id
        ? names.get(String(d.delivery_boy_user_id))
        : null,
      createdAt: String(d.created_at),
      dispatchedAt: d.dispatched_at ? String(d.dispatched_at) : null,
      deliveredAt: d.delivered_at ? String(d.delivered_at) : null,
      packedAt: d.packed_at ? String(d.packed_at) : null,
      inTransitAt: d.in_transit_at ? String(d.in_transit_at) : null,
    }));
    return summarizeDeliveryReports(rows);
  }

  private buildPurchasePorts(userId?: string | null) {
    const db = this.db;
    const inventory = this.inventory;
    const parties = this.parties;
    const self = this;

    return {
      async findByIdempotency(organizationId: string, key: string) {
        const { data } = await db
          .from("purchases")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("idempotency_key", key)
          .maybeSingle();
        return data;
      },
      async postPurchaseRecord(payload: Record<string, unknown>) {
        const { data, error } = await db.from("purchases").insert(payload).select("*").single();
        if (error) throw error;
        return { id: String(data.id), invoiceNumber: String(data.invoice_number) };
      },
      async postPurchaseItems(_purchaseId: string, items: Array<Record<string, unknown>>) {
        const { error } = await db.from("purchase_items").insert(items);
        if (error) throw error;
      },
      async postStockPurchase(input: {
        organizationId: string;
        branchId: string;
        warehouseId: string;
        productId: string;
        unitId: string;
        qty: string;
        unitCost: string;
        purchaseId: string;
        operationId: string;
      }) {
        await inventory.postMovement(
          {
            organizationId: input.organizationId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId: input.productId,
            unitId: input.unitId,
            movementType: "purchase",
            qtyDelta: input.qty,
            unitCost: input.unitCost,
            sourceType: "purchase",
            sourceId: input.purchaseId,
            operationId: input.operationId,
          },
          userId,
        );
      },
      async postSupplierLedger(input: {
        organizationId: string;
        branchId: string;
        supplierId: string;
        amount: string;
        purchaseId: string;
      }) {
        await parties.postSupplierLedger({
          organizationId: input.organizationId,
          branchId: input.branchId,
          supplierId: input.supplierId,
          entryType: "purchase",
          amount: input.amount,
          sourceType: "purchase",
          sourceId: input.purchaseId,
          description: `Purchase ${input.purchaseId}`,
          userId,
        });
      },
      async postSupplierPayment(input: Record<string, unknown>) {
        if (!input.paymentMethodId || !input.amount) return;
        await parties.postSplitPayment(
          {
            organizationId: String(input.organizationId),
            branchId: String(input.branchId),
            direction: "pay",
            partyType: "supplier",
            supplierId: String(input.supplierId),
            splits: [
              {
                paymentMethodId: String(input.paymentMethodId),
                amount: String(input.amount),
              },
            ],
            billTotal: String(input.amount),
            idempotencyKey: String(input.idempotencyKey),
            sourceType: "purchase",
            sourceId: String(input.purchaseId),
          },
          userId,
        );
      },
      async getSupplierPrice(input: {
        organizationId: string;
        supplierId: string;
        productId: string;
        variantId?: string | null;
      }) {
        let q = db
          .from("supplier_product_prices")
          .select("*")
          .eq("organization_id", input.organizationId)
          .eq("supplier_id", input.supplierId)
          .eq("product_id", input.productId);
        q = input.variantId ? q.eq("variant_id", input.variantId) : q.is("variant_id", null);
        const { data } = await q.maybeSingle();
        if (!data) return null;
        return {
          lastPurchaseRate: Number(data.last_purchase_rate),
          averagePurchaseRate: Number(data.average_purchase_rate),
          supplierPrice: Number(data.supplier_price),
          purchaseCount: Number(data.purchase_count),
        };
      },
      async upsertSupplierPrice(input: Record<string, unknown>) {
        const { data: existing } = await db
          .from("supplier_product_prices")
          .select("id")
          .eq("organization_id", input.organization_id)
          .eq("supplier_id", input.supplier_id)
          .eq("product_id", input.product_id)
          .is("variant_id", input.variant_id ?? null)
          .maybeSingle();
        if (existing) {
          const { error } = await db
            .from("supplier_product_prices")
            .update({
              last_purchase_rate: input.last_purchase_rate,
              average_purchase_rate: input.average_purchase_rate,
              supplier_price: input.supplier_price,
              purchase_count: input.purchase_count,
              last_purchase_at: input.last_purchase_at,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (error) throw error;
          return;
        }
        const { error } = await db.from("supplier_product_prices").insert(input);
        if (error) throw error;
      },
      async postPriceHistory(input: Record<string, unknown>) {
        const { error } = await db.from("supplier_price_history").insert(input);
        if (error) throw error;
      },
      async postJournal(input: Record<string, unknown>) {
        await self.ensureAndPostJournal(input as never);
      },
    };
  }

  private async ensureAndPostJournal(input: {
    organizationId: string;
    branchId?: string;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    memo: string;
    lines: Array<{
      code: string;
      name: string;
      accountType: string;
      systemRole?: string;
      debit: number;
      credit: number;
    }>;
  }) {
    const { data: existing } = await this.db
      .from("journal_entries")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    const accountIds: string[] = [];
    for (const line of input.lines) {
      const { data: acc } = await this.db
        .from("accounts")
        .upsert(
          {
            organization_id: input.organizationId,
            code: line.code,
            name: line.name,
            account_type: line.accountType,
            system_role: line.systemRole ?? null,
            is_system: true,
          },
          { onConflict: "organization_id,code" },
        )
        .select("id")
        .single();
      accountIds.push(String(acc?.id));
    }

    const { data: entry, error } = await this.db
      .from("journal_entries")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId ?? null,
        entry_number: `JE-${Date.now()}`,
        entry_date: new Date().toISOString().slice(0, 10),
        memo: input.memo,
        source_type: input.sourceType,
        source_id: input.sourceId,
        status: "posted",
        idempotency_key: input.idempotencyKey,
      })
      .select("*")
      .single();
    if (error) throw error;

    const lines = input.lines.map((l, i) => ({
      organization_id: input.organizationId,
      journal_entry_id: entry.id,
      account_id: accountIds[i],
      debit: l.debit,
      credit: l.credit,
    }));
    const { error: lineErr } = await this.db.from("journal_entry_lines").insert(lines);
    if (lineErr) throw lineErr;
    return entry;
  }
}

function buildAuditRowForDeliveryAssign(input: {
  organizationId: string;
  branchId: string;
  deliveryId: string;
  actorUserId?: string | null;
  deliveryBoyUserId: string;
}) {
  return buildAuditRow({
    organizationId: input.organizationId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    actorKind: "editor",
    action: "delivery.assign",
    entityType: "delivery",
    entityId: input.deliveryId,
    after: { deliveryBoyUserId: input.deliveryBoyUserId },
  });
}
