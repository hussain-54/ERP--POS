import { describe, expect, it } from "vitest";
import {
  addOrIncrementProductOrThrow,
  applyCartLineDiscountInput,
  calculatePosCartTotals,
  changeCartLineUnit,
  createCartLineFromProduct,
  lineTotal,
  updateCartLineQty,
} from "./pos-cart.js";
import { preparePosPayments } from "./pos-payment.js";
import { preparePosSaleLine } from "./pos-pricing.js";
import { prepareSaleReturn } from "./pos-return.js";
import { calculateSaleTotals } from "./sale-totals.js";
import { roundMoney } from "./money.js";

const unit = "11111111-1111-4111-8111-111111111111";
const unitBox = "44444444-4444-4444-8444-444444444444";
const productA = "22222222-2222-4222-8222-222222222222";
const productB = "33333333-3333-4333-8333-333333333333";
const saleItemA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cash = "55555555-5555-4555-8555-555555555555";

const exclusive10 = {
  id: "t",
  ratePercent: 10,
  pricingMode: "exclusive" as const,
  isExempt: false,
  kind: "sales_tax" as const,
};

const inclusive17 = {
  id: "ti",
  ratePercent: 17,
  pricingMode: "inclusive" as const,
  isExempt: false,
  kind: "sales_tax" as const,
};

function productLine(
  key: string,
  productId: string,
  unitPrice: number,
  extras: Partial<Parameters<typeof createCartLineFromProduct>[0]> = {},
) {
  return createCartLineFromProduct({
    key,
    productId,
    name: key,
    unitId: unit,
    unitPrice,
    stock: "100",
    taxRate: exclusive10,
    retailPrice: unitPrice,
    wholesalePrice: unitPrice,
    dealerPrice: unitPrice,
    ...extras,
  });
}

function settle(
  grand: number,
  lines: Parameters<typeof preparePosPayments>[0]["lines"],
  opts: Partial<Parameters<typeof preparePosPayments>[0]> = {},
) {
  return preparePosPayments({
    grandTotal: grand,
    lines,
    walkIn: true,
    hasCustomer: false,
    allowCreditDue: false,
    ...opts,
  });
}

