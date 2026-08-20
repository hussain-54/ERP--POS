import { describe, expect, it } from "vitest";
import {
  cashTenderSuggestions,
  isCashPaymentKind,
  isCreditLikePaymentKind,
  paymentMethodLabel,
  paymentMethodSettlementNote,
  sanitizePaymentAmountInput,
  selectedPaymentMethodId,
  sortPosPaymentMethods,
} from "./pos-payment-ux";

describe("POS payment dock helpers", () => {
  it("labels and orders configured methods without inventing wallets", () => {
    const ordered = sortPosPaymentMethods([
      { id: "3", name: "Credit / Udhaar", kind: "credit" },
      { id: "1", name: "JazzCash", kind: "jazzcash" },
      { id: "2", name: "Cash", kind: "cash" },
      { id: "4", name: "Online payment", kind: "online" },
    ]);
    expect(ordered.map((m) => paymentMethodLabel(m))).toEqual([
      "Cash",
      "JazzCash",
      "Other Wallet",
      "Credit / Udhaar",
    ]);
    expect(paymentMethodSettlementNote("jazzcash")).toBe("Recorded locally — no gateway settlement");
    expect(paymentMethodSettlementNote("other")).toBe("Recorded locally — no gateway settlement");
    expect(paymentMethodSettlementNote("card")).toBe("Recorded locally — no gateway settlement");
    expect(paymentMethodSettlementNote("cash")).toBeNull();
    expect(paymentMethodSettlementNote("bank")).toBeNull();
    expect(paymentMethodSettlementNote("credit")).toBe("Credit / Udhaar — records AR, does not collect cash");
    expect(paymentMethodSettlementNote("installment")).toBe(
      "Installment — uses the existing installment plan, not a card processor",
    );
    expect(isCashPaymentKind("cash")).toBe(true);
    expect(isCreditLikePaymentKind("installment")).toBe(true);
    expect(selectedPaymentMethodId([{ id: "p1", paymentMethodId: "2", amount: "10" }])).toBe("2");
  });

  it("rejects negative payment amounts and suggests cash tenders", () => {
    expect(sanitizePaymentAmountInput("-10")).toBeNull();
    expect(sanitizePaymentAmountInput("100.5")).toBe("100.5");
    expect(sanitizePaymentAmountInput("")).toBe("");
    expect(cashTenderSuggestions(473)).toEqual([473, 500, 1000]);
  });
});
