import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApproverRole, ProductSearchResult } from "@electronic-erp/contracts";
import {
  buildHoldSnapshot,
  effectiveDiscountPercent,
  evaluateDiscountApproval,
  restoreHoldTransaction,
  roundMoney,
} from "@electronic-erp/domain";
import type {
  CartLine,
  DiscountMode,
  PosCustomerView,
  PosPaymentKind,
  PosPaymentLine,
  ProductTab,
} from "../types";
import { emptyCustomer, lineTotal } from "../types";
import { uuid } from "../format";

const RECENT_KEY = "erp-pos-v2-recent";
const FAVORITES_KEY = "erp-pos-v2-favorites";
const TAX_RATE = 0.17;

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

function lineTax(rate: number, qty: number, discount: number): number {
  const taxable = Math.max(0, rate * qty - discount);
  return roundMoney(taxable * TAX_RATE);
}

function toCartLine(p: ProductSearchResult, qty = 1): CartLine {
  const retail = Number(p.retailPrice ?? 0);
  const rate = Number(p.customerPrice ?? p.promotionPrice ?? p.retailPrice ?? 0);
  const listPrice = retail > 0 ? retail : rate;
  return {
    id: uuid(),
    productId: p.productId,
    name: p.name,
    sku: p.sku ?? "—",
    unitId: p.unitId,
    unitLabel: p.unitName ?? "Pcs",
    qty,
    rate,
    listPrice,
    discount: 0,
    discountPercent: 0,
    tax: lineTax(rate, qty, 0) / Math.max(qty, 1),
    taxRate: TAX_RATE,
    imageUrl: p.imageUrl,
    stockAvailable: p.stockAvailable != null ? Number(p.stockAvailable) : null,
    category: p.category ?? null,
  };
}

function parseRestoredLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const isManual = Boolean(r.isManual) || (typeof r.productId === "string" && r.productId.startsWith("custom-"));
  const productId = typeof r.productId === "string" ? r.productId : null;
  const unitId = typeof r.unitId === "string" ? r.unitId : null;
  if (!isManual && (!productId || !unitId)) return null;
  const qty = Number(r.qty ?? 1);
  const rate = Number(r.rate ?? r.unitPrice ?? 0);
  const discount = Number(r.discount ?? 0);
  return {
    id: typeof r.id === "string" ? r.id : uuid(),
    productId: productId ?? `custom-${uuid()}`,
    name: String(r.name ?? "Item"),
    sku: String(r.sku ?? "—"),
    unitId: unitId ?? uuid(),
    unitLabel: String(r.unitLabel ?? r.unitName ?? "Pcs"),
    qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
    rate: Number.isFinite(rate) ? rate : 0,
    listPrice: Number(r.listPrice ?? rate) || rate,
    discount: Number.isFinite(discount) ? discount : 0,
    discountPercent: Number(r.discountPercent ?? 0) || 0,
    tax: Number(r.tax ?? lineTax(rate, qty, discount) / Math.max(qty, 1)),
    taxRate: Number(r.taxRate ?? TAX_RATE) || TAX_RATE,
    imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : null,
    stockAvailable: r.stockAvailable != null ? Number(r.stockAvailable) : null,
    category: typeof r.category === "string" ? r.category : null,
    isManual,
  };
}