describe("POS pricing engine — one source of truth", () => {
  it("Case 1: one product × qty 1", () => {
    const cart = addOrIncrementProductOrThrow([], productLine("a", productA, 100), exclusive10);
    const totals = calculatePosCartTotals(cart, 0, exclusive10);
    expect(cart[0]!.qty).toBe("1");
    expect(totals.subtotal).toBe(100);
    expect(totals.itemDiscount).toBe(0);
    expect(totals.invoiceDiscount).toBe(0);
    expect(totals.taxableAmount).toBe(100);
    expect(totals.tax).toBe(10);
    expect(totals.grand).toBe(110);
    expect(lineTotal(cart[0]!)).toBe(110);
    expect(totals.saleTotals?.grandTotal).toBe(totals.grand);

    const posted = calculateSaleTotals(
      [
        {
          productId: productA,
          unitId: unit,
          qty: 1,
          unitPrice: 100,
          discount: 0,
          tax: 10,
        },
      ],
      0,
    );
    expect(posted.grandTotal).toBe(totals.grand);

    const pay = settle(totals.grand, [{ paymentMethodId: cash, kind: "cash", amount: 110 }]);
    expect(pay.paidTowardBill).toBe(110);
    expect(pay.remaining).toBe(0);
    expect(pay.change).toBe(0);
  });

  it("Case 2: multiple products", () => {
    let cart = addOrIncrementProductOrThrow([], productLine("a", productA, 100), exclusive10);
    cart = addOrIncrementProductOrThrow(cart, productLine("b", productB, 50), exclusive10);
    const totals = calculatePosCartTotals(cart, 0, exclusive10);
    expect(totals.items).toBe(2);
    expect(totals.qty).toBe(2);
    expect(totals.subtotal).toBe(150);
    expect(totals.tax).toBe(15);
    expect(totals.grand).toBe(165);
  });

  it("Case 3: line discount", () => {
    let cart = addOrIncrementProductOrThrow([], productLine("a", productA, 200), exclusive10);
    const discounted = applyCartLineDiscountInput(cart, cart[0]!.key, { mode: "fixed", value: 20 }, exclusive10);
    expect(discounted.ok).toBe(true);
    cart = discounted.cart;
    const totals = calculatePosCartTotals(cart, 0, exclusive10);
    expect(totals.itemDiscount).toBe(20);
    expect(totals.taxableAmount).toBe(180);
    expect(totals.tax).toBe(18);
    expect(totals.grand).toBe(198);
    expect(lineTotal(cart[0]!)).toBe(198);
  });

  it("Case 4: invoice discount", () => {
    const cart = addOrIncrementProductOrThrow([], productLine("a", productA, 100), exclusive10);
    const totals = calculatePosCartTotals(cart, 10, exclusive10);
    expect(totals.invoiceDiscount).toBe(10);
    expect(totals.discount).toBe(10);
    expect(totals.taxableAmount).toBe(90);
    expect(totals.tax).toBe(10);
    expect(totals.grand).toBe(100);
  });

  it("Case 5: exclusive tax", () => {
    const cart = addOrIncrementProductOrThrow([], productLine("a", productA, 1000), exclusive10);
    const totals = calculatePosCartTotals(cart, 0, exclusive10);
    expect(totals.taxableAmount).toBe(1000);
    expect(totals.tax).toBe(100);
    expect(totals.grand).toBe(1100);
  });

  it("Case 6: partial payment — remaining from preparePosPayments", () => {
    const cart = addOrIncrementProductOrThrow([], productLine("a", productA, 100), exclusive10);
    const totals = calculatePosCartTotals(cart, 0, exclusive10);
    const pay = settle(
      totals.grand,
      [{ paymentMethodId: cash, kind: "cash", amount: 50 }],
      { walkIn: false, hasCustomer: true, allowCreditDue: true },
    );
    expect(pay.ok).toBe(true);
    expect(pay.paidTowardBill).toBe(50);
    expect(pay.remaining).toBe(60);
    expect(pay.change).toBe(0);
    expect(pay.paymentStatus).toBe("partial");
  });

  it("Case 7: credit sale — unpaid remainder allowed with customer", () => {
    const cart = addOrIncrementProductOrThrow([], productLine("a", productA, 100), exclusive10);
    const totals = calculatePosCartTotals(cart, 0, exclusive10);
    const pay = settle(
      totals.grand,
      [{ paymentMethodId: cash, kind: "credit", amount: 0 }],
      { walkIn: false, hasCustomer: true, allowCreditDue: true, allowRemaining: true },
    );
    expect(pay.ok).toBe(true);
    expect(pay.paidTowardBill).toBe(0);
    expect(pay.remaining).toBe(totals.grand);
    expect(pay.paymentType).toBe("credit");
  });

  it("Case 8: rounding, delivery, and currency precision", () => {
    const priced = preparePosSaleLine({
      qty: 3,
      pricing: {
        retailPrice: 10.125,
        wholesalePrice: 10.125,
        dealerPrice: 10.125,
        priceLevel: "retail",
        qty: 3,
      },
    });
    expect(priced.unitPrice).toBe(10.13);
    const totals = calculateSaleTotals(
      [
        {
          productId: productA,
          unitId: unit,
          qty: 3,
          unitPrice: priced.unitPrice,
          discount: 0,
          tax: 0,
        },
      ],
      0,
      { deliveryCharges: 1.5, roundOff: -0.01 },
    );
    expect(totals.subtotal).toBe(30.39);
    expect(totals.deliveryCharges).toBe(1.5);
    expect(totals.roundOff).toBe(-0.01);
    expect(totals.grandTotal).toBe(31.88);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it("Case 9: refund uses original unit price × qty (same money rounding)", () => {
    const cart = addOrIncrementProductOrThrow([], productLine("a", productA, 100), exclusive10);
    const totals = calculatePosCartTotals(cart, 0, exclusive10);
    expect(totals.grand).toBe(110);

    const returned = prepareSaleReturn({
      disposition: "refund",
      reasonCode: "not_satisfied",
      refundMethod: "cash",
      hasCustomer: true,
      returnable: [
        {
          saleItemId: saleItemA,
          productId: productA,
          unitId: unit,
          soldQty: 1,
          previouslyReturnedQty: 0,
          unitPrice: 100,
        },
      ],
      lines: [
        {
          originalSaleItemId: saleItemA,
          unitId: unit,
          qty: 1,
          unitPrice: 100,
          condition: "good",
          originalPackaging: true,
          accessoriesComplete: true,
        },
      ],
    });
    expect(returned.refundAmount).toBe(100);
    expect(returned.refundAmount).toBe(roundMoney(1 * 100));
  });

  it("inclusive tax is extracted for reporting but not double-counted in grand", () => {
    const line = createCartLineFromProduct({
      key: "inc",
      productId: productA,
      name: "Inclusive",
      unitId: unit,
      unitPrice: 117,
      stock: "10",
      taxRate: inclusive17,
      retailPrice: 117,
      wholesalePrice: 117,
      dealerPrice: 117,
    });
    const cart = addOrIncrementProductOrThrow([], line, inclusive17);
    expect(cart[0]!.tax).toBe(17);
    expect(lineTotal(cart[0]!)).toBe(117);
    const totals = calculatePosCartTotals(cart, 0, inclusive17);
    expect(totals.subtotal).toBe(117);
    expect(totals.tax).toBe(17);
    expect(totals.taxableAmount).toBe(100);
    expect(totals.grand).toBe(117);

    const prepared = preparePosSaleLine({
      qty: 1,
      pricing: {
        retailPrice: 117,
        wholesalePrice: 117,
        dealerPrice: 117,
        priceLevel: "retail",
        qty: 1,
      },
      taxRate: inclusive17,
    });
    expect(prepared.tax).toBe(17);
    expect(prepared.lineTotal).toBe(117);
  });

  it("UoM conversion affects stock factor, not catalog unit price", () => {
    const withOpts = productLine("u", productA, 100, {
      unitOptions: [
        { unitId: unit, unitName: "pcs", symbolPlaces: 0, factorToBase: "1" },
        { unitId: unitBox, unitName: "box", symbolPlaces: 0, factorToBase: "10" },
      ],
      stock: "100",
    });
    let cart = addOrIncrementProductOrThrow([], withOpts, exclusive10);
    const changed = changeCartLineUnit(cart, cart[0]!.key, unitBox, exclusive10);
    expect(changed.ok).toBe(true);
    cart = changed.cart;
    expect(cart[0]!.unitId).toBe(unitBox);
    expect(cart[0]!.unitPrice).toBe(100);
    const qty = updateCartLineQty(cart, cart[0]!.key, "1", exclusive10);
    expect(qty.ok).toBe(true);
    expect(qty.cart[0]!.unitPrice).toBe(100);
  });

  it("cart UI total, cart engine, and payment remaining share one grand", () => {
    let cart = addOrIncrementProductOrThrow([], productLine("a", productA, 250), exclusive10);
    const qty = updateCartLineQty(cart, cart[0]!.key, "2", exclusive10);
    expect(qty.ok).toBe(true);
    cart = qty.cart;
    const discounted = applyCartLineDiscountInput(cart, cart[0]!.key, { mode: "fixed", value: 20 }, exclusive10);
    expect(discounted.ok).toBe(true);
    cart = discounted.cart;

    const totals = calculatePosCartTotals(cart, 10, exclusive10);
    expect(lineTotal(cart[0]!)).toBe(roundMoney(500 - 20 + cart[0]!.tax));
    expect(totals.grand).toBe(totals.saleTotals!.grandTotal);

    const pay = settle(totals.grand, [
      { paymentMethodId: cash, kind: "cash", amount: totals.grand, amountReceived: totals.grand + 5 },
    ]);
    expect(pay.paidTowardBill).toBe(totals.grand);
    expect(pay.remaining).toBe(0);
    expect(pay.change).toBe(5);
  });
});
