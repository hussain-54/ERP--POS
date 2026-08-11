import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { validatePosCheckout } from "@electronic-erp/domain";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
import { partiesApi } from "@/features/parties/parties-api";
import { inventoryApi } from "@/features/inventory/inventory-api";
import { enterpriseApi } from "@/features/enterprise/enterprise-api";
import { purchasesApi } from "@/features/purchases/purchases-api";
import { mapSalesmanEmployees, type SalesmanOption } from "./SalesmanPage";
import { posHardware } from "./hardware";
import { aiApi } from "@/features/ai/ai-api";
import "./pos-tokens.css";
import { PosSidebar } from "./components/PosSidebar";
import { PosHeader } from "./components/PosHeader";
import { PosProductPanel } from "./components/PosProductPanel";
import { PosCustomerPanel } from "./components/PosCustomerPanel";
import { PosCartPanel } from "./components/PosCartPanel";
import { PosPaymentPanel } from "./components/PosPaymentPanel";
import { PosApprovalDialog } from "./components/PosApprovalDialog";
import { ReceiptPreview, type InvoicePreview } from "./components/ReceiptPreview";
import { catalogApi } from "@/features/catalog/catalog-api";
import { usePosSession } from "./session/usePosSession";
import { POSBadge, POSButton, POSCard, POSEmptyState, POSInput, POSLayout } from "./design-system";
import {
  uuid,
  type CartLine,
  type LocaleMode,
  type PaySplit,
  type PosMode,
  type PriceLevel,
  type ProductTab,
} from "./pos-types";

const FAVORITES_KEY = "erp-pos-favorites";
const FAVORITES_DATA_KEY = "erp-pos-favorites-data";
const RECENT_KEY = "erp-pos-recent";
const RECENT_DATA_KEY = "erp-pos-recent-data";

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

function loadProducts(key: string): ProductSearchResult[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProductSearchResult[]) : [];
  } catch {
    return [];
  }
}

function saveProducts(key: string, items: ProductSearchResult[]) {
  localStorage.setItem(key, JSON.stringify(items.slice(0, 40)));
}

