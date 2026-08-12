/**
 * POS salesman / reference commission rules.
 * All commission math goes through calculateSalesCommission — do not reimplement %.
 */
import { calculateSalesCommission } from "./enterprise.js";
import { ValidationDomainError } from "./errors.js";

export type CommissionStatus = "accrued" | "adjusted" | "partially_paid" | "paid" | "void";

export type CommissionRecord = {
  id?: string;
  saleId: string;
  salesmanUserId: string;
  employeeId?: string | null;
  baseAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  status: CommissionStatus;
  paidAmount: number;
  originalAmount?: number;
};

export type SaleReferenceType =
  | "outside"
  | "dealer"
  | "influencer"
  | "employee"
  | "other";

/** Accrue commission for a finalized (posted) sale only. */
export function buildCommissionAccrual(input: {
  saleStatus: string;
  saleGrandTotal: number;
  commissionPercent: number;
  salesmanUserId?: string | null;
  employeeId?: string | null;
  saleId: string;
}): {
  shouldAccrue: boolean;
  row: Omit<CommissionRecord, "id" | "paidAmount"> & { paidAmount: number };
} | null {
  if (input.saleStatus !== "posted") {
    throw new ValidationDomainError("Commission accrues on finalized (posted) sales only");
  }
  if (!input.salesmanUserId || !(input.commissionPercent > 0)) return null;
  const calc = calculateSalesCommission(input.saleGrandTotal, input.commissionPercent);
  if (calc.commissionAmount <= 0) return null;
  return {
    shouldAccrue: true,
    row: {
      saleId: input.saleId,
      salesmanUserId: input.salesmanUserId,
      employeeId: input.employeeId ?? null,
      baseAmount: calc.baseAmount,
      commissionPercent: calc.commissionPercent,
      commissionAmount: calc.commissionAmount,
      originalAmount: calc.commissionAmount,
      status: "accrued",
      paidAmount: 0,
    },
  };
}

/**
 * Return rule: reduce commission base by this return's amount.
 * Uses current (already adjusted) base — safe for multiple partial returns.
 * Unpaid → adjusted/void; paid amounts are not clawed back.
 */
export function adjustCommissionForReturn(input: {
  commission: CommissionRecord;
  returnedAmount: number;
}): CommissionRecord {
  const returned = Math.max(0, input.returnedAmount);
  const remainingBase = Math.max(
    0,
    Math.round((input.commission.baseAmount - returned) * 100) / 100,
  );
  const calc = calculateSalesCommission(remainingBase, input.commission.commissionPercent);
  const originalAmount = input.commission.originalAmount ?? input.commission.commissionAmount;

  if (input.commission.status === "paid" || input.commission.status === "partially_paid") {
    const unpaid = Math.max(0, input.commission.commissionAmount - input.commission.paidAmount);
    const newUnpaid = Math.min(unpaid, calc.commissionAmount);
    return {
      ...input.commission,
      baseAmount: calc.baseAmount,
      commissionAmount: Math.round((input.commission.paidAmount + newUnpaid) * 100) / 100,
      originalAmount,
      status:
        calc.commissionAmount <= 0 && input.commission.paidAmount <= 0
          ? "void"
          : input.commission.paidAmount >= calc.commissionAmount - 1e-9
            ? "paid"
            : input.commission.paidAmount > 0
              ? "partially_paid"
              : "adjusted",
    };
  }

  if (calc.commissionAmount <= 0) {
    return {
      ...input.commission,
      baseAmount: 0,
      commissionAmount: 0,
      originalAmount,
      status: "void",
      paidAmount: 0,
    };
  }

  return {
    ...input.commission,
    baseAmount: calc.baseAmount,
    commissionAmount: calc.commissionAmount,
    originalAmount,
    status: "adjusted",
  };
}

/** Cancelled / voided sale: void unpaid commission; leave paid as-is with note via status void only if unpaid. */
export function voidCommissionForCancelledSale(commission: CommissionRecord): CommissionRecord {
  if (commission.status === "paid" || commission.paidAmount > 0) {
    return {
      ...commission,
      status: commission.paidAmount >= commission.commissionAmount - 1e-9 ? "paid" : "partially_paid",
    };
  }
  return {
    ...commission,
    commissionAmount: 0,
    baseAmount: 0,
    status: "void",
    paidAmount: 0,
  };
}

