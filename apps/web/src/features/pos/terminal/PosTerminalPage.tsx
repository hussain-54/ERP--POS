import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { posApi } from "../api";
import { uuid } from "../format";
import { usePosSale } from "../hooks/usePosSale";
import { ProductCatalog } from "./ProductCatalog";
import { CartPanel } from "./CartPanel";

export function PosTerminalPage() {
  const { branchId } = useAuth();
  const { push } = useToast();
  const sale = usePosSale();
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(9);

  const {
    search,
    setSearch,
    tab,
    setTab,
    products,
    setProducts,
    favoriteIds,
    recentIds,
    addProduct,
    toggleFavorite,
    lines,
    customer,
    paymentKind,
    setPaymentKind,
    invoiceDiscount,
    setInvoiceDiscount,
    deliveryCharges,
    roundOff,
    totals,
    updateQty,
    removeLine,
    clearCart,
    newSale,
  } = sale;

  const loadProducts = useCallback(async () => {
    try {
      const res = await posApi.searchProducts({ q: search || " ", limit });
      setProducts(res.items);
    } catch {
      setProducts([]);
    }
  }, [limit, search, setProducts]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadProducts(), 250);
    return () => window.clearTimeout(id);
  }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    if (tab === "favorites") {
      return products.filter((p) => favoriteIds.includes(p.productId));
    }
    if (tab === "recent") {
      const order = new Map(recentIds.map((id, i) => [id, i]));
      return [...products].sort((a, b) => (order.get(a.productId) ?? 99) - (order.get(b.productId) ?? 99));
    }
    return products;
  }, [products, tab, favoriteIds, recentIds]);

  useEffect(() => {
    function onShortcut(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "new-sale") newSale();
      if (detail === "clear-cart") clearCart();
      if (detail === "cancel-sale") newSale();
    }
    window.addEventListener("pos:shortcut", onShortcut);
    return () => window.removeEventListener("pos:shortcut", onShortcut);
  }, [newSale, clearCart]);

  async function onPay() {
    if (!branchId || lines.length === 0) return;
    setBusy(true);
    try {
      await posApi.postSale({
        branchId,
        warehouseId: branchId,
        idempotencyKey: uuid(),
        items: lines.map((l) => ({
          productId: l.productId,
          unitId: l.unitId,
          qty: l.qty,
          unitPrice: l.rate,
          discount: l.discount,
          tax: l.tax,
        })),
        payments: [],
        discountTotal: invoiceDiscount,
      });
      push({ title: "Sale posted", tone: "success" });
      newSale();
    } catch (err) {
      push({ title: "Checkout failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function onHold() {
    if (!branchId || lines.length === 0) return;
    setBusy(true);
    try {
      await posApi.holdSale({
        branchId,
        warehouseId: branchId,
        idempotencyKey: uuid(),
        items: lines.map((l) => ({
          productId: l.productId,
          unitId: l.unitId,
          qty: l.qty,
          unitPrice: l.rate,
        })),
      });
      push({ title: "Sale held", tone: "success" });
      newSale();
    } catch (err) {
      push({ title: "Hold failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  function onApplyDiscount() {
    const value = window.prompt("Invoice discount amount", String(invoiceDiscount));
    if (value == null) return;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) setInvoiceDiscount(n);
  }

  return (
    <div className="pos-sale-layout flex min-h-0 flex-1 overflow-hidden">
      <ProductCatalog
        search={search}
        onSearch={setSearch}
        tab={tab}
        onTab={setTab}
        products={visibleProducts}
        favoriteIds={favoriteIds}
        onAdd={addProduct}
        onToggleFavorite={toggleFavorite}
        onLoadMore={() => setLimit((l) => l + 9)}
      />
      <CartPanel
        customer={customer}
        lines={lines}
        paymentKind={paymentKind}
        onPaymentKind={setPaymentKind}
        invoiceDiscount={invoiceDiscount}
        deliveryCharges={deliveryCharges}
        roundOff={roundOff}
        totals={totals}
        onQty={updateQty}
        onRemove={removeLine}
        onClear={clearCart}
        onApplyDiscount={onApplyDiscount}
        onPay={() => void onPay()}
        onHold={() => void onHold()}
        onQuotation={() => push({ title: "Quotation", description: "Open Quotations module to convert.", tone: "info" })}
        busy={busy}
      />
    </div>
  );
}
