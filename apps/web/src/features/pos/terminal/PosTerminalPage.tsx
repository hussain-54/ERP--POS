import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { inventoryApi } from "@/features/inventory/inventory-api";
import { enrichCustomerForPos } from "../customers/customer-utils";
import { CATALOG_CHANGED_EVENT } from "@/features/product-management/catalog-api";
import { posApi } from "../api";
import { uuid } from "../format";
import { usePosSale } from "../hooks/usePosSale";
import type { PosCustomerView } from "../types";
import type { InvoiceView, ProductSearchResult } from "@electronic-erp/contracts";
import type { DiscountSection } from "../pricing/discount-utils";
import { PaymentDrawer } from "../payments/PaymentDrawer";
import { ProductDiscovery } from "./ProductDiscovery";
import { CartZone } from "./CartZone";
import { CheckoutZone } from "./CheckoutZone";
import { CustomerDialog } from "./CustomerDialog";
import { DiscountDialog } from "./DiscountDialog";
import { PostSaleDialog } from "./PostSaleDialog";
import { HoldSaleDialog } from "../sales/HoldSaleDialog";
import { ResumeSaleDialog } from "../sales/ResumeSaleDialog";
import { CameraScannerDialog } from "../hardware/CameraScannerDialog";
import { UnknownBarcodeDialog } from "../hardware/UnknownBarcodeDialog";
import {
  broadcastCartToCustomerDisplay,
  broadcastSalePaymentToCustomerDisplay,
  triggerCashDrawerKick,
} from "../hardware/hardware-broadcast";
import { deviceHardware } from "@/features/devices/hardware-service";
import "./terminal-layout.css";
import {
  customerPriceLevel,
  mapCartLineToSaleItem,
  validateSaleBeforeComplete,
} from "./sale-complete-utils";

type MobilePane = "products" | "cart" | "checkout";
type PosStage = "terminal" | "checkout";

interface CompletedSaleMeta {
  customerName: string;
  customerMobile: string | null;
  customerEmail: string | null;
  paymentMethod: string;
}

