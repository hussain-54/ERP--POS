import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import {
  approverRoleFromPermissions,
  buildHoldSnapshot,
  evaluateDiscountApproval,
  evaluatePosCustomerCredit,
  pickExactProductMatch,
  preparePosPayments,
  PaymentAttemptGate,
  restoreHoldTransaction,
  roundMoney,
  resolveCheckoutIdempotencyKey,
  validatePosCheckout,
  type InstallmentFrequency,
  type PosPaymentConfirmationStatus,
} from "@electronic-erp/domain";
import type { HeldSaleFilter } from "@electronic-erp/contracts";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
import { searchPosProducts } from "./pos-product-search";
import { adminApi } from "@/features/users/admin-api";
import {
  buildDiscountApprovalCreateBody,
  discountRequestTitle,
  evaluateDiscountAgainstPolicy,
  formatDiscountCap,
  parseDiscountValueInput,
  type PendingDiscountRequest,
} from "./discounts-workspace";
import { inventoryApi } from "@/features/inventory/inventory-api";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { purchasesApi } from "@/features/purchases/purchases-api";
import { mapSalesmanEmployees, type SalesmanOption } from "@/features/salesman/SalesmanPage";
import { cameraScanner, posHardware } from "./hardware";
import { aiApi } from "@/features/ai-camera/ai-api";
import "./pos-tokens.css";
import { PosSaleLayout } from "./components/PosSaleLayout";
import { PosSaleMeta } from "./components/PosSaleMeta";
import { usePosLayout } from "./usePosLayoutMode";
import type { PosMobileSheet } from "./pos-layout";
import { PosProductPanel } from "./components/PosProductPanel";
import { PosCustomerPanel, type PosCustomerFormInput } from "./components/PosCustomerPanel";
import { PosCart } from "./components/PosCart";
import { PosPaymentPanel } from "./components/PosPaymentPanel";
import { PosApprovalDialog } from "./components/PosApprovalDialog";
import { ReceiptPreview, type InvoicePreview } from "./components/ReceiptPreview";
import { PosHoldsPanel, type HeldSaleListItem } from "./components/PosHoldsPanel";
import { catalogApi, CATALOG_CHANGED_EVENT } from "@/features/product-management/catalog-api";
import { afterSalesApi } from "@/features/quotations/after-sales-api";
import { usePosSession } from "./session/usePosSession";
import { posCustomerRepository } from "./session/pos-customer-repository";
import { partiesApi } from "@/features/customers/parties-api";
import { cartToQuotationItems } from "./pos-quotation";
import {
  isLatestRequest,
  nextProductSearchLimit,
  POS_PRODUCT_SEARCH_LIMIT,
  productsMatchingCategory,
} from "./pos-catalog-load";
import { cachedPosFetch, clearPosBootstrapCache } from "./pos-bootstrap-cache";
import {
  appendCharToSearchInput,
  focusLastCartRate,
  isActionTarget,
  isPosOverlayOpen,
  isProductSearchFocusKey,
  isReservedBrowserChord,
  isTypingTarget,
  parseProductSearchCommand,
  priceOverrideWarning,
  saleHasUnsavedWork,
  schedulePosFocus,
} from "./pos-ux";
import { posActionFlags } from "./pos-security";
import { type PosHoldNavigationState } from "./held-sales";
import type { CustomerSearchHit } from "@electronic-erp/contracts";
import {
  POSConfirmDialog,
  POSDrawer,
} from "./design-system";
import {
  POS_SHORTCUT_EVENT,
  uuid,
  type CartLine,
  type LocaleMode,
  type PaySplit,
  type PosMode,
  type PosShortcutAction,
  type PriceLevel,
  type ProductTab,
} from "./pos-types";
import {
  INTERNET_REQUIRED_MESSAGE,
  INTERNET_REQUIRED_TITLE,
  requireInternetConnection,
} from "@/lib/online-required";
import {
  formatPosFailure,
  humanizeCartError,
  logPosDeveloperError,
  toPosUserDescription,
  type PosCatalogFeedback,
} from "./pos-user-messages";

/** @deprecated use requireInternetConnection — kept name for call-site clarity in POS */
function requireOnlineForPos(
  online: boolean,
  push: (t: { title: string; description?: string; tone: "danger" | "success" | "info" }) => void,
): boolean {
  if (online) return true;
  return requireInternetConnection(push);
}

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

