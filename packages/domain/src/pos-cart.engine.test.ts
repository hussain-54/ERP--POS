import { describe, expect, it } from "vitest";
import {
  addOrIncrementProduct,
  addOrIncrementProductOrThrow,
  calculatePosCartTotals,
  changeCartLineUnit,
  clearCartLines,
  createCartLineFromProduct,
  decreaseCartLineQty,
  increaseCartLineQty,
  pickExactProductMatch,
  removeCartLine,
  updateCartLineQty,
  validateQtyAgainstRules,
  qtyRulesForLine,
} from "./pos-cart.js";

const unit = "11111111-1111-4111-8111-111111111111";
const unitKg = "44444444-4444-4444-8444-444444444444";
const product = "22222222-2222-4222-8222-222222222222";

function line(overrides: Partial<Parameters<typeof createCartLineFromProduct>[0]> = {}) {
  return createCartLineFromProduct({
    key: "a",
    productId: product,
    name: "Cable",
    unitId: unit,
    unitName: "pcs",
    unitSymbolPlaces: 0,
    unitPrice: 100,
    stock: "10",
    ...overrides,
  });
}

describe("POS cart engine", () => {
  it("adds a product", () => {
    const result = addOrIncrementProduct([], line());
    expect(result.ok).toBe(true);
    expect(result.cart).toHaveLength(1);
    expect(result.cart[0].qty).toBe("1");
    expect(calculatePosCartTotals(result.cart, 0).grand).toBe(100);
  });

  it("merges duplicate product+unit", () => {
    let cart = addOrIncrementProductOrThrow([], line());
    cart = addOrIncrementProductOrThrow(cart, line({ key: "b" }));
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe("2");
    expect(calculatePosCartTotals(cart, 0).grand).toBe(200);
  });

  it("changes quantity with increase/decrease/direct", () => {
    let cart = addOrIncrementProductOrThrow([], line());
    let r = increaseCartLineQty(cart, cart[0].key);
    expect(r.ok).toBe(true);
    cart = r.cart;
    expect(cart[0].qty).toBe("2");

    r = updateCartLineQty(cart, cart[0].key, "5");
    expect(r.ok).toBe(true);
    cart = r.cart;
    expect(cart[0].qty).toBe("5");

    r = decreaseCartLineQty(cart, cart[0].key);
    expect(r.ok).toBe(true);
    expect(r.cart[0].qty).toBe("4");
  });

  it("allows add when stock is unknown (new product, no stock_balances yet)", () => {
    const out = addOrIncrementProduct([], line({ stock: undefined }));
    expect(out.ok).toBe(true);
    expect(out.cart).toHaveLength(1);
  });

  it("validates stock on add and increment", () => {
    const out = addOrIncrementProduct([], line({ stock: "0" }));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/out of stock/i);

    let cart = addOrIncrementProductOrThrow([], line({ stock: "2" }));
    cart = addOrIncrementProductOrThrow(cart, line({ key: "b", stock: "2" }));
    const over = addOrIncrementProduct(cart, line({ key: "c", stock: "2" }));
    expect(over.ok).toBe(false);
    expect(over.error).toMatch(/stock|Maximum quantity/i);
  });

  it("rejects negative / invalid / NaN quantities", () => {
    const cart = addOrIncrementProductOrThrow([], line());
    expect(updateCartLineQty(cart, cart[0].key, "-1").ok).toBe(false);
    expect(updateCartLineQty(cart, cart[0].key, "abc").ok).toBe(false);
    expect(updateCartLineQty(cart, cart[0].key, "1.5").ok).toBe(false); // integer unit
    expect(updateCartLineQty(cart, cart[0].key, "0").ok).toBe(false);
  });

  it("allows decimal qty when unit symbol places > 0", () => {
    const cart = addOrIncrementProductOrThrow(
      [],
      line({
        unitSymbolPlaces: 2,
        unitName: "kg",
        stock: "5",
        qty: "1.25",
      }),
    );
    expect(cart[0].qty).toBe("1.25");
    const bad = updateCartLineQty(cart, cart[0].key, "1.255");
    expect(bad.ok).toBe(false);
  });

  it("removes and clears cart; totals stay finite", () => {
    let cart = addOrIncrementProductOrThrow([], line());
    cart = addOrIncrementProductOrThrow(cart, line({ key: "x", productId: "33333333-3333-4333-8333-333333333333", stock: "5" }));
    expect(cart).toHaveLength(2);
    cart = removeCartLine(cart, cart[0].key);
    expect(cart).toHaveLength(1);
    const totals = calculatePosCartTotals(cart, "NaN" as unknown as number);
    expect(Number.isFinite(totals.grand)).toBe(true);
    cart = clearCartLines();
    expect(calculatePosCartTotals(cart, 0).grand).toBe(0);
  });

  it("changes unit and merges when same unit already present", () => {
    const withOpts = line({
      unitOptions: [
        { unitId: unit, unitName: "pcs", symbolPlaces: 0, factorToBase: "1" },
        { unitId: unitKg, unitName: "box", symbolPlaces: 0, factorToBase: "10" },
      ],
      stock: "100",
    });
    let cart = addOrIncrementProductOrThrow([], withOpts);
    const changed = changeCartLineUnit(cart, cart[0].key, unitKg);
    expect(changed.ok).toBe(true);
    expect(changed.cart[0].unitId).toBe(unitKg);
    expect(changed.cart[0].unitName).toBe("box");
  });

  it("picks exact barcode/SKU for enter-to-add", () => {
    const items = [
      { productId: "1", sku: "ABC", barcode: "999" },
      { productId: "2", sku: "XYZ", barcode: "111" },
    ];
    expect(pickExactProductMatch(items, "999")?.productId).toBe("1");
    expect(pickExactProductMatch(items, "xyz")?.productId).toBe("2");
    expect(pickExactProductMatch(items, "nope")).toBeNull();
  });

  it("qty rules expose min/max", () => {
    const rules = qtyRulesForLine(line({ stock: "3", unitSymbolPlaces: 0 }));
    expect(rules.minQty).toBe("1");
    expect(rules.maxQty).toBe("3");
    expect(validateQtyAgainstRules("4", rules).ok).toBe(false);
  });
});
