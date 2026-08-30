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
import type { InvoiceView, ProductSearchResult } from "@electronic-erp/contracts";
import type { DiscountSection } from "../pricing/discount-utils";
import { PaymentDrawer } from "../payments/PaymentDrawer";
import { validatePosPayment } from "../payments/payment-utils";
import { ProductDiscovery } from "./ProductDiscovery";
import { CartZone } from "./CartZone";
import { CheckoutZone } from "./CheckoutZone";
import { CustomerDialog } from "./CustomerDialog";
import { DiscountDialog } from "./DiscountDialog";
import { PostSaleDialog } from "./PostSaleDialog";
import { CheckoutStage } from "./CheckoutStage";
import "./terminal-layout.css";

type MobilePane = "products" | "cart" | "checkout";
type PosStage = "terminal" | "checkout";

export function PosTerminalPage() {
  const { branchId, organizationId, permissions, hasPermission } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const sale = usePosSale();
  const searchRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<PosStage>("terminal");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(30);
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
  const [cashReceived, setCashReceived] = useState<number | undefined>(undefined);

  // Post-sale completion state
  const [completedInvoice, setCompletedInvoice] = useState<InvoiceView | null>(null);
  const [postSaleOpen, setPostSaleOpen] = useState(false);
  const [lastPaid, setLastPaid] = useState<number>(0);
  const [lastChange, setLastChange] = useState<number>(0);

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
    const id = window.setTimeout(() => void loadProducts(), 250);
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
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (detail === "discount") {
        const line = lines.find((l) => l.id === selectedLineId) ?? null;
        if (line) {
          openItemDiscount(line);
        } else {
          setDiscountScope("invoice");
          setDiscountLine(null);
          setDiscountOpen(true);
        }
      }
      if (detail === "price-override") {
        const line = lines.find((l) => l.id === selectedLineId) ?? lines[0] ?? null;
        if (line) {
          openPriceEdit(line);
        }
      }
      if (detail === "hold") void onHold();
      if (detail === "pay") {
        if (stage === "terminal" && lines.length > 0) {
          setStage("checkout");
        } else {
          void completeSale();
        }
      }
      if (detail === "customers") {
        setCustomerMode("select");
        setCustomerOpen(true);
      }
    }
    window.addEventListener("pos:shortcut", onShortcut);
    return () => window.removeEventListener("pos:shortcut", onShortcut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSale, clearCart, lines, totals, customer, paymentKind, stage]);

  useEffect(() => {
    if (stage !== "checkout") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !customerOpen && !discountOpen && !paymentOpen && !postSaleOpen) {
        e.preventDefault();
        setStage("terminal");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stage, customerOpen, discountOpen, paymentOpen, postSaleOpen]);

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
    if (override !== undefined) {
      return override
        .filter((p) => p.paymentMethodId && p.amount > 0)
        .map((p) => ({
          paymentMethodId: p.paymentMethodId!,
          amount: p.amount,
          amountReceived: p.amountReceived,
          methodKind: tenderToMethodKind(p.kind),
          reference: p.reference,
        }));
    }
    if (paymentKind === "credit") return [];
    if (paymentKind === "installment") {
      const down = Number(installmentPlan.downPayment) || 0;
      if (down > 0) {
        const kind = tenderToMethodKind("cash");
        const id = methodsByKind[kind] ?? methodsByKind.cash;
        if (id) {
          return [
            {
              paymentMethodId: id,
              amount: down,
              amountReceived: down,
              methodKind: kind,
              reference: "Installment Down Payment",
            },
          ];
        }
      }
      return [];
    }
    if (paymentLines.length) {
      return paymentLines
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
        amountReceived: paymentKind === "cash" && cashReceived != null ? cashReceived : totals.grand,
        methodKind: kind,
      },
    ];
  }

  async function completeSale(overridePayments?: PosPaymentLine[]) {
    if (busy || !branchId || !organizationId || lines.length === 0) return;
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
    if ((paymentKind === "credit" || paymentKind === "installment" || paymentKind === "partial") && !customer.id) {
      push({ title: "Select a customer", description: "Credit, installment, and partial sales require an attached customer.", tone: "danger" });
      setCustomerMode("select");
      setCustomerOpen(true);
      return;
    }

    const currentTenderReceived =
      overridePayments && overridePayments.length > 0
        ? overridePayments.reduce((acc, p) => acc + (p.amountReceived ?? p.amount), 0)
        : paymentKind === "credit"
          ? 0
          : paymentKind === "cash" && cashReceived != null
            ? cashReceived
            : totals.grand;
    const currentChange = Math.max(0, currentTenderReceived - totals.grand);

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

      const postRes = (await posApi.postSale({
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
      })) as { id?: string; invoiceNumber?: string } | undefined;

      const invoiceNum = postRes?.invoiceNumber ?? `INV-${Date.now().toString().slice(-6)}`;

      // Build authoritative invoice object
      let invView: InvoiceView;
      if (postRes?.id) {
        try {
          invView = await posApi.getInvoice(postRes.id);
        } catch {
          invView = {
            invoiceNumber: invoiceNum,
            customerName: customer.label,
            customerMobile: customer.mobile ?? null,
            customerEmail: customer.email ?? null,
            branchName: "Main Branch",
            dateTime: new Date().toISOString(),
            sale: {
              id: postRes.id,
              organizationId: organizationId ?? uuid(),
              branchId: branchId ?? uuid(),
              warehouseId: branchId ?? uuid(),
              invoiceNumber: invoiceNum,
              subtotal: totals.subtotal,
              discountTotal: totals.totalDiscount,
              taxTotal: totals.tax,
              grandTotal: totals.grand,
              paidTotal: currentTenderReceived,
              remainingTotal: Math.max(0, totals.grand - currentTenderReceived),
              posMode: "easy",
              localeMode: "en",
              status: "posted",
              paymentStatus: paymentKind === "credit" ? "unpaid" : "paid",
              idempotencyKey: uuid(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1,
            },
            items: lines.map((l) => ({
              name: l.name,
              unit: l.unitLabel,
              qty: l.qty,
              rate: l.rate,
              discount: l.discount,
              tax: l.tax * l.qty,
              total: (l.rate * l.qty) - l.discount,
            })),
            payments: payments.map((p) => ({
              method: p.methodKind,
              amount: p.amount,
              reference: "reference" in p ? (p.reference ?? null) : null,
            })),
          };
        }
      } else {
        invView = {
          invoiceNumber: invoiceNum,
          customerName: customer.label,
          customerMobile: customer.mobile ?? null,
          customerEmail: customer.email ?? null,
          branchName: "Main Branch",
          dateTime: new Date().toISOString(),
          sale: {
            id: uuid(),
            organizationId: organizationId ?? uuid(),
            branchId: branchId ?? uuid(),
            warehouseId: branchId ?? uuid(),
            invoiceNumber: invoiceNum,
            subtotal: totals.subtotal,
            discountTotal: totals.totalDiscount,
            taxTotal: totals.tax,
            grandTotal: totals.grand,
            paidTotal: currentTenderReceived,
            remainingTotal: Math.max(0, totals.grand - currentTenderReceived),
            posMode: "easy",
            localeMode: "en",
            status: "posted",
            paymentStatus: paymentKind === "credit" ? "unpaid" : "paid",
            idempotencyKey: uuid(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
          items: lines.map((l) => ({
            name: l.name,
            unit: l.unitLabel,
            qty: l.qty,
            rate: l.rate,
            discount: l.discount,
            tax: l.tax * l.qty,
            total: (l.rate * l.qty) - l.discount,
          })),
          payments: payments.map((p) => ({
            method: p.methodKind,
            amount: p.amount,
            reference: "reference" in p ? (p.reference ?? null) : null,
          })),
        };
      }

      setCompletedInvoice(invView);
      setLastPaid(currentTenderReceived);
      setLastChange(currentChange);
      setPostSaleOpen(true);

      // Reset cart, stage, and tender
      newSale();
      setStage("terminal");
      setCashReceived(undefined);
      setMobilePane("products");
      push({ title: `Sale Completed #${invoiceNum}`, tone: "success" });
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
    <div className="pos-terminal-root flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {stage === "checkout" ? (
        <CheckoutStage
          lines={lines}
          customer={customer}
          totals={totals}
          paymentKind={paymentKind}
          onPaymentKind={setPaymentKind}
          cashReceived={cashReceived}
          onCashReceived={setCashReceived}
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
          onBackToCart={() => setStage("terminal")}
          onComplete={(overridePayments) => void completeSale(overridePayments)}
          methodsByKind={methodsByKind}
          busy={busy}
        />
      ) : (
        <>
          {/* Sub-Header bar inside POS */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5 sm:px-4">
            <Link to="/pos" className="pos-back-link">
              <i className="fa-solid fa-arrow-left text-[11px]" aria-hidden />
              Back to POS Command Center
            </Link>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-bold text-slate-800">{isQuick ? "Quick Counter" : "Sale Register"}</span>
              {hasPermission("products.write") ? (
                <Link
                  to={`/products/new?returnTo=${encodeURIComponent(location.pathname)}`}
                  className="font-bold text-blue-600 hover:underline"
                >
                  + New Product
                </Link>
              ) : null}
              <Link to="/pos/sales/held" className="font-bold text-amber-700 hover:underline">
                Held Sales
              </Link>
            </div>
          </div>

          {/* Mobile Tab Switcher */}
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
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  mobilePane === id ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {label}
                {id === "cart" && lines.length ? ` (${lines.length})` : ""}
              </button>
            ))}
          </div>

          {/* Main 3-Zone Desktop Grid */}
          <div className="pos-terminal-grid min-h-0 flex-1 overflow-hidden">
            {/* Zone 1: Product Discovery */}
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
                  push({
                    title: `${p.name} added to cart`,
                    tone: "info",
                  });
                }}
                onToggleFavorite={toggleFavorite}
                onLoadMore={() => setLimit((l) => l + 30)}
                loading={loadingProducts}
                hasMore={products.length >= limit}
                searchRef={searchRef}
              />
            </div>

            {/* Zone 2: Cart Ledger */}
            <div className={`min-h-0 min-w-0 ${mobilePane === "cart" ? "flex" : "hidden"} lg:flex`}>
              <CartZone
                lines={lines}
                customer={customer}
                totals={totals}
                onQty={updateQty}
                onRemove={removeLine}
                onClear={clearCart}
                onEditDiscount={openItemDiscount}
                onEditPrice={openPriceEdit}
                onSelectCustomer={() => {
                  setCustomerMode("select");
                  setCustomerOpen(true);
                }}
                onInvoiceDiscount={() => {
                  setDiscountScope("invoice");
                  setDiscountSection("invoice");
                  setDiscountLine(null);
                  setDiscountOpen(true);
                }}
                onHold={() => void onHold()}
                onQuickCashPay={() => void completeSale()}
                canOverridePrice={allowPriceOverride}
                selectedLineId={selectedLineId}
                onSelectLine={setSelectedLineId}
                onProceedToCheckout={() => setStage("checkout")}
                busy={busy}
              />
            </div>

            {/* Zone 3: Checkout & Pay */}
            <div className={`min-h-0 min-w-0 ${mobilePane === "checkout" ? "flex" : "hidden"} lg:flex`}>
              <CheckoutZone
                customer={customer}
                totals={totals}
                paymentKind={paymentKind}
                onPaymentKind={setPaymentKind}
                cashReceived={cashReceived}
                onCashReceived={setCashReceived}
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
                onProceedToCheckout={() => setStage("checkout")}
                busy={busy}
                recordOnlyHint={recordOnly}
                paymentRecorded={paymentRecorded}
              />
            </div>
          </div>
        </>
      )}

      {/* Customer Dialog Modal */}
      <CustomerDialog
        open={customerOpen}
        mode={customerMode}
        onClose={() => setCustomerOpen(false)}
        onSelect={setCustomer}
      />

      {/* Discount Dialog Modal */}
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

      {/* Payment Drawer Modal */}
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

      {/* Post-Sale Completion & Instant Thermal Receipt Modal */}
      <PostSaleDialog
        open={postSaleOpen}
        invoice={completedInvoice}
        paidAmount={lastPaid}
        changeAmount={lastChange}
        customerMobile={customer.mobile}
        customerEmail={customer.email}
        paymentMethod={paymentKind}
        onClose={() => setPostSaleOpen(false)}
        onNewSale={() => {
          setPostSaleOpen(false);
          setStage("terminal");
          searchRef.current?.focus();
        }}
      />
    </div>
  );
}
