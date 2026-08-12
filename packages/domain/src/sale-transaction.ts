import type { CreateSaleInput, SaleItemInput } from "@electronic-erp/contracts";
import { buildSaleJournalLines } from "./accounting-posting.js";
import { calculateSaleTotals } from "./sale-totals.js";
import { assertDiscountAllowed, effectiveDiscountPercent } from "./discount-policy.js";
import { ValidationDomainError } from "./errors.js";
import { assertPosPaymentPrepared, preparePosPayments } from "./pos-payment.js";
import { buildSaleFinalizationAuditRow } from "./sale-finalization.js";

export type StockSaleLine = {
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
};

export interface SaleTransactionPorts {
  findSaleByIdempotency(organizationId: string, key: string): Promise<unknown | null>;
  searchStockAvailable(warehouseId: string, productId: string): Promise<string>;
  postSaleRecord(payload: Record<string, unknown>): Promise<{ id: string; invoiceNumber: string }>;
  postSaleItems(saleId: string, items: Array<Record<string, unknown>>): Promise<void>;
  postDiscountAudits(saleId: string, audits: Array<Record<string, unknown>>): Promise<void>;
  postStockSale(input: StockSaleLine): Promise<void>;
  /** Reverse a stock deduction when compensating a failed finalization. */
  reverseStockSale?(input: StockSaleLine): Promise<void>;
  postCustomerSaleLedger(input: {
    organizationId: string;
    branchId: string;
    customerId: string;
    amount: string;
    saleId: string;
  }): Promise<void>;
  postSplitPayment(input: Record<string, unknown>): Promise<void>;
  /** Set paid totals only after payment is accepted by business logic. */
  updateSalePaymentState?(
    saleId: string,
    input: { paidTotal: number; remainingTotal: number; paymentStatus: string },
  ): Promise<void>;
  /**
   * Promote draft → posted. Must only run after stock + payment + ledger succeed.
   * This is the sole transition that marks the sale completed.
   */
  finalizeSaleStatus(saleId: string, input: {
    paidTotal: number;
    remainingTotal: number;
    paymentStatus: string;
    postedAt?: string;
  }): Promise<void>;
  /**
   * Mark incomplete draft as void and free the idempotency key for a safe retry.
   */
  voidIncompleteSale(saleId: string, reason: string): Promise<void>;
  postJournal(input: Record<string, unknown>): Promise<void>;
  postCommission(input: Record<string, unknown>): Promise<void>;
  postWarranties(input: Array<Record<string, unknown>>): Promise<void>;
  createInstallment?(input: Record<string, unknown>): Promise<void>;
  postAnalytics(input: Record<string, unknown>): Promise<void>;
  postAudit?(row: Record<string, unknown>): Promise<void>;
}

function qtyNumber(qty: SaleItemInput["qty"]): number {
  return typeof qty === "number" ? qty : Number(qty);
}

function moneyNumber(v: number | string | undefined, fallback = 0): number {
  if (v == null) return fallback;
  return typeof v === "number" ? v : Number(v);
}

function readExistingSale(existing: object): {
  id: string;
  invoiceNumber: string;
  status: string;
  paidTotal: number;
  remainingTotal: number;
  grandTotal: number;
} {
  const row = existing as Record<string, unknown>;
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoiceNumber ?? row.invoice_number ?? ""),
    status: String(row.status ?? ""),
    paidTotal: Number(row.paidTotal ?? row.paid_total ?? 0),
    remainingTotal: Number(row.remainingTotal ?? row.remaining_total ?? 0),
    grandTotal: Number(row.grandTotal ?? row.grand_total ?? 0),
  };
}

