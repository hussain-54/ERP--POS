import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import {
  approverRoleFromPermissions,
  buildHoldSnapshot,
  cartLinesForResume,
  evaluateDiscountApproval,
  evaluatePosCustomerCredit,
  pickExactProductMatch,
  preparePosPayments,
  PaymentAttemptGate,
  validatePosCheckout,
  type InstallmentFrequency,
  type PosPaymentConfirmationStatus,
} from "@electronic-erp/domain";
import type { HeldSaleFilter } from "@electronic-erp/contracts";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
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
import { usePosLayoutMode } from "./usePosLayoutMode";
import type { PosMobileSheet } from "./pos-layout";
import { PosProductPanel } from "./components/PosProductPanel";
import { PosCustomerPanel, type PosCustomerFormInput } from "./components/PosCustomerPanel";
import { PosCart } from "./components/PosCart";
import { PosPaymentPanel } from "./components/PosPaymentPanel";
import { PosApprovalDialog } from "./components/PosApprovalDialog";
import { ReceiptPreview, type InvoicePreview } from "./components/ReceiptPreview";
import { PosHoldsPanel, type HeldSaleListItem } from "./components/PosHoldsPanel";
import { catalogApi } from "@/features/product-management/catalog-api";
import { afterSalesApi } from "@/features/quotations/after-sales-api";
import { usePosSession } from "./session/usePosSession";
import { posCustomerRepository } from "./session/pos-customer-repository";
import { partiesApi } from "@/features/customers/parties-api";
import { cartToQuotationItems } from "./pos-quotation";
import {
  appendUniqueProducts,
  isLatestRequest,
  mergeProductSearches,
  nextProductSearchLimit,
  POS_PRODUCT_PAGE_SIZE,
  POS_PRODUCT_SEARCH_LIMIT,
} from "./pos-catalog-load";
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
  stockAvailabilityWarning,
} from "./pos-ux";
import { posActionFlags } from "./pos-security";
import { type PosHoldNavigationState } from "./held-sales";
import type { CustomerSearchHit } from "@electronic-erp/contracts";
import {
  POSBadge,
  POSConfirmDialog,
  POSDrawer,
  POSSelect,
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
  formatOnlineFailure,
  INTERNET_REQUIRED_MESSAGE,
  INTERNET_REQUIRED_TITLE,
  requireInternetConnection,
} from "@/lib/online-required";

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
  const holdEntry = entry === "holds" || pathname === "/held-sales";
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
  const [categoryPage, setCategoryPage] = useState(1);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [quoting, setQuoting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    { kind: "clear-cart" } | { kind: "cancel-sale" } | { kind: "remove-line"; key: string } | null
  >(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<CustomerSearchHit[]>([]);
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
  const layoutMode = usePosLayoutMode();
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
    void partiesApi.seedPaymentMethods().then((r) => {
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
    void inventoryApi.listWarehouses().then((r) => {
      const items = r.items.map((w) => ({
        id: String(w.id),
        name: String(w.name ?? w.code ?? "Warehouse"),
      }));
      setWarehouses(items);
      if (items[0]) setWarehouseId(items[0].id);
    });
    void enterpriseApi
      .listEmployees()
      .then((r) => setSalesmen(mapSalesmanEmployees(r.items)))
      .catch(() => undefined);
    void enterpriseApi
      .listReferences()
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
  }, [tab, categories.length]);

  useEffect(() => {
    if (tab !== "categories" || q.trim()) return;
    let cancelled = false;
    void (async () => {
      setSearching(true);
      try {
        if (selectedCategoryId) {
          const res = await catalogApi.listProducts({
            categoryId: selectedCategoryId,
            page: categoryPage,
            pageSize: POS_PRODUCT_PAGE_SIZE,
          });
          if (cancelled) return;
          setCatalogHasMore(categoryPage * POS_PRODUCT_PAGE_SIZE < res.total);
          const names = res.items.map((p) => p.name);
          const found = await mergeProductSearches(
            names,
            async (name) => {
              const hit = await posApi.searchProducts({
                q: name,
                warehouseId: warehouseId || undefined,
                customerId: walkIn ? undefined : customerId || undefined,
                limit: 5,
              });
              return hit.items;
            },
            POS_PRODUCT_PAGE_SIZE,
          );
          if (!cancelled) {
            setResults((prev) => (categoryPage === 1 ? found : appendUniqueProducts(prev, found)));
          }
        } else if (!cancelled) {
          setCatalogHasMore(false);
          setResults(recent);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedCategoryId, categoryPage, warehouseId, customerId, walkIn, q]);

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
    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await posApi.searchProducts({
            q,
            warehouseId: warehouseId || undefined,
            customerId: walkIn ? undefined : customerId || undefined,
            limit: searchLimit,
          });
          if (!isLatestRequest(productSearchSeq.current, started)) return;
          setResults(res.items);
        } catch (err) {
          if (!isLatestRequest(productSearchSeq.current, started)) return;
          const failed = formatOnlineFailure(err, "generic");
          toast.push({
            title: failed.title,
            description: failed.description,
            tone: "danger",
          });
        } finally {
          if (isLatestRequest(productSearchSeq.current, started)) setSearching(false);
        }
      })();
    }, 50);
    return () => window.clearTimeout(handle);
  }, [q, warehouseId, customerId, walkIn, toast, online, tab, searchLimit]);

  useEffect(() => {
    if (walkIn || !customerQuery.trim() || !hasPermission("customers.read")) {
      setCustomerHits([]);
      return;
    }
    const orgId = organizationId ?? "";
    const started = ++customerSearchSeq.current;
    const handle = window.setTimeout(() => {
      if (!online) {
        setCustomerHits([]);
        return;
      }
      void posCustomerRepository
        .search({
          q: customerQuery,
          organizationId: orgId,
          canRead: hasPermission("customers.read"),
        })
        .then((hits) => {
          if (isLatestRequest(customerSearchSeq.current, started)) setCustomerHits(hits);
        })
        .catch(() => {
          if (isLatestRequest(customerSearchSeq.current, started)) setCustomerHits([]);
        });
    }, 80);
    return () => window.clearTimeout(handle);
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
      toast.push({
        title: "Cannot add product",
        description: result.error ?? "Check stock or quantity",
        tone: "danger",
      });
      return false;
    }
    rememberRecent(p);
    const warn = stockAvailabilityWarning(p.stockAvailable, qty ?? "1");
    if (warn) {
      toast.push({ title: warn, tone: "info" });
    }
    setQ("");
    queueMicrotask(() => searchRef.current?.focus());
    return true;
  }, [sessionAddProduct, rememberRecent, toast]);
  addProductRef.current = addProduct;

  const selectCategory = useCallback((id: string | null) => {
    setSelectedCategoryId(id);
    setCategoryPage(1);
    setTab("categories");
  }, []);
  const setProductQuery = useCallback((next: string) => {
    setSearchLimit(POS_PRODUCT_SEARCH_LIMIT);
    setQ(next);
  }, []);
  const onLoadMoreProducts = useCallback(() => {
    if (q.trim()) {
      setSearchLimit((current) => nextProductSearchLimit(current));
      return;
    }
    if (tab === "categories" && selectedCategoryId) {
      setCategoryPage((page) => page + 1);
    }
  }, [q, tab, selectedCategoryId]);
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
  const onHoldSale = useCallback(() => {
    pageOpsRef.current.hold();
  }, []);
  const onPaySale = useCallback(() => {
    pageOpsRef.current.pay();
  }, []);
  const onQuotation = useCallback(() => {
    pageOpsRef.current.quotation();
  }, []);
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
      toast.push({ title: "Search unavailable while offline", tone: "danger" });
      return;
    }
    setSearching(true);
    try {
      const res = await posApi.searchProducts({
        q: needle,
        warehouseId: warehouseId || undefined,
        customerId: walkIn ? undefined : customerId || undefined,
      });
      setResults(res.items);
      const match =
        pickExactProductMatch(res.items, needle) ??
        (res.items.length === 1 ? res.items[0] : null);
      if (!match) {
        toast.push({ title: "No catalog match", description: needle, tone: "info" });
        return;
      }
      addProduct(match, cmd.qty ?? undefined);
    } catch (err) {
      const failed = formatOnlineFailure(err, "generic");
      toast.push({ title: failed.title, description: failed.description, tone: "danger" });
    } finally {
      setSearching(false);
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
      queueMicrotask(() => focusLastCartRate());
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
        description: err instanceof Error ? err.message : "Could not create quotation",
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
    const base = Math.max(0, totals.subtotal - totals.itemDiscount);
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
        description: err instanceof Error ? err.message : "Could not apply discount",
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
    const base = Math.max(0, Number(line.qty) * Number(line.unitPrice));
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
        description: err instanceof Error ? err.message : "Could not apply discount",
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
        description: err instanceof Error ? err.message : "Could not create approval",
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
        description: err instanceof Error ? err.message : "Error",
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
        description: err instanceof Error ? err.message : "Error",
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
        description: err instanceof Error ? err.message : "Error",
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
        const message = err instanceof Error ? err.message : "Could not refresh customer";
        setPaymentConfirmation("failure");
        setPaymentConfirmationError(message);
        toast.push({ title: "Customer refresh failed", description: message, tone: "danger" });
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
      setPaymentConfirmationError(prep.errors[0] ?? "Payment invalid");
      toast.push({ title: prep.errors[0] ?? "Payment invalid", tone: "danger" });
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
      setPaymentConfirmationError(validation.errors[0] ?? "Checkout invalid");
      toast.push({ title: validation.errors[0] ?? "Checkout invalid", tone: "danger" });
      return;
    }
    if (!walkIn && creditCustomer && prep.remaining > 0) {
      const credit = evaluatePosCustomerCredit({
        customer: creditCustomer,
        additionalCredit: String(prep.remaining),
      });
      if (creditCustomer.isBlocked) {
        setPaymentConfirmation("failure");
        setPaymentConfirmationError("Customer is blocked");
        toast.push({ title: "Customer is blocked", tone: "danger" });
        return;
      }
      if (credit.requiresApproval && !hasPermission("credit.approve")) {
        setPaymentConfirmation("failure");
        setPaymentConfirmationError(credit.reason ?? "Credit approval required");
        toast.push({
          title: "Credit approval required",
          description: credit.reason ?? "Limit exceeded",
          tone: "danger",
        });
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
      const message = err instanceof Error ? err.message : "Duplicate payment blocked";
      toast.push({ title: "Duplicate sale blocked", description: message, tone: "danger" });
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
        discounts:
          Number(invoiceDiscount || 0) > 0
            ? [
                {
                  scope: "invoice",
                  kind: invoiceDiscountKind,
                  percent:
                    invoiceDiscountKind === "percentage" ? invoiceDiscountPercent : undefined,
                  amount: Number(invoiceDiscount),
                  approverRole: actingDiscountRole,
                  reason: approvalReason || "POS invoice discount",
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
              description: err instanceof Error ? err.message : "Create delivery manually",
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
      const failed = formatOnlineFailure(err, "payment");
      paymentGateRef.current.fail(idempotencyKey, failed.description);
      setPaymentConfirmation("failure");
      setPaymentConfirmationError(failed.description);
      setCheckoutIdempotencyKey(uuid());
      toast.push({
        title: failed.title,
        description: failed.description,
        tone: "danger",
      });
    } finally {
      payingRef.current = false;
      setBusy(false);
    }
  }

  async function holdBill() {
    if (!canHold) {
      toast.push({ title: "Hold requires pos.hold", tone: "danger" });
      return;
    }
    if (!branchId || !warehouseId || !cart.length) return;
    if (busy || payingRef.current) return;
    if (!requireOnlineForPos(online, toast.push)) return;
    setBusy(true);
    try {
      const cartSnapshot = buildHoldSnapshot({
        cart,
        customerId: walkIn ? "" : customerId,
        walkIn,
        invoiceDiscount,
        locale,
        mode,
        payments,
        notes: holdNotes || notes,
        delivery,
        priceLevel,
        salesmanUserId,
        referenceId,
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
      const failed = formatOnlineFailure(err, "hold");
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
    const lines = cartLinesForResume(snap) as CartLine[];
    replaceCart(lines);
    if (typeof snap.invoiceDiscount === "string") setInvoiceDiscount(snap.invoiceDiscount);
    if (typeof snap.notes === "string") setNotes(snap.notes);
    if (typeof snap.walkIn === "boolean") setWalkIn(snap.walkIn);
    if (typeof snap.customerId === "string" && snap.customerId) {
      void selectCustomer(snap.customerId);
    } else if (snap.walkIn) {
      selectWalkIn();
    }
    if (Array.isArray(snap.payments)) setPayments(snap.payments as PaySplit[]);
    if (typeof snap.priceLevel === "string") setPriceLevel(snap.priceLevel as PriceLevel);
    if (typeof snap.salesmanUserId === "string") setSalesmanUserId(snap.salesmanUserId);
    if (typeof snap.referenceId === "string") setReferenceId(snap.referenceId);
    if (typeof snap.delivery === "boolean") setDelivery(snap.delivery);
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
          description: err instanceof Error ? err.message : "Resume the hold again from Hold / Resume",
          tone: "danger",
        });
      }
    }
    navigate(".", { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resume(id: string, andCheckout = false) {
    if (!requireOnlineForPos(online, toast.push)) return;
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
      const failed = formatOnlineFailure(err, "hold");
      toast.push({
        title: failed.title,
        description: failed.description,
        tone: "danger",
      });
    }
  }

  async function editHold(id: string) {
    const hold = holds.find((h) => h.id === id);
    if (!hold) return;
    try {
      // Load snapshot into cart for editing, keep hold open until re-saved or cancelled.
      if (hold.cartSnapshot) applyHoldSnapshot(hold.cartSnapshot);
      else {
        const snap = (hold as { cart_snapshot?: Record<string, unknown> }).cart_snapshot;
        if (snap) applyHoldSnapshot(snap);
      }
      const reason = window.prompt("Hold reason", hold.holdReason ?? "") ?? hold.holdReason ?? "";
      const note = window.prompt("Hold notes", hold.notes ?? "") ?? hold.notes ?? "";
      await posApi.editHold(id, {
        holdReason: reason || undefined,
        notes: note || undefined,
        cartSnapshot: buildHoldSnapshot({
          cart,
          customerId: walkIn ? "" : customerId,
          walkIn,
          invoiceDiscount,
          notes: note || notes,
          payments,
          delivery,
          priceLevel,
          salesmanUserId,
        }),
        customerId: walkIn ? null : customerId || null,
      });
      toast.push({ title: "Hold updated", tone: "success" });
      await refreshHolds();
    } catch (err) {
      toast.push({
        title: "Edit failed",
        description: err instanceof Error ? err.message : "Error",
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
        description: err instanceof Error ? err.message : "Error",
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
        description: err instanceof Error ? err.message : "Error",
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
        description: err instanceof Error ? err.message : "Error",
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
        description: err instanceof Error ? err.message : "Error",
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
        description: err instanceof Error ? err.message : hw.error ?? "Fallback search",
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
        customerRef.current?.focus();
        return;
      case "price-override":
        requestPriceOverride();
        return;
      case "discount":
        if (layoutMode === "mobile") setMobileSheet("cart");
        discountRef.current?.focus();
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
      void posApi
        .searchProducts({
          q: needle,
          warehouseId: warehouseIdRef.current || undefined,
          customerId: walkInRef.current ? undefined : customerIdRef.current || undefined,
        })
        .then((res) => {
          setResults(res.items);
          const match = pickExactProductMatch(res.items, needle) ?? res.items[0];
          if (match) {
            addProductRef.current(match, cmd.kind === "search" ? cmd.qty ?? undefined : undefined);
          } else {
            toast.push({ title: "No catalog match", description: needle, tone: "info" });
          }
          setQ("");
          searchRef.current?.focus();
        })
        .catch((err) => {
          const failed = formatOnlineFailure(err, "generic");
          toast.push({ title: failed.title, description: failed.description, tone: "danger" });
        })
        .finally(() => {
          window.setTimeout(() => {
            scanLockRef.current = false;
          }, 80);
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
    const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const due = Math.max(0, totals.grand - paid);
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
  const payBlockedReason = !branchId
    ? "No branch selected"
    : !warehouseId
      ? "Select a warehouse"
      : !cart.length
        ? "Add products first"
        : null;

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
    setCheckoutIdempotencyKey(uuid());
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
            mode={layoutMode}
            cartCount={cart.length}
            grandTotal={totals.grand}
            customerLabel={walkIn ? "Walk-in" : customer?.name || "Customer"}
            canPay={Boolean(branchId && warehouseId && cart.length)}
            payBlockedReason={payBlockedReason}
            mobileSheet={mobileSheet}
            onMobileSheet={setMobileSheet}
            onCancelSale={requestCancelSale}
            product={
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <div className="min-w-0 w-44 max-w-full">
                  <POSSelect
                    aria-label="Warehouse"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    options={
                      warehouses.length
                        ? warehouses.map((w) => ({ value: w.id, label: w.name }))
                        : [{ value: "", label: "No warehouse" }]
                    }
                  />
                </div>
                {!warehouseId ? <POSBadge tone="warning">No warehouse</POSBadge> : null}
                {lastInvoice ? <POSBadge tone="success">Last {lastInvoice}</POSBadge> : null}
                <POSBadge tone="primary">Rs {totals.grand.toFixed(2)}</POSBadge>
                <div className="w-24">
                  <POSSelect
                    aria-label="Mode"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as PosMode)}
                    options={[
                      { value: "easy", label: "Easy" },
                      { value: "advanced", label: "Advanced" },
                    ]}
                  />
                </div>
                <div className="w-24">
                  <POSSelect
                    aria-label="Language"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as LocaleMode)}
                    options={[
                      { value: "en", label: "EN" },
                      { value: "ur", label: "UR" },
                      { value: "en_ur", label: "EN+UR" },
                    ]}
                  />
                </div>
              </div>
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
              />
            </div>
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
                onManual={onManualEntry}
                canDiscount={canDiscount}
                canPriceOverride={canPriceOverride}
                cartError={lastCartError}
              />
            }
            payment={
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
