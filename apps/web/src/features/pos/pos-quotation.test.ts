import { describe, expect, it } from "vitest";
import { createCartLineFromProduct, createManualCartLine } from "@electronic-erp/domain";
import { cartToQuotationItems, confirmationStatusLabel, paymentTypeLabel } from "./pos-quotation";

const unitId = "11111111-1111-4111-8111-111111111111";
const productId = "33333333-3333-4333-8333-333333333333";

describe("POS quotation mapping", () => {
  it("maps catalog cart lines onto the existing quotation API shape", () => {
    const cart = [
      createCartLineFromProduct({
        key: "1",
        productId,
        name: "LED Bulb",
        unitId,
        unitPrice: 250,
        qty: "2",
      }),
    ];
    cart[0]!.discount = 10;
    cart[0]!.tax = 17;
    const mapped = cartToQuotationItems(cart);
    expect(mapped.ok).toBe(true);
    if (!mapped.ok) return;
    expect(mapped.items).toEqual([
      {
        productId,
        unitId,
        qty: "2",
        unitPrice: 250,
        discount: 10,
        tax: 17,
      },
    ]);
  });

  it("refuses manual lines instead of inventing product ids", () => {
    const cart = [createManualCartLine({ key: "m1", unitId })];
    const mapped = cartToQuotationItems(cart);
    expect(mapped.ok).toBe(false);
    if (mapped.ok) return;
    expect(mapped.error).toMatch(/catalog products/i);
  });
});

describe("POS operator-facing labels", () => {
  it("never exposes raw confirmation status tokens", () => {
    expect(confirmationStatusLabel("pending")).toBe("Posting sale…");
    expect(confirmationStatusLabel("failure")).toBe("Payment failed");
    expect(paymentTypeLabel("credit")).toBe("Credit / Udhar");
  });
});