export function usePosSale() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PosCustomerView>(emptyCustomer);
  const [paymentKind, setPaymentKind] = useState<PosPaymentKind>("cash");
  const [paymentLines, setPaymentLines] = useState<PosPaymentLine[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState<DiscountMode>("fixed");
  const [invoiceDiscountPercent, setInvoiceDiscountPercent] = useState(0);
  const [invoiceDiscountReason, setInvoiceDiscountReason] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [notes, setNotes] = useState("");
  const [salesmanRef, setSalesmanRef] = useState("");
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ProductTab>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => loadIds(RECENT_KEY));
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadIds(FAVORITES_KEY));
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [defaultUnitId, setDefaultUnitId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  useEffect(() => {
    const unit = products.find((p) => p.unitId)?.unitId;
    if (unit) setDefaultUnitId(unit);
  }, [products]);

  const addProduct = useCallback((p: ProductSearchResult) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.productId);
      if (existing) {
        return prev.map((l) => {
          if (l.productId !== p.productId) return l;
          const qty = l.qty + 1;
          const taxPerUnit = lineTax(l.rate, qty, l.discount) / qty;
          return { ...l, qty, tax: taxPerUnit };
        });
      }
      return [...prev, toCartLine(p)];
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

  const updateQty = useCallback((lineId: string, qtyOrDelta: number, absolute = false) => {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.id !== lineId) return l;
          const qty = absolute ? Math.max(0, qtyOrDelta) : Math.max(0, l.qty + qtyOrDelta);
          if (qty <= 0) return { ...l, qty: 0 };
          const tax = lineTax(l.rate, qty, l.discount) / qty;
          return { ...l, qty, tax };
        })
        .filter((l) => l.qty > 0),
    );
  }, []);

  const setLineDiscount = useCallback(
    (lineId: string, amount: number, percent: number, actingRole: ApproverRole) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const base = l.qty * l.rate;
          const discount = roundMoney(Math.min(Math.max(0, amount), base));
          const decision = evaluateDiscountApproval({
            discountAmount: discount,
            baseAmount: base,
            actingRole,
          });
          if (!decision.allowed) {
            throw new Error(
              `Item discount ${decision.percent}% requires ${decision.requiredRole} (your limit ${decision.maxAllowed}%)`,
            );
          }
          const tax = lineTax(l.rate, l.qty, discount) / Math.max(l.qty, 1);
          return {
            ...l,
            discount,
            discountPercent: percent || effectiveDiscountPercent(discount, base),
            tax,
          };
        }),
      );
    },
    [],
  );

  const setLinePrice = useCallback((lineId: string, rate: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const nextRate = Math.max(0, rate);
        const tax = lineTax(nextRate, l.qty, l.discount) / Math.max(l.qty, 1);
        return { ...l, rate: nextRate, tax };
      }),
    );
  }, []);

  const addCustomLine = useCallback((item: { name: string; rate: number; qty?: number; barcode?: string; sku?: string }) => {
    const qty = Math.max(1, item.qty ?? 1);
    const rate = Math.max(0, item.rate);
    const newLine: CartLine = {
      id: uuid(),
      productId: `custom-${uuid()}`,
      name: item.name,
      sku: item.sku || item.barcode || "MANUAL",
      unitId: defaultUnitId ?? uuid(),
      unitLabel: "Pcs",
      qty,
      rate,
      listPrice: rate,
      discount: 0,
      discountPercent: 0,
      tax: lineTax(rate, qty, 0) / qty,
      taxRate: TAX_RATE,
      stockAvailable: null,
      category: "Manual Entry",
      isManual: true,
    };
    setLines((prev) => [...prev, newLine]);
  }, [defaultUnitId]);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setInvoiceDiscount(0);
    setInvoiceDiscountPercent(0);
    setInvoiceDiscountMode("fixed");
    setInvoiceDiscountReason("");
    setCouponCode("");
    setDeliveryCharges(0);
    setRoundOff(0);
    setNotes("");
    setPaymentLines([]);
    setDraftLabel("");
  }, []);

  const newSale = useCallback(() => {
    clearCart();
    setCustomer(emptyCustomer());
    setPaymentKind("cash");
    setSalesmanRef("");
  }, [clearCart]);

  const applyInvoiceDiscount = useCallback(
    (input: {
      mode: DiscountMode;
      amount: number;
      percent: number;
      reason: string;
      coupon?: string;
      actingRole: ApproverRole;
      baseAmount: number;
    }) => {
      let amount = input.amount;
      if (input.mode === "percentage") {
        amount = roundMoney((input.baseAmount * input.percent) / 100);
      }
      amount = Math.max(0, Math.min(amount, input.baseAmount));
      const decision = evaluateDiscountApproval({
        discountAmount: amount,
        baseAmount: input.baseAmount || 1,
        actingRole: input.actingRole,
      });
      if (!decision.allowed) {
        throw new Error(
          `Invoice discount ${decision.percent}% requires ${decision.requiredRole} (your limit ${decision.maxAllowed}%)`,
        );
      }
      if (decision.percent > 5 && !input.reason.trim()) {
        throw new Error("Discount reason is required above 5%");
      }
      setInvoiceDiscount(amount);
      setInvoiceDiscountPercent(input.mode === "percentage" ? input.percent : decision.percent);
      setInvoiceDiscountMode(input.mode);
      setInvoiceDiscountReason(input.reason.trim());
      if (input.coupon) setCouponCode(input.coupon.trim().toUpperCase());
    },
    [],
  );

  const restoreFromHold = useCallback((snapshot: Record<string, unknown>) => {
    const restored = restoreHoldTransaction(snapshot);
    const nextLines = restored.cart
      .map(parseRestoredLine)
      .filter((l): l is CartLine => Boolean(l));
    setLines(nextLines);
    setInvoiceDiscount(Number(restored.invoiceDiscount) || 0);
    setInvoiceDiscountPercent(restored.invoiceDiscountPercent || 0);
    setInvoiceDiscountMode(restored.invoiceDiscountKind === "percentage" ? "percentage" : "fixed");
    setNotes(restored.notes || "");
    setSalesmanRef(restored.salesmanUserId || restored.referenceId || "");
    if (restored.walkIn || !restored.customerId) {
      setCustomer(emptyCustomer());
    } else {
      setCustomer({
        id: restored.customerId,
        label: restored.customerName || "Customer",
        priceTier: restored.priceLevel || "Retail",
        creditLimit: 0,
        outstanding: 0,
        loyaltyPoints: 0,
      });
    }
    setPaymentKind("cash");
    setPaymentLines([]);
  }, []);

  const buildSnapshot = useCallback(() => {
    const totalsNow = {
      items: lines.length,
      qty: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + lineTotal(l), 0),
      itemDiscount: lines.reduce((s, l) => s + l.discount, 0),
      invoiceDiscount,
      discount: lines.reduce((s, l) => s + l.discount, 0) + invoiceDiscount,
      tax: lines.reduce((s, l) => s + l.tax * l.qty, 0),
      grand: 0,
      taxableAmount: lines.reduce((s, l) => s + lineTotal(l), 0),
    };
    const tax = totalsNow.tax;
    totalsNow.grand = roundMoney(
      totalsNow.subtotal + tax + deliveryCharges + roundOff - invoiceDiscount,
    );
    return buildHoldSnapshot({
      cart: lines,
      customerId: customer.id,
      customerName: customer.label,
      walkIn: !customer.id,
      invoiceDiscount: String(invoiceDiscount),
      invoiceDiscountKind: invoiceDiscountMode === "percentage" ? "percentage" : "fixed",
      invoiceDiscountPercent,
      notes,
      payments: paymentLines,
      priceLevel: customer.priceTier.toLowerCase() || "retail",
      salesmanUserId: salesmanRef || null,
      referenceId: salesmanRef || null,
      totals: totalsNow,
    });
  }, [
    lines,
    customer,
    invoiceDiscount,
    invoiceDiscountMode,
    invoiceDiscountPercent,
    notes,
    paymentLines,
    salesmanRef,
    deliveryCharges,
    roundOff,
  ]);

  const totals = useMemo(() => {
    const itemCount = lines.length;
    const totalQty = lines.reduce((s, l) => s + l.qty, 0);
    const itemDiscount = lines.reduce((s, l) => s + l.discount, 0);
    const taxable = lines.reduce((s, l) => s + lineTotal(l), 0);
    const tax = lines.reduce((s, l) => s + l.tax * l.qty, 0);
    const subtotal = taxable;
    const totalDiscount = itemDiscount + invoiceDiscount;
    const grand = roundMoney(subtotal + tax + deliveryCharges + roundOff - invoiceDiscount);
    return {
      itemCount,
      totalQty,
      taxable,
      itemDiscount,
      tax,
      subtotal,
      totalDiscount,
      invoiceDiscount,
      deliveryCharges,
      roundOff,
      grand,
      expectedProfit: null as number | null,
    };
  }, [lines, invoiceDiscount, deliveryCharges, roundOff]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    for (const l of lines) {
      if (l.category) set.add(l.category);
    }
    return [...set].sort();
  }, [products, lines]);

  return {
    lines,
    customer,
    setCustomer,
    paymentKind,
    setPaymentKind,
    paymentLines,
    setPaymentLines,
    invoiceDiscount,
    invoiceDiscountMode,
    invoiceDiscountPercent,
    invoiceDiscountReason,
    couponCode,
    setCouponCode,
    notes,
    setNotes,
    salesmanRef,
    setSalesmanRef,
    deliveryCharges,
    setDeliveryCharges,
    roundOff,
    setRoundOff,
    search,
    setSearch,
    tab,
    setTab,
    categoryFilter,
    setCategoryFilter,
    categories,
    recentIds,
    favoriteIds,
    products,
    setProducts,
    defaultUnitId,
    draftLabel,
    setDraftLabel,
    addProduct,
    addCustomLine,
    toggleFavorite,
    updateQty,
    setLineDiscount,
    setLinePrice,
    removeLine,
    clearCart,
    newSale,
    applyInvoiceDiscount,
    restoreFromHold,
    buildSnapshot,
    totals,
  };
}

export type PosSaleState = ReturnType<typeof usePosSale>;
