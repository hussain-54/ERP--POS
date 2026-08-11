import type { CreateSaleInput, SaleItemInput } from "@electronic-erp/contracts";
import { buildSaleJournalLines } from "./accounting-posting.js";
import { calculateSaleTotals } from "./sale-totals.js";
import { assertDiscountAllowed, effectiveDiscountPercent } from "./discount-policy.js";
import { ValidationDomainError } from "./errors.js";

export interface SaleTransactionPorts {
  findSaleByIdempotency(organizationId: string, key: string): Promise<unknown | null>;
  searchStockAvailable(warehouseId: string, productId: string): Promise<string>;
  postSaleRecord(payload: Record<string, unknown>): Promise<{ id: string; invoiceNumber: string }>;
  postSaleItems(saleId: string, items: Array<Record<string, unknown>>): Promise<void>;
  postDiscountAudits(saleId: string, audits: Array<Record<string, unknown>>): Promise<void>;
  postStockSale(input: {
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
  }): Promise<void>;
  postCustomerSaleLedger(input: {
    organizationId: string;
    branchId: string;
    customerId: string;
    amount: string;
    saleId: string;
  }): Promise<void>;
  postSplitPayment(input: Record<string, unknown>): Promise<void>;
  postJournal(input: Record<string, unknown>): Promise<void>;
  postCommission(input: Record<string, unknown>): Promise<void>;
  postWarranties(input: Array<Record<string, unknown>>): Promise<void>;
  createInstallment?(input: Record<string, unknown>): Promise<void>;
  postAnalytics(input: Record<string, unknown>): Promise<void>;
}

function qtyNumber(qty: SaleItemInput["qty"]): number {
  return typeof qty === "number" ? qty : Number(qty);
}

function moneyNumber(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback;
  return typeof v === "number" ? v : Number(v);
}

/**
 * Central sale orchestration — UI must NOT duplicate stock/ledger/payment/accounting writes.
 * All side effects go through ports implemented by the POS repository.
 *
 * ATOMICITY LIMIT: steps are sequential Supabase writes (not one Postgres transaction).
 * Idempotency keys reduce duplicate risk; a mid-chain failure can leave partial side effects.
 * A single RPC wrapping the full chain is the intended hardening path — do not claim ACID yet.
 */
export class SaleTransactionService {
  constructor(private readonly ports: SaleTransactionPorts) {}

  async postSale(input: CreateSaleInput, userId?: string | null): Promise<{
    id: string;
    invoiceNumber: string;
    totals: ReturnType<typeof calculateSaleTotals>;
    paidTotal: number;
    remainingTotal: number;
  }> {
    const existing = await this.ports.findSaleByIdempotency(
      input.organizationId,
      input.idempotencyKey,
    );
    if (existing && typeof existing === "object" && existing !== null && "id" in existing) {
      const row = existing as { id: string; invoiceNumber?: string; invoice_number?: string };
      const totals = calculateSaleTotals(
        normalizeItems(input.items),
        input.discountTotal ?? 0,
      );
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber ?? row.invoice_number ?? "",
        totals,
        paidTotal: 0,
        remainingTotal: totals.grandTotal,
      };
    }

    const items = normalizeItems(input.items);
    const totals = calculateSaleTotals(items, input.discountTotal ?? 0);

    // Discount approval checks + audit payloads
    const audits: Array<Record<string, unknown>> = [];
    for (const d of input.discounts ?? []) {
      const percent =
        d.percent ??
        effectiveDiscountPercent(d.amount, d.scope === "invoice" ? totals.subtotal : d.amount || 1);
      assertDiscountAllowed(d.approverRole, percent);
      audits.push({
        discount_scope: d.scope,
        discount_kind: d.kind,
        percent,
        amount: d.amount,
        approver_role: d.approverRole,
        reason: d.reason ?? null,
        approved_by: userId ?? null,
      });
    }
    if ((input.discountTotal ?? 0) > 0 && !(input.discounts ?? []).some((d) => d.scope === "invoice")) {
      const percent = effectiveDiscountPercent(input.discountTotal ?? 0, totals.subtotal);
      assertDiscountAllowed("cashier", percent);
      audits.push({
        discount_scope: "invoice",
        discount_kind: input.invoiceDiscountKind ?? "fixed",
        percent,
        amount: input.discountTotal,
        approver_role: "cashier",
        reason: "invoice discount",
        approved_by: userId ?? null,
      });
    }

