import type { CreateSaleReturnInput } from "@electronic-erp/contracts";
import {
  APPROVAL_CHAINS,
  preparePosExchange,
  prepareSaleReturn,
  reasonLabel,
  refundSettlementPlan,
  RETURN_CONDITIONS,
  RETURN_REASON_CODES,
  type RefundMethod,
  type ReturnCondition,
  type ReturnDisposition,
  type ReturnReasonCode,
  type ReturnScope,
} from "@electronic-erp/domain";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { money } from "../format";

export type ReturnWorkspaceMode =
  | "sales"
  | "by-invoice"
  | "by-barcode"
  | "partial"
  | "full"
  | "exchange"
  | "cash-refund"
  | "store-credit"
  | "reasons";

export type ReturnableLineView = {
  saleItemId: string;
  productId: string | null;
  unitId: string;
  name: string;
  soldQty: number;
  previouslyReturnedQty: number;
  unitPrice: number;
  batchId?: string | null;
  maxReturnable: number;
};

export type SelectedReturnLine = {
  saleItemId: string;
  productId: string | null;
  unitId: string;
  name: string;
  qty: number;
  maxReturnable: number;
  unitPrice: number;
  condition: ReturnCondition;
  originalPackaging: boolean;
  accessoriesComplete: boolean;
  inspectionNotes: string;
  batchId?: string | null;
  exchangeProductId?: string | null;
  exchangeProductName?: string;
  exchangeUnitPrice?: number;
};

export type ReturnWorkflowStep =
  | "find"
  | "items"
  | "exchange"
  | "reason"
  | "refund"
  | "approval"
  | "confirm";

export const RETURN_STEP_LABELS: Record<ReturnWorkflowStep, string> = {
  find: "Find sale",
  items: "Select items",
  exchange: "Replacement",
  reason: "Return reason",
  refund: "Refund method",
  approval: "Approval",
  confirm: "Confirm",
};

export { RETURN_REASON_CODES, RETURN_CONDITIONS, reasonLabel };

export const REFUND_METHOD_OPTIONS: Array<{ id: RefundMethod; label: string; hint: string }> = [
  { id: "cash", label: "Cash refund", hint: "Cash paid out — recorded on the sale return, not a live PSP." },
  { id: "bank", label: "Bank transfer", hint: "Refund via bank — reference stored for reconciliation." },
  {
    id: "customer_credit",
    label: "Store credit",
    hint: "Credit posted to customer ledger — requires a customer on the original sale.",
  },
];

export function defaultDisposition(mode: ReturnWorkspaceMode): ReturnDisposition {
  if (mode === "store-credit") return "credit";
  if (mode === "exchange") return "exchange";
  return "refund";
}

export function defaultRefundMethod(mode: ReturnWorkspaceMode): RefundMethod {
  if (mode === "cash-refund") return "cash";
  if (mode === "store-credit") return "customer_credit";
  return "cash";
}

export function workflowSteps(mode: ReturnWorkspaceMode): ReturnWorkflowStep[] {
  const base: ReturnWorkflowStep[] = ["find", "items"];
  if (mode === "exchange") base.push("exchange");
  base.push("reason", "refund", "approval", "confirm");
  return base;
}

export function canApproveReturn(permissions: string[]): boolean {
  return (
    permissions.includes("approvals.act") ||
    permissions.includes("approvals.manage") ||
    permissions.includes("pos.discount_manager") ||
    permissions.includes("pos.discount_owner") ||
    permissions.includes("pos.discount_special")
  );
}

/** Cashier-only users need manager approval before posting monetary returns. */
export function returnNeedsApproval(refundAmount: number, permissions: string[]): boolean {
  if (canApproveReturn(permissions)) return false;
  return refundAmount > 1e-9;
}

export function returnApprovalChainLabel(): string {
  return APPROVAL_CHAINS.return.join(" → ");
}

export function buildSelectedLines(
  lines: ReturnableLineView[],
  qtyByItem: Map<string, number>,
): SelectedReturnLine[] {
  const out: SelectedReturnLine[] = [];
  for (const line of lines) {
    const qty = qtyByItem.get(line.saleItemId) ?? 0;
    if (qty <= 0) continue;
    out.push({
      saleItemId: line.saleItemId,
      productId: line.productId,
      unitId: line.unitId,
      name: line.name,
      qty: Math.min(qty, line.maxReturnable),
      maxReturnable: line.maxReturnable,
      unitPrice: line.unitPrice,
      condition: "good",
      originalPackaging: true,
      accessoriesComplete: true,
      inspectionNotes: "",
      batchId: line.batchId ?? null,
    });
  }
  return out;
}

export function fullReturnSelection(lines: ReturnableLineView[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines) {
    if (line.maxReturnable > 0) map.set(line.saleItemId, line.maxReturnable);
  }
  return map;
}

