import type { PosCartLine } from "@electronic-erp/domain";

/** Payload lines accepted by the existing after-sales quotation API. */
export type PosQuotationLine = {
  productId: string;
  unitId: string;
  qty: string;
  unitPrice: number;
  discount: number;
  tax: number;
};

/**
 * Map the live POS cart onto createQuotation items.
 * Manual / incomplete lines cannot be quoted — the quotations API requires catalog productId + unitId.
 */
export function cartToQuotationItems(
  cart: PosCartLine[],
): { ok: true; items: PosQuotationLine[] } | { ok: false; error: string } {
  if (!cart.length) {
    return { ok: false, error: "Add catalog products before creating a quotation." };
  }
  const items: PosQuotationLine[] = [];
  for (const line of cart) {
    if (line.isManual || !line.productId || !line.unitId) {
      return {
        ok: false,
        error: "Quotations need catalog products only. Remove manual lines first.",
      };
    }
    items.push({
      productId: line.productId,
      unitId: line.unitId,
      qty: line.qty,
      unitPrice: line.unitPrice,
      discount: line.discount,
      tax: line.tax,
    });
  }
  return { ok: true, items };
}

export function suggestPosCustomerCode(): string {
  return `C-${Date.now().toString(36).toUpperCase()}`;
}

export function confirmationStatusLabel(
  status: "idle" | "pending" | "success" | "failure" | "retry" | null | undefined,
): string | null {
  if (!status || status === "idle") return null;
  if (status === "pending") return "Posting sale…";
  if (status === "success") return "Sale posted";
  if (status === "failure") return "Payment failed";
  if (status === "retry") return "Ready to retry";
  return null;
}

export function paymentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    cash: "Cash",
    credit: "Credit / Udhar",
    split: "Split payment",
    partial: "Partial payment",
    installment: "Installment",
    advance: "Advance",
    full: "Paid in full",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}
