/**
 * POS session — single in-memory cart + customer state for the web terminal.
 * Not a second store: consolidates cart/customer/pricing/tax/discount session state.
 * Sales/holds/returns persistence: posApi → API → PosRepository / SaleTransactionService.
 * Offline desktop: OfflinePosEngine (SQLite) — do not duplicate here.
 */
import { useCallback, useMemo, useState } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import {
  addOrIncrementProduct,
  calculatePosCartTotals,
  clearCartLines,
  createCartLineFromProduct,
  createManualCartLine,
  pickPriceLevel,
  removeCartLine,
  toSaleItems,
  updateCartLineDiscount,
  updateCartLinePrice,
  updateCartLineQty,
  type PosCartLine,
  type PosPriceLevel,
  type PosTaxRate,
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
  const [taxRate, setTaxRate] = useState<PosTaxRate | null>(null);
  const [priceLevel, setPriceLevel] = useState<PosPriceLevel>("retail");
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [walkIn, setWalkIn] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState<PosSessionCustomer | null>(null);

  const totals = useMemo(
    () => calculatePosCartTotals(cart, invoiceDiscount),
    [cart, invoiceDiscount],
  );

  const addProduct = useCallback(
    (p: ProductSearchResult) => {
      const unitPrice = pickPriceLevel(p, priceLevel);
      const line = createCartLineFromProduct({
        key: newKey(),
        productId: p.productId,
        name: p.name,
        nameUr: p.nameUr,
        sku: p.sku,
        unitId: p.unitId,
        unitName: p.unitName,
        unitPrice: Number(unitPrice),
        warrantyDays: p.warrantyDays,
        stock: p.stockAvailable,
        taxRate,
      });
      setCartState((prev) => addOrIncrementProduct(prev, line, taxRate));
    },
    [priceLevel, taxRate],
  );

  const addManual = useCallback((unitId: string, name?: string) => {
    setCartState((prev) => [...prev, createManualCartLine({ key: newKey(), unitId, name })]);
  }, []);

  const setQty = useCallback(
    (key: string, qty: string) => {
      setCartState((prev) => updateCartLineQty(prev, key, qty, taxRate));
    },
    [taxRate],
  );

  const setPrice = useCallback(
    (key: string, unitPrice: number) => {
      setCartState((prev) => updateCartLinePrice(prev, key, unitPrice, taxRate));
    },
    [taxRate],
  );

  const setLineDiscount = useCallback(
    (key: string, discount: number) => {
      setCartState((prev) => updateCartLineDiscount(prev, key, discount, taxRate));
    },
    [taxRate],
  );

  const removeLine = useCallback((key: string) => {
    setCartState((prev) => removeCartLine(prev, key));
  }, []);

  const clearCart = useCallback(() => {
    setCartState(clearCartLines());
  }, []);

  const replaceCart = useCallback((lines: PosCartLine[]) => {
    setCartState(lines);
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
    addProduct,
    addManual,
    setQty,
    setPrice,
    setLineDiscount,
    removeLine,
    clearCart,
    selectWalkIn,
    applyCustomer,
    setCustomerId,
    setCustomer,
    setWalkIn,
  };
}
