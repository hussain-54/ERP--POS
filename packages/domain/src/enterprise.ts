/** Phase 15 domain engines: HR payroll/commission, tax math, notification rules. */

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Salesman commission from sale — shared with POS sale_commissions. */
export function calculateSalesCommission(
  saleGrandTotal: number,
  commissionPercent: number,
): { baseAmount: number; commissionPercent: number; commissionAmount: number } {
  const pct = Math.max(0, Math.min(100, commissionPercent));
  return {
    baseAmount: money(saleGrandTotal),
    commissionPercent: pct,
    commissionAmount: money((saleGrandTotal * pct) / 100),
  };
}

export function calculateNetSalary(input: {
  baseSalary: number;
  commissionAmount: number;
  incentiveAmount: number;
  deductions: number;
}): { gross: number; net: number } {
  const gross = money(input.baseSalary + input.commissionAmount + input.incentiveAmount);
  const net = money(Math.max(0, gross - Math.max(0, input.deductions)));
  return { gross, net };
}

export function performanceRating(score: number): "excellent" | "good" | "average" | "poor" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "average";
  return "poor";
}

export function achievementPct(salesAmount: number, targetAmount: number): number {
  if (targetAmount <= 0) return salesAmount > 0 ? 100 : 0;
  return money((salesAmount / targetAmount) * 100);
}

/** Tax split for inclusive / exclusive pricing (architecture-ready; not FBR live). */
export function splitTaxAmount(
  amount: number,
  ratePercent: number,
  pricingMode: "inclusive" | "exclusive",
  isExempt = false,
): { taxableAmount: number; taxAmount: number; grandTotal: number; pricingMode: string } {
  if (isExempt || ratePercent <= 0) {
    return {
      taxableAmount: money(amount),
      taxAmount: 0,
      grandTotal: money(amount),
      pricingMode,
    };
  }
  if (pricingMode === "inclusive") {
    const taxableAmount = money(amount / (1 + ratePercent / 100));
    const taxAmount = money(amount - taxableAmount);
    return { taxableAmount, taxAmount, grandTotal: money(amount), pricingMode };
  }
  const taxAmount = money((amount * ratePercent) / 100);
  return {
    taxableAmount: money(amount),
    taxAmount,
    grandTotal: money(amount + taxAmount),
    pricingMode,
  };
}

export type NotificationTriggerKind =
  | "low_stock"
  | "out_of_stock"
  | "overstock"
  | "installment_due"
  | "payment_due"
  | "supplier_payment_due"
  | "customer_outstanding"
  | "stock_received"
  | "online_order"
  | "quotation"
  | "warranty_expiry"
  | "repair_ready"
  | "approval_request"
  | "daily_sales"
  | "sync_failure";

export interface StockAlertFact {
  productId: string;
  productName: string;
  qtyOnHand: number;
  reorderLevel: number;
  overstockLevel?: number;
}

export function stockAlertNotifications(facts: StockAlertFact[]): Array<{
  type: NotificationTriggerKind;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  entityType: string;
  entityId: string;
}> {
  const out: Array<{
    type: NotificationTriggerKind;
    title: string;
    body: string;
    severity: "info" | "warning" | "critical";
    entityType: string;
    entityId: string;
  }> = [];
  for (const f of facts) {
    if (f.qtyOnHand <= 0) {
      out.push({
        type: "out_of_stock",
        title: "Out of stock",
        body: `${f.productName} has no available stock.`,
        severity: "critical",
        entityType: "product",
        entityId: f.productId,
      });
    } else if (f.qtyOnHand <= f.reorderLevel) {
      out.push({
        type: "low_stock",
        title: "Low stock",
        body: `${f.productName} is at ${f.qtyOnHand} (reorder ${f.reorderLevel}).`,
        severity: "warning",
        entityType: "product",
        entityId: f.productId,
      });
    } else if (f.overstockLevel != null && f.qtyOnHand >= f.overstockLevel) {
      out.push({
        type: "overstock",
        title: "Overstock",
        body: `${f.productName} is overstocked at ${f.qtyOnHand}.`,
        severity: "info",
        entityType: "product",
        entityId: f.productId,
      });
    }
  }
  return out;
}

/** External channel adapter port — email/SMS/push implement this; in-app is native. */
export interface NotificationChannelAdapter {
  channel: "email" | "sms" | "push";
  send(input: {
    toUserId?: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ ok: boolean; detail?: string }>;
}

export class NullNotificationChannelAdapter implements NotificationChannelAdapter {
  constructor(public readonly channel: "email" | "sms" | "push") {}
  async send(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: false, detail: `${this.channel} adapter not configured` };
  }
}

export function documentStoragePath(input: {
  organizationId: string;
  entityType: string;
  entityId: string;
  fileName: string;
}): string {
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = Date.now();
  return `org/${input.organizationId}/${input.entityType}/${input.entityId}/${stamp}_${safe}`;
}

export function assertDocumentAccess(policy: {
  isSensitive: boolean;
  canViewSensitive: boolean;
}): void {
  if (policy.isSensitive && !policy.canViewSensitive) {
    throw new Error("Forbidden: sensitive document requires elevated permission");
  }
}