export function PosPage({ entry = "sale" }: { entry?: "sale" | "holds" }) {
  const toast = useToast();
  const { pathname, state: locationState } = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const holdEntry =
    entry === "holds" ||
    pathname === "/held-sales" ||
    pathname === "/pos/hold-sale" ||
    pathname === "/pos/resume-sale";
  const { branchId, hasPermission, organizationId } = useAuth();
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
    invoiceDiscountKind,
    setInvoiceDiscountKind,
    invoiceDiscountPercent,
    setInvoiceDiscountPercent,
    walkIn,
    customerId,
    customer,
    addProduct: sessionAddProduct,
    addManual,
    setQty,
    increaseQty,
    decreaseQty,
    setPrice,
    setLineDiscountInput,
    changeUnit,
    removeLine,
    clearCart,
    selectWalkIn,
    applyCustomer,
    replaceCart,
    setWalkIn,
    lastCartError,
    setAllowManualOverride,
    recalculate,
  } = session;

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
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
  const [searchLimit, setSearchLimit] = useState(POS_PRODUCT_SEARCH_LIMIT);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogEpoch, setCatalogEpoch] = useState(0);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [quoting, setQuoting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    { kind: "clear-cart" } | { kind: "cancel-sale" } | { kind: "remove-line"; key: string } | null
  >(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerSearchHit[]>([]);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [catalogFeedback, setCatalogFeedback] = useState<PosCatalogFeedback | null>(null);
  const [pendingDiscount, setPendingDiscount] = useState<PendingDiscountRequest | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [payments, setPayments] = useState<PaySplit[]>([]);
  const [salesmanUserId, setSalesmanUserId] = useState("");
  const [salesmen, setSalesmen] = useState<SalesmanOption[]>([]);
  const [referenceId, setReferenceId] = useState("");
  const [references, setReferences] = useState<Array<{ id: string; name: string }>>([]);
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [delivery, setDelivery] = useState(false);
  const [useInstallment, setUseInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");
  const [downPayment, setDownPayment] = useState("0");
  const [installmentFrequency, setInstallmentFrequency] =
    useState<InstallmentFrequency>("monthly");
  const [lateFeePercent, setLateFeePercent] = useState("0");
  const [lateFeeFixed, setLateFeeFixed] = useState("0");
  const [isAdvance, setIsAdvance] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(() => uuid());
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<PosPaymentConfirmationStatus | null>(null);
  const [paymentConfirmationError, setPaymentConfirmationError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponHint, setCouponHint] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [methods, setMethods] = useState<Array<{ id: string; name: string; code?: string; kind?: string }>>([]);
  const [holds, setHolds] = useState<HeldSaleListItem[]>([]);
  const [holdsFilter, setHoldsFilter] = useState<HeldSaleFilter>("all_pending");
  const [holdReason, setHoldReason] = useState("");
  const [holdNotes, setHoldNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<InvoicePreview | null>(null);
  const [receiptFormat, setReceiptFormat] = useState<"80mm" | "58mm" | "a4">("80mm");
  const [showHolds, setShowHolds] = useState(holdEntry);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const { mode: layoutMode, chrome } = usePosLayout();
  const [mobileSheet, setMobileSheet] = useState<PosMobileSheet>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const payingRef = useRef(false);
  const scanLockRef = useRef(false);
  const addProductRef = useRef<(p: ProductSearchResult, qty?: string) => boolean>(() => false);
  const productSearchSeq = useRef(0);
  const customerSearchSeq = useRef(0);
  const productHandlersRef = useRef({
    commit: (_raw: string, _highlighted: ProductSearchResult | null) => undefined as void,
    camera: () => undefined as void,
    qr: () => undefined as void,
    barcode: () => undefined as void,
    manual: () => undefined as void,
  });
  const pageOpsRef = useRef({
    cartPrice: (_key: string, _unitPrice: number) => undefined as void,
    cartDiscount: (_key: string, _raw: string) => undefined as void,
    cartRemove: (_key: string) => undefined as void,
    cartClear: () => undefined as void,
    invoiceDiscount: (_value: string) => undefined as void,
    cancelSale: () => undefined as void,
    hold: () => undefined as void,
    pay: () => undefined as void,
    quotation: () => undefined as void,
    retryPay: () => undefined as void,
    selectCustomer: (_id: string) => undefined as void,
    walkIn: () => undefined as void,
    salesman: (_id: string) => undefined as void,
    loadHistory: (_id: string) =>
      Promise.resolve(
        [] as Array<{
          id: string;
          entryType: string;
          amount: string;
          occurredAt: string;
          description?: string | null;
        }>,
      ),
    createCustomer: async (_input: PosCustomerFormInput) => undefined as void,
    updateCustomer: async (_id: string, _input: PosCustomerFormInput) => undefined as void,
    shortcut: (_e: KeyboardEvent) => undefined as void,
    functionShortcut: (_action: PosShortcutAction) => undefined as void,
  });
  const warehouseIdRef = useRef(warehouseId);
  const customerIdRef = useRef(customerId);
  const walkInRef = useRef(walkIn);
  warehouseIdRef.current = warehouseId;
  customerIdRef.current = customerId;
  walkInRef.current = walkIn;
  const customerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = searchParams.get("focus");
    const modeParam = searchParams.get("mode");
    if (!focus && !modeParam) return;
    if (modeParam === "easy" || focus === "quick") setMode("easy");
    if (modeParam === "advanced") setMode("advanced");
    if (focus === "customer") {
      setWalkIn(false);
      queueMicrotask(() => customerRef.current?.focus());
      if (layoutMode === "mobile") setMobileSheet("customer");
    }
    if (focus === "payment") {
      setMode("advanced");
      if (layoutMode === "mobile") setMobileSheet("pay");
    }
    if (focus === "search" || focus === "scan" || focus === "quick") {
      queueMicrotask(() => searchRef.current?.focus());
    }
    // Consume focus params so remounts / refreshes do not keep re-applying.
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    next.delete("mode");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const discountRef = useRef<HTMLInputElement>(null);
  const paymentGateRef = useRef(new PaymentAttemptGate());

  const posFlags = posActionFlags(hasPermission);
  const canDiscount = posFlags.canDiscount;
  const canPriceOverride = posFlags.canPriceOverride;
  const canHold = posFlags.canHold;
  const canInstallment = posFlags.canInstallment;
  const actingDiscountRole = approverRoleFromPermissions({
    special: hasPermission("pos.discount_special"),
    owner: hasPermission("pos.discount_owner"),
    manager: hasPermission("pos.discount_manager"),
    supervisor: hasPermission("pos.discount_supervisor"),
    cashier: hasPermission("pos.discount_cashier"),
  });
  const advanced = mode === "advanced";

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
    if (holdEntry) setShowHolds(true);
  }, [holdEntry]);

  useEffect(() => {
    void cachedPosFetch("pos:payment-methods", () => partiesApi.seedPaymentMethods()).then((r) => {
      const mapped = r.items.map((m) => ({
        id: String(m.id),
        name: String(m.name ?? m.kind ?? "Method"),
        code: m.code != null ? String(m.code).toLowerCase() : undefined,
        kind: m.kind != null ? String(m.kind).toLowerCase() : undefined,
      }));
      setMethods(mapped);
      const cash = mapped.find((m) => m.kind === "cash" || m.code === "cash") ?? mapped[0];
      if (cash) {
        setPayments([
          {
            id: uuid(),
            paymentMethodId: cash.id,
            amount: "",
            methodKind: cash.kind ?? "cash",
          },
        ]);
      }
    });
    void cachedPosFetch("pos:warehouses", () => inventoryApi.listWarehouses()).then((r) => {
      const items = r.items.map((w) => ({
        id: String(w.id),
        name: String(w.name ?? w.code ?? "Warehouse"),
      }));
      setWarehouses(items);
      if (items[0]) setWarehouseId(items[0].id);
    });
    void cachedPosFetch("pos:employees", () => enterpriseApi.listEmployees())
      .then((r) => setSalesmen(mapSalesmanEmployees(r.items)))
      .catch(() => undefined);
    void cachedPosFetch("pos:references", () => enterpriseApi.listReferences())
      .then((r) =>
        setReferences(
          (r.items as Array<Record<string, unknown>>)
            .filter((x) => x.is_active !== false)
            .map((x) => ({
              id: String(x.id),
              name: `${String(x.name)}${x.code ? ` (${String(x.code)})` : ""}`,
            })),
        ),
      )
      .catch(() => undefined);
    void cachedPosFetch("pos:tax-rates", () => enterpriseApi.listTaxRates())
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
            kind: preferred.is_exempt
              ? "exempt"
              : String(preferred.code ?? preferred.name ?? "")
                    .toLowerCase()
                    .includes("gst")
                ? "gst"
                : "sales_tax",
          });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!branchId || !showHolds) return;
    void refreshHolds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, holdsFilter, showHolds]);

  async function refreshHolds() {
    if (!branchId) return;
    try {
      // listHeldSales already applies expiry — do not call /holds/expire separately.
      const res = await posApi.listHolds(branchId, holdsFilter);
      setHolds(res.items as HeldSaleListItem[]);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (tab !== "categories" || categories.length) return;
    void cachedPosFetch("pos:categories", () => catalogApi.listTaxonomy("categories"))
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
  }, [tab, categories.length]);

  useEffect(() => {
    const onCatalogChanged = () => {
      clearPosBootstrapCache("pos:categories");
      setCatalogEpoch((n) => n + 1);
    };
    window.addEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
  }, []);

  useEffect(() => {
    if (tab !== "categories" || q.trim()) return;
    if (!selectedCategoryId) {
      productSearchSeq.current += 1;
      setCatalogHasMore(false);
      setResults(recent);
      return;
    }
    const categoryName = categories.find((item) => item.id === selectedCategoryId)?.name;
    if (!categoryName) return;
    if (!online) {
      productSearchSeq.current += 1;
      setResults([]);
      return;
    }
    const started = ++productSearchSeq.current;
    setSearching(true);
    void searchPosProducts({
      q: categoryName,
      warehouseId: warehouseId || undefined,
      customerId: walkIn ? undefined : customerId || undefined,
      limit: searchLimit,
    })
      .then((items) => {
        if (!isLatestRequest(productSearchSeq.current, started)) return;
        setCatalogHasMore(
          items.length >= searchLimit && nextProductSearchLimit(searchLimit) > searchLimit,
        );
        setResults(productsMatchingCategory(items, categoryName));
      })
      .catch(() => {
        if (!isLatestRequest(productSearchSeq.current, started)) return;
        setCatalogHasMore(false);
      })
      .finally(() => {
        if (isLatestRequest(productSearchSeq.current, started)) setSearching(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedCategoryId, categories, warehouseId, customerId, walkIn, q, searchLimit, online, catalogEpoch]);

  useEffect(() => {
    if (!q.trim()) {
      if (tab !== "categories") setResults([]);
      return;
    }
    if (!online) {
      setResults([]);
      return;
    }
    const started = ++productSearchSeq.current;
    setSearching(true);
    void (async () => {
      try {
        const items = await searchPosProducts({
          q,
          warehouseId: warehouseId || undefined,
          customerId: walkIn ? undefined : customerId || undefined,
          limit: searchLimit,
        });
        if (!isLatestRequest(productSearchSeq.current, started)) return;
        setResults(items);
        setCatalogFeedback(null);
      } catch (err) {
        if (!isLatestRequest(productSearchSeq.current, started)) return;
        setResults([]);
        const failed = formatPosFailure(err, "search");
        setCatalogFeedback({
          tone: "danger",
          title: failed.title,
          description: failed.description,
        });
      } finally {
        if (isLatestRequest(productSearchSeq.current, started)) setSearching(false);
      }
    })();
  }, [q, warehouseId, customerId, walkIn, online, tab, searchLimit, catalogEpoch]);

  useEffect(() => {
    if (walkIn || !customerQuery.trim() || !hasPermission("customers.read")) {
      setCustomerHits([]);
      setCustomerSearchError(null);
      return;
    }
    const orgId = organizationId ?? "";
    const started = ++customerSearchSeq.current;
    if (!online) {
      setCustomerHits([]);
      setCustomerSearchError("Customer search needs an internet connection.");
      return;
    }
    void posCustomerRepository
      .search({
        q: customerQuery,
        organizationId: orgId,
        canRead: hasPermission("customers.read"),
      })
      .then((hits) => {
        if (isLatestRequest(customerSearchSeq.current, started)) {
          setCustomerHits(hits);
          setCustomerSearchError(null);
        }
      })
      .catch((err) => {
        if (isLatestRequest(customerSearchSeq.current, started)) {
          logPosDeveloperError("customer-search", err);
          setCustomerHits([]);
          setCustomerSearchError(
            toPosUserDescription(
              err,
              "Customers could not be searched. Check your connection and try again.",
            ),
          );
        }
      });
  }, [customerQuery, walkIn, online, organizationId, hasPermission]);

  const rememberRecent = useCallback((p: ProductSearchResult) => {
    setRecent((prev) => {
      const next = [p, ...prev.filter((x) => x.productId !== p.productId)].slice(0, 24);
      saveIds(RECENT_KEY, next.map((x) => x.productId));
      saveProducts(RECENT_DATA_KEY, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((p: ProductSearchResult) => {
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
  }, []);

  const addProduct = useCallback((p: ProductSearchResult, qty?: string) => {
    const result = sessionAddProduct(p, undefined, qty);
    if (!result.ok) {
      // lastCartError is set inline on the cart — avoid a duplicate toast.
      return false;
    }
    rememberRecent(p);
    setCatalogFeedback(null);
    setQ("");
    queueMicrotask(() => searchRef.current?.focus());
    return true;
  }, [sessionAddProduct, rememberRecent]);
  addProductRef.current = addProduct;

  const selectCategory = useCallback((id: string | null) => {
    setSelectedCategoryId(id);
    setSearchLimit(POS_PRODUCT_SEARCH_LIMIT);
    setTab("categories");
  }, []);
  const setProductQuery = useCallback((next: string) => {
    setSearchLimit(POS_PRODUCT_SEARCH_LIMIT);
    setQ(next);
  }, []);
  const onLoadMoreProducts = useCallback(() => {
    setSearchLimit((current) => nextProductSearchLimit(current));
  }, []);
  const onCommitSearch = useCallback((raw: string, highlighted: ProductSearchResult | null) => {
    productHandlersRef.current.commit(raw, highlighted);
  }, []);
  const onCamera = useCallback(() => {
    productHandlersRef.current.camera();
  }, []);
  const onQrScan = useCallback(() => {
    productHandlersRef.current.qr();
  }, []);
  const onBarcodeScanHint = useCallback(() => {
    productHandlersRef.current.barcode();
  }, []);
  const onManualEntry = useCallback(() => {
    productHandlersRef.current.manual();
  }, []);
  const onCartPrice = useCallback((key: string, unitPrice: number) => {
    pageOpsRef.current.cartPrice(key, unitPrice);
  }, []);
  const onCartDiscount = useCallback((key: string, raw: string) => {
    pageOpsRef.current.cartDiscount(key, raw);
  }, []);
  const onCartRemove = useCallback((key: string) => {
    pageOpsRef.current.cartRemove(key);
  }, []);
  const onCartClear = useCallback(() => {
    pageOpsRef.current.cartClear();
  }, []);
  const onInvoiceDiscount = useCallback((value: string) => {
    pageOpsRef.current.invoiceDiscount(value);
  }, []);
  const onCancelSale = useCallback(() => {
    pageOpsRef.current.cancelSale();
  }, []);
  const onHoldSale = useCallback(() => {
    pageOpsRef.current.hold();
  }, []);
  const onPaySale = useCallback(() => {
    pageOpsRef.current.pay();
  }, []);
  const onQuotation = useCallback(() => {
    pageOpsRef.current.quotation();
  }, []);
  const onApplyCoupon = useCallback(async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponHint(null);
    try {
      const purchaseBase = Math.max(0, (totals.subtotal ?? 0) - (totals.itemDiscount ?? 0));
      const evaluated = await posApi.validateCoupon({
        code,
        purchaseBase,
        customerId: walkIn ? null : customerId || null,
      });
      setInvoiceDiscount(String(evaluated.amount));
      setInvoiceDiscountKind("fixed");
      setInvoiceDiscountPercent(0);
      setAppliedCouponCode(evaluated.code);
      setCouponHint(`Coupon ${evaluated.code} applied (−${evaluated.amount.toFixed(2)})`);
    } catch (err) {
      setAppliedCouponCode(null);
      setCouponHint(toPosUserDescription(err, "Coupon could not be applied"));
    } finally {
      setCouponBusy(false);
    }
  }, [
    couponCode,
    totals.subtotal,
    totals.itemDiscount,
    walkIn,
    customerId,
    setInvoiceDiscount,
    setInvoiceDiscountKind,
    setInvoiceDiscountPercent,
  ]);
  const onRetryPayment = useCallback(() => {
    pageOpsRef.current.retryPay();
  }, []);
  const onSelectCustomer = useCallback((id: string) => {
    pageOpsRef.current.selectCustomer(id);
  }, []);
  const onCustomerWalkIn = useCallback(() => {
    pageOpsRef.current.walkIn();
  }, []);
  const onSalesmanChange = useCallback((id: string) => {
    pageOpsRef.current.salesman(id);
  }, []);
  const onLoadCustomerHistory = useCallback((id: string) => pageOpsRef.current.loadHistory(id), []);
  const onCreateCustomer = useCallback(
    (input: PosCustomerFormInput) => pageOpsRef.current.createCustomer(input),
    [],
  );
  const onUpdateCustomer = useCallback(
    (id: string, input: PosCustomerFormInput) => pageOpsRef.current.updateCustomer(id, input),
    [],
  );

  async function commitProductSearch(raw: string, highlighted: ProductSearchResult | null) {
    if (scanLockRef.current) return;
    const cmd = parseProductSearchCommand(raw);
    if (cmd.kind === "qty-last") {
      const last = cart[cart.length - 1];
      if (!last) {
        toast.push({ title: "Cart is empty", description: "Add a product before *qty", tone: "info" });
        return;
      }
      setQty(last.key, cmd.qty);
      setQ("");
      searchRef.current?.focus();
      return;
    }
    const needle = cmd.query;
    if (!needle) return;
    const exact = pickExactProductMatch(results, needle);
    if (exact) {
      addProduct(exact, cmd.qty ?? undefined);
      return;
    }
    if (highlighted && results.some((item) => item.productId === highlighted.productId)) {
      addProduct(highlighted, cmd.qty ?? undefined);
      return;
    }
    if (!online) {
      setCatalogFeedback({
        tone: "danger",
        title: "Search unavailable",
        description: "Connect to the internet to search the product catalog.",
      });
      return;
    }
    setSearching(true);
    const started = ++productSearchSeq.current;
    try {
      const items = await searchPosProducts({
        q: needle,
        warehouseId: warehouseId || undefined,
        customerId: walkIn ? undefined : customerId || undefined,
      });
      if (!isLatestRequest(productSearchSeq.current, started)) return;
      setResults(items);
      const match =
        pickExactProductMatch(items, needle) ??
        (items.length === 1 ? items[0] : null);
      if (!match) {
        setCatalogFeedback({
          tone: "info",
          title: "No products found for this search.",
          description: `Nothing matched “${needle}”. Try another name, barcode, SKU, brand, or category.`,
        });
        return;
      }
      setCatalogFeedback(null);
      addProduct(match, cmd.qty ?? undefined);
    } catch (err) {
      if (!isLatestRequest(productSearchSeq.current, started)) return;
      const failed = formatPosFailure(err, "search");
      setCatalogFeedback({
        tone: "danger",
        title: failed.title,
        description: failed.description,
      });
    } finally {
      if (isLatestRequest(productSearchSeq.current, started)) setSearching(false);
    }
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
    setInvoiceDiscountKind("fixed");
    setInvoiceDiscountPercent(0);
    setNotes("");
    setDelivery(false);
    setUseInstallment(false);
    setIsAdvance(false);
    setCashReceived("");
    setDownPayment("0");
    setInstallmentCount("3");
    setInstallmentFrequency("monthly");
    setLateFeePercent("0");
    setLateFeeFixed("0");
    setPaymentConfirmation(null);
    setPaymentConfirmationError(null);
    setCheckoutIdempotencyKey(uuid());
    setPayments((prev) =>
      prev[0]
        ? [
            {
              id: uuid(),
              paymentMethodId: prev[0].paymentMethodId,
              amount: "",
              methodKind: prev[0].methodKind,
            },
          ]
        : [],
    );
    setLastInvoice(null);
    setSalesmanUserId("");
    setReferenceId("");
    setCommissionPercent(0);
  }

  function requestClearCart() {
    if (!cart.length) return;
    setConfirmAction({ kind: "clear-cart" });
  }

  function requestCancelSale() {
    if (!cart.length) {
      clearSale();
      return;
    }
    setConfirmAction({ kind: "cancel-sale" });
  }

  function requestPriceOverride() {
    if (canPriceOverride) {
      toast.push({
        title: "Price override enabled",
        description: "Edit line rate directly in the cart.",
        tone: "info",
      });
      focusLastCartRate();
      return;
    }
    setPendingDiscount({ kind: "price" });
    setApprovalReason("Price override requested");
    setApprovalOpen(true);
  }

  function recalculateTotals() {
    recalculate();
    requestInvoiceDiscount(invoiceDiscount);
    setPayments((prev) => [...prev]);
    toast.push({ title: "Totals recalculated", tone: "info" });
  }

  async function createQuotationFromCart() {
    if (!requireOnlineForPos(online, toast.push)) return;
    if (!hasPermission("quotations.write")) {
      toast.push({
        title: "Cannot create quotation",
        description: "Requires quotations.write permission",
        tone: "danger",
      });
      return;
    }
    if (!branchId) {
      toast.push({ title: "No branch selected", tone: "danger" });
      return;
    }
    const mapped = cartToQuotationItems(cart);
    if (!mapped.ok) {
      toast.push({ title: "Cannot create quotation", description: mapped.error, tone: "danger" });
      return;
    }
    setQuoting(true);
    try {
      await afterSalesApi.createQuotation({
        branchId,
        customerId: walkIn ? undefined : customerId || undefined,
        items: mapped.items,
        discountTotal: Number(invoiceDiscount || 0),
        notes: notes || undefined,
        idempotencyKey: uuid(),
      });
      toast.push({ title: "Quotation created", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Quotation failed",
        description: toPosUserDescription(err, "Could not create the quotation. Check your connection and try again."),
        tone: "danger",
      });
    } finally {
      setQuoting(false);
    }
  }

  function applyConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.kind === "clear-cart") clearCart();
    else if (confirmAction.kind === "cancel-sale") clearSale();
    else removeLine(confirmAction.key);
    setConfirmAction(null);
  }

  function requestInvoiceDiscount(value: string) {
    const base = Math.max(0, roundMoney(totals.subtotal - totals.itemDiscount));
    const parsed = parseDiscountValueInput(value);
    let evaluated;
    try {
      evaluated = evaluateDiscountAgainstPolicy({
        base,
        mode: parsed.mode,
        value: parsed.value,
        actingRole: actingDiscountRole,
      });
    } catch (err) {
      toast.push({
        title: "Invalid discount",
        description: toPosUserDescription(err, "Could not apply the discount. Please try again."),
        tone: "danger",
      });
      return;
    }
    setInvoiceDiscountKind(parsed.mode === "percentage" ? "percentage" : "fixed");
    setInvoiceDiscountPercent(parsed.mode === "percentage" ? parsed.value || 0 : 0);
    if (evaluated.decision.needsApproval && evaluated.applied.amount > 0) {
      setPendingDiscount({
        kind: "invoice",
        raw: value,
        mode: parsed.mode,
        value: parsed.value,
        amount: evaluated.applied.amount,
        base,
        percent: evaluated.decision.percent,
        requiredRole: evaluated.decision.requiredRole,
        maxAllowed: evaluated.decision.maxAllowed,
      });
      setApprovalReason("");
      setApprovalOpen(true);
      return;
    }
    setInvoiceDiscount(String(evaluated.applied.amount));
  }

  function requestLineDiscount(key: string, raw: string) {
    const line = cart.find((item) => item.key === key);
    if (!line) return;
    const parsed = parseDiscountValueInput(raw);
    const base = Math.max(0, roundMoney(Number(line.qty) * Number(line.unitPrice)));
    let evaluated;
    try {
      evaluated = evaluateDiscountAgainstPolicy({
        base,
        mode: parsed.mode,
        value: parsed.value,
        actingRole: actingDiscountRole,
      });
    } catch (err) {
      toast.push({
        title: "Invalid discount",
        description: toPosUserDescription(err, "Could not apply the discount. Please try again."),
        tone: "danger",
      });
      return;
    }
    if (evaluated.decision.needsApproval && evaluated.applied.amount > 0) {
      setPendingDiscount({
        kind: "line",
        key,
        raw,
        mode: parsed.mode,
        value: parsed.value,
        amount: evaluated.applied.amount,
        base,
        percent: evaluated.decision.percent,
        requiredRole: evaluated.decision.requiredRole,
        maxAllowed: evaluated.decision.maxAllowed,
      });
      setApprovalReason("");
      setApprovalOpen(true);
      return;
    }
    setLineDiscountInput(key, raw);
  }

  async function submitDiscountApproval() {
    if (!pendingDiscount) return;
    if (!hasPermission("approvals.act")) {
      toast.push({
        title: "Cannot request approval",
        description: "Requires approvals.act. This is the real Approval Workflow, not a cashier override.",
        tone: "danger",
      });
      return;
    }
    if (!approvalReason.trim()) return;
    setApprovalBusy(true);
    try {
      const payload =
        pendingDiscount.kind === "price"
          ? {
              kind: "price_override",
              key: pendingDiscount.key,
              unitPrice: pendingDiscount.unitPrice,
              actingRole: actingDiscountRole,
            }
          : {
              scope: pendingDiscount.kind,
              mode: pendingDiscount.mode,
              value: pendingDiscount.value,
              base: pendingDiscount.base,
              percent: pendingDiscount.percent,
              requiredRole: pendingDiscount.requiredRole,
              actingRole: actingDiscountRole,
            };
      await adminApi.createApproval(
        buildDiscountApprovalCreateBody({
          branchId: branchId ?? undefined,
          title: discountRequestTitle(pendingDiscount),
          amount: pendingDiscount.kind === "price" ? pendingDiscount.unitPrice : pendingDiscount.amount,
          remarks: approvalReason.trim(),
          requesterRole: actingDiscountRole,
          payload,
        }),
      );
      toast.push({
        title: "Approval requested",
        description:
          "The discount was not applied. Caps stay in force until a user with the required permission applies it on New Sale.",
        tone: "success",
      });
      setApprovalOpen(false);
      setPendingDiscount(null);
      setApprovalReason("");
    } catch (err) {
      toast.push({
        title: "Request failed",
        description: toPosUserDescription(err, "Could not create the approval request. Please try again."),
        tone: "danger",
      });
    } finally {
      setApprovalBusy(false);
    }
  }

  async function selectCustomer(id: string) {
    setCustomerQuery("");
    setCustomerHits([]);
    try {
      const profile = await posCustomerRepository.get({
        id,
        organizationId: organizationId ?? "",
        canRead: hasPermission("customers.read"),
        canViewLoyalty: hasPermission("loyalty.view") || hasPermission("loyalty.manage"),
      });
      applyCustomer(profile);
    } catch (err) {
      toast.push({
        title: "Customer load failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
    }
  }

  async function createCustomerFromPos(input: {
    code: string;
    name: string;
    mobile?: string;
    email?: string;
    address?: string;
    cnic?: string;
    customerType?: "retail" | "wholesale" | "dealer";
  }) {
    setCreatingCustomer(true);
    try {
      const created = await posCustomerRepository.create({
        organizationId: organizationId ?? "",
        canWrite: hasPermission("customers.write"),
        body: input,
      });
      toast.push({
        title: "Customer created",
        tone: "success",
      });
      await selectCustomer(created.id);
    } catch (err) {
      toast.push({
        title: "Create customer failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
      throw err;
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function updateCustomerFromPos(
    id: string,
    input: {
      code: string;
      name: string;
      mobile?: string;
      email?: string;
      address?: string;
      cnic?: string;
      customerType?: "retail" | "wholesale" | "dealer";
    },
  ) {
    setCreatingCustomer(true);
    try {
      const patch: Record<string, unknown> = {
        name: input.name,
        mobile: input.mobile ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        customerType: input.customerType,
      };
      if (input.cnic?.trim()) patch.cnic = input.cnic.trim();
      await posCustomerRepository.update({
        id,
        organizationId: organizationId ?? "",
        canWrite: hasPermission("customers.write"),
        patch,
      });
      toast.push({ title: "Customer updated", tone: "success" });
      await selectCustomer(id);
    } catch (err) {
      toast.push({
        title: "Update failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
      throw err;
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function checkout() {
    if (busy || paymentConfirmation === "pending" || payingRef.current) return;
    payingRef.current = true;
    setBusy(true);
    setPaymentConfirmationError(null);
    const idempotencyKey = checkoutIdempotencyKey;
    try {
    if (!requireOnlineForPos(online, toast.push)) {
      setPaymentConfirmation("failure");
      setPaymentConfirmationError("Internet required to post a sale");
      return;
    }

    let creditCustomer = customer;
    if (!walkIn && customerId) {
      try {
        creditCustomer = await posCustomerRepository.get({
          id: customerId,
          organizationId: organizationId ?? "",
          canRead: hasPermission("customers.read"),
          canViewLoyalty: hasPermission("loyalty.view") || hasPermission("loyalty.manage"),
        });
        applyCustomer(creditCustomer);
      } catch (err) {
        const message = toPosUserDescription(
          err,
          "Could not refresh this customer. Check your connection and try again.",
        );
        setPaymentConfirmation("failure");
        setPaymentConfirmationError(message);
        return;
      }
    }

    const kindById = new Map(methods.map((m) => [m.id, m.kind ?? m.code ?? ""]));
    const prep = preparePosPayments({
      grandTotal: totals.grand,
      lines: payments.map((p) => ({
        paymentMethodId: p.paymentMethodId,
        amount: p.amount,
        amountReceived:
          (kindById.get(p.paymentMethodId) === "cash" || p.methodKind === "cash") && cashReceived
            ? cashReceived
            : p.amountReceived,
        kind: kindById.get(p.paymentMethodId) || p.methodKind,
      })),
      walkIn,
      hasCustomer: Boolean(customerId) && !walkIn,
      allowCreditDue: !walkIn && Boolean(customerId),
      useInstallment,
      isAdvance,
      allowRemaining: (!walkIn && Boolean(customerId)) || useInstallment,
    });
    if (!prep.ok) {
      setPaymentConfirmation("failure");
      setPaymentConfirmationError(
        humanizeCartError(prep.errors[0] ?? "Payment is invalid. Check amounts and try again."),
      );
      return;
    }

    const allowCredit = !walkIn && Boolean(customerId);
    const validation = validatePosCheckout({
      cart,
      totals,
      branchId,
      warehouseId,
      walkIn,
      customerId,
      paidTotal: prep.paidTowardBill,
      allowCreditDue: allowCredit,
    });
    if (!validation.ok) {
      setPaymentConfirmation("failure");
      setPaymentConfirmationError(
        humanizeCartError(validation.errors[0] ?? "Checkout is invalid. Review the cart and try again."),
      );
      return;
    }
    if (!walkIn && creditCustomer && prep.remaining > 0) {
      const credit = evaluatePosCustomerCredit({
        customer: creditCustomer,
        additionalCredit: String(prep.remaining),
      });
      if (creditCustomer.isBlocked) {
        setPaymentConfirmation("failure");
        setPaymentConfirmationError("This customer is blocked and cannot buy on credit.");
        return;
      }
      if (credit.requiresApproval && !hasPermission("credit.approve")) {
        setPaymentConfirmation("failure");
        setPaymentConfirmationError(
          credit.reason ??
            "Credit approval is required before this sale can be completed.",
        );
        return;
      }
    }

    const paymentLines = prep.splits.map((s) => ({
      paymentMethodId: s.paymentMethodId,
      amount: Number(s.amount),
      reference: s.reference,
      methodKind: s.kind,
      amountReceived: s.kind === "cash" && cashReceived ? Number(cashReceived) : undefined,
    }));

    try {
      paymentGateRef.current.begin(idempotencyKey);
    } catch (err) {
      const message = toPosUserDescription(
        err,
        "This payment is already being processed. Please wait.",
      );
      setPaymentConfirmation("failure");
      setPaymentConfirmationError(message);
      return;
    }

    setPaymentConfirmation("pending");
      const result = await posApi.postSale({
        branchId: branchId!,
        warehouseId,
        customerId: walkIn ? undefined : customerId || undefined,
        salesmanUserId: salesmanUserId || undefined,
        referenceId: referenceId || undefined,
        commissionPercent: salesmanUserId ? commissionPercent : 0,
        notes: [notes, delivery ? "Delivery required" : ""].filter(Boolean).join(" · ") || undefined,
        posMode: mode,
        localeMode: locale,
        items: saleItems,
        payments: paymentLines,
        isAdvancePayment: isAdvance || undefined,
        priceLevel,
        discountTotal: Number(invoiceDiscount || 0),
        invoiceDiscountKind,
        couponCode: appliedCouponCode || undefined,
        discounts:
          Number(invoiceDiscount || 0) > 0
            ? [
                {
                  scope: "invoice",
                  kind: appliedCouponCode ? ("coupon" as const) : invoiceDiscountKind,
                  percent:
                    invoiceDiscountKind === "percentage" ? invoiceDiscountPercent : undefined,
                  amount: Number(invoiceDiscount),
                  approverRole: actingDiscountRole,
                  reason: appliedCouponCode
                    ? `Coupon ${appliedCouponCode}`
                    : approvalReason || "POS invoice discount",
                },
              ]
            : [],
        createInstallment:
          canInstallment && useInstallment && customerId && !walkIn
            ? {
                downPayment: downPayment || "0",
                installmentCount: Number(installmentCount || 1),
                startDate: new Date().toISOString().slice(0, 10),
                frequency: installmentFrequency,
                lateFeePercent: Number(lateFeePercent) || 0,
                lateFeeFixed: lateFeeFixed || "0",
              }
            : undefined,
        idempotencyKey,
        operationId: idempotencyKey,
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
              description: toPosUserDescription(err, "Create the delivery note manually from Deliveries."),
              tone: "danger",
            });
          }
        }
      }

      paymentGateRef.current.succeed(idempotencyKey);
      setPaymentConfirmation("success");
      setMobileSheet(null);
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
        title: "Payment accepted",
        description: `${result.invoiceNumber} · paid ${result.paidTotal} · due ${result.remainingTotal}${
          prep.change > 0 ? ` · change ${prep.change}` : ""
        }`,
        tone: "success",
      });
    } catch (err) {
      const failed = formatPosFailure(err, "payment");
      paymentGateRef.current.fail(idempotencyKey, failed.description);
      setPaymentConfirmation("failure");
      setPaymentConfirmationError(failed.description);
      const nextKey = resolveCheckoutIdempotencyKey({ currentKey: idempotencyKey, event: "failed" });
      if ("rotate" in nextKey) setCheckoutIdempotencyKey(uuid());
    } finally {
      payingRef.current = false;
      setBusy(false);
    }
  }

  async function holdBill() {
    if (!canHold) {
      toast.push({
        title: "Hold not available",
        description: "This cashier needs pos.hold permission to hold a sale.",
        tone: "danger",
      });
      return;
    }
    if (!cart.length) {
      toast.push({
        title: "Nothing to hold",
        description: "Add at least one product before holding this sale.",
        tone: "info",
      });
      return;
    }
    if (!warehouseId) {
      toast.push({
        title: "Select a warehouse",
        description: "A warehouse is required before holding this sale.",
        tone: "info",
      });
      return;
    }
    if (!branchId) {
      toast.push({
        title: "No branch selected",
        description: "Choose a branch before holding this sale.",
        tone: "info",
      });
      return;
    }
    if (busy || payingRef.current) return;
    if (!requireOnlineForPos(online, toast.push)) return;
    setBusy(true);
    try {
      const cartSnapshot = buildHoldSnapshot({
        cart,
        customerId: walkIn ? "" : customerId,
        customerName: walkIn ? null : customer?.name ?? null,
        walkIn,
        invoiceDiscount,
        invoiceDiscountKind,
        invoiceDiscountPercent,
        locale,
        mode,
        payments,
        cashReceived,
        notes: holdNotes || notes,
        delivery,
        priceLevel,
        salesmanUserId,
        commissionPercent,
        referenceId,
        useInstallment,
        installmentCount,
        downPayment,
        installmentFrequency,
        lateFeePercent,
        lateFeeFixed,
        isAdvance,
        totals: {
          items: totals.items,
          qty: totals.qty,
          subtotal: totals.subtotal,
          itemDiscount: totals.itemDiscount ?? 0,
          invoiceDiscount: totals.invoiceDiscount ?? 0,
          discount: totals.discount,
          tax: totals.tax,
          grand: totals.grand,
          taxableAmount: totals.taxInvoice?.taxableAmount ?? totals.subtotal,
        },
      });
      await posApi.hold({
        branchId,
        warehouseId,
        holdLabel: `Hold ${new Date().toLocaleTimeString()}`,
        holdReason: holdReason || undefined,
        notes: holdNotes || notes || undefined,
        customerId: walkIn ? undefined : customerId || undefined,
        cartSnapshot,
      });
      clearSale();
      setHoldReason("");
      setHoldNotes("");
      toast.push({ title: "Bill held", tone: "success" });
      await refreshHolds();
      setShowHolds(true);
    } catch (err) {
      const failed = formatPosFailure(err, "hold");
      toast.push({
        title: failed.title,
        description: failed.description,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  function applyHoldSnapshot(snap: Record<string, unknown>) {
    // Always replace cart — never concat — to avoid duplicate lines on resume.
    const restored = restoreHoldTransaction(snap);
    replaceCart(restored.cart as CartLine[]);
    setInvoiceDiscount(restored.invoiceDiscount);
    setInvoiceDiscountKind(restored.invoiceDiscountKind);
    setInvoiceDiscountPercent(restored.invoiceDiscountPercent);
    setNotes(restored.notes);
    setWalkIn(restored.walkIn);
    if (restored.customerId && !restored.walkIn) {
      void selectCustomer(restored.customerId);
    } else {
      selectWalkIn();
    }
    setPayments(restored.payments as PaySplit[]);
    setCashReceived(restored.cashReceived);
    setPriceLevel(restored.priceLevel as PriceLevel);
    setSalesmanUserId(restored.salesmanUserId);
    setCommissionPercent(restored.commissionPercent);
    setReferenceId(restored.referenceId);
    setDelivery(restored.delivery);
    setLocale(restored.locale as LocaleMode);
    setMode(restored.mode as PosMode);
    setUseInstallment(restored.useInstallment);
    setInstallmentCount(restored.installmentCount);
    setDownPayment(restored.downPayment);
    setInstallmentFrequency(restored.installmentFrequency as InstallmentFrequency);
    setLateFeePercent(restored.lateFeePercent);
    setLateFeeFixed(restored.lateFeeFixed);
    setIsAdvance(restored.isAdvance);
  }

  useEffect(() => {
    const nav = (locationState ?? null) as PosHoldNavigationState | null;
    if (!nav) return;
    const hasHold = Boolean(nav.resumeSnapshot || nav.openHolds);
    const hasAssignment = Boolean(nav.salesmanUserId || nav.referenceId);
    if (!hasHold && !hasAssignment) return;
    if (nav.openHolds) setShowHolds(true);
    if (nav.salesmanUserId) {
      setSalesmanUserId(nav.salesmanUserId);
      if (typeof nav.commissionPercent === "number") setCommissionPercent(nav.commissionPercent);
    }
    if (nav.referenceId) setReferenceId(nav.referenceId);
    if (nav.resumeSnapshot) {
      try {
        applyHoldSnapshot(nav.resumeSnapshot);
        if (nav.checkout) {
          window.setTimeout(() => void checkout(), 0);
        }
      } catch (err) {
        toast.push({
          title: "Could not restore held cart",
          description: toPosUserDescription(err, "Resume the hold again from Hold / Resume."),
          tone: "danger",
        });
      }
    }
    navigate(".", { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resume(id: string, andCheckout = false) {
    if (!requireOnlineForPos(online, toast.push)) return;
    if (busy || payingRef.current) return;
    setBusy(true);
    try {
      const held = await posApi.resumeHold(id, andCheckout);
      const snap =
        (held as { cartSnapshot?: Record<string, unknown>; cart_snapshot?: Record<string, unknown> })
          .cartSnapshot ??
        (held as { cart_snapshot?: Record<string, unknown> }).cart_snapshot;
      if (snap) applyHoldSnapshot(snap);
      toast.push({
        title: andCheckout ? "Bill resumed — complete payment" : "Bill resumed",
        tone: "success",
      });
      await refreshHolds();
      setShowHolds(false);
      if (andCheckout) {
        // Defer checkout so cart state from replaceCart is committed.
        setTimeout(() => void checkout(), 0);
      }
    } catch (err) {
      const failed = formatPosFailure(err, "hold");
      toast.push({
        title: failed.title,
        description: failed.description,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function editHold(id: string) {
    const hold = holds.find((h) => h.id === id);
    if (!hold) return;
    const snap =
      (hold.cartSnapshot as Record<string, unknown> | undefined) ??
      (hold as { cart_snapshot?: Record<string, unknown> }).cart_snapshot;
    if (!snap) {
      toast.push({
        title: "Hold has no cart",
        description: "This hold cannot be edited because its snapshot is missing.",
        tone: "danger",
      });
      return;
    }
    try {
      // Rebuild snapshot from the hold's stored cart — never from live React cart state
      // (applyHoldSnapshot is async setState and would overwrite with stale lines).
      const restored = restoreHoldTransaction(snap);
      const reason = window.prompt("Hold reason", hold.holdReason ?? "") ?? hold.holdReason ?? "";
      const note = window.prompt("Hold notes", hold.notes ?? "") ?? hold.notes ?? "";
      await posApi.editHold(id, {
        holdReason: reason || undefined,
        notes: note || undefined,
        cartSnapshot: buildHoldSnapshot({
          cart: restored.cart as CartLine[],
          customerId: restored.walkIn ? "" : restored.customerId,
          customerName: restored.walkIn ? null : restored.customerName,
          walkIn: restored.walkIn,
          invoiceDiscount: restored.invoiceDiscount,
          invoiceDiscountKind: restored.invoiceDiscountKind,
          invoiceDiscountPercent: restored.invoiceDiscountPercent,
          notes: note || restored.notes,
          payments: restored.payments as PaySplit[],
          cashReceived: restored.cashReceived,
          delivery: restored.delivery,
          priceLevel: restored.priceLevel,
          salesmanUserId: restored.salesmanUserId,
          commissionPercent: restored.commissionPercent,
          referenceId: restored.referenceId,
          locale: restored.locale,
          mode: restored.mode,
          useInstallment: restored.useInstallment,
          installmentCount: restored.installmentCount,
          downPayment: restored.downPayment,
          installmentFrequency: restored.installmentFrequency,
          lateFeePercent: restored.lateFeePercent,
          lateFeeFixed: restored.lateFeeFixed,
          isAdvance: restored.isAdvance,
          totals: restored.totals,
        }),
        customerId: restored.walkIn ? null : restored.customerId || null,
      });
      toast.push({ title: "Hold updated", tone: "success" });
      await refreshHolds();
    } catch (err) {
      toast.push({
        title: "Edit failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
    }
  }

  async function duplicateHold(id: string) {
    if (!warehouseId) return;
    try {
      await posApi.duplicateHold(id, { warehouseId });
      toast.push({ title: "Hold duplicated", tone: "success" });
      await refreshHolds();
    } catch (err) {
      toast.push({
        title: "Duplicate failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
    }
  }

  async function transferHold(id: string) {
    const toUserId = window.prompt("Transfer to user profile id");
    if (!toUserId) return;
    try {
      await posApi.transferHold(id, { toUserId });
      toast.push({ title: "Hold transferred", tone: "success" });
      await refreshHolds();
    } catch (err) {
      toast.push({
        title: "Transfer failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
    }
  }

  async function cancelHold(id: string) {
    try {
      await posApi.cancelHold(id, "Cancelled from POS");
      toast.push({ title: "Hold cancelled", tone: "success" });
      await refreshHolds();
    } catch (err) {
      toast.push({
        title: "Cancel failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
    }
  }

  async function discardHold(id: string) {
    try {
      await posApi.discardHold(id);
      toast.push({ title: "Hold discarded", tone: "success" });
      await refreshHolds();
    } catch (err) {
      toast.push({
        title: "Discard failed",
        description: toPosUserDescription(err, "Please try again."),
        tone: "danger",
      });
    }
  }

  function barcodeScanHint() {
    searchRef.current?.focus();
    toast.push({
      title: "Barcode scanner ready",
      description: "USB keyboard-wedge scanners type into search automatically when not in another field",
      tone: "info",
    });
  }

  async function scanQrFromCamera() {
    try {
      const result = await cameraScanner.requestScan();
      if (result.ok && result.data?.code) {
        setQ(result.data.code);
        toast.push({
          title: "QR / camera code captured",
          description: result.data.code,
          tone: "success",
        });
        return;
      }
      toast.push({
        title: "QR scanner not ready",
        description: result.error ?? "Wire MediaDevices capture on this host (integration point)",
        tone: "info",
      });
    } catch (err) {
      toast.push({
        title: "QR scanner not ready",
        description:
          err instanceof Error
            ? err.message
            : "Wire MediaDevices capture on this host (integration point)",
        tone: "info",
      });
    }
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
        description: toPosUserDescription(
          err,
          hw.error ?? "Use product search or scan a barcode instead.",
        ),
        tone: "info",
      });
    }
  }

  function handlePosFunctionShortcut(action: PosShortcutAction) {
    switch (action) {
      case "new-sale":
        requestCancelSale();
        searchRef.current?.focus();
        return;
      case "hold-resume":
        if (showHolds) setShowHolds(false);
        else if (cart.length > 0 && canHold) void holdBill();
        else if (canHold) setShowHolds(true);
        return;
      case "customers":
        setWalkIn(false);
        if (layoutMode === "mobile") setMobileSheet("customer");
        schedulePosFocus(() => customerRef.current);
        return;
      case "price-override":
        if (layoutMode === "mobile") setMobileSheet("cart");
        requestPriceOverride();
        return;
      case "discount":
        if (layoutMode === "mobile") setMobileSheet("cart");
        schedulePosFocus(() => discountRef.current);
        return;
      case "recalculate":
        recalculateTotals();
        return;
      case "clear-cart":
        requestClearCart();
        return;
      case "cancel-sale":
        requestCancelSale();
        return;
    }
  }

  function handlePosShortcut(e: KeyboardEvent) {
    if (isReservedBrowserChord(e)) return;
    const typing = isTypingTarget(e.target);
    const overlay = isPosOverlayOpen();

    if (e.key === "Escape") {
      if (overlay || typing) return;
      if (receipt) {
        e.preventDefault();
        setReceipt(null);
        searchRef.current?.focus();
        return;
      }
      if (showHolds) {
        e.preventDefault();
        setShowHolds(false);
        searchRef.current?.focus();
        return;
      }
      if (mobileSheet) {
        e.preventDefault();
        setMobileSheet(null);
        searchRef.current?.focus();
        return;
      }
      searchRef.current?.focus();
      return;
    }

    if (overlay) return;

    if (e.key === "Enter" && !typing && !isActionTarget(e.target)) {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }

    if (!typing && cart.length) {
      const last = cart[cart.length - 1];
      if (last && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        increaseQty(last.key);
        return;
      }
      if (last && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        decreaseQty(last.key);
        return;
      }
    }
    if (isProductSearchFocusKey(e)) {
      e.preventDefault();
      const input = searchRef.current;
      if (!input) return;
      input.focus();
      appendCharToSearchInput(input, e.key);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => pageOpsRef.current.shortcut(e);
    const onFunction = (event: Event) => {
      event.preventDefault();
      pageOpsRef.current.functionShortcut((event as CustomEvent<PosShortcutAction>).detail);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(POS_SHORTCUT_EVENT, onFunction);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(POS_SHORTCUT_EVENT, onFunction);
    };
  }, []);

  useEffect(() => {
    if (layoutMode !== "mobile") setMobileSheet(null);
  }, [layoutMode]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!saleHasUnsavedWork(cart.length)) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [cart.length]);

  useEffect(() => {
    return posHardware.subscribeScanner((event) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      const cmd = parseProductSearchCommand(event.code);
      const needle = cmd.kind === "search" ? cmd.query : event.code;
      const started = ++productSearchSeq.current;
      void searchPosProducts({
          q: needle,
          warehouseId: warehouseIdRef.current || undefined,
          customerId: walkInRef.current ? undefined : customerIdRef.current || undefined,
        })
        .then((items) => {
          if (!isLatestRequest(productSearchSeq.current, started)) return;
          setResults(items);
          const match =
            pickExactProductMatch(items, needle) ??
            (items.length === 1 ? items[0] : null);
          if (match) {
            addProductRef.current(match, cmd.kind === "search" ? cmd.qty ?? undefined : undefined);
            setCatalogFeedback(null);
          } else {
            setCatalogFeedback({
              tone: "info",
              title: "No products found for this search.",
              description: `Nothing matched “${needle}”. Try another barcode or SKU.`,
            });
          }
          setQ("");
          searchRef.current?.focus();
        })
        .catch((err) => {
          if (!isLatestRequest(productSearchSeq.current, started)) return;
          const failed = formatPosFailure(err, "search");
          setCatalogFeedback({
            tone: "danger",
            title: failed.title,
            description: failed.description,
          });
        })
        .finally(() => {
          scanLockRef.current = false;
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (payments.length === 1 && totals.grand > 0 && !payments[0].amount) {
      setPayments([{ ...payments[0], amount: String(totals.grand) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.grand]);

  const salesmanOptions = useMemo(
    () =>
      salesmen.map((s) => ({
        id: s.id,
        name: `${s.name}${s.code ? ` · ${s.code}` : ""} (${s.commissionPercent}%)`,
      })),
    [salesmen],
  );
  const creditHint = useMemo(() => {
    if (!customer || walkIn) return null;
    const prep = preparePosPayments({
      grandTotal: totals.grand,
      lines: payments.map((p) => ({
        paymentMethodId: p.paymentMethodId,
        amount: p.amount,
        amountReceived: p.amountReceived,
        kind: p.methodKind,
      })),
      walkIn: false,
      hasCustomer: true,
      allowCreditDue: true,
      allowRemaining: true,
    });
    const due = prep.remaining;
    if (due <= 0) return null;
    const credit = evaluatePosCustomerCredit({
      customer,
      additionalCredit: String(due),
    });
    if (customer.isBlocked) return "Customer is blocked — credit sales not allowed";
    if (credit.requiresApproval) {
      return `Credit limit exceeded (projected ${credit.projectedOutstanding}) — approval required`;
    }
    if (credit.isOverdue) return "Customer has overdue balance";
    return `Credit available · due date ${credit.dueDate ?? "—"}`;
  }, [customer, walkIn, payments, totals.grand]);
  const canWriteCustomers = hasPermission("customers.write");
  const canLoadCustomerHistory =
    hasPermission("customers.read") || hasPermission("ledgers.view");

  const quoteMapped = useMemo(() => cartToQuotationItems(cart), [cart]);
  const canQuote =
    hasPermission("quotations.write") && Boolean(branchId) && quoteMapped.ok;
  const quoteReason = !hasPermission("quotations.write")
    ? "Requires quotations.write permission"
    : !branchId
      ? "No branch selected"
      : quoteMapped.ok
        ? "Save this cart as a quotation"
        : quoteMapped.error;
  const canPayNow = Boolean(branchId && warehouseId && cart.length);
  const payBlockedReason = !branchId
    ? "No branch selected — choose a branch to continue"
    : !warehouseId
      ? "Select a warehouse before paying"
      : !cart.length
        ? "Add at least one product before paying"
        : null;
  const saleMeta = useMemo(
    () => (
      <PosSaleMeta
        warehouseId={warehouseId}
        warehouses={warehouses}
        lastInvoice={lastInvoice}
        mode={mode}
        locale={locale}
        onWarehouse={setWarehouseId}
        onMode={setMode}
        onLocale={setLocale}
      />
    ),
    [warehouseId, warehouses, lastInvoice, mode, locale],
  );

  productHandlersRef.current.commit = (raw, highlighted) => {
    void commitProductSearch(raw, highlighted);
  };
  productHandlersRef.current.camera = () => {
    void recognizeCamera();
  };
  productHandlersRef.current.qr = () => {
    void scanQrFromCamera();
  };
  productHandlersRef.current.barcode = barcodeScanHint;
  productHandlersRef.current.manual = addManualQuick;
  pageOpsRef.current.cartPrice = (key, unitPrice) => {
    if (!canPriceOverride) {
      setPendingDiscount({ kind: "price", key, unitPrice });
      setApprovalReason("Price override requested");
      setApprovalOpen(true);
      return;
    }
    const line = cart.find((c) => c.key === key);
    const catalog = line?.retailPrice ?? line?.unitPrice ?? unitPrice;
    const warn = priceOverrideWarning(Number(catalog), unitPrice);
    if (warn) {
      toast.push({ title: "Price override", description: warn, tone: "info" });
    }
    setPrice(key, unitPrice, true);
  };
  pageOpsRef.current.cartDiscount = (key, raw) => requestLineDiscount(key, raw);
  pageOpsRef.current.cartRemove = (key) => setConfirmAction({ kind: "remove-line", key });
  pageOpsRef.current.cartClear = requestClearCart;
  pageOpsRef.current.invoiceDiscount = requestInvoiceDiscount;
  pageOpsRef.current.cancelSale = requestCancelSale;
  pageOpsRef.current.hold = () => {
    void holdBill();
  };
  pageOpsRef.current.pay = () => {
    void checkout();
  };
  pageOpsRef.current.quotation = () => {
    void createQuotationFromCart();
  };
  pageOpsRef.current.retryPay = () => {
    setPaymentConfirmation("retry");
    setPaymentConfirmationError(null);
    paymentGateRef.current.retry(checkoutIdempotencyKey);
    const nextKey = resolveCheckoutIdempotencyKey({
      currentKey: checkoutIdempotencyKey,
      event: "retry",
    });
    if ("rotate" in nextKey) setCheckoutIdempotencyKey(uuid());
  };
  pageOpsRef.current.selectCustomer = (id) => {
    void selectCustomer(id);
  };
  pageOpsRef.current.walkIn = () => {
    selectWalkIn();
    setCustomerQuery("");
  };
  pageOpsRef.current.salesman = (id) => {
    setSalesmanUserId(id);
    const match = salesmen.find((s) => s.id === id);
    setCommissionPercent(match?.commissionPercent ?? 0);
  };
  pageOpsRef.current.loadHistory = (id) =>
    posCustomerRepository.history({
      id,
      canRead: hasPermission("customers.read") || hasPermission("ledgers.view"),
    });
  pageOpsRef.current.createCustomer = (input) => createCustomerFromPos(input);
  pageOpsRef.current.updateCustomer = (id, input) => updateCustomerFromPos(id, input);
  pageOpsRef.current.shortcut = handlePosShortcut;
  pageOpsRef.current.functionShortcut = handlePosFunctionShortcut;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden" dir={locale === "ur" ? "rtl" : "ltr"}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!online ? (
            <div
              role="alert"
              className="mx-3 mt-3 shrink-0 rounded-[var(--pos-radius)] border border-[var(--pos-danger)] bg-[var(--pos-danger-soft,rgba(220,38,38,0.08))] px-3 py-2 text-sm text-[var(--pos-danger)]"
            >
              <strong>{INTERNET_REQUIRED_TITLE}</strong>
              <span className="mt-0.5 block opacity-90">{INTERNET_REQUIRED_MESSAGE}</span>
            </div>
          ) : null}
          <PosSaleLayout
            chrome={chrome}
            cartCount={cart.length}
            grandTotal={totals.grand}
            customerLabel={walkIn ? "Walk-in" : customer?.name || "Customer"}
            canPay={canPayNow}
            payBlockedReason={payBlockedReason}
            mobileSheet={mobileSheet}
            onMobileSheet={setMobileSheet}
            onCancelSale={onCancelSale}
            product={
            <PosProductPanel
                query={q}
                onQueryChange={setProductQuery}
                searching={searching}
                products={results}
                favorites={favorites}
                recent={recent}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={selectCategory}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                tab={tab}
                onTabChange={setTab}
                locale={locale}
                priceLevel={priceLevel}
                onAdd={addProduct}
                onCommitSearch={onCommitSearch}
                searchRef={searchRef}
                onCamera={onCamera}
                onBarcodeScanHint={onBarcodeScanHint}
                onQrScan={onQrScan}
                onManualEntry={onManualEntry}
                hasMore={
                  q.trim()
                    ? results.length >= searchLimit && nextProductSearchLimit(searchLimit) > searchLimit
                    : tab === "categories" && Boolean(selectedCategoryId) && catalogHasMore
                }
                onLoadMore={onLoadMoreProducts}
                meta={saleMeta}
                catalogFeedback={catalogFeedback}
              />
            }
            customer={
              <PosCustomerPanel
                customer={customer}
                walkIn={walkIn}
                customers={customerHits}
                customerQuery={customerQuery}
                onCustomerQuery={setCustomerQuery}
                onSelectCustomer={onSelectCustomer}
                onWalkIn={onCustomerWalkIn}
                onCreateCustomer={canWriteCustomers ? onCreateCustomer : undefined}
                onUpdateCustomer={canWriteCustomers ? onUpdateCustomer : undefined}
                onLoadHistory={canLoadCustomerHistory ? onLoadCustomerHistory : undefined}
                creatingCustomer={creatingCustomer}
                canCreate={canWriteCustomers}
                canEdit={canWriteCustomers}
                canRead={hasPermission("customers.read")}
                priceLevel={priceLevel}
                onPriceLevel={setPriceLevel}
                salesmanId={salesmanUserId}
                salesmen={salesmanOptions}
                onSalesman={onSalesmanChange}
                referenceId={referenceId}
                references={references}
                onReference={setReferenceId}
                delivery={delivery}
                onDelivery={setDelivery}
                customerRef={customerRef}
                advanced={advanced}
                creditHint={creditHint}
                searchError={customerSearchError}
              />
            }
            cart={
              <PosCart
                cart={cart}
                locale={locale}
                onQty={setQty}
                onIncrease={increaseQty}
                onDecrease={decreaseQty}
                onPrice={onCartPrice}
                onDiscount={onCartDiscount}
                onUnitChange={changeUnit}
                onRemove={onCartRemove}
                onClear={onCartClear}
                canDiscount={canDiscount}
                canPriceOverride={canPriceOverride}
                cartError={lastCartError}
                invoiceDiscount={invoiceDiscount}
                onInvoiceDiscount={onInvoiceDiscount}
                discountRef={discountRef}
                canInvoiceDiscount={canDiscount}
              />
            }
            payment={
              <PosPaymentPanel
                totals={totals}
                invoiceDiscount={invoiceDiscount}
                onInvoiceDiscount={onInvoiceDiscount}
                canInvoiceDiscount={canDiscount}
                discountRef={discountRef}
                methods={methods}
                payments={payments}
                onPayments={setPayments}
                notes={notes}
                onNotes={setNotes}
                busy={busy}
                canPay={canPayNow}
                payBlockedReason={payBlockedReason}
                allowCreditDue={!walkIn && Boolean(customerId)}
                canHold={canHold}
                canInstallment={canInstallment}
                onHold={onHoldSale}
                onPay={onPaySale}
                onQuotation={onQuotation}
                canQuote={canQuote}
                quoteReason={quoteReason}
                quoting={quoting}
                onRetry={onRetryPayment}
                advanced={advanced}
                useInstallment={useInstallment}
                onUseInstallment={setUseInstallment}
                installmentCount={installmentCount}
                onInstallmentCount={setInstallmentCount}
                downPayment={downPayment}
                onDownPayment={setDownPayment}
                installmentFrequency={installmentFrequency}
                onInstallmentFrequency={setInstallmentFrequency}
                lateFeePercent={lateFeePercent}
                onLateFeePercent={setLateFeePercent}
                lateFeeFixed={lateFeeFixed}
                onLateFeeFixed={setLateFeeFixed}
                isAdvance={isAdvance}
                onIsAdvance={setIsAdvance}
                cashReceived={cashReceived}
                onCashReceived={setCashReceived}
                confirmation={paymentConfirmation}
                confirmationError={paymentConfirmationError}
                customer={customer}
                walkIn={walkIn}
                invoiceReference={lastInvoice}
                couponCode={couponCode}
                onCouponCode={(code) => {
                  setCouponCode(code);
                  setAppliedCouponCode(null);
                  setCouponHint(null);
                }}
                onApplyCoupon={() => void onApplyCoupon()}
                couponBusy={couponBusy}
                couponHint={couponHint}
              />
            }
          />
          {receipt ? (
            <div className="max-h-56 shrink-0 overflow-auto px-3 pb-2">
              <ReceiptPreview
                invoice={receipt}
                format={receiptFormat}
                onFormatChange={setReceiptFormat}
                onClose={() => setReceipt(null)}
              />
            </div>
          ) : null}
        </div>

      <POSDrawer open={showHolds} title="Held sales" onClose={() => setShowHolds(false)} side="right">
        <PosHoldsPanel
          holds={holds}
          filter={holdsFilter}
          onFilterChange={setHoldsFilter}
          holdReason={holdReason}
          onHoldReasonChange={setHoldReason}
          holdNotes={holdNotes}
          onHoldNotesChange={setHoldNotes}
          busy={busy}
          canCreateHold={Boolean(branchId && warehouseId && cart.length)}
          onCreateHold={() => void holdBill()}
          onResume={(id) => void resume(id, false)}
          onResumeCheckout={(id) => void resume(id, true)}
          onEdit={(id) => void editHold(id)}
          onDuplicate={(id) => void duplicateHold(id)}
          onTransfer={(id) => void transferHold(id)}
          onCancel={(id) => void cancelHold(id)}
          onDiscard={(id) => void discardHold(id)}
        />
      </POSDrawer>

      <PosApprovalDialog
        open={approvalOpen}
        title="Discount / price approval required"
        description={
          pendingDiscount && pendingDiscount.kind !== "price"
            ? `${pendingDiscount.kind === "invoice" ? "Invoice" : "Line"} discount ${pendingDiscount.percent}% requires ${pendingDiscount.requiredRole} approval (your role: ${actingDiscountRole}, max ${formatDiscountCap(pendingDiscount.maxAllowed)}). The discount has not been applied.`
            : "Manual price override requires manager/owner/special discount permission. It has not been enabled."
        }
        reason={approvalReason}
        onReasonChange={setApprovalReason}
        canApprove={
          pendingDiscount != null && pendingDiscount.kind !== "price"
            ? evaluateDiscountApproval({
                discountAmount: pendingDiscount.amount,
                baseAmount: pendingDiscount.base,
                actingRole: actingDiscountRole,
              }).allowed
            : canPriceOverride
        }
        canRequestApproval={hasPermission("approvals.act")}
        requestBusy={approvalBusy}
        onCancel={() => {
          setApprovalOpen(false);
          setPendingDiscount(null);
        }}
        onRequestApproval={() => void submitDiscountApproval()}
        onApprove={() => {
          if (!pendingDiscount) return;
          if (pendingDiscount.kind === "price") {
            if (!canPriceOverride) return;
            if (pendingDiscount.key && pendingDiscount.unitPrice != null) {
              const line = cart.find((c) => c.key === pendingDiscount.key);
              const catalog = line?.retailPrice ?? line?.unitPrice ?? pendingDiscount.unitPrice;
              const warn = priceOverrideWarning(Number(catalog), pendingDiscount.unitPrice);
              if (warn) {
                toast.push({ title: "Price override", description: warn, tone: "info" });
              }
              setPrice(pendingDiscount.key, pendingDiscount.unitPrice, true);
            } else {
              setAllowManualOverride(true);
            }
          } else {
            const decision = evaluateDiscountApproval({
              discountAmount: pendingDiscount.amount,
              baseAmount: pendingDiscount.base,
              actingRole: actingDiscountRole,
            });
            if (!decision.allowed) return;
            if (pendingDiscount.kind === "invoice") {
              setInvoiceDiscount(String(pendingDiscount.amount));
            } else if (pendingDiscount.key) {
              setLineDiscountInput(pendingDiscount.key, pendingDiscount.raw);
            }
          }
          setApprovalOpen(false);
          setPendingDiscount(null);
          setApprovalReason("");
        }}
      />

      <POSConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction?.kind === "clear-cart"
            ? "Clear cart?"
            : confirmAction?.kind === "cancel-sale"
              ? "Cancel this sale?"
              : "Remove item?"
        }
        description={
          confirmAction?.kind === "clear-cart"
            ? "All products will be removed from this cart."
            : confirmAction?.kind === "cancel-sale"
              ? "The cart, discounts, and payments on this sale will be cleared."
              : "This product will be removed from the cart."
        }
        confirmLabel={
          confirmAction?.kind === "clear-cart"
            ? "Clear cart"
            : confirmAction?.kind === "cancel-sale"
              ? "Cancel sale"
              : "Remove"
        }
        danger
        onConfirm={applyConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