export function PosPage() {
  const toast = useToast();
  const { branchId, branches, setBranchId, user, hasPermission } = useAuth();
  const session = usePosSession();
  const {
    cart,
    totals,
    saleItems,
    setTaxRate,
    priceLevel,
    setPriceLevel,
    invoiceDiscount,
    setInvoiceDiscount,
    walkIn,
    customerId,
    customer,
    addProduct: sessionAddProduct,
    addManual,
    setQty,
    setPrice,
    setLineDiscount,
    removeLine,
    clearCart,
    selectWalkIn,
    applyCustomer,
    replaceCart,
    setWalkIn,
  } = session;

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [mode, setMode] = useState<PosMode>("easy");
  const [locale, setLocale] = useState<LocaleMode>("en");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<ProductTab>("recent");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [recent, setRecent] = useState<ProductSearchResult[]>(() => loadProducts(RECENT_DATA_KEY));
  const [favorites, setFavorites] = useState<ProductSearchResult[]>(() => loadProducts(FAVORITES_DATA_KEY));
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(loadIds(FAVORITES_KEY)));
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<Array<{ id: string; name: string; mobile?: string | null }>>([]);
  const [pendingInvoiceDiscount, setPendingInvoiceDiscount] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [payments, setPayments] = useState<PaySplit[]>([]);
  const [salesmanUserId, setSalesmanUserId] = useState("");
  const [salesmen, setSalesmen] = useState<SalesmanOption[]>([]);
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [delivery, setDelivery] = useState(false);
  const [useInstallment, setUseInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");
  const [downPayment, setDownPayment] = useState("0");
  const [shift, setShift] = useState<Record<string, unknown> | null>(null);
  const [notes, setNotes] = useState("");
  const [methods, setMethods] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [holds, setHolds] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<InvoicePreview | null>(null);
  const [receiptFormat, setReceiptFormat] = useState<"80mm" | "58mm" | "a4">("80mm");
  const [clock, setClock] = useState(() => new Date());
  const [showHolds, setShowHolds] = useState(false);
  const [deviceId] = useState(() => {
    const key = "erp-pos-device-id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  });

  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);

  const canDiscount =
    hasPermission("pos.discount_cashier") ||
    hasPermission("pos.discount_manager") ||
    hasPermission("pos.discount_owner");
  const canPriceOverride = hasPermission("pos.discount_manager") || hasPermission("pos.discount_owner");
  const advanced = mode === "advanced";

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    void partiesApi.seedPaymentMethods().then((r) => {
      const mapped = r.items.map((m) => ({
        id: String(m.id),
        name: String(m.name ?? m.kind ?? "Method"),
        code: m.kind != null ? String(m.kind) : undefined,
      }));
      setMethods(mapped);
      const cash = mapped.find((m) => m.code === "cash") ?? mapped[0];
      if (cash) {
        setPayments([{ id: uuid(), paymentMethodId: cash.id, amount: "" }]);
      }
    });
    void inventoryApi.listWarehouses().then((r) => {
      if (r.items[0]) setWarehouseId(String(r.items[0].id));
    });
    void enterpriseApi
      .listEmployees()
      .then((r) => setSalesmen(mapSalesmanEmployees(r.items)))
      .catch(() => undefined);
    void enterpriseApi
      .listTaxRates()
      .then((r) => {
        const items = r.items as Array<Record<string, unknown>>;
        const preferred =
          items.find((t) => t.is_default && t.is_active !== false) ??
          items.find((t) => t.is_active !== false) ??
          items[0];
        if (preferred) {
          setTaxRate({
            id: String(preferred.id),
            ratePercent: Number(preferred.rate_percent ?? 0),
            pricingMode: (preferred.pricing_mode === "inclusive" ? "inclusive" : "exclusive") as
              | "inclusive"
              | "exclusive",
            isExempt: Boolean(preferred.is_exempt),
          });
        }
      })
      .catch(() => undefined);
    void catalogApi
      .listTaxonomy("categories")
      .then((r) => {
        const items = (r as { items?: Array<Record<string, unknown>> }).items ?? [];
        setCategories(
          items.map((c) => ({
            id: String(c.id),
            name: String(c.name ?? c.code ?? "Category"),
          })),
        );
      })
      .catch(() => undefined);
    return posHardware.subscribeScanner((event) => {
      setQ(event.code);
      setTab("results");
      void posApi
        .searchProducts({ q: event.code, warehouseId: warehouseId || undefined })
        .then((res) => {
          setResults(res.items);
          if (res.items[0]) addProduct(res.items[0]);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!branchId) return;
    void posApi.listHolds(branchId).then((res) => setHolds(res.items)).catch(() => undefined);
    void posApi
      .currentShift(branchId)
      .then((res) => setShift(res.item))
      .catch(() => setShift(null));
  }, [branchId]);

  useEffect(() => {
    if (tab !== "categories") return;
    void (async () => {
      setSearching(true);
      try {
        if (selectedCategoryId) {
          const res = await catalogApi.listProducts({ categoryId: selectedCategoryId, pageSize: 40 });
          // Map catalog products into search-shaped cards via POS search by name
          const names = res.items.slice(0, 20).map((p) => p.name);
          const found: ProductSearchResult[] = [];
          for (const name of names.slice(0, 8)) {
            const hit = await posApi.searchProducts({
              q: name,
              warehouseId: warehouseId || undefined,
              limit: 5,
            });
            for (const item of hit.items) {
              if (!found.some((f) => f.productId === item.productId)) found.push(item);
            }
          }
          setResults(found);
        } else {
          setResults(recent);
        }
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedCategoryId, warehouseId]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await posApi.searchProducts({
            q,
            warehouseId: warehouseId || undefined,
            customerId: customerId || undefined,
          });
          setResults(res.items);
          setTab("results");
        } catch (err) {
          toast.push({
            title: "Search failed",
            description: err instanceof Error ? err.message : "Error",
            tone: "danger",
          });
        } finally {
          setSearching(false);
        }
      })();
    }, 220);
    return () => window.clearTimeout(handle);
  }, [q, warehouseId, customerId, toast]);

  useEffect(() => {
    if (walkIn || !customerQuery.trim()) {
      setCustomerHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void partiesApi.listCustomers(customerQuery).then((res) => {
        setCustomerHits(
          res.items.slice(0, 12).map((c) => ({
            id: c.id,
            name: c.name,
            mobile: c.mobile ?? null,
          })),
        );
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [customerQuery, walkIn]);

  const rememberRecent = useCallback((p: ProductSearchResult) => {
    setRecent((prev) => {
      const next = [p, ...prev.filter((x) => x.productId !== p.productId)].slice(0, 24);
      saveIds(RECENT_KEY, next.map((x) => x.productId));
      saveProducts(RECENT_DATA_KEY, next);
      return next;
    });
  }, []);

  function toggleFavorite(p: ProductSearchResult) {
    setFavorites((prev) => {
      const exists = prev.some((x) => x.productId === p.productId);
      const next = exists
        ? prev.filter((x) => x.productId !== p.productId)
        : [p, ...prev].slice(0, 40);
      saveIds(FAVORITES_KEY, next.map((x) => x.productId));
      saveProducts(FAVORITES_DATA_KEY, next);
      setFavoriteIds(new Set(next.map((x) => x.productId)));
      return next;
    });
  }

  function addProduct(p: ProductSearchResult) {
    sessionAddProduct(p);
    rememberRecent(p);
  }

  function addManualQuick() {
    if (!warehouseId) {
      toast.push({ title: "Warehouse required for manual item", tone: "danger" });
      return;
    }
    const unitId = cart.find((c) => c.unitId)?.unitId;
    if (!unitId) {
      toast.push({
        title: "Add a catalog item first",
        description: "Manual lines need a unit from an existing product in this session",
        tone: "info",
      });
      return;
    }
    addManual(unitId);
  }

  function clearSale() {
    clearCart();
    setInvoiceDiscount("0");
    setNotes("");
    setDelivery(false);
    setUseInstallment(false);
    setPayments((prev) =>
      prev[0]
        ? [{ id: uuid(), paymentMethodId: prev[0].paymentMethodId, amount: "" }]
        : [],
    );
    setLastInvoice(null);
  }

  function requestInvoiceDiscount(value: string) {
    const amount = Number(value || 0);
    const pct = totals.subtotal > 0 ? (amount / totals.subtotal) * 100 : 0;
    const needsManager = pct > 5.001 && !hasPermission("pos.discount_manager") && !hasPermission("pos.discount_owner");
    const needsOwner = pct > 15.001 && !hasPermission("pos.discount_owner");
    if ((needsManager || needsOwner) && amount > 0) {
      setPendingInvoiceDiscount(value);
      setApprovalReason("");
      setApprovalOpen(true);
      return;
    }
    setInvoiceDiscount(value);
  }

  async function selectCustomer(id: string) {
    setCustomerQuery("");
    setCustomerHits([]);
    try {
      const c = await partiesApi.getCustomer(id);
      applyCustomer({
        id: c.id,
        name: c.name,
        mobile: c.mobile ?? null,
        customerType: c.customerType,
        creditLimit: c.creditLimit != null ? String(c.creditLimit) : undefined,
        outstanding: c.outstanding != null ? String(c.outstanding) : undefined,
      });
    } catch {
      applyCustomer({ id, name: id });
    }
  }

  async function checkout() {
    const paymentLines = payments
      .filter((s) => s.paymentMethodId && Number(s.amount) > 0)
      .map((s) => ({ paymentMethodId: s.paymentMethodId, amount: Number(s.amount) }));
    const paid = paymentLines.reduce((s, p) => s + p.amount, 0);
    const allowCredit = !walkIn && Boolean(customerId);
    const validation = validatePosCheckout({
      cart,
      totals,
      branchId,
      warehouseId,
      walkIn,
      customerId,
      paidTotal: paid,
      allowCreditDue: allowCredit,
    });
    if (!validation.ok) {
      toast.push({ title: validation.errors[0] ?? "Checkout invalid", tone: "danger" });
      return;
    }
    setBusy(true);
    try {
      const result = await posApi.postSale({
        branchId: branchId!,
        warehouseId,
        customerId: walkIn ? undefined : customerId || undefined,
        salesmanUserId: salesmanUserId || undefined,
        commissionPercent: salesmanUserId ? commissionPercent : 0,
        notes: [notes, delivery ? "Delivery required" : ""].filter(Boolean).join(" · ") || undefined,
        posMode: mode,
        localeMode: locale,
        items: saleItems,
        payments: paymentLines,
        discountTotal: Number(invoiceDiscount || 0),
        discounts:
          Number(invoiceDiscount || 0) > 0
            ? [
                {
                  scope: "invoice",
                  kind: priceLevel === "wholesale" ? "wholesale" : "fixed",
                  amount: Number(invoiceDiscount),
                  approverRole: hasPermission("pos.discount_owner")
                    ? "owner"
                    : hasPermission("pos.discount_manager")
                      ? "manager"
                      : "cashier",
                  reason: approvalReason || "POS invoice discount",
                },
              ]
            : [],
        createInstallment:
          useInstallment && customerId && !walkIn
            ? {
                downPayment: downPayment || "0",
                installmentCount: Number(installmentCount || 1),
                startDate: new Date().toISOString().slice(0, 10),
              }
            : undefined,
        deviceId,
        idempotencyKey: uuid(),
        operationId: uuid(),
      });

      if (delivery) {
        const deliveryItems = cart
          .filter((c) => c.productId && !c.isManual)
          .map((c) => ({
            productId: c.productId!,
            unitId: c.unitId,
            qty: c.qty,
          }));
        if (deliveryItems.length) {
          try {
            await purchasesApi.createDelivery({
              branchId: branchId!,
              warehouseId,
              saleId: result.id,
              customerId: walkIn ? undefined : customerId || undefined,
              items: deliveryItems,
              notes: notes || "Created from POS",
              idempotencyKey: uuid(),
              operationId: uuid(),
            });
            toast.push({
              title: "Delivery note created",
              description: "Open Deliveries to assign and dispatch",
              tone: "success",
            });
          } catch (err) {
            toast.push({
              title: "Sale posted; delivery note failed",
              description: err instanceof Error ? err.message : "Create delivery manually",
              tone: "danger",
            });
          }
        }
      }

      setLastInvoice(result.invoiceNumber);
      clearSale();
      void posHardware.openDrawer({ reason: `sale ${result.invoiceNumber}` });
      void posApi
        .getInvoice(result.id)
        .then((inv) => setReceipt(inv as InvoicePreview))
        .catch(() => undefined);
      void posHardware.printThermal({
        type: "receipt_80",
        payload: `INV ${result.invoiceNumber}\nTotal ${result.totals.grandTotal}`,
        documentType: "sales_invoice",
      });
      toast.push({
        title: "Sale posted",
        description: `${result.invoiceNumber} · paid ${result.paidTotal} · due ${result.remainingTotal}`,
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Sale failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function holdBill() {
    if (!branchId || !warehouseId || !cart.length) return;
    setBusy(true);
    try {
      await posApi.hold({
        branchId,
        warehouseId,
        holdLabel: `Hold ${new Date().toLocaleTimeString()}`,
        cartSnapshot: {
          cart,
          customerId: walkIn ? "" : customerId,
          walkIn,
          invoiceDiscount,
          locale,
          mode,
          payments,
          notes,
          delivery,
          priceLevel,
          salesmanUserId,
        },
        deviceId,
      });
      clearSale();
      toast.push({ title: "Bill held", tone: "success" });
      const res = await posApi.listHolds(branchId);
      setHolds(res.items);
      setShowHolds(true);
    } catch (err) {
      toast.push({
        title: "Hold failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function resume(id: string) {
    const held = await posApi.resumeHold(id);
    const snap = (held as { cart_snapshot?: Record<string, unknown> }).cart_snapshot;
    if (snap?.cart && Array.isArray(snap.cart)) {
      replaceCart(snap.cart as CartLine[]);
      if (typeof snap.invoiceDiscount === "string") setInvoiceDiscount(snap.invoiceDiscount);
      if (typeof snap.notes === "string") setNotes(snap.notes);
      if (typeof snap.walkIn === "boolean") setWalkIn(snap.walkIn);
      if (typeof snap.customerId === "string" && snap.customerId) {
        void selectCustomer(snap.customerId);
      }
      if (Array.isArray(snap.payments)) setPayments(snap.payments as PaySplit[]);
      if (typeof snap.priceLevel === "string") setPriceLevel(snap.priceLevel as PriceLevel);
      if (typeof snap.salesmanUserId === "string") setSalesmanUserId(snap.salesmanUserId);
      if (typeof snap.delivery === "boolean") setDelivery(snap.delivery);
    }
    toast.push({ title: "Bill resumed", tone: "success" });
    if (branchId) {
      const res = await posApi.listHolds(branchId);
      setHolds(res.items);
    }
    setShowHolds(false);
  }

  async function recognizeCamera() {
    const hw = await posHardware.recognizeFromCamera();
    const hwHint = hw.ok
      ? (hw.data?.candidates[0]?.label ?? hw.data?.candidates[0]?.productIdHint)
      : undefined;
    try {
      const res = await aiApi.recognize({
        warehouseId: warehouseId || undefined,
        branchId: branchId || undefined,
        hintText: hwHint || q || undefined,
        source: "pos",
        signals: { freeText: hwHint || q || undefined },
      });
      const decision = res.decision;
      if (decision.status === "exact" && decision.bestMatch) {
        setQ(decision.bestMatch.product.name);
        toast.push({
          title: "AI match (confirm before sell)",
          description: `${decision.bestMatch.product.name} · conf ${decision.topConfidence.toFixed(2)}`,
          tone: "success",
        });
        return;
      }
      const similar = decision.similar[0] ?? decision.candidates[0];
      if (similar) setQ(similar.product.name);
      toast.push({
        title: `AI ${decision.status}`,
        description: decision.explanations[0] ?? "Select manually",
        tone: "info",
      });
    } catch (err) {
      if (hwHint) setQ(hwHint);
      toast.push({
        title: "AI recognition unavailable",
        description: err instanceof Error ? err.message : hw.error ?? "Fallback search",
        tone: "info",
      });
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        if (e.shiftKey) setShowHolds((v) => !v);
        else void holdBill();
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        setWalkIn(false);
        customerRef.current?.focus();
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        discountRef.current?.focus();
        return;
      }
      if (e.key === "F7" && !typing) {
        e.preventDefault();
        clearCart();
        return;
      }
      if (e.key === "F8" && !typing) {
        e.preventDefault();
        clearSale();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, payments, branchId, warehouseId]);

  useEffect(() => {
    if (payments.length === 1 && totals.grand > 0 && !payments[0].amount) {
      setPayments([{ ...payments[0], amount: String(totals.grand) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.grand]);

  return (
    <div dir={locale === "ur" ? "rtl" : "ltr"}>
      <POSLayout
        sidebar={
          <PosSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((v) => !v)}
            holdCount={holds.length}
            drawerSummary={
              shift
                ? {
                    opening: Number(shift.opening_float ?? 0).toFixed(2),
                    inHand: Number(shift.expected_cash ?? shift.opening_float ?? 0).toFixed(2),
                    sales: Number(shift.sales_total ?? 0).toFixed(2),
                    expenses: Number(shift.expense_total ?? 0).toFixed(2),
                    expected: Number(shift.expected_cash ?? 0).toFixed(2),
                  }
                : undefined
            }
            onCloseShift={() => {
              void (async () => {
                if (!branchId) return;
                if (!shift) {
                  try {
                    const opened = await posApi.openShift({ branchId, openingFloat: 0 });
                    setShift(opened as Record<string, unknown>);
                    toast.push({ title: "Shift opened", tone: "success" });
                  } catch (err) {
                    toast.push({
                      title: "Open shift failed",
                      description: err instanceof Error ? err.message : "Apply migration pos_cash_shifts",
                      tone: "danger",
                    });
                  }
                  return;
                }
                try {
                  const counted = Number(shift.expected_cash ?? shift.opening_float ?? 0);
                  await posApi.closeShift(String(shift.id), { closingCounted: counted });
                  setShift(null);
                  toast.push({ title: "Shift closed", tone: "success" });
                } catch (err) {
                  toast.push({
                    title: "Close shift failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  });
                }
              })();
            }}
          />
        }
        mobileSidebar={
          mobileNav ? (
            <div className="fixed inset-0 z-40 flex lg:hidden">
              <PosSidebar
                collapsed={false}
                onToggle={() => setMobileNav(false)}
                holdCount={holds.length}
              />
              <button
                type="button"
                className="flex-1 bg-black/40"
                onClick={() => setMobileNav(false)}
                aria-label="Close menu"
              />
            </div>
          ) : null
        }
        topbar={
          <PosHeader
            branchId={branchId}
            branches={branches}
            onBranchChange={setBranchId}
            cashierName={user?.fullName ?? "Cashier"}
            online={online}
            holdCount={holds.length}
            mode={mode}
            locale={locale}
            onModeChange={setMode}
            onLocaleChange={setLocale}
            onMenu={() => setMobileNav(true)}
            clock={clock}
            shiftOpen={Boolean(shift)}
          />
        }
      >
        <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <POSButton size="sm" variant="secondary" onClick={() => void recognizeCamera()}>
                Camera AI
              </POSButton>
              {warehouseId ? (
                <POSBadge tone="neutral">WH {warehouseId.slice(0, 8)}</POSBadge>
              ) : (
                <POSBadge tone="warning">No warehouse</POSBadge>
              )}
              {lastInvoice ? <POSBadge tone="success">Last {lastInvoice}</POSBadge> : null}
            </div>
            <PosProductPanel
              query={q}
              onQueryChange={setQ}
              searching={searching}
              products={results}
              favorites={favorites}
              recent={recent}
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(id) => {
                setSelectedCategoryId(id);
                setTab("categories");
              }}
              favoriteIds={favoriteIds}
              onToggleFavorite={toggleFavorite}
              tab={tab}
              onTabChange={setTab}
              locale={locale}
              onAdd={addProduct}
              searchRef={searchRef}
            />
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <PosCustomerPanel
              customer={customer}
              walkIn={walkIn}
              customers={customerHits}
              customerQuery={customerQuery}
              onCustomerQuery={setCustomerQuery}
              onSelectCustomer={(id) => void selectCustomer(id)}
              onWalkIn={() => {
                selectWalkIn();
                setCustomerQuery("");
              }}
              priceLevel={priceLevel}
              onPriceLevel={setPriceLevel}
              salesmanId={salesmanUserId}
              salesmen={salesmen.map((s) => ({ id: s.id, name: `${s.name} (${s.commissionPercent}%)` }))}
              onSalesman={(id) => {
                setSalesmanUserId(id);
                const match = salesmen.find((s) => s.id === id);
                setCommissionPercent(match?.commissionPercent ?? 0);
              }}
              delivery={delivery}
              onDelivery={setDelivery}
              customerRef={customerRef}
              advanced={advanced}
            />

            <PosCartPanel
              cart={cart}
              advanced={advanced}
              locale={locale}
              onQty={(key, qty) => setQty(key, qty)}
              onPrice={(key, unitPrice) => {
                if (!canPriceOverride) {
                  setApprovalOpen(true);
                  setPendingInvoiceDiscount(null);
                  setApprovalReason(`price:${key}:${unitPrice}`);
                  return;
                }
                setPrice(key, unitPrice);
              }}
              onDiscount={(key, discount) => setLineDiscount(key, discount)}
              onRemove={(key) => removeLine(key)}
              onClear={() => clearCart()}
              onManual={addManualQuick}
              canDiscount={canDiscount}
              canPriceOverride={canPriceOverride}
            />

            <PosPaymentPanel
              totals={totals}
              invoiceDiscount={invoiceDiscount}
              onInvoiceDiscount={requestInvoiceDiscount}
              canInvoiceDiscount={canDiscount}
              discountRef={discountRef}
              methods={methods}
              payments={payments}
              onPayments={setPayments}
              notes={notes}
              onNotes={setNotes}
              busy={busy}
              canPay={Boolean(branchId && warehouseId && cart.length)}
              allowCreditDue={!walkIn && Boolean(customerId)}
              onHold={() => void holdBill()}
              onPay={() => void checkout()}
              onCancel={clearSale}
              advanced={advanced}
              useInstallment={useInstallment}
              onUseInstallment={setUseInstallment}
              installmentCount={installmentCount}
              onInstallmentCount={setInstallmentCount}
              downPayment={downPayment}
              onDownPayment={setDownPayment}
            />

            {(showHolds || holds.length > 0) && (
              <POSCard
                title="Held bills"
                actions={
                  <POSButton size="sm" variant="ghost" onClick={() => setShowHolds((v) => !v)}>
                    {showHolds ? "Hide" : "Show"}
                  </POSButton>
                }
              >
                {showHolds ? (
                  <ul className="max-h-40 space-y-2 overflow-auto text-sm">
                    {holds.map((h) => (
                      <li
                        key={String(h.id)}
                        className="flex items-center justify-between gap-2 border-b border-[var(--pos-border)] py-1.5"
                      >
                        <span className="truncate">{String(h.hold_label ?? h.id)}</span>
                        <POSButton size="sm" onClick={() => void resume(String(h.id))}>
                          Resume
                        </POSButton>
                      </li>
                    ))}
                    {!holds.length ? (
                      <POSEmptyState title="No held bills" description="Hold a sale to resume later" />
                    ) : null}
                  </ul>
                ) : null}
              </POSCard>
            )}

            {advanced ? (
              <POSCard title="Warehouse" padding="sm">
                <POSInput
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  aria-label="Warehouse ID"
                />
              </POSCard>
            ) : null}

            {receipt ? (
              <ReceiptPreview
                invoice={receipt}
                format={receiptFormat}
                onFormatChange={setReceiptFormat}
                onClose={() => setReceipt(null)}
              />
            ) : null}
          </div>
        </div>
      </POSLayout>

      <PosApprovalDialog
        open={approvalOpen}
        title="Manager approval required"
        description={
          pendingInvoiceDiscount != null
            ? "Invoice discount exceeds cashier limit (5%). A manager/owner session is required."
            : "Price override requires manager/owner discount permission."
        }
        reason={approvalReason.startsWith("price:") ? "Price override requested" : approvalReason}
        onReasonChange={(v) => {
          if (!approvalReason.startsWith("price:")) setApprovalReason(v);
          else setApprovalReason(approvalReason);
        }}
        canApprove={hasPermission("pos.discount_manager") || hasPermission("pos.discount_owner")}
        onCancel={() => {
          setApprovalOpen(false);
          setPendingInvoiceDiscount(null);
        }}
        onApprove={() => {
          if (!approvalReason.trim() && pendingInvoiceDiscount != null) return;
          if (pendingInvoiceDiscount != null) {
            setInvoiceDiscount(pendingInvoiceDiscount);
            setPendingInvoiceDiscount(null);
          } else if (approvalReason.startsWith("price:")) {
            const parts = approvalReason.split(":");
            const key = parts[1];
            const unitPrice = Number(parts[2] || 0);
            if (key) setPrice(key, unitPrice);
          }
          setApprovalOpen(false);
          setApprovalReason("");
        }}
      />
    </div>
  );
}
