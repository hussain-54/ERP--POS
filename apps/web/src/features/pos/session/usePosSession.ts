/**
 * POS session — single in-memory cart + customer state for the web terminal.
 * Cart mutations go through domain pos-cart (stock / qty / money-safe).
 * Pricing, discount, and tax math live in domain — not in React.
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
  resolvePosUnitPrice,
  recalculateCart,
  removeCartLine,
  toSaleItems,
  updateCartLineDiscount,
  updateCartLinePrice,
  updateCartLineQty,
  type PosCartLine,
  type PosCustomerProfile,
  type PosPriceLevel,
  type PosTaxRate,
  type PosUnitOption,
} from "@electronic-erp/domain";

export type PosSessionCustomer = PosCustomerProfile;


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
  const [allowManualOverride, setAllowManualOverride] = useState(false);

  const totals = useMemo(
    () => calculatePosCartTotals(cart, invoiceDiscount, taxRate),
    [cart, invoiceDiscount, taxRate],
  );

  const setTaxRate = useCallback((rate: PosTaxRate | null) => {
    setTaxRateState(rate);
    setCartState((prev) => recalculateCart(prev, rate));
  }, []);

  const addProduct = useCallback(
    (p: ProductSearchResult, unitOptions?: PosUnitOption[]): { ok: boolean; error?: string } => {
      let unitPrice: number;
      try {
        const resolved = resolvePosUnitPrice({
          retailPrice: Number(p.retailPrice),
          wholesalePrice: Number(p.wholesalePrice),
          dealerPrice: Number(p.dealerPrice),
          customerPrice: p.customerPrice != null ? Number(p.customerPrice) : null,
          promotionPrice: p.promotionPrice != null ? Number(p.promotionPrice) : null,
          quantityBreaks: p.quantityBreaks?.map((b) => ({
            minQty: Number(b.minQty),
            unitPrice: Number(b.unitPrice),
          })),
          priceLevel,
          qty: 1,
        });
        unitPrice = resolved.unitPrice;
      } catch (err) {
        const error = err instanceof Error ? err.message : "Invalid price";
        setLastCartError(error);
        return { ok: false, error };
      }

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
        unitPrice,
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
    (key: string, unitPrice: number, authorized = false) => {
      if (!authorized && !allowManualOverride) {
        setLastCartError("Manual price override is not authorized");
        return;
      }
      try {
        resolvePosUnitPrice({
          retailPrice: unitPrice,
          wholesalePrice: unitPrice,
          dealerPrice: unitPrice,
          priceLevel: "retail",
          qty: 1,
          manualOverride: unitPrice,
          allowManualOverride: true,
        });
      } catch (err) {
        setLastCartError(err instanceof Error ? err.message : "Invalid price");
        return;
      }
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
    [taxRate, allowManualOverride],
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
    setPriceLevel(c.priceLevel as PosPriceLevel);
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
    allowManualOverride,
    setAllowManualOverride,
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
