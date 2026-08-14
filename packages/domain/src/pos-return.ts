import { ValidationDomainError } from "./errors.js";
import { buildAuditRow, type AuditEntryInput } from "./audit-trail.js";

export const RETURN_REASON_CODES = [
  "damaged",
  "wrong_product",
  "defective",
  "not_satisfied",
  "other",
] as const;
export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

export const RETURN_SCOPES = ["full", "partial"] as const;
export type ReturnScope = (typeof RETURN_SCOPES)[number];

/** Settlement disposition (maps to existing DB return_type). */
export const RETURN_DISPOSITIONS = ["refund", "credit", "exchange"] as const;
export type ReturnDisposition = (typeof RETURN_DISPOSITIONS)[number];

export const REFUND_METHODS = ["cash", "bank", "customer_credit"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

export const RETURN_CONDITIONS = [
  "good",
  "opened",
  "damaged",
  "defective",
  "incomplete",
] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export type RestockTarget = "on_hand" | "damaged" | "none";

export type ReturnableLine = {
  saleItemId: string;
  productId: string | null;
  unitId: string;
  name?: string;
  soldQty: number;
  previouslyReturnedQty: number;
  unitPrice: number;
  batchId?: string | null;
};

export type ReturnLineInput = {
  originalSaleItemId: string;
  productId?: string | null;
  unitId: string;
  qty: number;
  unitPrice: number;
  exchangeProductId?: string | null;
  condition: ReturnCondition;
  originalPackaging: boolean;
  accessoriesComplete: boolean;
  inspectionNotes?: string | null;
  batchId?: string | null;
};

export type PreparedReturnLine = ReturnLineInput & {
  maxReturnable: number;
  lineTotal: number;
  restockTarget: RestockTarget;
  restock: boolean;
};

export type PrepareSaleReturnInput = {
  disposition: ReturnDisposition;
  scope?: ReturnScope;
  reasonCode: ReturnReasonCode;
  reasonDetail?: string;
  refundMethod?: RefundMethod | null;
  lines: ReturnLineInput[];
  returnable: ReturnableLine[];
  hasCustomer: boolean;
};

export type PreparedSaleReturn = {
  scope: ReturnScope;
  disposition: ReturnDisposition;
  reasonCode: ReturnReasonCode;
  reason: string;
  refundMethod: RefundMethod | null;
  refundAmount: number;
  lines: PreparedReturnLine[];
};

export function assertRefundAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ValidationDomainError("Refund amount must be a non-negative finite number");
  }
}

/** How money should settle for a prepared (or stored) return. */
export type RefundSettlementKind = "cash_out" | "customer_credit" | "none";

export type RefundSettlementPlan = {
  kind: RefundSettlementKind;
  method: RefundMethod | null;
  amount: number;
  /** Recorded tender on payments (cash/bank only). Not a PSP claim. */
  paymentKind: "cash" | "bank" | null;
};

export function refundSettlementPlan(input: {
  disposition: ReturnDisposition;
  refundMethod: RefundMethod | null;
  refundAmount: number;
}): RefundSettlementPlan {
  assertRefundAmount(input.refundAmount);
  if (input.disposition === "exchange" || input.refundAmount < 1e-9) {
    return { kind: "none", method: input.refundMethod, amount: 0, paymentKind: null };
  }
  if (input.disposition === "credit" || input.refundMethod === "customer_credit") {
    return {
      kind: "customer_credit",
      method: "customer_credit",
      amount: input.refundAmount,
      paymentKind: null,
    };
  }
  if (input.disposition === "refund" && (input.refundMethod === "cash" || input.refundMethod === "bank")) {
    return {
      kind: "cash_out",
      method: input.refundMethod,
      amount: input.refundAmount,
      paymentKind: input.refundMethod,
    };
  }
  if (input.disposition === "refund") {
    return {
      kind: "cash_out",
      method: "cash",
      amount: input.refundAmount,
      paymentKind: "cash",
    };
  }
  return { kind: "none", method: input.refundMethod, amount: 0, paymentKind: null };
}

export function reasonLabel(code: ReturnReasonCode): string {
  switch (code) {
    case "damaged":
      return "Damaged";
    case "wrong_product":
      return "Wrong product";
    case "defective":
      return "Defective";
    case "not_satisfied":
      return "Not satisfied";
    case "other":
      return "Other";
  }
}

export function maxReturnableQty(soldQty: number, previouslyReturnedQty: number): number {
  const max = Math.round((soldQty - previouslyReturnedQty) * 10000) / 10000;
  return Math.max(0, max);
}

/**
 * Stock restock policy from inspection.
 * Good/opened sellable → on-hand; damaged/defective → damaged bucket; incomplete → none.
 */
export function restockDecision(input: {
  condition: ReturnCondition;
  originalPackaging: boolean;
  accessoriesComplete: boolean;
}): { restock: boolean; target: RestockTarget } {
  if (!input.accessoriesComplete || input.condition === "incomplete") {
    return { restock: false, target: "none" };
  }
  if (input.condition === "damaged" || input.condition === "defective") {
    return { restock: true, target: "damaged" };
  }
  if (input.condition === "opened" && !input.originalPackaging) {
    return { restock: true, target: "damaged" };
  }
  return { restock: true, target: "on_hand" };
}

export function inferReturnScope(
  lines: Array<{ originalSaleItemId: string; qty: number }>,
  returnable: ReturnableLine[],
): ReturnScope {
  const open = returnable.filter(
    (r) => maxReturnableQty(r.soldQty, r.previouslyReturnedQty) > 1e-9,
  );
  if (lines.length < open.length) return "partial";
  for (const r of open) {
    const max = maxReturnableQty(r.soldQty, r.previouslyReturnedQty);
    const line = lines.find((l) => l.originalSaleItemId === r.saleItemId);
    if (!line || line.qty + 1e-9 < max) return "partial";
  }
  return "full";
}