    // Stock validation for catalog items
    for (const item of items) {
      if (item.isManual || !item.productId) continue;
      const available = await this.ports.searchStockAvailable(input.warehouseId, item.productId);
      if (Number(available) + 1e-9 < qtyNumber(item.qty)) {
        throw new ValidationDomainError(
          `Insufficient stock for product ${item.productId}: available ${available}`,
        );
      }
    }

    const paidTotal = (input.payments ?? []).reduce((s, p) => s + moneyNumber(p.amount), 0);
    if (paidTotal - totals.grandTotal > 0.009) {
      throw new ValidationDomainError("Payment total exceeds grand total");
    }
    const remainingTotal = Math.round((totals.grandTotal - paidTotal) * 100) / 100;
    if (!input.customerId && remainingTotal > 0.009) {
      throw new ValidationDomainError("Walk-in sales must be paid in full");
    }
    const paymentStatus =
      paidTotal <= 0 ? "unpaid" : remainingTotal <= 0.009 ? "paid" : "partial";

    const operationId = input.operationId ?? input.idempotencyKey;
    const sale = await this.ports.postSaleRecord({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      warehouse_id: input.warehouseId,
      customer_id: input.customerId ?? null,
      salesman_user_id: input.salesmanUserId ?? null,
      reference_name: input.referenceName ?? null,
      price_level_id: input.priceLevelId ?? null,
      pos_mode: input.posMode ?? "advanced",
      locale_mode: input.localeMode ?? "en",
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      grand_total: totals.grandTotal,
      paid_total: paidTotal,
      remaining_total: remainingTotal,
      payment_status: paymentStatus,
      due_date: input.dueDate ?? null,
      notes: input.notes ?? null,
      warranty_notes: input.warrantyNotes ?? null,
      status: "posted",
      posted_at: new Date().toISOString(),
      idempotency_key: input.idempotencyKey,
      device_id: input.deviceId ?? null,
      offline_transaction_id: input.offlineTransactionId ?? null,
      operation_id: operationId,
      sync_state: input.offlineTransactionId ? "pending" : "synced",
      created_by: userId ?? null,
    });

    const lineRows = items.map((item, index) => {
      const qty = qtyNumber(item.qty);
      const lineGross = qty * item.unitPrice;
      const lineTotal = Math.round((lineGross - (item.discount ?? 0) + (item.tax ?? 0)) * 100) / 100;
      return {
        organization_id: input.organizationId,
        sale_id: sale.id,
        line_no: index + 1,
        product_id: item.productId ?? null,
        variant_id: item.variantId ?? null,
        is_manual: Boolean(item.isManual),
        manual_name: item.manualName ?? null,
        manual_item_code: item.manualItemCode ?? null,
        manual_description: item.manualDescription ?? null,
        unit_id: item.unitId,
        qty: String(qty),
        unit_price: item.unitPrice,
        discount_amount: item.discount ?? 0,
        discount_percent: item.discountPercent ?? 0,
        tax_amount: item.tax ?? 0,
        line_total: lineTotal,
        batch_id: item.batchId ?? null,
        serial_number_id: item.serialNumberId ?? null,
        warranty_days: item.warrantyDays ?? 0,
        cost_price: item.costPrice ?? 0,
      };
    });
    await this.ports.postSaleItems(sale.id, lineRows);
    if (audits.length) await this.ports.postDiscountAudits(sale.id, audits);

    // Inventory
    for (const item of items) {
      if (item.isManual || !item.productId) continue;
      await this.ports.postStockSale({
        organizationId: input.organizationId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: item.productId,
        unitId: item.unitId,
        qty: String(qtyNumber(item.qty)),
        saleId: sale.id,
        operationId: `${operationId}-${item.productId}`,
        batchId: item.batchId,
        serialNumberId: item.serialNumberId,
      });
    }