/**
 * Central sale orchestration — UI must NOT duplicate stock/ledger/payment/accounting writes.
 * All side effects go through ports implemented by the POS repository (Supabase online).
 * Offline desktop posts via OfflinePosEngine → sync → PosRepository (same domain path).
 *
 * Finalization workflow (safe domain transaction):
 * 1. Idempotency — return posted sale; reject in-progress draft; block void reuse via port
 * 2. Validate discounts, stock availability, payments
 * 3. Insert sale as **draft** (not completed)
 * 4. Items → stock → customer balance → payment → payment state
 * 5. On mid-chain failure: reverse applied stock, void draft (never leave posted orphan)
 * 6. **finalizeSaleStatus → posted** only after critical path succeeds
 * 7. Journal, commission, warranties, installment, analytics, audit (post-commit side effects)
 *
 * Steps are sequential writes (not one Postgres RPC). Draft→posted gate + compensation
 * prevent “sale completed without stock”. A single DB transaction RPC remains the hardening path.
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
    if (existing && typeof existing === "object" && existing !== null) {
      const row = readExistingSale(existing);
      if (row.status === "posted") {
        const totals = calculateSaleTotals(
          normalizeItems(input.items),
          input.discountTotal ?? 0,
        );
        return {
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          totals,
          paidTotal: row.paidTotal,
          remainingTotal:
            row.remainingTotal ||
            Math.max(0, Math.round((row.grandTotal - row.paidTotal) * 100) / 100),
        };
      }
      if (row.status === "draft") {
        throw new ValidationDomainError(
          "Sale finalization already in progress for this idempotency key — avoid duplicate submission",
        );
      }
      if (row.status === "void") {
        // Key should have been freed on void; if still present, block duplicate invoice.
        throw new ValidationDomainError(
          "Previous attempt for this idempotency key was voided — retry with a fresh key",
        );
      }
      // held / returned / exchanged — treat as duplicate protection
      throw new ValidationDomainError(
        `Sale already exists for this idempotency key (status=${row.status})`,
      );
    }

    const items = normalizeItems(input.items);
    const totals = calculateSaleTotals(items, input.discountTotal ?? 0);

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

    for (const item of items) {
      if (item.isManual || !item.productId) continue;
      const available = await this.ports.searchStockAvailable(input.warehouseId, item.productId);
      if (Number(available) + 1e-9 < qtyNumber(item.qty)) {
        throw new ValidationDomainError(
          `Insufficient stock for product ${item.productId}: available ${available}`,
        );
      }
    }

    const prep = preparePosPayments({
      grandTotal: totals.grandTotal,
      lines: (input.payments ?? []).map((p) => ({
        paymentMethodId: p.paymentMethodId,
        amount: moneyNumber(p.amount),
        amountReceived: p.amountReceived != null ? moneyNumber(p.amountReceived) : null,
        reference: p.reference,
        kind: p.methodKind,
      })),
      walkIn: !input.customerId,
      hasCustomer: Boolean(input.customerId),
      allowCreditDue: Boolean(input.customerId),
      useInstallment: Boolean(input.createInstallment),
      isAdvance: Boolean(input.isAdvancePayment),
      allowRemaining: Boolean(input.customerId),
    });
    assertPosPaymentPrepared(prep);
    const paidTotal = prep.paidTowardBill;
    const remainingTotal = prep.remaining;

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
      paid_total: 0,
      remaining_total: totals.grandTotal,
      payment_status: "unpaid",
      due_date: input.dueDate ?? null,
      notes: input.notes ?? null,
      warranty_notes: input.warrantyNotes ?? null,
      // Draft until stock + payment + ledger succeed — never mark completed early.
      status: "draft",
      posted_at: null,
      idempotency_key: input.idempotencyKey,
      device_id: input.deviceId ?? null,
      offline_transaction_id: input.offlineTransactionId ?? null,
      operation_id: operationId,
      sync_state: input.offlineTransactionId ? "pending" : "synced",
      created_by: userId ?? null,
    });

    const deducted: StockSaleLine[] = [];
    try {
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

      for (const item of items) {
        if (item.isManual || !item.productId) continue;
        const stockLine: StockSaleLine = {
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
        };
        await this.ports.postStockSale(stockLine);
        deducted.push(stockLine);
      }

      if (input.customerId) {
        await this.ports.postCustomerSaleLedger({
          organizationId: input.organizationId,
          branchId: input.branchId,
          customerId: input.customerId,
          amount: String(totals.grandTotal),
          saleId: sale.id,
        });
      }

      if (prep.splits.length) {
        await this.ports.postSplitPayment({
          organizationId: input.organizationId,
          branchId: input.branchId,
          direction: "receive",
          partyType: "customer",
          customerId: input.customerId,
          splits: prep.splits.map((p) => ({
            paymentMethodId: p.paymentMethodId,
            amount: p.amount,
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

      if (this.ports.updateSalePaymentState) {
        await this.ports.updateSalePaymentState(sale.id, {
          paidTotal,
          remainingTotal,
          paymentStatus: prep.paymentStatus,
        });
      }

      // Critical path complete — only now mark sale completed / invoice posted.
      await this.ports.finalizeSaleStatus(sale.id, {
        paidTotal,
        remainingTotal,
        paymentStatus: prep.paymentStatus,
        postedAt: new Date().toISOString(),
      });
    } catch (err) {
      await this.compensateFailedFinalization(sale.id, deducted, err);
      throw err;
    }

    // Post-commit side effects (sale already posted). Failures here do not void the sale.
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

    let commissionAmount: number | null = null;
    if (input.salesmanUserId && (input.commissionPercent ?? 0) > 0) {
      commissionAmount =
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
        frequency: input.createInstallment.frequency ?? "monthly",
        lateFeePercent: input.createInstallment.lateFeePercent ?? 0,
        lateFeeFixed: input.createInstallment.lateFeeFixed ?? "0",
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
        commissionAmount,
      },
    });

    if (this.ports.postAudit) {
      await this.ports.postAudit(
        buildSaleFinalizationAuditRow({
          organizationId: input.organizationId,
          branchId: input.branchId,
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          actorUserId: userId,
          deviceId: input.deviceId,
          grandTotal: totals.grandTotal,
          paidTotal,
          status: "posted",
        }),
      );
    }

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      totals,
      paidTotal,
      remainingTotal,
    };
  }

  private async compensateFailedFinalization(
    saleId: string,
    deducted: StockSaleLine[],
    err: unknown,
  ): Promise<void> {
    const reason = err instanceof Error ? err.message : String(err);
    if (this.ports.reverseStockSale) {
      for (const line of [...deducted].reverse()) {
        try {
          await this.ports.reverseStockSale({
            ...line,
            operationId: `${line.operationId}-reverse`,
          });
        } catch {
          // Best-effort reverse; void still runs so sale is not marked completed.
        }
      }
    }
    try {
      await this.ports.voidIncompleteSale(saleId, reason);
    } catch {
      // Avoid masking the original failure.
    }
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
