import type {
  CreateSaleInput,
  CreateSaleReturnInput,
  ProductSearchQuery,
  ProductSearchResult,
  Sale,
} from "@electronic-erp/contracts";
import {
  buildSaleReturnJournalLines,
  SaleTransactionService,
  ValidationDomainError,
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
    holdLabel?: string;
    cartSnapshot: Record<string, unknown>;
    deviceId?: string;
    userId?: string | null;
    warehouseId: string;
  }) {
    const invoiceNumber = `HOLD-${Date.now()}`;
    const { data: sale, error } = await this.db
      .from("sales")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        invoice_number: invoiceNumber,
        status: "held",
        held_at: new Date().toISOString(),
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
        held_by: input.userId ?? null,
        cart_snapshot: input.cartSnapshot,
        device_id: input.deviceId ?? null,
        status: "held",
      })
      .select("*")
      .single();
    if (heldErr) throw heldErr;
    return { sale: mapSale(sale), held };
  }

  async listHeldSales(organizationId: string, branchId: string) {
    const { data, error } = await this.db
      .from("held_sales")
      .select("*, sales(*)")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("status", "held")
      .order("held_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async resumeHeldSale(heldId: string) {
    const { data: held, error } = await this.db
      .from("held_sales")
      .select("*")
      .eq("id", heldId)
      .single();
    if (error) throw error;
    if (!held || held.status !== "held") throw new ValidationDomainError("Held bill not found");

    await this.db
      .from("held_sales")
      .update({ status: "resumed", resumed_at: new Date().toISOString() })
      .eq("id", heldId);
    await this.db
      .from("sales")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", held.sale_id);

    return held;
  }

  async postReturn(input: CreateSaleReturnInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("sale_returns")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    const refundAmount = input.items.reduce(
      (s, i) => s + Number(i.qty) * i.unitPrice,
      0,
    );

    const { data: ret, error } = await this.db
      .from("sale_returns")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        original_sale_id: input.originalSaleId,
        return_type: input.returnType,
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
      await this.db.from("sale_return_items").insert({
        organization_id: input.organizationId,
        sale_return_id: ret.id,
        original_sale_item_id: item.originalSaleItemId ?? null,
        product_id: item.productId ?? null,
        unit_id: item.unitId,
        qty: String(item.qty),
        unit_price: item.unitPrice,
        line_total: Number(item.qty) * item.unitPrice,
        exchange_product_id: item.exchangeProductId ?? null,
      });

      if (item.productId) {
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
            operationId: crypto.randomUUID(),
            reason: input.reason,
          },
          userId,
        );
      }

      // Exchange: issue replacement product (stock out) via inventory engine
      if (input.returnType === "exchange" && item.exchangeProductId) {
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
            operationId: crypto.randomUUID(),
            reason: `Exchange for return ${ret.id}`,
          },
          userId,
        );
      }
    }

    const { data: original } = await this.db
      .from("sales")
      .select("*")
      .eq("id", input.originalSaleId)
      .maybeSingle();

    if (original?.customer_id) {
      await this.parties.postCustomerLedger({
        organizationId: input.organizationId,
        branchId: input.branchId,
        customerId: String(original.customer_id),
        entryType: "return",
        amount: String(refundAmount),
        sourceType: "sale_return",
        sourceId: String(ret.id),
        description: `Return ${input.returnType}: ${input.reason}`,
        userId,
      });
    }

    await this.db
      .from("sales")
      .update({
        status: input.returnType === "exchange" ? "exchanged" : "returned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.originalSaleId);

    await this.ensureAndPostJournal({
      organizationId: input.organizationId,
      branchId: input.branchId,
      sourceType: "sale_return",
      sourceId: String(ret.id),
      idempotencyKey: input.idempotencyKey,
      memo: `Return ${ret.id}`,
      lines: buildSaleReturnJournalLines({ refundAmount }),
    });

    return ret;
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
        const { error } = await db.from("sale_commissions").insert(input);
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
        const { error } = await db.from("audit_logs").insert(row);
        if (error) throw error;
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