export function prepareSaleReturn(input: PrepareSaleReturnInput): PreparedSaleReturn {
  if (!RETURN_REASON_CODES.includes(input.reasonCode)) {
    throw new ValidationDomainError("Invalid return reason");
  }
  if (!input.lines.length) {
    throw new ValidationDomainError("Select at least one return line");
  }

  const byItem = new Map(input.returnable.map((r) => [r.saleItemId, r]));
  const prepared: PreparedReturnLine[] = [];

  for (const line of input.lines) {
    const src = byItem.get(line.originalSaleItemId);
    if (!src) {
      throw new ValidationDomainError(`Sale line ${line.originalSaleItemId} is not returnable`);
    }
    const qty = Number(line.qty);
    if (!(qty > 0) || Number.isNaN(qty)) {
      throw new ValidationDomainError("Return quantity must be positive");
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new ValidationDomainError("Invalid refund amount");
    }
    const max = maxReturnableQty(src.soldQty, src.previouslyReturnedQty);
    if (qty - max > 1e-9) {
      throw new ValidationDomainError(
        `Return qty ${qty} exceeds returnable ${max} for line ${line.originalSaleItemId}`,
      );
    }
    const decision = restockDecision({
      condition: line.condition,
      originalPackaging: line.originalPackaging,
      accessoriesComplete: line.accessoriesComplete,
    });
    if (input.disposition === "exchange" && !line.exchangeProductId) {
      throw new ValidationDomainError("Exchange requires a replacement product on each line");
    }
    prepared.push({
      ...line,
      productId: line.productId ?? src.productId,
      unitId: line.unitId || src.unitId,
      unitPrice: line.unitPrice,
      batchId: line.batchId ?? src.batchId ?? null,
      qty,
      maxReturnable: max,
      lineTotal: Math.round(qty * line.unitPrice * 100) / 100,
      restockTarget: decision.target,
      restock: decision.restock,
    });
  }

  // Prevent double-claiming the same line beyond remaining in one request
  const claimed = new Map<string, number>();
  for (const p of prepared) {
    const prev = claimed.get(p.originalSaleItemId) ?? 0;
    const next = prev + p.qty;
    if (next - p.maxReturnable > 1e-9) {
      throw new ValidationDomainError("Duplicate return lines exceed sold quantity");
    }
    claimed.set(p.originalSaleItemId, next);
  }

  let refundMethod: RefundMethod | null = input.refundMethod ?? null;
  if (input.disposition === "refund") {
    if (!refundMethod) refundMethod = "cash";
    if (refundMethod === "customer_credit" && !input.hasCustomer) {
      throw new ValidationDomainError("Customer credit refund requires a customer on the sale");
    }
  } else if (input.disposition === "credit") {
    if (!input.hasCustomer) {
      throw new ValidationDomainError("Customer credit return requires a customer on the sale");
    }
    refundMethod = "customer_credit";
  } else {
    refundMethod = null;
  }

  const scope =
    input.scope ??
    inferReturnScope(
      prepared.map((p) => ({ originalSaleItemId: p.originalSaleItemId, qty: p.qty })),
      input.returnable,
    );

  const detail = (input.reasonDetail ?? "").trim();
  if (input.reasonCode === "other" && !detail) {
    throw new ValidationDomainError("Please describe the return reason");
  }
  const reason = detail
    ? `${reasonLabel(input.reasonCode)}: ${detail}`
    : reasonLabel(input.reasonCode);

  const refundAmount =
    Math.round(prepared.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  assertRefundAmount(refundAmount);

  return {
    scope,
    disposition: input.disposition,
    reasonCode: input.reasonCode,
    reason,
    refundMethod,
    refundAmount,
    lines: prepared,
  };
}

export function saleReturnAuditInput(input: {
  organizationId: string;
  branchId: string;
  returnId: string;
  originalSaleId: string;
  actorUserId?: string | null;
  deviceId?: string | null;
  disposition: string;
  scope: string;
  refundAmount: number;
  reason: string;
}): AuditEntryInput {
  return {
    organizationId: input.organizationId,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    actorKind: "other",
    action: "sale.return",
    entityType: "sale_return",
    entityId: input.returnId,
    deviceId: input.deviceId,
    correlationId: input.originalSaleId,
    after: {
      disposition: input.disposition,
      scope: input.scope,
      refundAmount: input.refundAmount,
      reason: input.reason,
      originalSaleId: input.originalSaleId,
    },
    remarks: `Return posted ${input.returnId}`,
  };
}

export function buildSaleReturnAuditRow(
  input: Parameters<typeof saleReturnAuditInput>[0],
): Record<string, unknown> {
  return buildAuditRow(saleReturnAuditInput(input));
}

/** Summarize return history for reports. */
export function summarizeReturnHistory(
  rows: Array<{
    refundAmount: number;
    disposition: string;
    scope: string;
    reasonCode?: string | null;
  }>,
): {
  count: number;
  totalRefundAmount: number;
  byDisposition: Record<string, number>;
  byScope: Record<string, number>;
  byReason: Record<string, number>;
} {
  const byDisposition: Record<string, number> = {};
  const byScope: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  let totalRefundAmount = 0;
  for (const r of rows) {
    totalRefundAmount += r.refundAmount;
    byDisposition[r.disposition] = (byDisposition[r.disposition] ?? 0) + 1;
    byScope[r.scope] = (byScope[r.scope] ?? 0) + 1;
    const code = r.reasonCode ?? "other";
    byReason[code] = (byReason[code] ?? 0) + 1;
  }
  return {
    count: rows.length,
    totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
    byDisposition,
    byScope,
    byReason,
  };
}