/** Apply a commission payment (partial or full). */
export function applyCommissionPayment(input: {
  commission: CommissionRecord;
  payAmount: number;
}): CommissionRecord {
  if (input.commission.status === "void") {
    throw new ValidationDomainError("Cannot pay a void commission");
  }
  const pay = Math.round(input.payAmount * 100) / 100;
  if (!(pay > 0)) throw new ValidationDomainError("Payment amount must be positive");
  const due = Math.round((input.commission.commissionAmount - input.commission.paidAmount) * 100) / 100;
  if (pay - due > 1e-9) {
    throw new ValidationDomainError(`Payment ${pay} exceeds commission due ${due}`);
  }
  const paidAmount = Math.round((input.commission.paidAmount + pay) * 100) / 100;
  const status: CommissionStatus =
    paidAmount + 1e-9 >= input.commission.commissionAmount ? "paid" : "partially_paid";
  return { ...input.commission, paidAmount, status };
}

export function commissionDue(commission: CommissionRecord): number {
  if (commission.status === "void") return 0;
  return Math.max(0, Math.round((commission.commissionAmount - commission.paidAmount) * 100) / 100);
}

export function summarizeCommissionReports(
  rows: Array<{
    salesmanUserId: string;
    salesmanName?: string;
    referenceId?: string | null;
    referenceName?: string | null;
    saleGrandTotal?: number;
    commissionAmount: number;
    paidAmount: number;
    status: CommissionStatus;
  }>,
): {
  commissionDue: number;
  commissionPaid: number;
  salesmanSales: Array<{ salesmanUserId: string; salesmanName?: string; salesTotal: number; commissionAmount: number }>;
  referenceSales: Array<{ referenceId: string; referenceName?: string; salesTotal: number; count: number }>;
  topSalesman: Array<{ salesmanUserId: string; salesmanName?: string; commissionAmount: number; salesTotal: number }>;
} {
  let commissionDueTotal = 0;
  let commissionPaidTotal = 0;
  const bySalesman = new Map<
    string,
    { salesmanUserId: string; salesmanName?: string; salesTotal: number; commissionAmount: number }
  >();
  const byRef = new Map<string, { referenceId: string; referenceName?: string; salesTotal: number; count: number }>();

  for (const r of rows) {
    if (r.status === "void") continue;

    commissionDueTotal += Math.max(0, r.commissionAmount - r.paidAmount);
    commissionPaidTotal += r.paidAmount;

    const sm = bySalesman.get(r.salesmanUserId) ?? {
      salesmanUserId: r.salesmanUserId,
      salesmanName: r.salesmanName,
      salesTotal: 0,
      commissionAmount: 0,
    };
    sm.salesTotal += r.saleGrandTotal ?? 0;
    sm.commissionAmount += r.commissionAmount;
    bySalesman.set(r.salesmanUserId, sm);

    if (r.referenceId) {
      const rf = byRef.get(r.referenceId) ?? {
        referenceId: r.referenceId,
        referenceName: r.referenceName ?? undefined,
        salesTotal: 0,
        count: 0,
      };
      rf.salesTotal += r.saleGrandTotal ?? 0;
      rf.count += 1;
      byRef.set(r.referenceId, rf);
    }
  }

  const salesmanSales = [...bySalesman.values()].sort((a, b) => b.salesTotal - a.salesTotal);
  const topSalesman = [...bySalesman.values()]
    .map((s) => ({
      salesmanUserId: s.salesmanUserId,
      salesmanName: s.salesmanName,
      commissionAmount: s.commissionAmount,
      salesTotal: s.salesTotal,
    }))
    .sort((a, b) => b.commissionAmount - a.commissionAmount)
    .slice(0, 10);

  return {
    commissionDue: Math.round(commissionDueTotal * 100) / 100,
    commissionPaid: Math.round(commissionPaidTotal * 100) / 100,
    salesmanSales,
    referenceSales: [...byRef.values()].sort((a, b) => b.salesTotal - a.salesTotal),
    topSalesman,
  };
}

export function assertSalesmanActive(input: { isSalesman: boolean; isActive: boolean }): void {
  if (!input.isSalesman) throw new ValidationDomainError("Employee is not flagged as salesman");
  if (!input.isActive) throw new ValidationDomainError("Salesman is inactive");
}

export { calculateSalesCommission };
