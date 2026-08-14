import type { CreateSaleInput, SaleItemInput } from "@electronic-erp/contracts";
import { buildSaleJournalLines } from "./accounting-posting.js";
import { calculateSaleTotals } from "./sale-totals.js";
import { assertDiscountAllowed, effectiveDiscountPercent } from "./discount-policy.js";
import { ValidationDomainError } from "./errors.js";
import { roundMoney } from "./money.js";
import { applyDiscount } from "./pos-discount.js";
import { assertPosPaymentPrepared, preparePosPayments } from "./pos-payment.js";
import { preparePosSaleLine, type QuantityPriceBreak } from "./pos-pricing.js";
import type { PosTaxRateInput } from "./pos-tax.js";
import { buildSaleFinalizationAuditRow } from "./sale-finalization.js";
import { buildCommissionAccrual } from "./pos-commission.js";
import { sha256Utf8 } from "./sha256.js";

/**
 * Derive a RFC4122-shaped UUID from a stable seed (SHA-256).
 * Used so stock_movements.operation_id stays a real UUID while remaining
 * deterministic for (parentOp, product, line, purpose) — preserves per-line
 * idempotency under unique (organization_id, operation_id).
 * Parent sale correlation remains sales.operation_id + movements.source_id.
 *
 * ID relationship (do not conflate):
 * - idempotencyKey → sales.idempotency_key — **sale-level** duplicate gate (posted → return; draft → reject)
 * - operationId (sale) = input.operationId ?? idempotencyKey → sales.operation_id / payment.operation_id
 * - stock movement operation_id = saleStockMovementOperationId(...) — **per-line** UUID; NEVER parent+"-"+product
 * - sale id → stock_movements.source_id / payment source_id — business correlation
 * - payment id → payments row; payment duplicates also keyed by same sale idempotencyKey
 *
 * Double-submit of a posted sale must hit findSaleByIdempotency and skip all stock writes.
 * Inventory unique (organization_id, operation_id) is a second line of defense for movement retries.
 *
 * Uses pure-JS SHA-256 (not node:crypto) so Vite web builds can import this module.
 */
