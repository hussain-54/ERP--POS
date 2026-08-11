/**
 * POS session — single in-memory cart + customer state for the web terminal.
 * Cart mutations go through domain pos-cart (stock / qty / money-safe).
 */
import { useCallback, useMemo, useState } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import {
  addOrIncrementProduct,
  calculatePosCartTotals,
  changeCartLineUnit,
  clearCartLines,
  createCartLineFromProduct,
  createManualCartLine,
  decreaseCartLineQty,
  increaseCartLineQty,
  pickPriceLevel,
  recalculateCart,
  removeCartLine,
  toSaleItems,
  updateCartLineDiscount,
  updateCartLinePrice,
  updateCartLineQty,
  type PosCartLine,
  type PosPriceLevel,
  type PosTaxRate,
  type PosUnitOption,
} from "@electronic-erp/domain";

export type PosSessionCustomer = {
  id: string;
  name: string;
  mobile?: string | null;
  customerType?: string;
  creditLimit?: string;
  outstanding?: string;
};

function newKey(): string {
  return crypto.randomUUID();
}

export function usePosSession() {
  const [cart, setCartState] = useState<PosCartLine[]>([]);
  const [taxRate, setTaxRateState] = useState<PosTaxRate | null>(null);
  const [priceLevel, setPriceLevel] = useState<PosPriceLevel>("retail");
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [walkIn, setWalkIn] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState<PosSessionCustomer | null>(null);
  const [lastCartError, setLastCartError] = useState<string | null>(null);

  const totals = useMemo(
    () => calculatePosCartTotals(cart, invoiceDiscount),
    [cart, invoiceDiscount],
  );

  const setTaxRate = useCallback((rate: PosTaxRate | null) => {
    setTaxRateState(rate);
    setCartState((prev) => recalculateCart(prev, rate));
  }, []);

  const addProduct = useCallback(
    (p: ProductSearchResult, unitOptions?: PosUnitOption[]): { ok: boolean; error?: string } => {
      const unitPrice = pickPriceLevel(p, priceLevel);
      const places = Number(p.unitSymbolPlaces ?? 0);
      const line = createCartLineFromProduct({
        key: newKey(),
        productId: p.productId,
        name: p.name,
        nameUr: p.nameUr,
        sku: p.sku,
        unitId: p.unitId,
        unitName: p.unitName,
        unitSymbolPlaces: places,
        unitPrice: Number(unitPrice),
        warrantyDays: p.warrantyDays,
        stock: p.stockAvailable,
        unitOptions:
          unitOptions ??
          [
            {
              unitId: p.unitId,
              unitName: p.unitName ?? "Unit",
              symbolPlaces: places,
              factorToBase: "1",
            },
          ],
        taxRate,
      });
      let outcome: { ok: boolean; error?: string } = { ok: true };
      setCartState((prev) => {
        const result = addOrIncrementProduct(prev, line, taxRate);
        if (result.ok) {
          setLastCartError(null);
          outcome = { ok: true };
          return result.cart;
        }
        const error = result.error ?? "Cannot add product";
        setLastCartError(error);
        outcome = { ok: false, error };
        return prev;
      });
      return outcome;
    },
    [priceLevel, taxRate],
  );

  const addManual = useCallback((unitId: string, name?: string) => {
    setCartState((prev) => [...prev, createManualCartLine({ key: newKey(), unitId, name })]);
    setLastCartError(null);
  }, []);

  const setQty = useCallback(
    (key: string, qty: string) => {
      setCartState((prev) => {
        const result = updateCartLineQty(prev, key, qty, taxRate);
        if (result.ok) {
          setLastCartError(null);
          return result.cart;
        }
        setLastCartError(result.error ?? "Invalid quantity");
        return prev;
      });
    },
    [taxRate],
  );

  const increaseQty = useCallback(
    (key: string) => {
      setCartState((prev) => {
        const result = increaseCartLineQty(prev, key, taxRate);
        if (result.ok) {
          setLastCartError(null);
          return result.cart;
        }
        setLastCartError(result.error ?? "Cannot increase quantity");
        return prev;
      });
    },
    [taxRate],
  );

  const decreaseQty = useCallback(
    (key: string) => {
      setCartState((prev) => {
        const result = decreaseCartLineQty(prev, key, taxRate);
        if (result.ok) {
          setLastCartError(null);
          return result.cart;
        }
        setLastCartError(result.error ?? "Cannot decrease quantity");
        return prev;
      });
    },
    [taxRate],
  );

  const setPrice = useCallback(
    (key: string, unitPrice: number) => {
      setCartState((prev) => {
        const result = updateCartLinePrice(prev, key, unitPrice, taxRate);
        if (result.ok) {
          setLastCartError(null);
          return result.cart;
        }
        setLastCartError(result.error ?? "Invalid price");
        return prev;
      });
    },
    [taxRate],
  );

  const setLineDiscount = useCallback(
    (key: string, discount: number) => {
      setCartState((prev) => {
        const result = updateCartLineDiscount(prev, key, discount, taxRate);
        if (result.ok) {
          setLastCartError(null);
          return result.cart;
        }
        setLastCartError(result.error ?? "Invalid discount");
        return prev;
      });
    },
    [taxRate],
  );

  const changeUnit = useCallback(
    (key: string, unitId: string) => {
      setCartState((prev) => {
        const result = changeCartLineUnit(prev, key, unitId, taxRate);
        if (result.ok) {
          setLastCartError(null);
          return result.cart;
        }
        setLastCartError(result.error ?? "Cannot change unit");
        return prev;
      });
    },
    [taxRate],
  );

  const removeLine = useCallback((key: string) => {
    setCartState((prev) => removeCartLine(prev, key));
    setLastCartError(null);
  }, []);

  const clearCart = useCallback(() => {
    setCartState(clearCartLines());
    setLastCartError(null);
  }, []);

  const replaceCart = useCallback((lines: PosCartLine[]) => {
    setCartState(lines);
    setLastCartError(null);
  }, []);

  const selectWalkIn = useCallback(() => {
    setWalkIn(true);
    setCustomerId("");
    setCustomer(null);
  }, []);

  const applyCustomer = useCallback((c: PosSessionCustomer) => {
    setWalkIn(false);
    setCustomerId(c.id);
    setCustomer(c);
  }, []);

  const saleItems = useMemo(() => toSaleItems(cart), [cart]);

  return {
    cart,
    replaceCart,
    totals,
    saleItems,
    taxRate,
    setTaxRate,
    priceLevel,
    setPriceLevel,
    invoiceDiscount,
    setInvoiceDiscount,
    walkIn,
    customerId,
    customer,
    lastCartError,
    clearCartError: () => setLastCartError(null),
    addProduct,
    addManual,
    setQty,
    increaseQty,
    decreaseQty,
    setPrice,
    setLineDiscount,
    changeUnit,
    removeLine,
    clearCart,
    selectWalkIn,
    applyCustomer,
    setCustomerId,
    setCustomer,
    setWalkIn,
  };
}
