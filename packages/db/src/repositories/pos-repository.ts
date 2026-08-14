import type {
  CreateSaleInput,
  CreateSaleReturnInput,
  ProductSearchQuery,
  ProductSearchResult,
  Sale,
  SaleListFilterInput,
  SaleListResponse,
  SaleManagementTab,
} from "@electronic-erp/contracts";
import {
  assertHoldActionAllowed,
  assertHoldCartNonEmpty,
  adjustCommissionForReturn,
  buildSaleReturnAuditRow,
  buildSaleReturnJournalLines,
  cartLinesForResume,
  computeHoldExpiresAt,
  filterHeldSales,
  holdMustNotReduceInventory,
  maxReturnableQty,
  prepareSaleReturn,
  refundSettlementPlan,
  SaleTransactionService,
  saleReturnStockMovementOperationId,
  statusAfterExpiry,
  summarizeReturnHistory,
  summarizeSaleManagement,
  ValidationDomainError,
  type CommissionRecord,
  type HeldSaleFilter,
  type HeldSaleRecord,
  type ReturnableLine,
  type ReturnCondition,
  type ReturnReasonCode,
  type ReturnScope,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";
import { InventoryRepository } from "./inventory-repository.js";
import { PartiesRepository } from "./parties-repository.js";

type Row = Record<string, unknown>;

export class PosRepository {
  private readonly inventory: InventoryRepository;
  private readonly parties: PartiesRepository;

  constructor(private readonly db: DatabaseClient) {
    this.inventory = new InventoryRepository(db);
    this.parties = new PartiesRepository(db);
  }

  async searchProducts(
    organizationId: string,
    query: ProductSearchQuery,
  ): Promise<ProductSearchResult[]> {
    const q = query.q.trim();
    const productSelect =
      "id,name,name_ur,sku,base_unit_id,retail_price,wholesale_price,dealer_price,warranty_days,brand_id,company_id,category_id,model_id";
    const { data: products, error } = await this.db
      .from("products")
      .select(productSelect)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .or(`name.ilike.%${q}%,name_ur.ilike.%${q}%,sku.ilike.%${q}%`)
      .limit(query.limit ?? 20);
    if (error) throw error;

    // Barcode + QR codes
    const { data: barcodes } = await this.db
      .from("barcodes")
      .select("product_id,code")
      .eq("organization_id", organizationId)
      .ilike("code", `%${q}%`)
      .limit(20);
    const { data: qrs } = await this.db
      .from("qr_codes")
      .select("product_id,payload")
      .eq("organization_id", organizationId)
      .ilike("payload", `%${q}%`)
      .limit(20);

    // Taxonomy / attribute name matches → product ids
    const taxonomyIds: string[] = [];
    for (const table of ["brands", "companies", "categories", "product_models"] as const) {
      const { data } = await this.db
        .from(table)
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("name", `%${q}%`)
        .limit(20);
      for (const row of data ?? []) taxonomyIds.push(String(row.id));
    }
    const numericQ = Number(q);
    let specsQuery = this.db
      .from("product_specifications")
      .select("product_id,size,color,watt,voltage,ampere")
      .or(`size.ilike.%${q}%,color.ilike.%${q}%,material.ilike.%${q}%,gauge.ilike.%${q}%,model_label.ilike.%${q}%`)
      .limit(30);
    if (Number.isFinite(numericQ)) {
      specsQuery = this.db
        .from("product_specifications")
        .select("product_id,size,color,watt,voltage,ampere")
        .or(
          `size.ilike.%${q}%,color.ilike.%${q}%,watt.eq.${numericQ},voltage.eq.${numericQ},ampere.eq.${numericQ}`,
        )
        .limit(30);
    }
    const { data: specs } = await specsQuery;

    let taxonomyProducts: Row[] = [];
    if (taxonomyIds.length) {
      const { data } = await this.db
        .from("products")
        .select(productSelect)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .or(
          [
            `brand_id.in.(${taxonomyIds.join(",")})`,
            `company_id.in.(${taxonomyIds.join(",")})`,
            `category_id.in.(${taxonomyIds.join(",")})`,
            `model_id.in.(${taxonomyIds.join(",")})`,
          ].join(","),
        )
        .limit(query.limit ?? 20);
      taxonomyProducts = (data ?? []) as Row[];
    }

    const byId = new Map<string, Row>();
    for (const p of products ?? []) byId.set(String(p.id), p as Row);
    for (const p of taxonomyProducts) byId.set(String(p.id), p);
    for (const s of specs ?? []) {
      if (!byId.has(String(s.product_id))) {
        const { data: p } = await this.db
          .from("products")
          .select(productSelect)
          .eq("id", s.product_id)
          .maybeSingle();
        if (p) byId.set(String(p.id), p as Row);
      }
    }

    const codeHits: Array<{ product_id: string; code: string }> = [
      ...(barcodes ?? []).map((b) => ({ product_id: String(b.product_id), code: String(b.code) })),
      ...(qrs ?? []).map((b) => ({
        product_id: String(b.product_id),
        code: String((b as { payload?: string }).payload ?? ""),
      })),
    ];
    for (const b of codeHits) {
      if (!byId.has(String(b.product_id))) {
        const { data: p } = await this.db
          .from("products")
          .select(productSelect)
          .eq("id", b.product_id)
          .maybeSingle();
        if (p) byId.set(String(p.id), { ...p, _barcode: b.code } as Row);
      } else {
        byId.set(String(b.product_id), { ...byId.get(String(b.product_id))!, _barcode: b.code });
      }
    }

    const results: ProductSearchResult[] = [];
    for (const row of byId.values()) {
      let stockAvailable: string | undefined;
      if (query.warehouseId) {
        const balances = await this.inventory.listBalances(organizationId, {
          warehouseId: query.warehouseId,
          productId: String(row.id),
        });
        stockAvailable = balances[0]?.qtyAvailable ?? "0";
      }

      const { data: brand } = row.brand_id
        ? await this.db.from("brands").select("name").eq("id", row.brand_id).maybeSingle()
        : { data: null };
      const { data: company } = row.company_id
        ? await this.db.from("companies").select("name").eq("id", row.company_id).maybeSingle()
        : { data: null };
      const { data: category } = row.category_id
        ? await this.db.from("categories").select("name").eq("id", row.category_id).maybeSingle()
        : { data: null };
      const { data: model } = row.model_id
        ? await this.db.from("product_models").select("name").eq("id", row.model_id).maybeSingle()
        : { data: null };
      const { data: spec } = await this.db
        .from("product_specifications")
        .select("size,color,watt,voltage,ampere")
        .eq("product_id", row.id)
        .maybeSingle();
      const { data: unit } = await this.db
        .from("units")
        .select("name,symbol_places")
        .eq("id", row.base_unit_id)
        .maybeSingle();

      results.push({
        productId: String(row.id),
        name: String(row.name),
        nameUr: (row.name_ur as string | null) ?? null,
        sku: String(row.sku),
        barcode: (row._barcode as string | null) ?? null,
        brand: brand?.name ?? null,
        company: company?.name ?? null,
        category: category?.name ?? null,
        model: model?.name ?? null,
        size: (spec?.size as string | null) ?? null,
        color: (spec?.color as string | null) ?? null,
        watt: spec?.watt != null ? String(spec.watt) : null,
        voltage: spec?.voltage != null ? String(spec.voltage) : null,
        ampere: spec?.ampere != null ? String(spec.ampere) : null,
        unitId: String(row.base_unit_id),
        unitName: unit?.name ?? null,
        unitSymbolPlaces: Number(unit?.symbol_places ?? 0),
        ...(stockAvailable != null ? { stockAvailable } : {}),
        retailPrice: Number(row.retail_price ?? 0),
        wholesalePrice: Number(row.wholesale_price ?? 0),
        dealerPrice: Number(row.dealer_price ?? 0),
        warrantyDays: Number(row.warranty_days ?? 0),
      });
    }
    // Prefer exact barcode/SKU matches first for enter-to-add / scanner UX
    const qLower = q.toLowerCase();
    results.sort((a, b) => {
      const score = (r: (typeof results)[0]) => {
        if (r.barcode && r.barcode.toLowerCase() === qLower) return 0;
        if (r.sku.toLowerCase() === qLower) return 1;
        if (r.barcode && r.barcode.toLowerCase().includes(qLower)) return 2;
        return 3;
      };
      return score(a) - score(b);
    });
    return results.slice(0, query.limit ?? 20);
  }

  async postSale(input: CreateSaleInput, userId?: string | null) {
    const service = new SaleTransactionService(this.buildPorts(userId));
    return service.postSale(input, userId);
  }

  async holdSale(input: {
    organizationId: string;
    branchId: string;
    warehouseId: string;
    holdLabel?: string;
    holdReason?: string;
    notes?: string;
    customerId?: string | null;
    cartSnapshot: Record<string, unknown>;
    deviceId?: string;
    userId?: string | null;
    expiresAt?: string;
  }) {
    assertHoldCartNonEmpty(input.cartSnapshot);
    // Invariant: hold parks snapshot only — never inserts sale_items or stock movements.
    void holdMustNotReduceInventory();

    const heldAt = new Date().toISOString();
    const expiresAt = input.expiresAt ?? computeHoldExpiresAt(heldAt);
    const customerId =
      input.customerId ??
      (typeof input.cartSnapshot.customerId === "string" && input.cartSnapshot.customerId
        ? String(input.cartSnapshot.customerId)
        : null);
    const invoiceNumber = `HOLD-${Date.now()}`;
    const { data: sale, error } = await this.db
      .from("sales")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        invoice_number: invoiceNumber,
        status: "held",
        customer_id: customerId,
        notes: input.notes ?? null,
        held_at: heldAt,
        idempotency_key: crypto.randomUUID(),
        device_id: input.deviceId ?? null,
        created_by: input.userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const { data: held, error: heldErr } = await this.db
      .from("held_sales")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        sale_id: sale.id,
        hold_label: input.holdLabel ?? invoiceNumber,
        hold_reason: input.holdReason ?? null,
        notes: input.notes ?? null,
        customer_id: customerId,
        held_by: input.userId ?? null,
        cart_snapshot: input.cartSnapshot,
        device_id: input.deviceId ?? null,
        held_at: heldAt,
        expires_at: expiresAt,
        status: "held",
      })
      .select("*")
      .single();
    if (heldErr) throw heldErr;
    return { sale: mapSale(sale), held: mapHeldSale(held) };
  }

  async listHeldSales(
    organizationId: string,
    branchId: string,
    opts: {
      filter?: HeldSaleFilter;
      userId?: string | null;
      resumeAny?: boolean;
      applyExpiry?: boolean;
    } = {},
  ) {
    if (opts.applyExpiry !== false) {
      await this.expireDueHolds(organizationId, branchId);
    }

    const { data, error } = await this.db
      .from("held_sales")
      .select("*, sales(*)")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .in("status", ["held", "expired"])
      .order("held_at", { ascending: false });
    if (error) throw error;

    const records = (data ?? []).map((row) => mapHeldSale(row));
    const filter = opts.filter ?? "all_pending";
    return filterHeldSales(records, filter, { userId: opts.userId, now: new Date() });
  }

  async expireDueHolds(organizationId: string, branchId?: string) {
    const nowIso = new Date().toISOString();
    let q = this.db
      .from("held_sales")
      .select("id,sale_id,expires_at,status")
      .eq("organization_id", organizationId)
      .eq("status", "held")
      .not("expires_at", "is", null)
      .lte("expires_at", nowIso);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    const due = data ?? [];
    for (const row of due) {
      await this.db
        .from("held_sales")
        .update({
          status: statusAfterExpiry(),
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("status", "held");
      await this.db
        .from("sales")
        .update({ status: "void", updated_at: nowIso, notes: "Hold expired" })
        .eq("id", row.sale_id)
        .eq("status", "held");
    }
    return due.length;
  }

  async resumeHeldSale(
    heldId: string,
    opts: {
      actorUserId?: string | null;
      resumeAny?: boolean;
      checkout?: boolean;
    } = {},
  ) {
    const held = await this.getHeldSaleOrThrow(heldId);
    assertHoldActionAllowed(held, opts.checkout ? "resume_and_checkout" : "resume", {
      actorUserId: opts.actorUserId,
      resumeAny: opts.resumeAny,
    });
    // Resume restores snapshot via replaceCart on client — never appends (no duplicate lines).
    const cart = cartLinesForResume(held.cartSnapshot);

    const nowIso = new Date().toISOString();
    const { data, error } = await this.db
      .from("held_sales")
      .update({ status: "resumed", resumed_at: nowIso, updated_at: nowIso })
      .eq("id", heldId)
      .eq("status", "held")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Held bill not found or already closed");

    await this.db
      .from("sales")
      .update({ status: "draft", updated_at: nowIso })
      .eq("id", held.saleId)
      .eq("status", "held");

    return {
      ...mapHeldSale(data),
      cartLines: cart,
      checkout: Boolean(opts.checkout),
    };
  }

  async editHeldSale(
    heldId: string,
    input: {
      holdLabel?: string;
      holdReason?: string;
      notes?: string;
      customerId?: string | null;
      cartSnapshot?: Record<string, unknown>;
      expiresAt?: string;
      actorUserId?: string | null;
      resumeAny?: boolean;
    },
  ) {
    const held = await this.getHeldSaleOrThrow(heldId);
    assertHoldActionAllowed(held, "edit", {
      actorUserId: input.actorUserId,
      resumeAny: input.resumeAny,
    });
    if (input.cartSnapshot) assertHoldCartNonEmpty(input.cartSnapshot);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.holdLabel !== undefined) patch.hold_label = input.holdLabel;
    if (input.holdReason !== undefined) patch.hold_reason = input.holdReason;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.customerId !== undefined) patch.customer_id = input.customerId;
    if (input.cartSnapshot !== undefined) patch.cart_snapshot = input.cartSnapshot;
    if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt;

    const { data, error } = await this.db
      .from("held_sales")
      .update(patch)
      .eq("id", heldId)
      .eq("status", "held")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Held bill not found");

    if (input.customerId !== undefined || input.notes !== undefined) {
      const salePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.customerId !== undefined) salePatch.customer_id = input.customerId;
      if (input.notes !== undefined) salePatch.notes = input.notes;
      await this.db.from("sales").update(salePatch).eq("id", held.saleId);
    }
    return mapHeldSale(data);
  }

  async duplicateHeldSale(
    heldId: string,
    opts: { actorUserId?: string | null; deviceId?: string | null; warehouseId: string },
  ) {
    const held = await this.getHeldSaleOrThrow(heldId);
    assertHoldActionAllowed(held, "duplicate", { actorUserId: opts.actorUserId, resumeAny: true });
    return this.holdSale({
      organizationId: held.organizationId,
      branchId: held.branchId,
      warehouseId: opts.warehouseId,
      holdLabel: held.holdLabel ? `${held.holdLabel} (copy)` : `Hold copy ${new Date().toLocaleTimeString()}`,
      holdReason: held.holdReason ?? undefined,
      notes: held.notes ?? undefined,
      customerId: held.customerId,
      cartSnapshot: { ...held.cartSnapshot },
      deviceId: opts.deviceId ?? held.deviceId ?? undefined,
      userId: opts.actorUserId,
    });
  }

  async transferHeldSale(
    heldId: string,
    input: {
      toUserId: string;
      branchId?: string;
      actorUserId?: string | null;
      resumeAny?: boolean;
    },
  ) {
    const held = await this.getHeldSaleOrThrow(heldId);
    assertHoldActionAllowed(held, "transfer", {
      actorUserId: input.actorUserId,
      resumeAny: input.resumeAny,
    });
    const patch: Record<string, unknown> = {
      held_by: input.toUserId,
      transferred_to: input.toUserId,
      updated_at: new Date().toISOString(),
    };
    if (input.branchId) patch.branch_id = input.branchId;

    const { data, error } = await this.db
      .from("held_sales")
      .update(patch)
      .eq("id", heldId)
      .eq("status", "held")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Held bill not found");

    if (input.branchId) {
      await this.db
        .from("sales")
        .update({ branch_id: input.branchId, updated_at: new Date().toISOString() })
        .eq("id", held.saleId);
    }
    return mapHeldSale(data);
  }

  async cancelHeldSale(
    heldId: string,
    opts: { actorUserId?: string | null; resumeAny?: boolean; reason?: string } = {},
  ) {
    const held = await this.getHeldSaleOrThrow(heldId);
    assertHoldActionAllowed(held, "cancel", {
      actorUserId: opts.actorUserId,
      resumeAny: opts.resumeAny,
    });
    const nowIso = new Date().toISOString();
    const { data, error } = await this.db
      .from("held_sales")
      .update({
        status: "cancelled",
        cancelled_at: nowIso,
        notes: opts.reason ?? held.notes,
        updated_at: nowIso,
      })
      .eq("id", heldId)
      .eq("status", "held")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Held bill not found");

    await this.db
      .from("sales")
      .update({ status: "void", updated_at: nowIso, notes: opts.reason ?? "Hold cancelled" })
      .eq("id", held.saleId)
      .eq("status", "held");

    return mapHeldSale(data);
  }

  async discardHeldSale(
    heldId: string,
    opts: { actorUserId?: string | null; resumeAny?: boolean } = {},
  ) {
    const held = await this.getHeldSaleOrThrow(heldId);
    assertHoldActionAllowed(held, "discard", {
      actorUserId: opts.actorUserId,
      resumeAny: opts.resumeAny,
    });
    const nowIso = new Date().toISOString();
    const { data, error } = await this.db
      .from("held_sales")
      .update({
        status: "discarded",
        discarded_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", heldId)
      .in("status", ["held", "expired"])
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Held bill not found");

    await this.db
      .from("sales")
      .update({ status: "void", updated_at: nowIso, notes: "Hold discarded" })
      .eq("id", held.saleId);

    return mapHeldSale(data);
  }

  private async getHeldSaleOrThrow(heldId: string) {
    const { data, error } = await this.db.from("held_sales").select("*").eq("id", heldId).single();
    if (error) throw error;
    if (!data) throw new ValidationDomainError("Held bill not found");
    return mapHeldSale(data);
  }

  async getReturnableSale(saleId: string) {
    const invoice = await this.getInvoice(saleId);
    const { data: items } = await this.db
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleId)
      .order("line_no");
    const { data: priorReturns } = await this.db
      .from("sale_returns")
      .select("id")
      .eq("original_sale_id", saleId)
      .eq("status", "posted");
    const returnIds = (priorReturns ?? []).map((r) => String(r.id));
    let prior: Array<Row> = [];
    if (returnIds.length) {
      const { data } = await this.db
        .from("sale_return_items")
        .select("original_sale_item_id,qty")
        .in("sale_return_id", returnIds);
      prior = (data ?? []) as Array<Row>;
    }

    const returnedByItem = new Map<string, number>();
    for (const row of prior ?? []) {
      const id = row.original_sale_item_id ? String(row.original_sale_item_id) : "";
      if (!id) continue;
      returnedByItem.set(id, (returnedByItem.get(id) ?? 0) + Number(row.qty ?? 0));
    }

    const returnable: ReturnableLine[] = (items ?? []).map((i) => {
      const soldQty = Number(i.qty);
      const previouslyReturnedQty = returnedByItem.get(String(i.id)) ?? 0;
      return {
        saleItemId: String(i.id),
        productId: i.product_id ? String(i.product_id) : null,
        unitId: String(i.unit_id),
        soldQty,
        previouslyReturnedQty,
        unitPrice: Number(i.unit_price),
        batchId: i.batch_id ? String(i.batch_id) : null,
      };
    });

    return {
      ...invoice,
      returnableLines: returnable.map((r) => {
        const invItem = (invoice.items as Array<Record<string, unknown>>).find(
          (it) => String(it.id) === r.saleItemId,
        );
        return {
          ...r,
          name: invItem ? String(invItem.name) : r.saleItemId,
          maxReturnable: maxReturnableQty(r.soldQty, r.previouslyReturnedQty),
        };
      }),
    };
  }

  async searchSalesForReturn(input: {
    organizationId: string;
    branchId?: string;
    invoiceNumber?: string;
    customerQuery?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) {
    let q = this.db
      .from("sales")
      .select("*, customers(name,mobile)")
      .eq("organization_id", input.organizationId)
      .in("status", ["posted", "returned", "exchanged"])
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 50);
    if (input.branchId) q = q.eq("branch_id", input.branchId);
    if (input.invoiceNumber?.trim()) {
      q = q.ilike("invoice_number", `%${input.invoiceNumber.trim()}%`);
    }
    if (input.dateFrom) q = q.gte("created_at", input.dateFrom);
    if (input.dateTo) q = q.lte("created_at", `${input.dateTo}T23:59:59.999Z`);
    const { data, error } = await q;
    if (error) throw error;

    let rows = data ?? [];
    const cq = input.customerQuery?.trim().toLowerCase();
    if (cq) {
      rows = rows.filter((r) => {
        const c = r.customers as { name?: string; mobile?: string } | null;
        const name = String(c?.name ?? "").toLowerCase();
        const mobile = String(c?.mobile ?? "").toLowerCase();
        return name.includes(cq) || mobile.includes(cq) || mobile.replace(/\D/g, "").includes(cq.replace(/\D/g, ""));
      });
    }
    return rows.map((r) => {
      const c = r.customers as { name?: string; mobile?: string } | null;
      return {
        ...mapSale(r),
        customerName: c?.name ?? null,
        customerMobile: c?.mobile ?? null,
      };
    });
  }

  async listReturns(
    organizationId: string,
    opts: { branchId?: string; originalSaleId?: string; limit?: number } = {},
  ) {
    let q = this.db
      .from("sale_returns")
      .select("*, sale_return_items(*)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 100);
    if (opts.branchId) q = q.eq("branch_id", opts.branchId);
    if (opts.originalSaleId) q = q.eq("original_sale_id", opts.originalSaleId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async returnHistoryReport(
    organizationId: string,
    opts: { branchId?: string; dateFrom?: string; dateTo?: string } = {},
  ) {
    let q = this.db
      .from("sale_returns")
      .select("refund_amount,return_type,return_scope,reason_code,status,created_at")
      .eq("organization_id", organizationId)
      .eq("status", "posted");
    if (opts.branchId) q = q.eq("branch_id", opts.branchId);
    if (opts.dateFrom) q = q.gte("created_at", opts.dateFrom);
    if (opts.dateTo) q = q.lte("created_at", `${opts.dateTo}T23:59:59.999Z`);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []).map((r) => ({
      refundAmount: Number(r.refund_amount ?? 0),
      disposition: String(r.return_type),
      scope: String(r.return_scope ?? "partial"),
      reasonCode: (r.reason_code as string | null) ?? null,
    }));
    return {
      summary: summarizeReturnHistory(rows),
      items: data ?? [],
    };
  }

  async postReturn(input: CreateSaleReturnInput, userId?: string | null) {
    const { data: original, error: saleErr } = await this.db
      .from("sales")
      .select("*")
      .eq("id", input.originalSaleId)
      .single();
    if (saleErr) throw saleErr;
    if (!original || !["posted", "returned", "exchanged"].includes(String(original.status))) {
      throw new ValidationDomainError("Original sale is not eligible for return");
    }

    const { data: existing } = await this.db
      .from("sale_returns")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      await this.completeReturnSettlement({
        organizationId: input.organizationId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        returnRow: existing,
        original,
        idempotencyKey: input.idempotencyKey,
        userId,
        deviceId: input.deviceId,
      });
      return existing;
    }

    const returnableCtx = await this.getReturnableSale(input.originalSaleId);
    const prepared = prepareSaleReturn({
      disposition: input.returnType,
      scope: input.returnScope as ReturnScope | undefined,
      reasonCode: (input.reasonCode ?? "other") as ReturnReasonCode,
      reasonDetail: input.reason,
      refundMethod: input.refundMethod,
      hasCustomer: Boolean(original.customer_id),
      returnable: returnableCtx.returnableLines,
      lines: input.items.map((i) => ({
        originalSaleItemId: String(i.originalSaleItemId),
        productId: i.productId,
        unitId: i.unitId,
        qty: Number(i.qty),
        unitPrice: i.unitPrice,
        exchangeProductId: i.exchangeProductId,
        condition: (i.condition ?? "good") as ReturnCondition,
        originalPackaging: i.originalPackaging ?? true,
        accessoriesComplete: i.accessoriesComplete ?? true,
        inspectionNotes: i.inspectionNotes,
        batchId: i.batchId,
      })),
    });

    const nowIso = new Date().toISOString();
    const { data: ret, error } = await this.db
      .from("sale_returns")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        original_sale_id: input.originalSaleId,
        return_type: prepared.disposition,
        return_scope: prepared.scope,
        reason: prepared.reason,
        reason_code: prepared.reasonCode,
        refund_method: prepared.refundMethod,
        refund_amount: prepared.refundAmount,
        confirmation_notes: input.confirmationNotes ?? null,
        status: "posted",
        posted_at: nowIso,
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

    for (const item of prepared.lines) {
      await this.db.from("sale_return_items").insert({
        organization_id: input.organizationId,
        sale_return_id: ret.id,
        original_sale_item_id: item.originalSaleItemId,
        product_id: item.productId ?? null,
        unit_id: item.unitId,
        qty: String(item.qty),
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        exchange_product_id: item.exchangeProductId ?? null,
        condition: item.condition,
        original_packaging: item.originalPackaging,
        accessories_complete: item.accessoriesComplete,
        inspection_notes: item.inspectionNotes ?? null,
        batch_id: item.batchId ?? null,
        restock_target: item.restockTarget,
        restocked: item.restock,
      });

      if (item.productId && item.restock) {
        // Same rule as sale stock lines: operation_id is uuid — never string-concat UUIDs.
        const returnOpIn = saleReturnStockMovementOperationId(
          input.idempotencyKey,
          item.originalSaleItemId,
          "in",
        );
        await this.inventory.postMovement(
          {
            organizationId: input.organizationId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId: item.productId,
            unitId: item.unitId,
            movementType: "sale_return",
            qtyDelta: String(item.qty),
            sourceType: "sale_return",
            sourceId: String(ret.id),
            operationId: returnOpIn,
            batchId: item.batchId ?? undefined,
            reason: prepared.reason,
          },
          userId,
        );
        if (item.restockTarget === "damaged") {
          const returnOpDmg = saleReturnStockMovementOperationId(
            input.idempotencyKey,
            item.originalSaleItemId,
            "dmg",
          );
          await this.inventory.postMovement(
            {
              organizationId: input.organizationId,
              branchId: input.branchId,
              warehouseId: input.warehouseId,
              productId: item.productId,
              unitId: item.unitId,
              movementType: "damage",
              qtyDelta: String(item.qty),
              sourceType: "sale_return",
              sourceId: String(ret.id),
              operationId: returnOpDmg,
              batchId: item.batchId ?? undefined,
              reason: `Return inspection: ${item.condition}`,
            },
            userId,
          );
        }
      }

      if (prepared.disposition === "exchange" && item.exchangeProductId) {
        await this.inventory.postMovement(
          {
            organizationId: input.organizationId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId: item.exchangeProductId,
            unitId: item.unitId,
            movementType: "sale",
            qtyDelta: String(item.qty),
            sourceType: "sale_return",
            sourceId: String(ret.id),
            operationId: saleReturnStockMovementOperationId(
              input.idempotencyKey,
              item.originalSaleItemId,
              "ex",
              item.exchangeProductId,
            ),
            reason: `Exchange for return ${ret.id}`,
          },
          userId,
        );
      }
    }

    // Refund settlement (payments + ledger). Journal is idempotent by return key.
    await this.settleReturnRefund({
      organizationId: input.organizationId,
      branchId: input.branchId,
      returnId: String(ret.id),
      customerId: original.customer_id ? String(original.customer_id) : null,
      disposition: prepared.disposition,
      refundMethod: prepared.refundMethod,
      refundAmount: prepared.refundAmount,
      idempotencyKey: input.idempotencyKey,
      userId,
      deviceId: input.deviceId,
      reason: prepared.reason,
    });

    // Sale status: full return → returned/exchanged; partial keeps posted unless already returned
    if (prepared.scope === "full") {
      await this.db
        .from("sales")
        .update({
          status: prepared.disposition === "exchange" ? "exchanged" : "returned",
          payment_status:
            prepared.disposition === "refund" || prepared.disposition === "credit"
              ? "refunded"
              : original.payment_status,
          updated_at: nowIso,
        })
        .eq("id", input.originalSaleId);
    } else if (prepared.disposition === "exchange") {
      await this.db
        .from("sales")
        .update({ status: "exchanged", updated_at: nowIso })
        .eq("id", input.originalSaleId)
        .eq("status", "posted");
    }

    const cogs = prepared.lines.reduce((s, l) => s + l.qty * 0, 0);
    await this.ensureAndPostJournal({
      organizationId: input.organizationId,
      branchId: input.branchId,
      sourceType: "sale_return",
      sourceId: String(ret.id),
      idempotencyKey: input.idempotencyKey,
      memo: `Return ${ret.id}`,
      lines: buildSaleReturnJournalLines({ refundAmount: prepared.refundAmount, cogs }),
    });

    // Commission rules: adjust accrued commission for returned amounts (finalized sales only).
    const { data: commissionRow } = await this.db
      .from("sale_commissions")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("sale_id", input.originalSaleId)
      .maybeSingle();
    if (commissionRow) {
      const current: CommissionRecord = {
        id: String(commissionRow.id),
        saleId: String(commissionRow.sale_id),
        salesmanUserId: String(commissionRow.salesman_user_id),
        employeeId: commissionRow.employee_id ? String(commissionRow.employee_id) : null,
        baseAmount: Number(commissionRow.base_amount ?? 0),
        commissionPercent: Number(commissionRow.commission_percent ?? 0),
        commissionAmount: Number(commissionRow.commission_amount ?? 0),
        status: commissionRow.status as CommissionRecord["status"],
        paidAmount: Number(commissionRow.paid_amount ?? 0),
        originalAmount: Number(commissionRow.original_amount ?? commissionRow.commission_amount ?? 0),
      };
      const adjusted = adjustCommissionForReturn({
        commission: current,
        returnedAmount: prepared.refundAmount,
      });
      await this.db
        .from("sale_commissions")
        .update({
          base_amount: adjusted.baseAmount,
          commission_amount: adjusted.commissionAmount,
          status: adjusted.status,
          paid_amount: adjusted.paidAmount,
          original_amount: adjusted.originalAmount,
          adjusted_at: nowIso,
          voided_at: adjusted.status === "void" ? nowIso : null,
          updated_at: nowIso,
        })
        .eq("id", current.id);
    }

    await this.insertAuditLog(
      buildSaleReturnAuditRow({
        organizationId: input.organizationId,
        branchId: input.branchId,
        returnId: String(ret.id),
        originalSaleId: input.originalSaleId,
        actorUserId: userId,
        deviceId: input.deviceId,
        disposition: prepared.disposition,
        scope: prepared.scope,
        refundAmount: prepared.refundAmount,
        reason: prepared.reason,
      }),
    );

    return ret;
  }

  /**
   * Idempotent completion for a return that already has a header (retry / repair).
   * Stock movements use stable operation_ids; payments use the return idempotency key.
   */
  private async completeReturnSettlement(input: {
    organizationId: string;
    branchId: string;
    warehouseId: string;
    returnRow: Row;
    original: Row;
    idempotencyKey: string;
    userId?: string | null;
    deviceId?: string;
  }) {
    const returnId = String(input.returnRow.id);
    const { data: items } = await this.db
      .from("sale_return_items")
      .select("*")
      .eq("sale_return_id", returnId);
    for (const item of items ?? []) {
      const productId = item.product_id ? String(item.product_id) : null;
      const restocked = Boolean(item.restocked);
      const originalSaleItemId = String(item.original_sale_item_id);
      if (productId && restocked) {
        const returnOpIn = saleReturnStockMovementOperationId(
          input.idempotencyKey,
          originalSaleItemId,
          "in",
        );
        await this.inventory.postMovement(
          {
            organizationId: input.organizationId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId,
            unitId: String(item.unit_id),
            movementType: "sale_return",
            qtyDelta: String(item.qty),
            sourceType: "sale_return",
            sourceId: returnId,
            operationId: returnOpIn,
            batchId: item.batch_id ? String(item.batch_id) : undefined,
            reason: String(input.returnRow.reason ?? "Return"),
          },
          input.userId,
        );
        if (String(item.restock_target) === "damaged") {
          const returnOpDmg = saleReturnStockMovementOperationId(
            input.idempotencyKey,
            originalSaleItemId,
            "dmg",
          );
          await this.inventory.postMovement(
            {
              organizationId: input.organizationId,
              branchId: input.branchId,
              warehouseId: input.warehouseId,
              productId,
              unitId: String(item.unit_id),
              movementType: "damage",
              qtyDelta: String(item.qty),
              sourceType: "sale_return",
              sourceId: returnId,
              operationId: returnOpDmg,
              batchId: item.batch_id ? String(item.batch_id) : undefined,
              reason: `Return inspection: ${item.condition}`,
            },
            input.userId,
          );
        }
      }
      const exchangeProductId = item.exchange_product_id ? String(item.exchange_product_id) : "";
      if (String(input.returnRow.return_type) === "exchange" && exchangeProductId) {
        await this.inventory.postMovement(
          {
            organizationId: input.organizationId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId: exchangeProductId,
            unitId: String(item.unit_id),
            movementType: "sale",
            qtyDelta: String(item.qty),
            sourceType: "sale_return",
            sourceId: returnId,
            operationId: saleReturnStockMovementOperationId(
              input.idempotencyKey,
              originalSaleItemId,
              "ex",
              exchangeProductId,
            ),
            reason: `Exchange for return ${returnId}`,
          },
          input.userId,
        );
      }
    }

    const disposition = String(input.returnRow.return_type) as "refund" | "credit" | "exchange";
    const refundMethodRaw = input.returnRow.refund_method
      ? String(input.returnRow.refund_method)
      : null;
    await this.settleReturnRefund({
      organizationId: input.organizationId,
      branchId: input.branchId,
      returnId,
      customerId: input.original.customer_id ? String(input.original.customer_id) : null,
      disposition,
      refundMethod:
        refundMethodRaw === "cash" ||
        refundMethodRaw === "bank" ||
        refundMethodRaw === "customer_credit"
          ? refundMethodRaw
          : null,
      refundAmount: Number(input.returnRow.refund_amount ?? 0),
      idempotencyKey: input.idempotencyKey,
      userId: input.userId,
      deviceId: input.deviceId,
      reason: String(input.returnRow.reason ?? "Return"),
    });

    await this.ensureAndPostJournal({
      organizationId: input.organizationId,
      branchId: input.branchId,
      sourceType: "sale_return",
      sourceId: returnId,
      idempotencyKey: input.idempotencyKey,
      memo: `Return ${returnId}`,
      lines: buildSaleReturnJournalLines({
        refundAmount: Number(input.returnRow.refund_amount ?? 0),
        cogs: 0,
      }),
    });
  }

  private async settleReturnRefund(input: {
    organizationId: string;
    branchId: string;
    returnId: string;
    customerId: string | null;
    disposition: "refund" | "credit" | "exchange";
    refundMethod: "cash" | "bank" | "customer_credit" | null;
    refundAmount: number;
    idempotencyKey: string;
    userId?: string | null;
    deviceId?: string;
    reason: string;
  }) {
    const plan = refundSettlementPlan({
      disposition: input.disposition,
      refundMethod: input.refundMethod,
      refundAmount: input.refundAmount,
    });
    if (plan.kind === "none" || plan.amount < 1e-9) return;

    if (plan.kind === "customer_credit") {
      if (!input.customerId) {
        throw new ValidationDomainError("Customer credit return requires a customer on the sale");
      }
      const { data: existingLedger } = await this.db
        .from("party_ledger_entries")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("source_type", "sale_return")
        .eq("source_id", input.returnId)
        .limit(1)
        .maybeSingle();
      if (existingLedger) return;
      await this.parties.postCustomerLedger({
        organizationId: input.organizationId,
        branchId: input.branchId,
        customerId: input.customerId,
        entryType: "return",
        amount: plan.amount.toFixed(2),
        sourceType: "sale_return",
        sourceId: input.returnId,
        description: `Return ${input.disposition}: ${input.reason}`,
        userId: input.userId,
        operationId: input.idempotencyKey,
      });
      return;
    }

    const methodId = await this.paymentMethodIdForKind(input.organizationId, plan.paymentKind ?? "cash");
    await this.parties.postSplitPayment(
      {
        organizationId: input.organizationId,
        branchId: input.branchId,
        direction: "pay",
        partyType: "customer",
        customerId: input.customerId ?? undefined,
        splits: [{ paymentMethodId: methodId, amount: plan.amount.toFixed(2) }],
        billTotal: plan.amount.toFixed(2),
        sourceType: "sale_return",
        sourceId: input.returnId,
        idempotencyKey: input.idempotencyKey,
        operationId: input.idempotencyKey,
        notes: `POS ${plan.method} refund`,
        reference: `REFUND-${input.returnId.slice(0, 8)}`,
        deviceId: input.deviceId,
      },
      input.userId,
    );
  }

  private async paymentMethodIdForKind(organizationId: string, kind: "cash" | "bank"): Promise<string> {
    const methods = await this.parties.listPaymentMethods(organizationId);
    const rows = methods as Array<{ id: string; kind?: string; is_active?: boolean }>;
    const hit =
      rows.find((m) => m.kind === kind && m.is_active !== false) ??
      rows.find((m) => m.kind === kind);
    if (!hit?.id) {
      throw new ValidationDomainError(`No ${kind} payment method configured for refunds`);
    }
    return String(hit.id);
  }

  async getInvoice(saleId: string) {
    const { data: sale, error } = await this.db.from("sales").select("*").eq("id", saleId).single();
    if (error) throw error;
    const mapped = mapSale(sale);
    const { data: items } = await this.db
      .from("sale_items")
      .select("*")
      .eq("sale_id", saleId)
      .order("line_no");
    let customer: Row | null = null;
    if (sale.customer_id) {
      const { data } = await this.db.from("customers").select("*").eq("id", sale.customer_id).maybeSingle();
      customer = data;
    }
    let branchName: string | null = null;
    {
      const { data: branch } = await this.db
        .from("branches")
        .select("name")
        .eq("id", sale.branch_id)
        .maybeSingle();
      branchName = branch ? String(branch.name) : null;
    }
    let cashierName: string | null = null;
    if (sale.created_by) {
      const { data: profile } = await this.db
        .from("user_profiles")
        .select("full_name,email")
        .eq("id", sale.created_by)
        .maybeSingle();
      cashierName = profile
        ? String(profile.full_name ?? profile.email ?? sale.created_by)
        : String(sale.created_by);
    }
    let salesmanName: string | null = null;
    if (sale.salesman_user_id) {
      const { data: profile } = await this.db
        .from("user_profiles")
        .select("full_name,email")
        .eq("id", sale.salesman_user_id)
        .maybeSingle();
      salesmanName = profile
        ? String(profile.full_name ?? profile.email ?? sale.salesman_user_id)
        : String(sale.salesman_user_id);
    }
    const { data: commission } = await this.db
      .from("sale_commissions")
      .select("commission_percent,commission_amount")
      .eq("sale_id", saleId)
      .maybeSingle();
    const { data: paymentRows } = await this.db
      .from("payments")
      .select("id,reference,total_amount,payment_splits(amount,payment_methods(name,code))")
      .eq("source_type", "sale")
      .eq("source_id", saleId);
    const payments: Array<{ method: string; amount: number; reference: string | null }> = [];
    for (const pay of paymentRows ?? []) {
      const splits = (pay.payment_splits as Array<Row> | null) ?? [];
      for (const split of splits) {
        const methodRow = split.payment_methods as Row | null;
        payments.push({
          method: String(methodRow?.name ?? methodRow?.code ?? "Payment"),
          amount: Number(split.amount ?? 0),
          reference: (pay.reference as string | null) ?? null,
        });
      }
      if (!splits.length && Number(pay.total_amount ?? 0) > 0) {
        payments.push({
          method: "Payment",
          amount: Number(pay.total_amount ?? 0),
          reference: (pay.reference as string | null) ?? null,
        });
      }
    }
    const invoiceItems = await Promise.all(
      (items ?? []).map(async (i) => {
        let name = i.is_manual ? String(i.manual_name ?? "Manual item") : String(i.product_id);
        if (!i.is_manual && i.product_id) {
          const { data: product } = await this.db
            .from("products")
            .select("name,sku")
            .eq("id", i.product_id)
            .maybeSingle();
          if (product) name = `${product.name}${product.sku ? ` (${product.sku})` : ""}`;
        }
        let unit: string | null = null;
        if (i.unit_id) {
          const { data: u } = await this.db
            .from("units")
            .select("name,code")
            .eq("id", i.unit_id)
            .maybeSingle();
          unit = u ? String(u.code ?? u.name) : null;
        }
        return {
          id: String(i.id),
          productId: i.product_id ? String(i.product_id) : null,
          unitId: String(i.unit_id),
          name,
          qty: i.qty,
          unit,
          rate: Number(i.unit_price),
          discount: Number(i.discount_amount),
          tax: Number(i.tax_amount),
          total: Number(i.line_total),
          warrantyDays: Number(i.warranty_days ?? 0),
        };
      }),
    );
    return {
      sale: mapped,
      invoiceNumber: mapped.invoiceNumber,
      dateTime: mapped.postedAt ?? mapped.createdAt,
      branchId: mapped.branchId,
      branchName,
      terminalId: mapped.deviceId,
      cashierId: sale.created_by ? String(sale.created_by) : null,
      cashierName,
      customerName: customer ? String(customer.name) : null,
      customerMobile: customer ? (customer.mobile as string | null) : null,
      customerAddress: customer ? (customer.address as string | null) : null,
      customerEmail: customer ? ((customer.email as string | null) ?? null) : null,
      reference: mapped.referenceName,
      salesmanId: mapped.salesmanUserId,
      salesmanName,
      commissionPercent: commission ? Number(commission.commission_percent ?? 0) : null,
      commissionAmount: commission ? Number(commission.commission_amount ?? 0) : null,
      dueDate: mapped.dueDate,
      terms: mapped.notes,
      warrantyNotes: (sale.warranty_notes as string | null) ?? null,
      paidAmount: mapped.paidTotal,
      remainingAmount: mapped.remainingTotal,
      items: invoiceItems,
      payments,
      logoUrl: null,
    };
  }

  async listSales(organizationId: string, branchId?: string) {
    let q = this.db
      .from("sales")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapSale);
  }

  private applySaleManagementTab(q: { eq: Function; in: Function; or: Function; gt: Function; not: Function }, tab: SaleManagementTab) {
    switch (tab) {
      case "completed":
        return q.eq("status", "posted").eq("payment_status", "paid");
      case "credit":
        return q
          .eq("status", "posted")
          .gt("remaining_total", 0)
          .not("customer_id", "is", null)
          .in("payment_status", ["unpaid", "partial"]);
      case "partial":
        return q.eq("status", "posted").eq("payment_status", "partial");
      case "cancelled":
        return q.eq("status", "void");
      case "pending":
        return q.or(
          "status.eq.draft,status.eq.held,and(status.eq.posted,payment_status.eq.unpaid,remaining_total.gt.0)",
        );
      case "all":
      default:
        return q.in("status", ["posted", "void", "returned", "exchanged"]);
    }
  }

  private async saleIdsForPaymentMethod(organizationId: string, paymentMethodId: string) {
    const { data, error } = await this.db
      .from("payments")
      .select("source_id, payment_splits!inner(payment_method_id)")
      .eq("organization_id", organizationId)
      .eq("source_type", "sale")
      .eq("payment_splits.payment_method_id", paymentMethodId);
    if (error) throw error;
    return [...new Set((data ?? []).map((r) => String(r.source_id)))];
  }

  private buildSalesManagementQuery(input: SaleListFilterInput, select = "*, customers(name,mobile)") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = this.db
      .from("sales")
      .select(select, { count: "exact" })
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: false });
    q = this.applySaleManagementTab(q, input.tab ?? "all");
    if (input.branchId) q = q.eq("branch_id", input.branchId);
    if (input.warehouseId) q = q.eq("warehouse_id", input.warehouseId);
    if (input.customerId) q = q.eq("customer_id", input.customerId);
    if (input.cashierUserId) q = q.eq("created_by", input.cashierUserId);
    if (input.salesmanUserId) q = q.eq("salesman_user_id", input.salesmanUserId);
    if (input.status) q = q.eq("status", input.status);
    if (input.paymentStatus) q = q.eq("payment_status", input.paymentStatus);
    if (input.invoiceNumber?.trim()) {
      q = q.ilike("invoice_number", `%${input.invoiceNumber.trim()}%`);
    }
    if (input.dateFrom) q = q.gte("created_at", input.dateFrom);
    if (input.dateTo) q = q.lte("created_at", `${input.dateTo}T23:59:59.999Z`);
    return q;
  }

  private filterRowsByCustomerQuery<T extends Row>(rows: T[], customerQuery?: string): T[] {
    const cq = customerQuery?.trim().toLowerCase();
    if (!cq) return rows;
    return rows.filter((r) => {
      const c = r.customers as { name?: string; mobile?: string } | null;
      const name = String(c?.name ?? "").toLowerCase();
      const mobile = String(c?.mobile ?? "").toLowerCase();
      return (
        name.includes(cq) ||
        mobile.includes(cq) ||
        mobile.replace(/\D/g, "").includes(cq.replace(/\D/g, ""))
      );
    });
  }

  async searchSalesManagement(input: SaleListFilterInput): Promise<SaleListResponse> {
    let paymentSaleIds: string[] | null = null;
    if (input.paymentMethodId) {
      paymentSaleIds = await this.saleIdsForPaymentMethod(
        input.organizationId,
        input.paymentMethodId,
      );
      if (!paymentSaleIds.length) {
        return {
          summary: summarizeSaleManagement([]),
          items: [],
          total: 0,
          limit: input.limit ?? 25,
          offset: input.offset ?? 0,
        };
      }
    }

    const limit = input.limit ?? 25;
    const offset = input.offset ?? 0;
    const hasCustomerQuery = Boolean(input.customerQuery?.trim());

    let summaryQuery = this.buildSalesManagementQuery(
      input,
      "grand_total,subtotal,discount_total,tax_total,remaining_total,status,payment_status,customer_id,customers(name,mobile)",
    );
    if (paymentSaleIds) summaryQuery = summaryQuery.in("id", paymentSaleIds);
    const { data: summaryRowsRaw, error: summaryErr } = await summaryQuery.limit(5000);
    if (summaryErr) throw summaryErr;
    const summaryRows = this.filterRowsByCustomerQuery((summaryRowsRaw ?? []) as Row[], input.customerQuery);
    const summary = summarizeSaleManagement(
      summaryRows.map((r) => ({
        status: r.status as Sale["status"],
        paymentStatus: r.payment_status as Sale["paymentStatus"],
        grandTotal: Number(r.grand_total ?? 0),
        subtotal: Number(r.subtotal ?? 0),
        discountTotal: Number(r.discount_total ?? 0),
        taxTotal: Number(r.tax_total ?? 0),
        paidTotal: 0,
        remainingTotal: Number(r.remaining_total ?? 0),
        customerId: r.customer_id ? String(r.customer_id) : null,
      })),
    );

    let listQuery = this.buildSalesManagementQuery(input);
    if (paymentSaleIds) listQuery = listQuery.in("id", paymentSaleIds);

    let rows: Row[] = [];
    let total = 0;

    if (hasCustomerQuery) {
      const { data: allRows, error: listErr } = await listQuery.limit(5000);
      if (listErr) throw listErr;
      const filtered = this.filterRowsByCustomerQuery((allRows ?? []) as Row[], input.customerQuery);
      total = filtered.length;
      rows = filtered.slice(offset, offset + limit);
    } else {
      const { data, error: listErr, count } = await listQuery.range(offset, offset + limit - 1);
      if (listErr) throw listErr;
      rows = (data ?? []) as Row[];
      total = count ?? rows.length;
    }

    const saleIds = rows.map((r) => String(r.id));
    const itemCounts = new Map<string, number>();
    if (saleIds.length) {
      const { data: itemRows } = await this.db
        .from("sale_items")
        .select("sale_id")
        .in("sale_id", saleIds);
      for (const row of itemRows ?? []) {
        const id = String(row.sale_id);
        itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1);
      }
    }

    const profileIds = [
      ...new Set(
        rows.flatMap((r) => [r.created_by, r.salesman_user_id].filter(Boolean).map(String)),
      ),
    ];
    const profiles = new Map<string, string>();
    if (profileIds.length) {
      const { data: profileRows } = await this.db
        .from("user_profiles")
        .select("id,full_name,email")
        .in("id", profileIds);
      for (const p of profileRows ?? []) {
        profiles.set(String(p.id), String(p.full_name ?? p.email ?? p.id));
      }
    }

    const paymentLabels = new Map<string, string>();
    if (saleIds.length) {
      const { data: paymentRows } = await this.db
        .from("payments")
        .select("source_id,payment_splits(amount,payment_methods(name,code))")
        .eq("source_type", "sale")
        .in("source_id", saleIds);
      for (const pay of paymentRows ?? []) {
        const saleId = String(pay.source_id);
        const splits = (pay.payment_splits as Array<Record<string, unknown>> | null) ?? [];
        const methods = splits
          .map((s) => {
            const m = s.payment_methods as Record<string, unknown> | null;
            return String(m?.name ?? m?.code ?? "Payment");
          })
          .filter(Boolean);
        if (methods.length) {
          const existing = paymentLabels.get(saleId);
          paymentLabels.set(
            saleId,
            existing ? `${existing}, ${methods.join(", ")}` : methods.join(", "),
          );
        }
      }
    }

    const items = rows.map((r) => {
      const mapped = mapSale(r);
      const c = r.customers as { name?: string; mobile?: string } | null;
      const cashierId = r.created_by ? String(r.created_by) : null;
      const salesmanId = r.salesman_user_id ? String(r.salesman_user_id) : null;
      return {
        ...mapped,
        customerName: c?.name ?? null,
        customerMobile: c?.mobile ?? null,
        cashierId,
        cashierName: cashierId ? (profiles.get(cashierId) ?? cashierId) : null,
        salesmanName: salesmanId ? (profiles.get(salesmanId) ?? salesmanId) : null,
        itemCount: itemCounts.get(mapped.id) ?? 0,
        paymentMethods: paymentLabels.get(mapped.id) ?? null,
      };
    });

    return { summary, items, total, limit, offset };
  }

  async exportSalesManagementCsv(input: SaleListFilterInput): Promise<string> {
    const { salesManagementExportCsv } = await import("@electronic-erp/domain");
    const page = await this.searchSalesManagement({ ...input, limit: 5000, offset: 0 });
    return salesManagementExportCsv(
      page.items.map((r) => ({
        invoiceNumber: r.invoiceNumber,
        dateTime: r.postedAt ?? r.createdAt,
        customerName: r.customerName,
        cashierName: r.cashierName,
        salesmanName: r.salesmanName,
        itemCount: r.itemCount,
        grandTotal: Number(r.grandTotal),
        paidTotal: Number(r.paidTotal),
        remainingTotal: Number(r.remainingTotal),
        paymentMethods: r.paymentMethods,
        status: r.status,
        paymentStatus: r.paymentStatus,
      })),
    );
  }

  private buildPorts(userId?: string | null) {
    const db = this.db;
    const inventory = this.inventory;
    const parties = this.parties;
    const self = this;

    return {
      async findSaleByIdempotency(organizationId: string, key: string) {
        const { data } = await db
          .from("sales")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("idempotency_key", key)
          .maybeSingle();
        return data;
      },
      async searchStockAvailable(warehouseId: string, productId: string) {
        const { data } = await db
          .from("stock_balances")
          .select("qty_on_hand,qty_reserved")
          .eq("warehouse_id", warehouseId)
          .eq("product_id", productId)
          .maybeSingle();
        if (!data) return "0";
        return String(Number(data.qty_on_hand ?? 0) - Number(data.qty_reserved ?? 0));
      },
      async postSaleRecord(payload: Record<string, unknown>) {
        const key = String(payload.idempotency_key ?? crypto.randomUUID());
        const invoiceNumber = `INV-${key.replace(/-/g, "").slice(0, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        const { data, error } = await db
          .from("sales")
          .insert({ ...payload, invoice_number: invoiceNumber })
          .select("*")
          .single();
        if (error) throw error;
        return { id: String(data.id), invoiceNumber: String(data.invoice_number) };
      },
      async postSaleItems(_saleId: string, items: Array<Record<string, unknown>>) {
        const { error } = await db.from("sale_items").insert(items);
        if (error) throw error;
      },
      async postDiscountAudits(saleId: string, audits: Array<Record<string, unknown>>) {
        const rows = audits.map((a) => ({ ...a, sale_id: saleId, organization_id: a.organization_id }));
        // organization_id filled from first sale lookup
        const { data: sale } = await db.from("sales").select("organization_id").eq("id", saleId).single();
        const { error } = await db.from("sale_discount_audits").insert(
          rows.map((r) => ({ ...r, organization_id: sale?.organization_id })),
        );
        if (error) throw error;
      },
      async postStockSale(input: {
        organizationId: string;
        branchId: string;
        warehouseId: string;
        productId: string;
        unitId: string;
        qty: string;
        saleId: string;
        operationId: string;
        batchId?: string;
        serialNumberId?: string;
      }) {
        await inventory.postMovement(
          {
            organizationId: input.organizationId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId: input.productId,
            unitId: input.unitId,
            movementType: "sale",
            qtyDelta: input.qty,
            sourceType: "sale",
            sourceId: input.saleId,
            operationId: input.operationId,
            batchId: input.batchId,
            serialNumberId: input.serialNumberId,
          },
          userId,
        );
      },
      async postCustomerSaleLedger(input: {
        organizationId: string;
        branchId: string;
        customerId: string;
        amount: string;
        saleId: string;
      }) {
        await parties.postCustomerLedger({
          organizationId: input.organizationId,
          branchId: input.branchId,
          customerId: input.customerId,
          entryType: "sale",
          amount: input.amount,
          sourceType: "sale",
          sourceId: input.saleId,
          description: `Sale ${input.saleId}`,
          userId,
        });
      },
      async postSplitPayment(input: Record<string, unknown>) {
        await parties.postSplitPayment(input as never, userId);
      },
      async updateSalePaymentState(
        saleId: string,
        input: { paidTotal: number; remainingTotal: number; paymentStatus: string },
      ) {
        const { error } = await db
          .from("sales")
          .update({
            paid_total: input.paidTotal,
            remaining_total: input.remainingTotal,
            payment_status: input.paymentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", saleId)
          .eq("status", "draft");
        if (error) throw error;
      },
      async finalizeSaleStatus(
        saleId: string,
        input: {
          paidTotal: number;
          remainingTotal: number;
          paymentStatus: string;
          postedAt?: string;
        },
      ) {
        const { data, error } = await db
          .from("sales")
          .update({
            status: "posted",
            posted_at: input.postedAt ?? new Date().toISOString(),
            paid_total: input.paidTotal,
            remaining_total: input.remainingTotal,
            payment_status: input.paymentStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", saleId)
          .eq("status", "draft")
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          throw new ValidationDomainError(
            "Sale could not be finalized — not in draft status (possible duplicate)",
          );
        }
      },
      async voidIncompleteSale(saleId: string, reason: string) {
        // Free the original idempotency key so the cashier can retry with the same client key.
        const freedKey = crypto.randomUUID();
        const { error } = await db
          .from("sales")
          .update({
            status: "void",
            notes: reason.slice(0, 500),
            idempotency_key: freedKey,
            updated_at: new Date().toISOString(),
          })
          .eq("id", saleId)
          .eq("status", "draft");
        if (error) throw error;
      },
      async reverseStockSale(input: {
        organizationId: string;
        branchId: string;
        warehouseId: string;
        productId: string;
        unitId: string;
        qty: string;
        saleId: string;
        operationId: string;
        batchId?: string;
        serialNumberId?: string;
      }) {
        await inventory.postMovement(
          {
            organizationId: input.organizationId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            productId: input.productId,
            unitId: input.unitId,
            movementType: "sale_return",
            qtyDelta: input.qty,
            sourceType: "sale",
            sourceId: input.saleId,
            operationId: input.operationId,
            batchId: input.batchId,
            serialNumberId: input.serialNumberId,
            reason: "Compensate failed sale finalization",
          },
          userId,
        );
      },
      async postJournal(input: Record<string, unknown>) {
        await self.ensureAndPostJournal(input as never);
      },
      async postCommission(input: Record<string, unknown>) {
        let employeeId = input.employee_id ?? null;
        if (!employeeId && input.salesman_user_id) {
          const { data: emp } = await db
            .from("employees")
            .select("id")
            .eq("organization_id", input.organization_id)
            .eq("user_id", input.salesman_user_id)
            .eq("is_salesman", true)
            .maybeSingle();
          employeeId = emp?.id ?? null;
        }
        const payload = {
          ...input,
          employee_id: employeeId,
          status: input.status ?? "accrued",
          paid_amount: input.paid_amount ?? 0,
          original_amount: input.original_amount ?? input.commission_amount,
          updated_at: new Date().toISOString(),
        };
        const { error } = await db.from("sale_commissions").upsert(payload, {
          onConflict: "organization_id,sale_id",
        });
        if (error) throw error;
      },
      async postWarranties(rows: Array<Record<string, unknown>>) {
        // Resolve sale_item ids by line_no
        if (!rows.length) return;
        const saleId = rows[0]!.sale_id;
        const { data: items } = await db
          .from("sale_items")
          .select("id,line_no")
          .eq("sale_id", saleId);
        const byLine = new Map((items ?? []).map((i) => [Number(i.line_no), String(i.id)]));
        const payload = rows
          .map((r) => ({
            organization_id: r.organization_id,
            sale_id: r.sale_id,
            sale_item_id: byLine.get(Number(r.line_no)),
            product_id: r.product_id,
            serial_number_id: r.serial_number_id,
            warranty_start: r.warranty_start,
            warranty_end: r.warranty_end,
          }))
          .filter((r) => r.sale_item_id);
        if (payload.length) {
          const { error } = await db.from("sale_warranties").insert(payload);
          if (error) throw error;
        }
      },
      async createInstallment(input: Record<string, unknown>) {
        await parties.createInstallmentPlan(input as never, userId);
      },
      async postAnalytics(input: Record<string, unknown>) {
        const { error } = await db.from("sales_analytics_events").insert(input);
        if (error) throw error;
      },
      async postAudit(row: Record<string, unknown>) {
        await self.insertAuditLog(row);
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

  // --- cash shifts ---
  async getOpenShift(organizationId: string, branchId: string) {
    const { data, error } = await this.db
      .from("pos_cash_shifts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async openShift(input: {
    organizationId: string;
    branchId: string;
    openingFloat: number;
    notes?: string;
    userId?: string | null;
  }) {
    const existing = await this.getOpenShift(input.organizationId, input.branchId);
    if (existing) throw new Error("A cash shift is already open for this branch");
    const { data, error } = await this.db
      .from("pos_cash_shifts")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        opened_by: input.userId ?? null,
        opening_float: input.openingFloat,
        notes: input.notes ?? null,
        status: "open",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async refreshShiftTotals(shiftId: string, organizationId: string, branchId: string) {
    const { data: shift } = await this.db
      .from("pos_cash_shifts")
      .select("*")
      .eq("id", shiftId)
      .maybeSingle();
    if (!shift) return null;
    const openedAt = String(shift.opened_at);
    const { data: sales } = await this.db
      .from("sales")
      .select("grand_total,paid_total,payment_status,created_at")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .gte("created_at", openedAt)
      .neq("status", "void");
    const salesTotal = (sales ?? []).reduce((s, r) => s + Number(r.grand_total ?? 0), 0);
    const cashSales = (sales ?? []).reduce((s, r) => s + Number(r.paid_total ?? 0), 0);
    const expected = Number(shift.opening_float ?? 0) + cashSales - Number(shift.expense_total ?? 0);
    const { data, error } = await this.db
      .from("pos_cash_shifts")
      .update({
        sales_total: salesTotal,
        cash_sales_total: cashSales,
        expected_cash: expected,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async closeShift(input: {
    shiftId: string;
    closingCounted: number;
    userId?: string | null;
    notes?: string;
  }) {
    const { data: shift } = await this.db
      .from("pos_cash_shifts")
      .select("*")
      .eq("id", input.shiftId)
      .eq("status", "open")
      .maybeSingle();
    if (!shift) throw new Error("Open shift not found");
    const refreshed = await this.refreshShiftTotals(
      input.shiftId,
      String(shift.organization_id),
      String(shift.branch_id),
    );
    const expected = Number(refreshed?.expected_cash ?? shift.opening_float ?? 0);
    const variance = Math.round((input.closingCounted - expected) * 100) / 100;
    const { data, error } = await this.db
      .from("pos_cash_shifts")
      .update({
        status: "closed",
        closed_by: input.userId ?? null,
        closed_at: new Date().toISOString(),
        closing_counted: input.closingCounted,
        expected_cash: expected,
        variance,
        notes: input.notes ?? shift.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.shiftId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  /** audit_logs.device_id FKs to devices; unknown POS local UUIDs are omitted rather than failing the write. */
  private async insertAuditLog(row: Record<string, unknown>) {
    const { error } = await this.db.from("audit_logs").insert(row);
    if (!error) return;
    const deviceFk =
      row.device_id != null &&
      (error.code === "23503" || /device_id|devices/i.test(error.message ?? ""));
    if (deviceFk) {
      const { error: retryErr } = await this.db.from("audit_logs").insert({ ...row, device_id: null });
      if (retryErr) throw retryErr;
      return;
    }
    throw error;
  }
}

function mapSale(row: Row): Sale {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    branchId: String(row.branch_id),
    warehouseId: String(row.warehouse_id),
    invoiceNumber: String(row.invoice_number),
    status: row.status as Sale["status"],
    posMode: (row.pos_mode as Sale["posMode"]) ?? "advanced",
    localeMode: (row.locale_mode as Sale["localeMode"]) ?? "en",
    customerId: (row.customer_id as string | null) ?? null,
    salesmanUserId: (row.salesman_user_id as string | null) ?? null,
    referenceName: (row.reference_name as string | null) ?? null,
    subtotal: Number(row.subtotal ?? 0),
    discountTotal: Number(row.discount_total ?? 0),
    taxTotal: Number(row.tax_total ?? 0),
    grandTotal: Number(row.grand_total ?? 0),
    paidTotal: Number(row.paid_total ?? 0),
    remainingTotal: Number(row.remaining_total ?? 0),
    paymentStatus: row.payment_status as Sale["paymentStatus"],
    dueDate: (row.due_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    postedAt: (row.posted_at as string | null) ?? null,
    idempotencyKey: String(row.idempotency_key),
    deviceId: (row.device_id as string | null) ?? null,
    offlineTransactionId: (row.offline_transaction_id as string | null) ?? null,
    syncState: (row.sync_state as Sale["syncState"]) ?? "synced",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
    version: Number(row.version ?? 1),
  };
}

function mapHeldSale(row: Row): HeldSaleRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    branchId: String(row.branch_id),
    saleId: String(row.sale_id),
    holdLabel: (row.hold_label as string | null) ?? null,
    holdReason: (row.hold_reason as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    heldBy: (row.held_by as string | null) ?? null,
    customerId: (row.customer_id as string | null) ?? null,
    cartSnapshot: (row.cart_snapshot as Record<string, unknown>) ?? {},
    heldAt: String(row.held_at),
    expiresAt: (row.expires_at as string | null) ?? null,
    resumedAt: (row.resumed_at as string | null) ?? null,
    status: row.status as HeldSaleRecord["status"],
    deviceId: (row.device_id as string | null) ?? null,
  };
}