export function PosTerminalPage() {
  const { branchId, organizationId, permissions, hasPermission, user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const sale = usePosSale();
  const searchRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string>(uuid());

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
  const [warehouseId, setWarehouseId] = useState<string | null>(null);

  // Post-sale completion state
  const [completedInvoice, setCompletedInvoice] = useState<InvoiceView | null>(null);
  const [postSaleOpen, setPostSaleOpen] = useState(false);
  const [lastPaid, setLastPaid] = useState<number>(0);
  const [lastChange, setLastChange] = useState<number>(0);
  const [completedSaleMeta, setCompletedSaleMeta] = useState<CompletedSaleMeta | null>(null);

  // Hardware scanner states
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [unknownBarcodeOpen, setUnknownBarcodeOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState("");

  // Hold & Resume states
  const [holdOpen, setHoldOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  const actingRole = actingDiscountRole(permissions);
  const allowPriceOverride = canOverridePrice(permissions);

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
    addCustomLine,
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
    deliveryCharges,
    setDeliveryCharges,
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
    defaultUnitId,
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!branchId) {
        setWarehouseId(null);
        return;
      }
      try {
        const res = await inventoryApi.listWarehouses();
        if (cancelled) return;
        const items = res.items ?? [];
        const match =
          items.find((w) => w.is_default === true || w.isDefault === true) ||
          items.find((w) => String(w.branch_id ?? w.branchId ?? "") === branchId) ||
          items[0];
        setWarehouseId(match?.id ? String(match.id) : branchId);
      } catch {
        if (!cancelled) setWarehouseId(branchId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const resolvedWarehouseId = warehouseId ?? branchId;

  const loadProducts = useCallback(async () => {
    if (!resolvedWarehouseId) return;
    setLoadingProducts(true);
    try {
      const q = search.trim() || " ";
      const res = await posApi.searchProducts({
        q,
        limit,
        warehouseId: resolvedWarehouseId,
        customerId: customer.id ?? undefined,
      });
      setProducts(res.items);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [resolvedWarehouseId, search, limit, customer.id, setProducts]);

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
      const cid =
        typeof state.resumeSnapshot.customerId === "string" ? state.resumeSnapshot.customerId : null;
      if (cid) void enrichRestoredCustomer(cid);
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

  // Real-time broadcast to Customer Counter / Pole Display
  useEffect(() => {
    broadcastCartToCustomerDisplay(lines, customer, totals);
  }, [lines, customer, totals]);

  // Handle scanned Barcode / SKU / QR Code
  const handleScanCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();

      const localMatch = products.find(
        (p) =>
          p.barcode?.toLowerCase() === lower ||
          p.sku?.toLowerCase() === lower ||
          p.name.toLowerCase() === lower,
      );

      if (localMatch) {
        addProduct(localMatch);
        push({ title: `Scanned: ${localMatch.name}`, tone: "success" });
        setSearch("");
        searchRef.current?.focus();
        return;
      }

      if (resolvedWarehouseId) {
        try {
          const res = await posApi.searchProducts({
            q: trimmed,
            limit: 5,
            warehouseId: resolvedWarehouseId,
            customerId: customer.id ?? undefined,
          });
          const serverMatch =
            res.items.find(
              (p) =>
                p.barcode?.toLowerCase() === lower ||
                p.sku?.toLowerCase() === lower,
            ) ?? res.items[0];

          if (serverMatch) {
            addProduct(serverMatch);
            push({ title: `Scanned: ${serverMatch.name}`, tone: "success" });
            setSearch("");
            searchRef.current?.focus();
            return;
          }
        } catch {
          // Fall through to unknown barcode dialog
        }
      }

      setUnknownBarcode(trimmed);
      setUnknownBarcodeOpen(true);
    },
    [products, addProduct, push, resolvedWarehouseId, customer.id, setSearch],
  );

  // Subscribe to hardware keyboard wedge barcode scanner
  useEffect(() => {
    const unsub = deviceHardware.subscribeScanner((evt) => {
      if (evt?.code) {
        handleScanCode(evt.code);
      }
    });
    return () => unsub();
  }, [handleScanCode]);

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
      if (detail === "clear-cart") {
        if (
          postSaleOpen ||
          customerOpen ||
          discountOpen ||
          paymentOpen ||
          holdOpen ||
          resumeOpen ||
          cameraScannerOpen ||
          unknownBarcodeOpen
        ) {
          return;
        }
        clearCart();
      }
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
      if (detail === "resume-held") setResumeOpen(true);
      if (detail === "pay") {
        if (lines.length === 0) return;
        setMobilePane("checkout");
        void completeSale(undefined, { cashReceived });
        return;
      }
      if (detail === "delivery") {
        const current = deliveryCharges > 0 ? String(deliveryCharges) : "";
        const raw = window.prompt("Delivery charges (Rs). Enter 0 to clear delivery order.", current || "0");
        if (raw == null) return;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          push({ title: "Invalid delivery charge", tone: "danger" });
          return;
        }
        setDeliveryCharges(n);
        push({
          title: n > 0 ? `Delivery charges: Rs. ${n.toFixed(2)}` : "Delivery charges cleared",
          tone: "info",
        });
      }
      if (detail === "customers") {
        setCustomerMode("select");
        setCustomerOpen(true);
      }
    }
    window.addEventListener("pos:shortcut", onShortcut);
    return () => window.removeEventListener("pos:shortcut", onShortcut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    newSale,
    clearCart,
    lines,
    totals,
    customer,
    paymentKind,
    postSaleOpen,
    customerOpen,
    discountOpen,
    paymentOpen,
    holdOpen,
    resumeOpen,
    cameraScannerOpen,
    unknownBarcodeOpen,
  ]);

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

  useEffect(() => {
    function onOpenResume() {
      setResumeOpen(true);
    }
    window.addEventListener("pos:open-resume-dialog", onOpenResume);
    return () => window.removeEventListener("pos:open-resume-dialog", onOpenResume);
  }, []);

  async function enrichRestoredCustomer(customerId: string) {
    try {
      const c = await partiesApi.getCustomer(customerId);
      setCustomer(await enrichCustomerForPos(c));
    } catch {
      /* keep partial customer from snapshot */
    }
  }

  function onHold() {
    if (lines.length === 0) {
      push({ title: "Cart is empty", description: "Add items before holding a sale.", tone: "info" });
      return;
    }
    setHoldOpen(true);
  }

  async function handleConfirmHold(data: { customerName?: string; reference: string; notes: string }) {
    if (!branchId || !organizationId || lines.length === 0) return;
    setBusy(true);
    try {
      const combinedNotes = [data.reference, data.notes].filter(Boolean).join(" · ") || notes || undefined;
      await posApi.holdSale({
        organizationId,
        branchId,
        warehouseId: resolvedWarehouseId ?? branchId,
        customerId: customer.id,
        notes: combinedNotes,
        holdLabel: data.customerName || customer.label || "Held Sale",
        cartSnapshot: buildSnapshot(),
      });
      push({
        title: "Sale held successfully",
        description: "Transaction parked. Open Held Sales to resume at any time.",
        tone: "success",
      });
      newSale();
      setStage("terminal");
      window.dispatchEvent(new Event("pos:refresh-holds"));
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

  function handleResumeHeld(snapshot: Record<string, unknown>) {
    restoreFromHold(snapshot);
    const customerId =
      typeof snapshot.customerId === "string"
        ? snapshot.customerId
        : typeof (snapshot as { customer?: { id?: string } }).customer?.id === "string"
          ? (snapshot as { customer: { id: string } }).customer.id
          : null;
    if (customerId) void enrichRestoredCustomer(customerId);
    setResumeOpen(false);
    setStage("terminal");
    window.dispatchEvent(new Event("pos:refresh-holds"));
    push({ title: "Sale resumed into cart", tone: "success" });
  }

  function buildPaymentsForPost(override?: PosPaymentLine[], cashTender?: number) {
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
    const tender = cashTender ?? cashReceived;
    return [
      {
        paymentMethodId: id,
        amount: totals.grand,
        amountReceived: paymentKind === "cash" && tender != null ? tender : totals.grand,
        methodKind: kind,
      },
    ];
  }

  async function completeSale(
    overridePayments?: PosPaymentLine[],
    options?: {
      installment?: { downPayment: string; installmentCount: number };
      /** Explicit cash tender (Quick Cash / Exact) — avoids stale React state. */
      cashReceived?: number;
    },
  ) {
    if (busy || !branchId || !organizationId || lines.length === 0) return;
    // Cashier-friendly: COMPLETE SALE with no cash entry implies Exact amount.
    const effectiveCashReceived =
      options?.cashReceived ??
      cashReceived ??
      (paymentKind === "cash" && !overridePayments?.length ? totals.grand : undefined);
    if (effectiveCashReceived != null && paymentKind === "cash") {
      setCashReceived(effectiveCashReceived);
    }
    const payments = buildPaymentsForPost(overridePayments, effectiveCashReceived);
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

    const preCheck = validateSaleBeforeComplete({
      lines,
      customer,
      paymentKind,
      cashReceived: effectiveCashReceived,
      grandTotal: totals.grand,
      overridePayments,
      defaultUnitId,
    });
    if (!preCheck.ok) {
      push({ title: preCheck.title, description: preCheck.description, tone: "danger" });
      if (preCheck.title.includes("cash")) setMobilePane("checkout");
      return;
    }

    const currentTenderReceived =
      overridePayments && overridePayments.length > 0
        ? overridePayments.reduce((acc, p) => acc + (p.amountReceived ?? p.amount), 0)
        : paymentKind === "credit"
          ? 0
          : paymentKind === "cash" && effectiveCashReceived != null
            ? effectiveCashReceived
            : totals.grand;
    const currentChange = Math.max(0, currentTenderReceived - totals.grand);

    setBusy(true);
    const saleIdempotencyKey = idempotencyKeyRef.current;
    const installmentMeta = options?.installment ?? installmentPlan;

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
        warehouseId: resolvedWarehouseId ?? branchId,
        customerId: customer.id ?? undefined,
        idempotencyKey: saleIdempotencyKey,
        notes: notes || undefined,
        couponCode: couponCode || undefined,
        discountTotal: invoiceDiscount,
        invoiceDiscountKind: couponCode ? "coupon" : "fixed",
        discounts,
        items: lines.map((l) => mapCartLineToSaleItem(l, defaultUnitId)),
        payments,
        priceLevel: customerPriceLevel(customer.priceTier),
        createInstallment:
          paymentKind === "installment"
            ? {
                downPayment: installmentMeta.downPayment,
                installmentCount: installmentMeta.installmentCount,
                startDate: new Date().toISOString().slice(0, 10),
                frequency: "monthly" as const,
              }
            : undefined,
      })) as { id?: string; invoiceNumber?: string } | undefined;

      const invoiceNum = postRes?.invoiceNumber ?? `INV-${Date.now().toString().slice(-6)}`;
      const cashierName = user?.fullName ?? "Counter Cashier";
      const terminalId = "POS-01";
      const remaining = Math.max(0, totals.grand - currentTenderReceived);
      const paymentStatus =
        remaining <= 0.009 ? ("paid" as const) : currentTenderReceived > 0.009 ? ("partial" as const) : ("unpaid" as const);
      const invoiceItems = lines.map((l) => ({
        name: l.name,
        sku: l.sku || null,
        unit: l.unitLabel,
        qty: l.qty,
        listPrice: l.listPrice,
        rate: l.rate,
        discount: l.discount,
        tax: l.tax * l.qty,
        total: l.rate * l.qty - l.discount,
      }));
      const invoicePayments = payments.map((p) => ({
        method: p.methodKind,
        amount: p.amount,
        reference: "reference" in p ? (p.reference ?? null) : null,
      }));

      function buildLocalInvoice(saleId: string): InvoiceView {
        return {
          invoiceNumber: invoiceNum,
          customerName: customer.label,
          customerMobile: customer.mobile ?? null,
          customerEmail: customer.email ?? null,
          branchName: "Main Branch",
          terminalId,
          cashierName,
          dateTime: new Date().toISOString(),
          paidAmount: currentTenderReceived,
          remainingAmount: Math.max(0, totals.grand - currentTenderReceived),
          sale: {
            id: saleId,
            organizationId: organizationId ?? uuid(),
            branchId: branchId ?? uuid(),
            warehouseId: resolvedWarehouseId ?? branchId ?? uuid(),
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
            paymentStatus,
            idempotencyKey: saleIdempotencyKey,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
          items: invoiceItems,
          payments: invoicePayments,
        };
      }

      // Build authoritative invoice object (after confirmed post only)
      let invView: InvoiceView;
      if (postRes?.id) {
        try {
          const serverInv = await posApi.getInvoice(postRes.id);
          invView = {
            ...serverInv,
            customerName: serverInv.customerName ?? customer.label,
            customerMobile: serverInv.customerMobile ?? customer.mobile ?? null,
            customerEmail: serverInv.customerEmail ?? customer.email ?? null,
            cashierName: serverInv.cashierName ?? cashierName,
            terminalId: serverInv.terminalId ?? terminalId,
            branchName: serverInv.branchName ?? "Main Branch",
            paidAmount: serverInv.paidAmount ?? currentTenderReceived,
            remainingAmount:
              serverInv.remainingAmount ?? Math.max(0, totals.grand - currentTenderReceived),
            items:
              serverInv.items?.length > 0
                ? serverInv.items.map((item, idx) => ({
                    ...item,
                    sku: item.sku ?? invoiceItems[idx]?.sku ?? null,
                    listPrice: item.listPrice ?? invoiceItems[idx]?.listPrice,
                  }))
                : invoiceItems,
            payments: serverInv.payments?.length ? serverInv.payments : invoicePayments,
            sale: serverInv.sale
              ? {
                  ...serverInv.sale,
                  paymentStatus: serverInv.sale.paymentStatus ?? paymentStatus,
                  paidTotal: serverInv.sale.paidTotal ?? currentTenderReceived,
                }
              : buildLocalInvoice(postRes.id).sale,
          };
        } catch {
          push({
            title: "Receipt loaded from sale totals",
            description: "Server invoice fetch failed — verify amounts before sharing or printing.",
            tone: "info",
          });
          invView = buildLocalInvoice(postRes.id);
        }
      } else {
        invView = buildLocalInvoice(uuid());
      }

      setCompletedSaleMeta({
        customerName: customer.label,
        customerMobile: customer.mobile ?? invView.customerMobile ?? null,
        customerEmail: customer.email ?? invView.customerEmail ?? null,
        paymentMethod: paymentKind,
      });
      setCompletedInvoice(invView);
      setLastPaid(currentTenderReceived);
      setLastChange(currentChange);
      setPostSaleOpen(true);
      idempotencyKeyRef.current = uuid();

      // Trigger cash drawer kick on cash payments
      const hasCashTender = paymentKind === "cash" || paymentKind === "split" || paymentKind === "partial";
      if (hasCashTender) {
        void triggerCashDrawerKick(`Sale #${invoiceNum}`, organizationId ?? undefined);
      }

      // Broadcast completed sale & change to Customer Pole Display
      broadcastSalePaymentToCustomerDisplay(
        totals.grand,
        currentTenderReceived,
        currentChange,
        paymentKind,
        "Electronic & Electrical Store",
      );

      // Reset cart, stage, and tender
      newSale();
      setStage("terminal");
      setCashReceived(undefined);
      setMobilePane("products");
      push({ title: `Payment successful · Sale #${invoiceNum}`, tone: "success" });
    } catch (err) {
      push({
        title: "Payment could not be completed",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

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
      {/* Mobile Tab Switcher */}
      <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 p-1 lg:hidden">
        {(
          [
            ["products", "Products"],
            ["cart", lines.length ? `Cart (${lines.length})` : "Current Sale"],
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
          </button>
        ))}
      </div>

      {/* Main 3-Zone Desktop Grid: Left (Catalog) | Center (Cart) | Right (Customer + Summary + Pay) */}
      <div className="pos-terminal-grid-3col min-h-0 flex-1 overflow-hidden">
        {/* Zone 1: Product Discovery (Left) */}
        <div
          className={`pos-zone-cell min-h-0 min-w-0 overflow-hidden ${mobilePane === "products" ? "flex" : "hidden"} lg:flex`}
        >
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
            onOpenScanner={() => setCameraScannerOpen(true)}
            onUnknownBarcode={(code) => {
              setUnknownBarcode(code);
              setUnknownBarcodeOpen(true);
            }}
            onManualEntry={() => {
              setUnknownBarcode("");
              setUnknownBarcodeOpen(true);
            }}
            onCheckout={() => {
              if (lines.length === 0) {
                push({ title: "Cart is empty", description: "Add products before checkout.", tone: "info" });
                return;
              }
              setMobilePane("checkout");
            }}
            checkoutDisabled={lines.length === 0 || busy}
            cartItemCount={lines.length}
            cartGrandTotal={totals.grand}
          />
        </div>

        {/* Zone 2: Cart Ledger (Center) */}
        <div
          className={`pos-zone-cell min-h-0 min-w-0 overflow-hidden ${mobilePane === "cart" ? "flex" : "hidden"} lg:flex`}
        >
          <CartZone
            lines={lines}
            customer={customer}
            onQty={updateQty}
            onRemove={removeLine}
            onClear={clearCart}
            onEditDiscount={openItemDiscount}
            onEditPrice={openPriceEdit}
            onSelectCustomer={() => {
              setCustomerMode("select");
              setCustomerOpen(true);
            }}
            onNewCustomer={() => {
              setCustomerMode("create");
              setCustomerOpen(true);
            }}
            onInvoiceDiscount={() => {
              setDiscountScope("invoice");
              setDiscountSection("invoice");
              setDiscountLine(null);
              setDiscountOpen(true);
            }}
            onHold={() => void onHold()}
            onAddProduct={() => {
              setMobilePane("products");
              window.dispatchEvent(new Event("pos:focus-search"));
            }}
            onPriceCheck={() => {
              const selected = selectedLineId ? lines.find((l) => l.id === selectedLineId) : null;
              if (selected && allowPriceOverride) {
                openPriceEdit(selected);
                return;
              }
              setMobilePane("products");
              window.dispatchEvent(new Event("pos:focus-search"));
              push({
                title: "Select a cart line to edit price, or search a product",
                tone: "info",
              });
            }}
            onAddNote={() => {
              setMobilePane("checkout");
              window.setTimeout(() => {
                document.getElementById("pos-sale-note")?.focus();
              }, 50);
            }}
            onMore={() => setPaymentOpen(true)}
            canOverridePrice={allowPriceOverride}
            selectedLineId={selectedLineId}
            onSelectLine={setSelectedLineId}
            onProceedToCheckout={() => setMobilePane("checkout")}
            busy={busy}
          />
        </div>

        {/* Zone 3: Customer + Order Summary + Checkout CTA (Right) */}
        <div
          className={`pos-zone-cell min-h-0 min-w-0 overflow-hidden ${mobilePane === "checkout" ? "flex" : "hidden"} lg:flex`}
        >
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
            onPayment={() => setPaymentOpen(true)}
            onSplitPayment={() => {
              setPaymentKind("split");
              setPaymentOpen(true);
            }}
            onInstallment={() => {
              setPaymentKind("installment");
              setPaymentOpen(true);
            }}
            onComplete={() => void completeSale(undefined, { cashReceived })}
            onDeliveryOrder={() => {
              const current = deliveryCharges > 0 ? String(deliveryCharges) : "";
              const raw = window.prompt(
                "Delivery charges (Rs). Enter 0 to clear delivery order.",
                current || "0",
              );
              if (raw == null) return;
              const n = Number(raw);
              if (!Number.isFinite(n) || n < 0) {
                push({ title: "Invalid delivery charge", tone: "danger" });
                return;
              }
              setDeliveryCharges(n);
              if (n > 0 && !notes.toLowerCase().includes("delivery")) {
                setNotes(notes ? `${notes} | Delivery order` : "Delivery order");
              }
              if (n === 0 && notes.toLowerCase().includes("delivery order")) {
                setNotes(notes.replace(/\s*\|\s*Delivery order/i, "").replace(/^Delivery order\s*\|\s*/i, "").trim());
              }
              push({
                title: n > 0 ? `Delivery charges: Rs. ${n.toFixed(2)}` : "Delivery charges cleared",
                tone: "info",
              });
            }}
            onClearCart={clearCart}
            deliveryCharges={deliveryCharges}
            busy={busy}
            recordOnlyHint={
              paymentKind === "card" ||
              paymentKind === "bank" ||
              paymentKind === "qr" ||
              paymentKind === "jazzcash" ||
              paymentKind === "easypaisa" ||
              paymentKind === "sadapay" ||
              paymentKind === "wallet"
            }
          />
        </div>
      </div>

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
        notes={notes}
        onNotes={setNotes}
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
        confirmLabel="PAY & COMPLETE SALE"
        onConfirm={(linesPay, meta) => {
          setPaymentLines(linesPay);
          if (meta) {
            setInstallmentPlan({
              downPayment: meta.downPayment,
              installmentCount: meta.installmentCount,
            });
          }
          setPaymentOpen(false);
          void completeSale(linesPay, meta ? { installment: meta } : undefined);
        }}
      />

      {/* Post-Sale Completion & Instant Thermal Receipt Modal */}
      <PostSaleDialog
        open={postSaleOpen}
        invoice={completedInvoice}
        paidAmount={lastPaid}
        changeAmount={lastChange}
        customerMobile={completedSaleMeta?.customerMobile ?? completedInvoice?.customerMobile}
        customerEmail={completedSaleMeta?.customerEmail ?? completedInvoice?.customerEmail}
        customerName={completedSaleMeta?.customerName}
        paymentMethod={completedSaleMeta?.paymentMethod ?? paymentKind}
        onClose={() => {
          setPostSaleOpen(false);
        }}
        onNewSale={() => {
          newSale();
          setPostSaleOpen(false);
          setCompletedSaleMeta(null);
          setCompletedInvoice(null);
          setStage("terminal");
          searchRef.current?.focus();
        }}
        onViewSale={
          completedInvoice?.sale?.id
            ? () => {
                setPostSaleOpen(false);
                navigate(`/pos/sales/completed?saleId=${completedInvoice.sale!.id}`);
              }
            : undefined
        }
      />

      {/* Camera & QR Scanner Modal */}
      <CameraScannerDialog
        open={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScan={handleScanCode}
      />

      {/* Unknown Barcode Modal */}
      <UnknownBarcodeDialog
        open={unknownBarcodeOpen}
        barcode={unknownBarcode}
        hasCreatePermission={hasPermission("products.write") || hasPermission("products.create")}
        onClose={() => setUnknownBarcodeOpen(false)}
        onSearchProduct={(code) => {
          setSearch(code);
          setTab("all");
          searchRef.current?.focus();
        }}
        onManualEntry={(manualItem) => {
          addCustomLine(manualItem);
          push({ title: `Added manual item: ${manualItem.name}`, tone: "success" });
        }}
        onCreateProduct={(code) => {
          navigate(
            `/products/new?sku=${encodeURIComponent(code)}&barcode=${encodeURIComponent(code)}&returnTo=${encodeURIComponent(location.pathname)}`,
          );
        }}
      />

      {/* Hold Current Sale Modal */}
      <HoldSaleDialog
        open={holdOpen}
        itemCount={lines.length}
        grandTotal={totals.grand}
        customer={customer}
        initialNotes={notes}
        onClose={() => setHoldOpen(false)}
        onConfirmHold={handleConfirmHold}
      />

      {/* Resume Held Sale Modal */}
      <ResumeSaleDialog
        open={resumeOpen}
        branchId={branchId}
        onClose={() => setResumeOpen(false)}
        onResume={handleResumeHeld}
      />
    </div>
  );
}
