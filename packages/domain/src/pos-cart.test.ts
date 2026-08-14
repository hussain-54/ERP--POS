import { describe, expect, it } from "vitest";
import {
  addOrIncrementProductOrThrow,
  calculatePosCartTotals,
  clearCartLines,
  createCartLineFromProduct,
  createManualCartLine,
  pickPriceLevel,
  removeCartLine,
  updateCartLineQty,
} from "./pos-cart.js";
import { validatePosCheckout } from "./pos-validation.js";

const unit = "11111111-1111-4111-8111-111111111111";
const product = "22222222-2222-4222-8222-222222222222";

describe("pos-cart architecture", () => {
  it("creates cart, adds product, removes, changes qty, calculates totals", () => {
    let cart = clearCartLines();
    expect(cart).toEqual([]);

    const line = createCartLineFromProduct({
      key: "a",
      productId: product,
      name: "Switch",
      unitId: unit,
      unitPrice: 100,
      stock: "100",
      taxRate: { id: "t", ratePercent: 10, pricingMode: "exclusive", isExempt: false },
    });
    expect(line.tax).toBe(10);

    const tax = {
      id: "t",
      ratePercent: 10,
      pricingMode: "exclusive" as const,
      isExempt: false,
    };
    cart = addOrIncrementProductOrThrow(cart, line, tax);
    expect(cart).toHaveLength(1);

    cart = addOrIncrementProductOrThrow(cart, { ...line, key: "b" }, tax);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe("2");
    expect(cart[0].tax).toBe(20);

    const qtyResult = updateCartLineQty(cart, cart[0].key, "3", tax);
    expect(qtyResult.ok).toBe(true);
    cart = qtyResult.cart;
    expect(cart[0].qty).toBe("3");
    expect(cart[0].tax).toBe(30);

    const totals = calculatePosCartTotals(cart, 5);
    expect(totals.subtotal).toBe(300);
    expect(totals.invoiceDiscount).toBe(5);
    expect(totals.tax).toBe(30);
    expect(totals.grand).toBe(325);
    expect(totals.saleTotals?.grandTotal).toBe(325);

    cart = removeCartLine(cart, cart[0].key);
    expect(cart).toHaveLength(0);
    expect(calculatePosCartTotals(cart, 0).grand).toBe(0);
  });

  it("picks price level and validates walk-in payment", () => {
    expect(pickPriceLevel({ retailPrice: 10, wholesalePrice: 8, dealerPrice: 7 }, "wholesale")).toBe(
      8,
    );

    const cart = [createManualCartLine({ key: "m", unitId: unit, name: "Misc" })];
    cart[0].unitPrice = 50;
    const totals = calculatePosCartTotals(cart, 0);
    const bad = validatePosCheckout({
      cart,
      totals,
      branchId: unit,
      warehouseId: unit,
      walkIn: true,
      paidTotal: 10,
      allowCreditDue: false,
    });
    expect(bad.ok).toBe(false);

    const ok = validatePosCheckout({
      cart,
      totals,
      branchId: unit,
      warehouseId: unit,
      walkIn: true,
      paidTotal: 50,
      allowCreditDue: false,
    });
    expect(ok.ok).toBe(true);
  });

  it("select customer path allows credit when unpaid", () => {
    const cart = [
      createCartLineFromProduct({
        key: "a",
        productId: product,
        name: "Fan",
        unitId: unit,
        unitPrice: 200,
        stock: "5",
      }),
    ];
    const totals = calculatePosCartTotals(cart, 0);
    const credit = validatePosCheckout({
      cart,
      totals,
      branchId: unit,
      warehouseId: unit,
      walkIn: false,
      customerId: product,
      paidTotal: 0,
      allowCreditDue: true,
    });
    expect(credit.ok).toBe(true);
  });

  it("re-resolves quantity-break price when qty crosses threshold", () => {
    const line = createCartLineFromProduct({
      key: "q",
      productId: product,
      name: "Bulk",
      unitId: unit,
      unitPrice: 100,
      stock: "100",
      retailPrice: 100,
      wholesalePrice: 90,
      dealerPrice: 80,
      priceLevel: "retail",
      quantityBreaks: [{ minQty: 10, unitPrice: 85 }],
    });
    let cart = addOrIncrementProductOrThrow([], line);
    expect(cart[0]!.unitPrice).toBe(100);
    const qty = updateCartLineQty(cart, cart[0]!.key, "10");
    expect(qty.ok).toBe(true);
    cart = qty.cart;
    expect(cart[0]!.unitPrice).toBe(85);
  });
});
