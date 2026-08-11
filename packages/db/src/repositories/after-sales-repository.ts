import type {
  AddServicePartInput,
  ConvertOrderToInvoiceInput,
  CreateQuotationInput,
  CreateSalesOrderInput,
  CreateServiceJobInput,
  CreateWarrantyClaimInput,
  QuotationStatus,
  SalesOrderStatus,
  ServiceJobStatus,
  WarrantyLookupQuery,
  WarrantyReplacementInput,
} from "@electronic-erp/contracts";
import {
  assertOrderTransition,
  assertQuotationTransition,
  assertSerialMatchesWarranty,
  assertServiceJobTransition,
  assertWarrantyClaimAllowed,
  calculateQuoteTotals,
  computeServiceBill,
  ValidationDomainError,
} from "@electronic-erp/domain";
import type { DatabaseClient } from "../client.js";
import { InventoryRepository } from "./inventory-repository.js";
import { PosRepository } from "./pos-repository.js";

type Row = Record<string, unknown>;

export class AfterSalesRepository {
  private readonly inventory: InventoryRepository;
  private readonly pos: PosRepository;

  constructor(private readonly db: DatabaseClient) {
    this.inventory = new InventoryRepository(db);
    this.pos = new PosRepository(db);
  }

  // --- Quotations ---
  async createQuotation(input: CreateQuotationInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("quotations")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    const totals = calculateQuoteTotals(input.items, input.discountTotal ?? 0);
    const quotationNumber = `QT-${Date.now()}`;
    const { data: quote, error } = await this.db
      .from("quotations")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        quotation_number: quotationNumber,
        customer_id: input.customerId ?? null,
        status: "draft",
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        validity_date: input.validityDate ?? null,
        terms: input.terms ?? null,
        notes: input.notes ?? null,
        idempotency_key: input.idempotencyKey,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.insertLines("quotation_items", "quotation_id", quote.id, input.organizationId, input.items);
    return quote;
  }

