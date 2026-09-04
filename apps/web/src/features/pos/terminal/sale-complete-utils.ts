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
  paymentLines?: PosPaymentLine[];
  paymentReference?: string;
  installmentConfirmed?: boolean;
  defaultUnitId: string | null;
}): { ok: true } | { ok: false; title: string; description?: string } {
  for (const line of input.lines) {
    if (
      !isManualCartLine(line) &&
      line.stockAvailable != null &&
      line.qty > line.stockAvailable
    ) {
      return {
        ok: false,
        title: line.stockAvailable <= 0 ? "Product is out of stock" : "Insufficient stock",
        description:
          line.stockAvailable <= 0
            ? `${line.name} has no stock available.`
            : `${line.name} — only ${line.stockAvailable} available.`,
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
    if (input.cashReceived == null || !Number.isFinite(input.cashReceived)) {
      return {
        ok: false,
        title: "Enter cash received",
        description: "Enter the amount received from the customer, or use Exact / Quick Cash.",
      };
    }
    if (input.cashReceived + 0.001 < input.grandTotal) {
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

  if (input.paymentKind === "split") {
    const lines = input.overridePayments?.length
      ? input.overridePayments
      : input.paymentLines ?? [];
    const allocated = lines.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (!lines.length) {
      return {
        ok: false,
        title: "Split payment incomplete",
        description: "Configure and confirm split payment so allocated amount equals total due.",
      };
    }
    if (Math.abs(allocated - input.grandTotal) > 0.009) {
      return {
        ok: false,
        title: "Split not fully allocated",
        description: `Allocated Rs. ${allocated.toFixed(2)} of Rs. ${input.grandTotal.toFixed(2)}. Remaining must be Rs. 0.00.`,
      };
    }
  }

  if (input.paymentKind === "installment" && !input.installmentConfirmed) {
    return {
      ok: false,
      title: "Confirm installment plan",
      description: "Open Installment, review the schedule, then Confirm Installment before COMPLETE SALE.",
    };
  }

  const recordKinds = new Set(["card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"]);
  if (recordKinds.has(input.paymentKind) && !(input.paymentReference ?? "").trim() && !usingOverride) {
    return {
      ok: false,
      title: "Payment reference required",
      description: "Enter a card/bank/wallet transaction reference before completing the sale.",
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
