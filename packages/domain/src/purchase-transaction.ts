import type { CreatePurchaseInput, PurchaseItemInput } from "@electronic-erp/contracts";
import { buildPurchaseJournalLines } from "./accounting-posting.js";
import { calculatePurchaseTotals } from "./purchase-totals.js";
import { applyPurchaseToSupplierPrice } from "./supplier-pricing.js";
import { ValidationDomainError } from "./errors.js";

export interface PurchaseTransactionPorts {
  findByIdempotency(organizationId: string, key: string): Promise<unknown | null>;
  postPurchaseRecord(payload: Record<string, unknown>): Promise<{ id: string; invoiceNumber: string }>;
  postPurchaseItems(purchaseId: string, items: Array<Record<string, unknown>>): Promise<void>;
  postStockPurchase(input: {
    organizationId: string;
    branchId: string;
    warehouseId: string;
    productId: string;
    unitId: string;
    qty: string;
    unitCost: string;
    purchaseId: string;
    operationId: string;
  }): Promise<void>;
  postSupplierLedger(input: {
    organizationId: string;
    branchId: string;
    supplierId: string;
    amount: string;
    purchaseId: string;
  }): Promise<void>;
  postSupplierPayment?(input: Record<string, unknown>): Promise<void>;
  getSupplierPrice(input: {
    organizationId: string;
    supplierId: string;
    productId: string;
    variantId?: string | null;
  }): Promise<{
    lastPurchaseRate: number;
    averagePurchaseRate: number;
    supplierPrice: number;
    purchaseCount: number;
  } | null>;
  upsertSupplierPrice(input: Record<string, unknown>): Promise<void>;
  postPriceHistory(input: Record<string, unknown>): Promise<void>;
  postJournal(input: Record<string, unknown>): Promise<void>;
}

function qtyNumber(qty: PurchaseItemInput["qty"]): number {
  return typeof qty === "number" ? qty : Number(qty);
}

/**
 * Central purchase orchestration — UI must not duplicate stock/ledger/accounting.
 */
export class PurchaseTransactionService {
  constructor(private readonly ports: PurchaseTransactionPorts) {}

  async postPurchase(input: CreatePurchaseInput, userId?: string | null) {
    const existing = await this.ports.findByIdempotency(
      input.organizationId,
      input.idempotencyKey,
    );
    if (existing && typeof existing === "object" && existing !== null && "id" in existing) {
      const row = existing as { id: string; invoice_number?: string; invoiceNumber?: string };
      const totals = calculatePurchaseTotals(input.items, input.discountTotal ?? 0);
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber ?? row.invoice_number ?? input.invoiceNumber,
        totals,
        paidTotal: input.paidTotal ?? 0,
        remainingTotal: totals.grandTotal - (input.paidTotal ?? 0),
        duplicate: true as const,
      };
    }

    const totals = calculatePurchaseTotals(input.items, input.discountTotal ?? 0);
    const paidTotal = input.paidTotal ?? 0;
    if (paidTotal - totals.grandTotal > 0.009) {
      throw new ValidationDomainError("Paid total exceeds purchase total");
    }
    const remainingTotal = Math.round((totals.grandTotal - paidTotal) * 100) / 100;
    const operationId = input.operationId ?? input.idempotencyKey;

    const purchase = await this.ports.postPurchaseRecord({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      warehouse_id: input.warehouseId,
      supplier_id: input.supplierId,
      invoice_number: input.invoiceNumber,
      invoice_date: input.invoiceDate ?? new Date().toISOString().slice(0, 10),
      status: "posted",
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      grand_total: totals.grandTotal,
      paid_total: paidTotal,
      remaining_total: remainingTotal,
      due_date: input.dueDate ?? null,
      notes: input.notes ?? null,
      idempotency_key: input.idempotencyKey,
      device_id: input.deviceId ?? null,
      offline_transaction_id: input.offlineTransactionId ?? null,
      operation_id: operationId,
      sync_state: input.offlineTransactionId ? "pending" : "synced",
      posted_at: new Date().toISOString(),
      created_by: userId ?? null,
    });

    const lineRows = input.items.map((item, index) => {
      const qty = qtyNumber(item.qty);
      const lineGross = qty * item.unitCost;
      const lineTotal =
        Math.round((lineGross - (item.discount ?? 0) + (item.tax ?? 0)) * 100) / 100;
      return {
        organization_id: input.organizationId,
        purchase_id: purchase.id,
        line_no: index + 1,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        unit_id: item.unitId,
        qty: String(qty),
        unit_cost: item.unitCost,
        discount_amount: item.discount ?? 0,
        tax_amount: item.tax ?? 0,
        line_total: lineTotal,
        batch_code: item.batchCode ?? null,
        expiry_date: item.expiryDate ?? null,
        bin_id: item.binId ?? null,
      };
    });
    await this.ports.postPurchaseItems(purchase.id, lineRows);

    for (const item of input.items) {
      const qty = qtyNumber(item.qty);
      await this.ports.postStockPurchase({
        organizationId: input.organizationId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        productId: item.productId,
        unitId: item.unitId,
        qty: String(qty),
        unitCost: String(item.unitCost),
        purchaseId: purchase.id,
        operationId: `${operationId}-${item.productId}`,
      });

      const current = await this.ports.getSupplierPrice({
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        productId: item.productId,
        variantId: item.variantId,
      });
      const next = applyPurchaseToSupplierPrice(current, item.unitCost, qty);
      await this.ports.upsertSupplierPrice({
        organization_id: input.organizationId,
        supplier_id: input.supplierId,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        last_purchase_rate: next.lastPurchaseRate,
        average_purchase_rate: next.averagePurchaseRate,
        supplier_price: next.supplierPrice,
        purchase_count: next.purchaseCount,
        last_purchase_at: new Date().toISOString(),
      });
      await this.ports.postPriceHistory({
        organization_id: input.organizationId,
        supplier_id: input.supplierId,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        purchase_id: purchase.id,
        unit_cost: item.unitCost,
        qty: String(qty),
      });
    }

    await this.ports.postSupplierLedger({
      organizationId: input.organizationId,
      branchId: input.branchId,
      supplierId: input.supplierId,
      amount: String(totals.grandTotal),
      purchaseId: purchase.id,
    });

    if (paidTotal > 0 && this.ports.postSupplierPayment) {
      await this.ports.postSupplierPayment({
        organizationId: input.organizationId,
        branchId: input.branchId,
        supplierId: input.supplierId,
        amount: String(paidTotal),
        paymentMethodId: input.paymentMethodId,
        purchaseId: purchase.id,
        idempotencyKey: input.idempotencyKey,
      });
    }

    await this.ports.postJournal({
      organizationId: input.organizationId,
      branchId: input.branchId,
      sourceType: "purchase",
      sourceId: purchase.id,
      idempotencyKey: input.idempotencyKey,
      memo: `Purchase ${purchase.invoiceNumber}`,
      lines: buildPurchaseJournalLines({
        inventoryAmount: Math.max(0, totals.subtotal - totals.discountTotal),
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        paidCash: paidTotal,
      }),
    });

    return {
      id: purchase.id,
      invoiceNumber: purchase.invoiceNumber,
      totals,
      paidTotal,
      remainingTotal,
      duplicate: false as const,
    };
  }
}
