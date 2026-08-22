import { useCallback, useMemo, useState } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { roundMoney } from "@electronic-erp/domain";
import type { CartLine, PosCustomerView, PosPaymentKind, ProductTab } from "../types";
import { emptyCustomer } from "../types";
import { uuid } from "../format";

const RECENT_KEY = "erp-pos-v2-recent";
const FAVORITES_KEY = "erp-pos-v2-favorites";

function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids.slice(0, 40)));
}

export function usePosSale() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PosCustomerView>(emptyCustomer);
  const [paymentKind, setPaymentKind] = useState<PosPaymentKind>("cash");
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ProductTab>("recent");
  const [recentIds, setRecentIds] = useState<string[]>(() => loadIds(RECENT_KEY));
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadIds(FAVORITES_KEY));
  const [products, setProducts] = useState<ProductSearchResult[]>([]);

  const addProduct = useCallback((p: ProductSearchResult) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.productId);
      if (existing) {
        return prev.map((l) => (l.productId === p.productId ? { ...l, qty: l.qty + 1 } : l));
      }
      const rate = Number(p.retailPrice ?? 0);
      const tax = roundMoney(rate * 0.17);
      return [
        ...prev,
        {
          id: uuid(),
          productId: p.productId,
          name: p.name,
          sku: p.sku ?? "—",
          unitId: p.unitId,
          unitLabel: p.unitName ?? "Pcs",
          qty: 1,
          rate,
          discount: 0,
          tax,
          imageUrl: p.imageUrl,
        },
      ];
    });
    setRecentIds((ids) => {
      const next = [p.productId, ...ids.filter((id) => id !== p.productId)];
      saveIds(RECENT_KEY, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    setFavoriteIds((ids) => {
      const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [productId, ...ids];
      saveIds(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const updateQty = useCallback((lineId: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.id === lineId ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setInvoiceDiscount(0);
    setDeliveryCharges(0);
    setRoundOff(0);
  }, []);

  const newSale = useCallback(() => {
    clearCart();
    setCustomer(emptyCustomer());
    setPaymentKind("cash");
  }, [clearCart]);

  const totals = useMemo(() => {
    const itemCount = lines.length;
    const totalQty = lines.reduce((s, l) => s + l.qty, 0);
    const taxable = lines.reduce((s, l) => s + l.qty * l.rate - l.discount, 0);
    const itemDiscount = lines.reduce((s, l) => s + l.discount, 0);
    const tax = lines.reduce((s, l) => s + l.tax * l.qty, 0);
    const subtotal = taxable + tax;
    const totalDiscount = itemDiscount + invoiceDiscount;
    const grand = roundMoney(subtotal + deliveryCharges + roundOff - invoiceDiscount);
    return { itemCount, totalQty, taxable, itemDiscount, tax, subtotal, totalDiscount, grand };
  }, [lines, invoiceDiscount, deliveryCharges, roundOff]);

  return {
    lines,
    customer,
    setCustomer,
    paymentKind,
    setPaymentKind,
    invoiceDiscount,
    setInvoiceDiscount,
    deliveryCharges,
    setDeliveryCharges,
    roundOff,
    setRoundOff,
    search,
    setSearch,
    tab,
    setTab,
    recentIds,
    favoriteIds,
    products,
    setProducts,
    addProduct,
    toggleFavorite,
    updateQty,
    removeLine,
    clearCart,
    newSale,
    totals,
  };
}

export type PosSaleState = ReturnType<typeof usePosSale>;
