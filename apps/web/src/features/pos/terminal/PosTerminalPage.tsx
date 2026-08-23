import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  actingDiscountRole,
  canOverridePrice,
  emptyCustomer,
  tenderToMethodKind,
  type CartLine,
  type DiscountScope,
  type PosPaymentLine,
} from "../types";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { partiesApi } from "@/features/customers/parties-api";
import { CATALOG_CHANGED_EVENT } from "@/features/product-management/catalog-api";
import { posApi } from "../api";
import { uuid } from "../format";
import { usePosSale } from "../hooks/usePosSale";
import type { PosCustomerView } from "../types";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import type { DiscountSection } from "../pricing/discount-utils";
import { PaymentDrawer } from "../payments/PaymentDrawer";
import { validatePosPayment } from "../payments/payment-utils";
import { ProductDiscovery } from "./ProductDiscovery";
import { CartZone } from "./CartZone";
import { CheckoutZone } from "./CheckoutZone";
import { CustomerDialog } from "./CustomerDialog";
import { DiscountDialog } from "./DiscountDialog";
import "./terminal-layout.css";

type MobilePane = "products" | "cart" | "checkout";

export function PosTerminalPage() {
  const { branchId, organizationId, permissions, hasPermission } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const sale = usePosSale();
  const searchRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(24);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("products");
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState<"select" | "create">("select");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountScope, setDiscountScope] = useState<DiscountScope>("invoice");
  const [discountSection, setDiscountSection] = useState<DiscountSection>("invoice");
  const [discountLine, setDiscountLine] = useState<CartLine | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [installmentPlan, setInstallmentPlan] = useState({ downPayment: "0", installmentCount: 3 });
  const [methodsByKind, setMethodsByKind] = useState<Record<string, string>>({});

  const actingRole = actingDiscountRole(permissions);
  const allowPriceOverride = canOverridePrice(permissions);
  const isQuick = location.pathname.includes("/quick");

  const {
    search,
    setSearch,
    tab,
    setTab,
    categoryFilter,
    setCategoryFilter,
    categories,
    products,
    setProducts,
    favoriteIds,
    recentIds,
    addProduct,
    toggleFavorite,
    lines,
    customer,
    setCustomer,
    paymentKind,
    setPaymentKind,
    paymentLines,
    setPaymentLines,
    invoiceDiscount,
    invoiceDiscountReason,
    couponCode,
    notes,
    setNotes,
    totals,
    updateQty,
    setLineDiscount,
    setLinePrice,
    removeLine,
    clearCart,
    newSale,
    applyInvoiceDiscount,
    restoreFromHold,
    buildSnapshot,
  } = sale;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await partiesApi.seedPaymentMethods().catch(() => null);
        const res = await partiesApi.listPaymentMethods();
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const row of res.items) {
          const kind = String(row.kind ?? "");
          const id = String(row.id ?? "");
          if (kind && id && !map[kind]) map[kind] = id;
        }
        setMethodsByKind(map);
      } catch {
        /* keep empty — complete sale will surface error */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = useCallback(async () => {
    if (!branchId) return;
    setLoadingProducts(true);
    try {
      const q = search.trim() || " ";
      const res = await posApi.searchProducts({
        q,
        limit,
        warehouseId: branchId,
        customerId: customer.id ?? undefined,
      });
      setProducts(res.items);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [branchId, search, limit, customer.id, setProducts]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadProducts(), 280);
    return () => window.clearTimeout(id);
  }, [loadProducts]);

  useEffect(() => {
    function onCatalogChanged() {
      void loadProducts();
    }
    window.addEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
  }, [loadProducts]);

  useEffect(() => {
    if (params.get("discount") === "1") {
      const section = (params.get("section") as DiscountSection | null) ?? "invoice";
      setDiscountSection(section);
      setDiscountScope(section === "item" ? "item" : "invoice");
      if (section === "item") {
        const hit = lines.find((l) => l.id === selectedLineId) ?? lines[0] ?? null;
        setDiscountLine(hit);
      } else {
        setDiscountLine(null);
      }
      setDiscountOpen(true);
    }
    if (params.get("pay") === "1") {
      const tender = params.get("tender");
      if (tender) setPaymentKind(tender as typeof paymentKind);
      setPaymentOpen(true);
    }
  }, [params, lines, selectedLineId, setPaymentKind]);

  useEffect(() => {
    const state = location.state as {
      resumeSnapshot?: Record<string, unknown>;
      attachCustomer?: PosCustomerView;
      addProducts?: ProductSearchResult[];
    } | null;
    if (!state) return;

    if (state.resumeSnapshot) {
      const notes = typeof state.resumeSnapshot.notes === "string" ? state.resumeSnapshot.notes : "";
      restoreFromHold(state.resumeSnapshot);
      navigate(location.pathname, { replace: true, state: {} });
      push({
        title: notes.startsWith("Repeat of") ? "Repeat sale loaded" : "Sale restored",
        description: notes.startsWith("Repeat of")
          ? "Customer and note applied — re-add products before checkout."
          : undefined,
        tone: "success",
      });
      return;
    }

    let touched = false;
    if (state.attachCustomer) {
      setCustomer(state.attachCustomer);
      touched = true;
      push({
        title: state.attachCustomer.id ? "Customer attached" : "Walk-in selected",
        tone: "success",
      });
    }
    if (state.addProducts?.length) {
      for (const p of state.addProducts) addProduct(p);
      touched = true;
      push({
        title: state.addProducts.length === 1 ? "Product added" : "Products added",
        tone: "success",
      });
    }
    if (touched) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state,
    location.pathname,
    restoreFromHold,
    navigate,
    push,
    setCustomer,
    addProduct,
  ]);

  const visibleProducts = useMemo(() => {
    let list = products;
    if (tab === "favorites") {
      list = products.filter((p) => favoriteIds.includes(p.productId));
    } else if (tab === "recent") {
      const order = new Map(recentIds.map((id, i) => [id, i]));
      list = [...products]
        .filter((p) => recentIds.includes(p.productId) || !search.trim())
        .sort((a, b) => (order.get(a.productId) ?? 999) - (order.get(b.productId) ?? 999));
      if (list.length === 0 && recentIds.length) {
        list = products;
      }
    }
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    return list;
  }, [products, tab, favoriteIds, recentIds, categoryFilter, search]);

  useEffect(() => {
    function onShortcut(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "new-sale") newSale();
      if (detail === "clear-cart") clearCart();
      if (detail === "cancel-sale") newSale();
      if (detail === "focus-search") {
        window.dispatchEvent(new Event("pos:focus-search"));
      }
      if (detail === "discount") {
        setDiscountScope("invoice");
        setDiscountLine(null);
        setDiscountOpen(true);
      }
      if (detail === "hold") void onHold();
      if (detail === "pay") setPaymentOpen(true);
      if (detail === "customers") {
        setCustomerMode("select");
        setCustomerOpen(true);
      }
    }
    window.addEventListener("pos:shortcut", onShortcut);
    return () => window.removeEventListener("pos:shortcut", onShortcut);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onHold defined below
  }, [newSale, clearCart]);

  async function onHold() {
    if (!branchId || !organizationId || lines.length === 0) return;
    setBusy(true);
    try {
      await posApi.holdSale({
        organizationId,
        branchId,
        warehouseId: branchId,
        customerId: customer.id,
        notes: notes || undefined,
        holdLabel: customer.label,
        cartSnapshot: buildSnapshot(),
      });
      push({ title: "Sale held", description: "Open Held Sales to resume.", tone: "success" });
      newSale();
      navigate("/pos/sales/held");
    } catch (err) {
      push({
        title: "Hold failed",
        description: err instanceof Error ? err.message : "Try again.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  function onSaveDraft() {
    if (lines.length === 0) return;
    try {
      const key = "erp-pos-drafts";
      const raw = localStorage.getItem(key);
      const drafts = raw ? (JSON.parse(raw) as unknown[]) : [];
      const list = Array.isArray(drafts) ? drafts : [];
      list.unshift({
        id: uuid(),
        savedAt: new Date().toISOString(),
        snapshot: buildSnapshot(),
        label: notes || customer.label,
      });
      localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));
      push({ title: "Draft saved locally", tone: "success" });
    } catch {
      push({ title: "Could not save draft", tone: "danger" });
    }
  }

  function buildPaymentsForPost(override?: PosPaymentLine[]) {
    const linesPay = override ?? paymentLines;
    if (paymentKind === "credit" || paymentKind === "installment") return [];
    if (linesPay.length) {
      return linesPay
        .filter((p) => p.paymentMethodId && p.amount > 0)
        .map((p) => ({
          paymentMethodId: p.paymentMethodId!,
          amount: p.amount,
          amountReceived: p.amountReceived,
          methodKind: tenderToMethodKind(p.kind),
          reference: p.reference,
        }));
    }
    const kind = tenderToMethodKind(paymentKind);
    const id = methodsByKind[kind] ?? methodsByKind.cash;
    if (!id) return [];
    return [
      {
        paymentMethodId: id,
        amount: totals.grand,
        amountReceived: totals.grand,
        methodKind: kind,
      },
    ];
  }

  async function completeSale(overridePayments?: PosPaymentLine[]) {
    if (!branchId || !organizationId || lines.length === 0) return;
    const payments = buildPaymentsForPost(overridePayments);
    if (!customer.id && payments.length === 0) {
      push({
        title: "Payment required",
        description: "Walk-in sales need a recorded tender. Open Payment or seed payment methods.",
        tone: "danger",
      });
      setPaymentOpen(true);
      return;
    }
    if ((paymentKind === "credit" || paymentKind === "installment") && !customer.id) {
      push({ title: "Select a customer", description: "Credit and installment require a customer.", tone: "danger" });
      setCustomerMode("select");
      setCustomerOpen(true);
      return;
    }

    setBusy(true);
    try {
      const discounts =
        invoiceDiscount > 0
          ? [
              {
                scope: "invoice" as const,
                kind: (couponCode ? "coupon" : "fixed") as "coupon" | "fixed",
                amount: invoiceDiscount,
                percent: sale.invoiceDiscountPercent,
                approverRole: actingRole,
                reason: invoiceDiscountReason || "invoice discount",
              },
            ]
          : [];

      await posApi.postSale({
        branchId,
        warehouseId: branchId,
        customerId: customer.id ?? undefined,
        idempotencyKey: uuid(),
        notes: notes || undefined,
        couponCode: couponCode || undefined,
        discountTotal: invoiceDiscount,
        invoiceDiscountKind: couponCode ? "coupon" : "fixed",
        discounts,
        items: lines.map((l) => ({
          productId: l.productId,
          unitId: l.unitId,
          qty: l.qty,
          unitPrice: l.rate,
          discount: l.discount,
          discountPercent: l.discountPercent,
          tax: l.tax * l.qty,
        })),
        payments,
        createInstallment:
          paymentKind === "installment"
            ? {
                downPayment: installmentPlan.downPayment,
                installmentCount: installmentPlan.installmentCount,
                startDate: new Date().toISOString().slice(0, 10),
                frequency: "monthly" as const,
              }
            : undefined,
      });
      push({ title: "Sale completed", tone: "success" });
      newSale();
      setMobilePane("products");
    } catch (err) {
      push({
        title: "Checkout failed",
        description: err instanceof Error ? err.message : "Try again.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  const recordOnly =
    ["card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"].includes(paymentKind);

  const paymentRecorded = useMemo(() => {
    if (!paymentLines.length) return null;
    const prep = validatePosPayment({
      grandTotal: totals.grand,
      lines: paymentLines,
      paymentKind,
      walkIn: !customer.id,
      hasCustomer: Boolean(customer.id),
    });
    return {
      paid: prep.paidTowardBill,
      remaining: prep.remaining,
      change: prep.change,
      lineCount: paymentLines.filter((l) => l.amount > 0).length,
    };
  }, [paymentLines, paymentKind, totals.grand, customer.id]);

  function openItemDiscount(line: CartLine) {
    setDiscountLine(line);
    setDiscountScope("item");
    setDiscountSection("item");
    setDiscountOpen(true);
  }

  function openPriceEdit(line: CartLine) {
    if (!allowPriceOverride) {
      push({ title: "Not permitted", description: "Price override requires manager+ discount rights.", tone: "danger" });
      return;
    }
    setDiscountLine(line);
    setDiscountScope("item");
    setDiscountSection("override");
    setDiscountOpen(true);
  }

  return (
    <div className="pos-terminal-root flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5 sm:px-4">
        <Link to="/pos" className="pos-back-link">
          <i className="fa-solid fa-arrow-left text-[11px]" aria-hidden />
          Back to POS Command Center
        </Link>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="hidden sm:inline">{isQuick ? "Quick Sale" : "New Sale"}</span>
          {hasPermission("products.write") ? (
            <Link
              to={`/products/new?returnTo=${encodeURIComponent(location.pathname)}`}
              className="font-semibold text-slate-700 hover:underline"
            >
              + New Product
            </Link>
          ) : null}
          <Link to="/pos/sales/held" className="font-semibold text-[var(--pos-primary)] hover:underline">
            Held Sales
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 p-1 lg:hidden">
        {(
          [
            ["products", "Products"],
            ["cart", "Cart"],
            ["checkout", "Pay"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobilePane(id)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold ${
              mobilePane === id ? "bg-white text-[var(--pos-primary)] shadow-sm" : "text-slate-500"
            }`}
          >
            {label}
            {id === "cart" && lines.length ? ` (${lines.length})` : ""}
          </button>
        ))}
      </div>

      <div className="pos-terminal-grid min-h-0 flex-1 overflow-hidden">
        <div className={`min-h-0 min-w-0 ${mobilePane === "products" ? "flex" : "hidden"} lg:flex`}>
          <ProductDiscovery
            search={search}
            onSearch={setSearch}
            tab={tab}
            onTab={setTab}
            categoryFilter={categoryFilter}
            onCategory={setCategoryFilter}
            categories={categories}
            products={visibleProducts}
            favoriteIds={favoriteIds}
            onAdd={(p) => {
              addProduct(p);
              setMobilePane("cart");
            }}
            onToggleFavorite={toggleFavorite}
            onLoadMore={() => setLimit((l) => l + 24)}
            loading={loadingProducts}
            hasMore={products.length >= limit}
            searchRef={searchRef}
          />
        </div>

        <div className={`min-h-0 min-w-0 ${mobilePane === "cart" ? "flex" : "hidden"} lg:flex`}>
          <CartZone
            lines={lines}
            onQty={updateQty}
            onRemove={removeLine}
            onClear={clearCart}
            onEditDiscount={openItemDiscount}
            onEditPrice={openPriceEdit}
            canOverridePrice={allowPriceOverride}
            selectedLineId={selectedLineId}
            onSelectLine={setSelectedLineId}
          />
        </div>

        <div className={`min-h-0 min-w-0 ${mobilePane === "checkout" ? "flex" : "hidden"} lg:flex`}>
          <CheckoutZone
            customer={customer}
            totals={totals}
            paymentKind={paymentKind}
            onPaymentKind={setPaymentKind}
            couponCode={couponCode}
            notes={notes}
            onNotes={setNotes}
            onSelectCustomer={() => {
              setCustomerMode("select");
              setCustomerOpen(true);
            }}
            onWalkIn={() => setCustomer(emptyCustomer())}
            onNewCustomer={() => {
              setCustomerMode("create");
              setCustomerOpen(true);
            }}
            onDiscount={() => {
              setDiscountScope("invoice");
              setDiscountSection("invoice");
              setDiscountLine(null);
              setDiscountOpen(true);
            }}
            onHold={() => void onHold()}
            onSaveDraft={onSaveDraft}
            onPayment={() => setPaymentOpen(true)}
            onComplete={() => void completeSale()}
            busy={busy}
            recordOnlyHint={recordOnly}
            paymentRecorded={paymentRecorded}
          />
        </div>
      </div>

      <CustomerDialog
        open={customerOpen}
        mode={customerMode}
        onClose={() => setCustomerOpen(false)}
        onSelect={setCustomer}
      />

      <DiscountDialog
        open={discountOpen}
        scope={discountScope}
        section={discountSection}
        line={discountLine}
        invoiceBase={totals.subtotal}
        customer={customer}
        actingRole={actingRole}
        allowPriceOverride={allowPriceOverride}
        organizationId={organizationId}
        branchId={branchId}
        onClose={() => setDiscountOpen(false)}
        onApplyItem={(lineId, amount, percent) => {
          try {
            setLineDiscount(lineId, amount, percent, actingRole);
            push({ title: "Item discount applied", tone: "success" });
          } catch (err) {
            push({
              title: "Discount blocked",
              description: err instanceof Error ? err.message : "Not allowed",
              tone: "danger",
            });
          }
        }}
        onApplyInvoice={(input) => {
          try {
            applyInvoiceDiscount({
              ...input,
              actingRole,
              baseAmount: totals.subtotal,
            });
            push({ title: "Invoice discount applied", tone: "success" });
          } catch (err) {
            push({
              title: "Discount blocked",
              description: err instanceof Error ? err.message : "Not allowed",
              tone: "danger",
            });
          }
        }}
        onApplyPriceOverride={(lineId, rate) => {
          setLinePrice(lineId, rate);
          push({ title: "Price updated", tone: "success" });
        }}
      />

      <PaymentDrawer
        open={paymentOpen}
        grandTotal={totals.grand}
        paymentKind={paymentKind}
        methodsByKind={methodsByKind}
        hasCustomer={Boolean(customer.id)}
        walkIn={!customer.id}
        onClose={() => setPaymentOpen(false)}
        confirmLabel="Record payment"
        onConfirm={(linesPay, meta) => {
          setPaymentLines(linesPay);
          if (meta) {
            setInstallmentPlan({
              downPayment: meta.downPayment,
              installmentCount: meta.installmentCount,
            });
          }
          setPaymentOpen(false);
          push({
            title: "Payment recorded",
            description: "Cart preserved — tap Complete Sale when ready.",
            tone: "success",
          });
        }}
      />
    </div>
  );
}