    // Customer ledger (full invoice as receivable), then payments reduce it.
    // Walk-in (no customer): skip AR ledger; still post payment rows + journal cash.
    if (input.customerId) {
      await this.ports.postCustomerSaleLedger({
        organizationId: input.organizationId,
        branchId: input.branchId,
        customerId: input.customerId,
        amount: String(totals.grandTotal),
        saleId: sale.id,
      });
    }

    if ((input.payments ?? []).length) {
      await this.ports.postSplitPayment({
        organizationId: input.organizationId,
        branchId: input.branchId,
        direction: "receive",
        partyType: "customer",
        customerId: input.customerId,
        splits: (input.payments ?? []).map((p) => ({
          paymentMethodId: p.paymentMethodId,
          amount: String(moneyNumber(p.amount)),
          reference: p.reference,
        })),
        billTotal: String(paidTotal || totals.grandTotal),
        idempotencyKey: input.idempotencyKey,
        operationId,
        creditApprovalId: input.creditApprovalId,
        sourceType: "sale",
        sourceId: sale.id,
        deviceId: input.deviceId,
        offlineTransactionId: input.offlineTransactionId,
      });
    }

    // Automatic double-entry: sales, AR/cash/bank, tax, discount, inventory, COGS
    const cogs = items.reduce((s, i) => s + qtyNumber(i.qty) * (i.costPrice ?? 0), 0);
    await this.ports.postJournal({
      organizationId: input.organizationId,
      branchId: input.branchId,
      sourceType: "sale",
      sourceId: sale.id,
      idempotencyKey: input.idempotencyKey,
      memo: `Sale ${sale.invoiceNumber}`,
      lines: buildSaleJournalLines({
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        cogs,
        paidCash: paidTotal,
      }),
    });

    if (input.salesmanUserId && (input.commissionPercent ?? 0) > 0) {
      const commissionAmount =
        Math.round(((totals.grandTotal * (input.commissionPercent ?? 0)) / 100) * 100) / 100;
      await this.ports.postCommission({
        organization_id: input.organizationId,
        sale_id: sale.id,
        salesman_user_id: input.salesmanUserId,
        base_amount: totals.grandTotal,
        commission_percent: input.commissionPercent,
        commission_amount: commissionAmount,
      });
    }

    const warranties = items
      .filter((i) => (i.warrantyDays ?? 0) > 0)
      .map((i, idx) => {
        const start = new Date();
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + (i.warrantyDays ?? 0));
        return {
          organization_id: input.organizationId,
          sale_id: sale.id,
          line_no: idx + 1,
          product_id: i.productId ?? null,
          serial_number_id: i.serialNumberId ?? null,
          warranty_start: start.toISOString().slice(0, 10),
          warranty_end: end.toISOString().slice(0, 10),
        };
      });
    if (warranties.length) await this.ports.postWarranties(warranties);

    if (input.createInstallment && input.customerId && this.ports.createInstallment) {
      await this.ports.createInstallment({
        organizationId: input.organizationId,
        branchId: input.branchId,
        customerId: input.customerId,
        sourceType: "sale",
        sourceId: sale.id,
        totalAmount: String(totals.grandTotal),
        downPayment: input.createInstallment.downPayment,
        installmentCount: input.createInstallment.installmentCount,
        startDate: input.createInstallment.startDate,
      });
    }

    await this.ports.postAnalytics({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      sale_id: sale.id,
      event_type: "sale_posted",
      payload: {
        grandTotal: totals.grandTotal,
        paidTotal,
        itemCount: items.length,
        offline: Boolean(input.offlineTransactionId),
      },
    });

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      totals,
      paidTotal,
      remainingTotal,
    };
  }
}

function normalizeItems(items: CreateSaleInput["items"]): Array<SaleItemInput & { unitPrice: number; discount: number; tax: number; qty: number }> {
  return items.map((item) => ({
    ...item,
    qty: qtyNumber(item.qty),
    unitPrice: item.unitPrice,
    discount: item.discount ?? 0,
    tax: item.tax ?? 0,
    discountPercent: item.discountPercent ?? 0,
    isManual: item.isManual ?? false,
    warrantyDays: item.warrantyDays ?? 0,
    costPrice: item.costPrice ?? 0,
  }));
}