export function uuidFromStableSeed(seed: string): string {
  const hash = sha256Utf8(seed);
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // UUID version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  let hex = "";
  for (let i = 0; i < 16; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Per-line stock write id — never concatenate UUID strings. */
export function saleStockMovementOperationId(
  parentOperationId: string,
  productId: string,
  lineIndex: number,
  purpose: "sale" | "reverse",
): string {
  return uuidFromStableSeed(
    `electronic-erp:stock-movement:${purpose}:${parentOperationId}:${productId}:${lineIndex}`,
  );
}

/** Return/exchange stock ids — never concatenate UUID strings. Keep `in`/`dmg` seeds stable with Phase 1C/3A. */
export function saleReturnStockMovementOperationId(
  idempotencyKey: string,
  originalSaleItemId: string,
  purpose: "in" | "dmg" | "ex",
  exchangeProductId?: string,
): string {
  const seed =
    purpose === "ex" && exchangeProductId
      ? `electronic-erp:stock-movement:sale_return:ex:${idempotencyKey}:${originalSaleItemId}:${exchangeProductId}`
      : `electronic-erp:stock-movement:sale_return:${purpose}:${idempotencyKey}:${originalSaleItemId}`;
  return uuidFromStableSeed(seed);
}

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
  /**
   * Optional catalog snapshot. When present, posted unit prices/discounts/tax
   * are re-resolved here — client money is not trusted.
   */
  getProductPricing?(
    productId: string,
    context: {
      organizationId: string;
      customerId?: string | null;
      unitId: string;
    },
  ): Promise<ProductPricingSnapshot | null>;
}

export type ProductPricingSnapshot = {
  retailPrice: number;
  wholesalePrice: number;
  dealerPrice: number;
  customerPrice?: number | null;
  promotionPrice?: number | null;
  quantityBreaks?: QuantityPriceBreak[];
  unitId?: string;
  taxRate?: PosTaxRateInput | null;
};

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
 * Local SQLite offline database has been removed; online API is the only write path.
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

    const pricedItems = await resolvePostedSaleItems(this.ports, input);
    const normalized = normalizeItems(pricedItems);
    const preInvoice = calculateSaleTotals(normalized, 0);
    const invoiceDiscountAmount = resolveInvoiceDiscountAmount(input, preInvoice);
    const items = normalized.map((item) => ({
      ...item,
      discount: roundMoney(item.discount ?? 0),
      tax: roundMoney(item.tax ?? 0),
      unitPrice: roundMoney(item.unitPrice),
    }));
    const totals = calculateSaleTotals(items, invoiceDiscountAmount);

    for (const item of items) {
      const lineGross = roundMoney(qtyNumber(item.qty) * item.unitPrice);
      const pct =
        (item.discountPercent ?? 0) > 0
          ? Number(item.discountPercent)
          : effectiveDiscountPercent(item.discount ?? 0, lineGross);
      if (pct > 0) {
        const audit = (input.discounts ?? []).find((d) => d.scope === "item");
        assertDiscountAllowed(audit?.approverRole ?? "cashier", pct);
      }
    }

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
    if (invoiceDiscountAmount > 0 && !(input.discounts ?? []).some((d) => d.scope === "invoice")) {
      const percent = effectiveDiscountPercent(invoiceDiscountAmount, totals.subtotal);
      assertDiscountAllowed("cashier", percent);
      audits.push({
        discount_scope: "invoice",
        discount_kind: input.invoiceDiscountKind ?? "fixed",
        percent,
        amount: invoiceDiscountAmount,
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
      reference_id: input.referenceId ?? null,
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
        const lineGross = roundMoney(qty * item.unitPrice);
        const lineTotal = roundMoney(lineGross - (item.discount ?? 0) + (item.tax ?? 0));
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

      for (let lineIndex = 0; lineIndex < items.length; lineIndex += 1) {
        const item = items[lineIndex]!;
        if (item.isManual || !item.productId) continue;
        const stockLine: StockSaleLine = {
          organizationId: input.organizationId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          productId: item.productId,
          unitId: item.unitId,
          qty: String(qtyNumber(item.qty)),
          saleId: sale.id,
          // Valid UUID per line; parent correlation remains sales.operation_id + source_id=saleId
          operationId: saleStockMovementOperationId(
            operationId,
            item.productId,
            lineIndex,
            "sale",
          ),
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
    const accrual = buildCommissionAccrual({
      saleStatus: "posted",
      saleGrandTotal: totals.grandTotal,
      commissionPercent: input.commissionPercent ?? 0,
      salesmanUserId: input.salesmanUserId,
      saleId: sale.id,
    });
    if (accrual?.shouldAccrue) {
      commissionAmount = accrual.row.commissionAmount;
      await this.ports.postCommission({
        organization_id: input.organizationId,
        sale_id: accrual.row.saleId,
        salesman_user_id: accrual.row.salesmanUserId,
        employee_id: accrual.row.employeeId,
        base_amount: accrual.row.baseAmount,
        commission_percent: accrual.row.commissionPercent,
        commission_amount: accrual.row.commissionAmount,
        original_amount: accrual.row.originalAmount,
        status: accrual.row.status,
        paid_amount: 0,
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
      try {
        await this.ports.postAudit(
          buildSaleFinalizationAuditRow({
            organizationId: input.organizationId,
            branchId: input.branchId,
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
            actorUserId: userId,
            deviceId: null,
            grandTotal: totals.grandTotal,
            paidTotal,
            status: "posted",
          }),
        );
      } catch {
        // Sale is already posted. Invalid audit_logs.device_id FK must not fail the API.
      }
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
            // Distinct valid UUID from the forward movement (never stringify-suffix UUIDs)
            operationId: uuidFromStableSeed(
              `electronic-erp:stock-movement:reverse-of:${line.operationId}`,
            ),
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

async function resolvePostedSaleItems(
  ports: SaleTransactionPorts,
  input: CreateSaleInput,
): Promise<CreateSaleInput["items"]> {
  if (!ports.getProductPricing) return input.items;
  const priceLevel = input.priceLevel ?? "retail";
  const next: CreateSaleInput["items"] = [];
  for (const item of input.items) {
    if (item.isManual || !item.productId) {
      next.push(item);
      continue;
    }
    const catalog = await ports.getProductPricing(item.productId, {
      organizationId: input.organizationId,
      customerId: input.customerId ?? null,
      unitId: item.unitId,
    });
    if (!catalog) {
      throw new ValidationDomainError(`Product pricing not found for ${item.productId}`);
    }
    const qty = qtyNumber(item.qty);
    const usePercent = (item.discountPercent ?? 0) > 0;
    const prepared = preparePosSaleLine({
      qty,
      pricing: {
        retailPrice: catalog.retailPrice,
        wholesalePrice: catalog.wholesalePrice,
        dealerPrice: catalog.dealerPrice,
        customerPrice: catalog.customerPrice,
        promotionPrice: catalog.promotionPrice,
        quantityBreaks: catalog.quantityBreaks,
        priceLevel,
        qty,
        unitId: item.unitId,
      },
      discountMode: usePercent ? "percentage" : "fixed",
      discountValue: usePercent ? Number(item.discountPercent) : Number(item.discount ?? 0),
      taxRate: catalog.taxRate ?? null,
    });
    next.push({
      ...item,
      unitPrice: prepared.unitPrice,
      discount: prepared.discount,
      discountPercent: prepared.discountPercent,
      tax: prepared.tax,
    });
  }
  return next;
}

function resolveInvoiceDiscountAmount(
  input: CreateSaleInput,
  preInvoice: ReturnType<typeof calculateSaleTotals>,
): number {
  const base = Math.max(0, roundMoney(preInvoice.subtotal - preInvoice.itemDiscount));
  const invoiceAudit = (input.discounts ?? []).find((d) => d.scope === "invoice");
  if (invoiceAudit?.kind === "percentage" && invoiceAudit.percent != null) {
    return applyDiscount({ base, mode: "percentage", value: invoiceAudit.percent }).amount;
  }
  if (input.invoiceDiscountKind === "percentage") {
    return applyDiscount({ base, mode: "percentage", value: input.discountTotal ?? 0 }).amount;
  }
  return roundMoney(Math.max(0, input.discountTotal ?? 0));
}
