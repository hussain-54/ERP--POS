import type { CartLine, PosCustomerView, PosPaymentKind, PosPaymentLine } from "../types";

export function customerPriceLevel(tier: string): "retail" | "wholesale" | "dealer" {
  const t = tier.toLowerCase();
  if (t.includes("wholesale")) return "wholesale";
  if (t.includes("dealer")) return "dealer";
  return "retail";
}

export function isManualCartLine(line: CartLine): boolean {
  return Boolean(line.isManual || line.productId.startsWith("custom-"));
}

export function validateSaleBeforeComplete(input: {
  lines: CartLine[];
  customer: PosCustomerView;
  paymentKind: PosPaymentKind;
  cashReceived?: number;
  grandTotal: number;
  overridePayments?: PosPaymentLine[];
  defaultUnitId: string | null;
}): { ok: true } | { ok: false; title: string; description?: string } {
  for (const line of input.lines) {
    if (
      !isManualCartLine(line) &&
      line.stockAvailable != null &&
      line.stockAvailable > 0 &&
      line.qty > line.stockAvailable
    ) {
      return {
        ok: false,
        title: "Insufficient stock",
        description: `${line.name} — only ${line.stockAvailable} available.`,
      };
    }
    if (isManualCartLine(line) && !input.defaultUnitId && !line.unitId.match(/^[0-9a-f-]{36}$/i)) {
      return {
        ok: false,
        title: "Manual item not ready",
        description: "Load the product catalog first so manual items can use a valid unit.",
      };
    }
  }

  const usingOverride = Boolean(input.overridePayments && input.overridePayments.length > 0);
  if (!usingOverride && input.paymentKind === "cash") {
    const received = input.cashReceived ?? input.grandTotal;
    if (received + 0.001 < input.grandTotal) {
      return {
        ok: false,
        title: "Insufficient cash received",
        description: `Need at least Rs. ${input.grandTotal.toFixed(2)} to complete this cash sale.`,
      };
    }
  }

  if (
    (input.paymentKind === "credit" || input.paymentKind === "partial" || input.paymentKind === "installment") &&
    !input.customer.id
  ) {
    return {
      ok: false,
      title: "Customer required",
      description: "Credit, partial, and installment sales require an attached customer.",
    };
  }

  if (input.paymentKind === "credit" && input.customer.id && input.customer.creditLimit > 0) {
    const projected = input.customer.outstanding + input.grandTotal;
    if (projected > input.customer.creditLimit + 0.001) {
      return {
        ok: false,
        title: "Credit limit exceeded",
        description: `${input.customer.label} would exceed credit limit (Rs. ${input.customer.creditLimit.toFixed(2)}).`,
      };
    }
  }

  return { ok: true };
}

export function mapCartLineToSaleItem(
  line: CartLine,
  defaultUnitId: string | null,
): {
  productId?: string;
  unitId: string;
  qty: number;
  unitPrice: number;
  discount: number;
  discountPercent: number;
  tax: number;
  isManual?: boolean;
  manualName?: string;
  manualItemCode?: string;
} {
  const manual = isManualCartLine(line);
  const unitId = manual ? (defaultUnitId ?? line.unitId) : line.unitId;
  return {
    ...(manual ? {} : { productId: line.productId }),
    unitId,
    qty: line.qty,
    unitPrice: line.rate,
    discount: line.discount,
    discountPercent: line.discountPercent,
    tax: line.tax * line.qty,
    ...(manual
      ? {
          isManual: true,
          manualName: line.name,
          manualItemCode: line.sku !== "MANUAL" ? line.sku : undefined,
        }
      : {}),
  };
}