  async listQuotations(organizationId: string, branchId?: string) {
    let q = this.db
      .from("quotations")
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

  async advanceQuotation(id: string, to: QuotationStatus) {
    const { data: quote, error } = await this.db.from("quotations").select("*").eq("id", id).single();
    if (error) throw error;
    assertQuotationTransition(quote.status as QuotationStatus, to);
    const { data, error: updErr } = await this.db
      .from("quotations")
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return data;
  }

  async convertQuotationToOrder(quotationId: string, userId?: string | null) {
    const { data: quote, error } = await this.db
      .from("quotations")
      .select("*")
      .eq("id", quotationId)
      .single();
    if (error) throw error;
    if (quote.converted_order_id) {
      const { data: existing } = await this.db
        .from("sales_orders")
        .select("*")
        .eq("id", quote.converted_order_id)
        .single();
      return existing;
    }
    const from = quote.status as QuotationStatus;
    if (from !== "accepted" && from !== "sent" && from !== "draft") {
      throw new ValidationDomainError(`Cannot convert quotation in status ${from}`);
    }
    if (from === "draft" || from === "sent") {
      assertQuotationTransition(from, "accepted");
      await this.db.from("quotations").update({ status: "accepted" }).eq("id", quotationId);
    }

    const { data: items } = await this.db
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("line_no");

    const order = await this.createSalesOrder(
      {
        organizationId: String(quote.organization_id),
        branchId: String(quote.branch_id),
        customerId: quote.customer_id ? String(quote.customer_id) : undefined,
        quotationId,
        items: (items ?? []).map((i) => ({
          productId: String(i.product_id),
          variantId: i.variant_id ? String(i.variant_id) : undefined,
          unitId: String(i.unit_id),
          qty: String(i.qty),
          unitPrice: Number(i.unit_price),
          discount: Number(i.discount_amount ?? 0),
          tax: Number(i.tax_amount ?? 0),
        })),
        discountTotal: 0,
        notes: quote.notes ? String(quote.notes) : undefined,
        idempotencyKey: crypto.randomUUID(),
      },
      userId,
    );

    assertQuotationTransition("accepted", "converted_to_order");
    await this.db
      .from("quotations")
      .update({
        status: "converted_to_order",
        converted_order_id: order.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quotationId);

    return order;
  }

  // --- Sales orders ---
  async createSalesOrder(input: CreateSalesOrderInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("sales_orders")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    const totals = calculateQuoteTotals(input.items, input.discountTotal ?? 0);
    const orderNumber = `SO-${Date.now()}`;
    const { data: order, error } = await this.db
      .from("sales_orders")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId ?? null,
        order_number: orderNumber,
        customer_id: input.customerId ?? null,
        quotation_id: input.quotationId ?? null,
        status: "draft",
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        notes: input.notes ?? null,
        idempotency_key: input.idempotencyKey,
        channel: input.channel ?? "erp",
        approval_status: input.approvalStatus ?? "none",
        price_book: input.priceBook ?? null,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.insertLines(
      "sales_order_items",
      "sales_order_id",
      order.id,
      input.organizationId,
      input.items,
    );
    return order;
  }

  async listOrders(organizationId: string, branchId?: string) {
    let q = this.db
      .from("sales_orders")
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

  async advanceOrder(id: string, to: SalesOrderStatus) {
    const { data: order, error } = await this.db.from("sales_orders").select("*").eq("id", id).single();
    if (error) throw error;
    assertOrderTransition(order.status as SalesOrderStatus, to);
    const { data, error: updErr } = await this.db
      .from("sales_orders")
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return data;
  }

  async convertOrderToInvoice(input: ConvertOrderToInvoiceInput, userId?: string | null) {
    const { data: order, error } = await this.db
      .from("sales_orders")
      .select("*")
      .eq("id", input.orderId)
      .single();
    if (error) throw error;
    if (order.converted_sale_id) {
      return { saleId: String(order.converted_sale_id), duplicate: true as const };
    }

    let status = order.status as SalesOrderStatus;
    if (status === "draft") {
      assertOrderTransition("draft", "confirmed");
      await this.db.from("sales_orders").update({ status: "confirmed" }).eq("id", input.orderId);
      status = "confirmed";
    }
    assertOrderTransition(status, "converted_to_invoice");

    const { data: items } = await this.db
      .from("sales_order_items")
      .select("*")
      .eq("sales_order_id", input.orderId)
      .order("line_no");

    const sale = await this.pos.postSale(
      {
        organizationId: input.organizationId,
        branchId: String(order.branch_id),
        warehouseId: input.warehouseId,
        customerId: order.customer_id ? String(order.customer_id) : undefined,
        notes: order.notes ? String(order.notes) : undefined,
        items: (items ?? []).map((i) => ({
          productId: String(i.product_id),
          variantId: i.variant_id ? String(i.variant_id) : undefined,
          unitId: String(i.unit_id),
          qty: String(i.qty),
          unitPrice: Number(i.unit_price),
          discount: Number(i.discount_amount ?? 0),
          tax: Number(i.tax_amount ?? 0),
        })),
        payments:
          input.paymentMethodId && (input.paidTotal ?? 0) > 0
            ? [{ paymentMethodId: input.paymentMethodId, amount: input.paidTotal ?? 0 }]
            : [],
        discountTotal: Number(order.discount_total ?? 0),
        discounts: [],
        idempotencyKey: input.idempotencyKey,
        operationId: input.idempotencyKey,
      },
      userId,
    );

    await this.db
      .from("sales_orders")
      .update({
        status: "converted_to_invoice",
        converted_sale_id: sale.id,
        warehouse_id: input.warehouseId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.orderId);

    return { ...sale, duplicate: false as const };
  }

  // --- Service jobs ---
  async createServiceJob(input: CreateServiceJobInput, userId?: string | null) {
    const { data: existing } = await this.db
      .from("service_jobs")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) return existing;

    let serialNumberId = input.serialNumberId ?? null;
    let underWarranty = false;
    let saleWarrantyId = input.saleWarrantyId ?? null;

    if (input.serialCode && !serialNumberId) {
      const { data: serial } = await this.db
        .from("stock_serials")
        .select("*")
        .eq("organization_id", input.organizationId)
        .eq("serial_number", input.serialCode)
        .maybeSingle();
      if (!serial) throw new ValidationDomainError("Serial not found");
      serialNumberId = String(serial.id);
    }

    if (saleWarrantyId || serialNumberId || input.saleId) {
      const warranty = await this.findWarranty({
        saleWarrantyId: saleWarrantyId ?? undefined,
        serialNumberId: serialNumberId ?? undefined,
        saleId: input.saleId,
      });
      if (warranty) {
        saleWarrantyId = String(warranty.id);
        underWarranty = true;
        assertWarrantyClaimAllowed({
          id: String(warranty.id),
          saleId: String(warranty.sale_id),
          productId: warranty.product_id ? String(warranty.product_id) : null,
          serialNumberId: warranty.serial_number_id ? String(warranty.serial_number_id) : null,
          warrantyStart: String(warranty.warranty_start),
          warrantyEnd: String(warranty.warranty_end),
        });
        assertSerialMatchesWarranty(
          {
            id: String(warranty.id),
            saleId: String(warranty.sale_id),
            productId: warranty.product_id ? String(warranty.product_id) : null,
            serialNumberId: warranty.serial_number_id ? String(warranty.serial_number_id) : null,
            warrantyStart: String(warranty.warranty_start),
            warrantyEnd: String(warranty.warranty_end),
          },
          serialNumberId,
        );
      }
    }

    const jobNumber = `JOB-${Date.now()}`;
    const { data: job, error } = await this.db
      .from("service_jobs")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId ?? null,
        job_number: jobNumber,
        customer_id: input.customerId ?? null,
        product_id: input.productId ?? null,
        serial_number_id: serialNumberId,
        serial_code: input.serialCode ?? null,
        sale_id: input.saleId ?? null,
        sale_warranty_id: saleWarrantyId,
        under_warranty: underWarranty,
        complaint: input.complaint,
        issue_found: input.issueFound ?? null,
        received_date: input.receivedDate ?? new Date().toISOString().slice(0, 10),
        technician_user_id: input.technicianUserId ?? null,
        repair_cost: input.repairCost ?? 0,
        service_charges: input.serviceCharges ?? 0,
        status: "received",
        notes: input.notes ?? null,
        idempotency_key: input.idempotencyKey,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return job;
  }

  async advanceServiceJob(id: string, to: ServiceJobStatus) {
    const { data: job, error } = await this.db.from("service_jobs").select("*").eq("id", id).single();
    if (error) throw error;
    assertServiceJobTransition(job.status as ServiceJobStatus, to);
    const { data, error: updErr } = await this.db
      .from("service_jobs")
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr) throw updErr;
    return data;
  }

  async addServicePart(input: AddServicePartInput, userId?: string | null) {
    const { data: job } = await this.db
      .from("service_jobs")
      .select("*")
      .eq("id", input.serviceJobId)
      .single();
    if (!job) throw new ValidationDomainError("Service job not found");

    const qty = typeof input.qty === "number" ? input.qty : Number(input.qty);
    const lineTotal = Math.round(qty * (input.unitCost ?? 0) * 100) / 100;

    const { data: part, error } = await this.db
      .from("service_job_parts")
      .insert({
        organization_id: input.organizationId,
        service_job_id: input.serviceJobId,
        product_id: input.productId,
        unit_id: input.unitId,
        qty: String(qty),
        unit_cost: input.unitCost ?? 0,
        line_total: lineTotal,
        stock_consumed: true,
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.inventory.postMovement(
      {
        organizationId: input.organizationId,
        branchId: String(job.branch_id),
        warehouseId: input.warehouseId,
        productId: input.productId,
        unitId: input.unitId,
        movementType: "repair_consumption",
        qtyDelta: String(qty),
        unitCost: String(input.unitCost ?? 0),
        sourceType: "service_job",
        sourceId: input.serviceJobId,
        operationId: crypto.randomUUID(),
        reason: `Parts for ${job.job_number}`,
      },
      userId,
    );

    return part;
  }

  async getServiceBill(jobId: string) {
    const { data: job } = await this.db.from("service_jobs").select("*").eq("id", jobId).single();
    if (!job) throw new ValidationDomainError("Service job not found");
    const { data: parts } = await this.db
      .from("service_job_parts")
      .select("line_total")
      .eq("service_job_id", jobId);
    const partsTotal = (parts ?? []).reduce((s, p) => s + Number(p.line_total ?? 0), 0);
    return {
      job,
      ...computeServiceBill({
        repairCost: Number(job.repair_cost ?? 0),
        serviceCharges: Number(job.service_charges ?? 0),
        partsTotal,
        underWarranty: Boolean(job.under_warranty),
      }),
      partsTotal,
    };
  }

  async listServiceJobs(organizationId: string, branchId?: string) {
    let q = this.db
      .from("service_jobs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  // --- Warranty ---
  async lookupWarranty(organizationId: string, query: WarrantyLookupQuery) {
    if (query.serialCode) {
      const { data: serial } = await this.db
        .from("stock_serials")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("serial_number", query.serialCode)
        .maybeSingle();
      if (!serial) return [];
      const { data } = await this.db
        .from("sale_warranties")
        .select("*, sales(invoice_number, customer_id)")
        .eq("organization_id", organizationId)
        .eq("serial_number_id", serial.id);
      return data ?? [];
    }
    if (query.invoiceNumber) {
      const { data: sale } = await this.db
        .from("sales")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("invoice_number", query.invoiceNumber)
        .maybeSingle();
      if (!sale) return [];
      const { data } = await this.db
        .from("sale_warranties")
        .select("*, sales(invoice_number, customer_id)")
        .eq("sale_id", sale.id);
      return data ?? [];
    }
    if (query.saleId) {
      const { data } = await this.db
        .from("sale_warranties")
        .select("*, sales(invoice_number, customer_id)")
        .eq("sale_id", query.saleId);
      return data ?? [];
    }
    if (query.productId) {
      const { data } = await this.db
        .from("sale_warranties")
        .select("*, sales(invoice_number, customer_id)")
        .eq("organization_id", organizationId)
        .eq("product_id", query.productId)
        .limit(50);
      return data ?? [];
    }
    return [];
  }

  async createWarrantyClaim(input: CreateWarrantyClaimInput, userId?: string | null) {
    const { data: warranty } = await this.db
      .from("sale_warranties")
      .select("*")
      .eq("id", input.saleWarrantyId)
      .single();
    if (!warranty) throw new ValidationDomainError("Warranty record not found");

    assertWarrantyClaimAllowed({
      id: String(warranty.id),
      saleId: String(warranty.sale_id),
      productId: warranty.product_id ? String(warranty.product_id) : null,
      serialNumberId: warranty.serial_number_id ? String(warranty.serial_number_id) : null,
      warrantyStart: String(warranty.warranty_start),
      warrantyEnd: String(warranty.warranty_end),
    });

    const { data: sale } = await this.db
      .from("sales")
      .select("customer_id")
      .eq("id", warranty.sale_id)
      .maybeSingle();

    const claimNumber = `WC-${Date.now()}`;
    const { data: claim, error } = await this.db
      .from("warranty_claims")
      .insert({
        organization_id: input.organizationId,
        branch_id: input.branchId,
        claim_number: claimNumber,
        sale_warranty_id: input.saleWarrantyId,
        sale_id: warranty.sale_id,
        customer_id: sale?.customer_id ?? null,
        product_id: warranty.product_id,
        serial_number_id: warranty.serial_number_id,
        claim_type: input.claimType,
        status: "open",
        description: input.description,
        service_job_id: input.serviceJobId ?? null,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return claim;
  }

  async postWarrantyReplacement(input: WarrantyReplacementInput, userId?: string | null) {
    const { data: claim } = await this.db
      .from("warranty_claims")
      .select("*")
      .eq("id", input.warrantyClaimId)
      .single();
    if (!claim) throw new ValidationDomainError("Claim not found");
    if (claim.claim_type !== "replacement") {
      throw new ValidationDomainError("Claim is not a replacement claim");
    }

    const qty = typeof input.qty === "number" ? input.qty : Number(input.qty ?? 1);

    // Issue replacement unit to customer (stock out). Tag via source_type for audit.
    await this.inventory.postMovement(
      {
        organizationId: input.organizationId,
        branchId: String(claim.branch_id),
        warehouseId: input.warehouseId,
        productId: input.newProductId,
        unitId: input.unitId,
        movementType: "sale",
        qtyDelta: String(qty),
        sourceType: "warranty_claim",
        sourceId: input.warrantyClaimId,
        operationId: crypto.randomUUID(),
        serialNumberId: input.newSerialNumberId,
        reason: `Warranty replacement ${claim.claim_number}`,
      },
      userId,
    );

    const { data: replacement, error } = await this.db
      .from("warranty_replacements")
      .insert({
        organization_id: input.organizationId,
        warranty_claim_id: input.warrantyClaimId,
        sale_warranty_id: claim.sale_warranty_id,
        old_product_id: claim.product_id,
        old_serial_number_id: claim.serial_number_id,
        new_product_id: input.newProductId,
        new_serial_number_id: input.newSerialNumberId ?? null,
        warehouse_id: input.warehouseId,
        unit_id: input.unitId,
        qty: String(qty),
        notes: input.notes ?? null,
        created_by: userId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await this.db
      .from("warranty_claims")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.warrantyClaimId);

    return replacement;
  }

  async listWarrantyClaims(organizationId: string, branchId?: string) {
    let q = this.db
      .from("warranty_claims")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async listReplacementHistory(saleWarrantyId: string) {
    const { data, error } = await this.db
      .from("warranty_replacements")
      .select("*")
      .eq("sale_warranty_id", saleWarrantyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  private async findWarranty(input: {
    saleWarrantyId?: string;
    serialNumberId?: string;
    saleId?: string;
  }): Promise<Row | null> {
    if (input.saleWarrantyId) {
      const { data } = await this.db
        .from("sale_warranties")
        .select("*")
        .eq("id", input.saleWarrantyId)
        .maybeSingle();
      return data;
    }
    if (input.serialNumberId) {
      const { data } = await this.db
        .from("sale_warranties")
        .select("*")
        .eq("serial_number_id", input.serialNumberId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    }
    if (input.saleId) {
      const { data } = await this.db
        .from("sale_warranties")
        .select("*")
        .eq("sale_id", input.saleId)
        .limit(1)
        .maybeSingle();
      return data;
    }
    return null;
  }

  private async insertLines(
    table: "quotation_items" | "sales_order_items",
    fk: "quotation_id" | "sales_order_id",
    parentId: string,
    organizationId: string,
    items: CreateQuotationInput["items"],
  ) {
    const rows = items.map((item, index) => {
      const qty = typeof item.qty === "number" ? item.qty : Number(item.qty);
      const lineGross = qty * item.unitPrice;
      const lineTotal =
        Math.round((lineGross - (item.discount ?? 0) + (item.tax ?? 0)) * 100) / 100;
      return {
        organization_id: organizationId,
        [fk]: parentId,
        line_no: index + 1,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        unit_id: item.unitId,
        qty: String(qty),
        unit_price: item.unitPrice,
        discount_amount: item.discount ?? 0,
        tax_amount: item.tax ?? 0,
        line_total: lineTotal,
      };
    });
    const { error } = await this.db.from(table).insert(rows);
    if (error) throw error;
  }
}