export function previewReturn(input: {
  disposition: ReturnDisposition;
  refundMethod: RefundMethod | null;
  reasonCode: ReturnReasonCode;
  reasonDetail: string;
  hasCustomer: boolean;
  returnable: ReturnableLineView[];
  selected: SelectedReturnLine[];
  scope?: ReturnScope;
}) {
  const prepared = prepareSaleReturn({
    disposition: input.disposition,
    scope: input.scope,
    reasonCode: input.reasonCode,
    reasonDetail: input.reasonDetail,
    refundMethod: input.refundMethod,
    hasCustomer: input.hasCustomer,
    returnable: input.returnable.map((r) => ({
      saleItemId: r.saleItemId,
      productId: r.productId,
      unitId: r.unitId,
      soldQty: r.soldQty,
      previouslyReturnedQty: r.previouslyReturnedQty,
      unitPrice: r.unitPrice,
      batchId: r.batchId,
    })),
    lines: input.selected.map((s) => ({
      originalSaleItemId: s.saleItemId,
      productId: s.productId,
      unitId: s.unitId,
      qty: s.qty,
      unitPrice: s.unitPrice,
      exchangeProductId: s.exchangeProductId ?? null,
      condition: s.condition,
      originalPackaging: s.originalPackaging,
      accessoriesComplete: s.accessoriesComplete,
      inspectionNotes: s.inspectionNotes || null,
      batchId: s.batchId,
    })),
  });

  const settlement = refundSettlementPlan({
    disposition: prepared.disposition,
    refundMethod: prepared.refundMethod,
    refundAmount: prepared.refundAmount,
  });

  return { prepared, settlement };
}

export function previewExchange(input: {
  reasonCode: ReturnReasonCode;
  reasonDetail: string;
  refundMethod: RefundMethod;
  hasCustomer: boolean;
  returnable: ReturnableLineView[];
  selected: SelectedReturnLine[];
}) {
  const replacements = input.selected
    .filter((s) => s.exchangeProductId)
    .map((s) => ({
      productId: s.exchangeProductId!,
      unitId: s.unitId,
      name: s.exchangeProductName,
      qty: s.qty,
      unitPrice: s.exchangeUnitPrice ?? s.unitPrice,
      stockAvailable: null,
    }));

  return preparePosExchange({
    reasonCode: input.reasonCode,
    reasonDetail: input.reasonDetail,
    refundMethod: input.refundMethod,
    hasCustomer: input.hasCustomer,
    returnDisposition: "refund",
    returnable: input.returnable.map((r) => ({
      saleItemId: r.saleItemId,
      productId: r.productId,
      unitId: r.unitId,
      soldQty: r.soldQty,
      previouslyReturnedQty: r.previouslyReturnedQty,
      unitPrice: r.unitPrice,
      batchId: r.batchId,
    })),
    returnLines: input.selected.map((s) => ({
      originalSaleItemId: s.saleItemId,
      productId: s.productId,
      unitId: s.unitId,
      qty: s.qty,
      unitPrice: s.unitPrice,
      exchangeProductId: null,
      condition: s.condition,
      originalPackaging: s.originalPackaging,
      accessoriesComplete: s.accessoriesComplete,
      inspectionNotes: s.inspectionNotes || null,
      batchId: s.batchId,
    })),
    replacements,
  });
}

export function formatSettlementLabel(settlement: ReturnType<typeof refundSettlementPlan>): string {
  if (settlement.kind === "none") return "No cash refund — stock / exchange only";
  if (settlement.kind === "customer_credit") return `Store credit ${money(settlement.amount)}`;
  return `${settlement.paymentKind === "bank" ? "Bank" : "Cash"} refund ${money(settlement.amount)}`;
}

export function buildPostReturnBody(input: {
  branchId: string;
  warehouseId: string;
  originalSaleId: string;
  disposition: ReturnDisposition;
  refundMethod: RefundMethod | null;
  reasonCode: ReturnReasonCode;
  reasonDetail: string;
  confirmationNotes: string;
  hasCustomer: boolean;
  returnable: ReturnableLineView[];
  selected: SelectedReturnLine[];
  idempotencyKey: string;
}): Omit<CreateSaleReturnInput, "organizationId"> {
  const preview = previewReturn({
    disposition: input.disposition,
    refundMethod: input.refundMethod,
    reasonCode: input.reasonCode,
    reasonDetail: input.reasonDetail,
    hasCustomer: input.hasCustomer,
    returnable: input.returnable,
    selected: input.selected,
  });

  return {
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    originalSaleId: input.originalSaleId,
    returnType: input.disposition,
    returnScope: preview.prepared.scope,
    reasonCode: input.reasonCode,
    reason: input.reasonDetail.trim() || undefined,
    refundMethod: preview.prepared.refundMethod ?? undefined,
    confirmationNotes: input.confirmationNotes.trim() || undefined,
    items: input.selected.map((s) => ({
      originalSaleItemId: s.saleItemId,
      productId: s.productId,
      unitId: s.unitId,
      qty: s.qty,
      unitPrice: s.unitPrice,
      exchangeProductId: s.exchangeProductId ?? null,
      condition: s.condition,
      originalPackaging: s.originalPackaging,
      accessoriesComplete: s.accessoriesComplete,
      inspectionNotes: s.inspectionNotes || null,
      batchId: s.batchId ?? null,
    })),
    idempotencyKey: input.idempotencyKey,
  };
}

export function productMatchesBarcode(product: ProductSearchResult, barcode: string): boolean {
  const needle = barcode.trim().toLowerCase();
  if (!needle) return false;
  return (
    (product.barcode ?? "").toLowerCase() === needle ||
    product.sku.toLowerCase() === needle
  );
}

export function conditionLabel(c: ReturnCondition): string {
  switch (c) {
    case "good":
      return "Good — restock sellable";
    case "opened":
      return "Opened";
    case "damaged":
      return "Damaged — damaged stock";
    case "defective":
      return "Defective — damaged stock";
    case "incomplete":
      return "Incomplete — no restock";
  }
}
