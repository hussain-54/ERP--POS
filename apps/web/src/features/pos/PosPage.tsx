import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import {
  applyDiscount,
  approverRoleFromPermissions,
  buildHoldSnapshot,
  cartLinesForResume,
  evaluateDiscountApproval,
  evaluatePosCustomerCredit,
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
import { PosHoldsPanel, type HeldSaleListItem } from "./components/PosHoldsPanel";
import { catalogApi } from "@/features/catalog/catalog-api";
import { usePosSession } from "./session/usePosSession";
import { posCustomerRepository } from "./session/pos-customer-repository";
import { partiesApi } from "@/features/parties/parties-api";
import type { CustomerSearchHit } from "@electronic-erp/contracts";
import {
  POSActionBar,
  POSBadge,
  POSButton,
  POSCard,
  POSDrawer,
  POSInput,
  POSLayout,
} from "./design-system";
import {
  POS_SHORTCUTS,
  uuid,
  type CartLine,
  type LocaleMode,
  type PaySplit,
  type PosMode,
  type PriceLevel,
  type ProductTab,
} from "./pos-types";
import { cameraScanner } from "./hardware";

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
  const { branchId, branches, setBranchId, user, hasPermission, organizationId } = useAuth();
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
    increaseQty,
    decreaseQty,
    setPrice,
    setLineDiscount,
    changeUnit,
    removeLine,
    clearCart,
    selectWalkIn,
    applyCustomer,
    replaceCart,
    setWalkIn,
    lastCartError,
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
  const [customerHits, setCustomerHits] = useState<CustomerSearchHit[]>([]);
  const [pendingInvoiceDiscount, setPendingInvoiceDiscount] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
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
  const [shift, setShift] = useState<Record<string, unknown> | null>(null);
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
  const [clock, setClock] = useState(() => new Date());
  const [showHolds, setShowHolds] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
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
  const paymentGateRef = useRef(new PaymentAttemptGate());

  const canDiscount =
    hasPermission("pos.discount_cashier") ||
    hasPermission("pos.discount_supervisor") ||
    hasPermission("pos.discount_manager") ||
    hasPermission("pos.discount_owner") ||
    hasPermission("pos.discount_special");
  const canPriceOverride =
    hasPermission("pos.discount_manager") ||
    hasPermission("pos.discount_owner") ||
    hasPermission("pos.discount_special");
  const actingDiscountRole = approverRoleFromPermissions({
    special: hasPermission("pos.discount_special"),
    owner: hasPermission("pos.discount_owner"),
    manager: hasPermission("pos.discount_manager"),
    supervisor: hasPermission("pos.discount_supervisor"),
    cashier: hasPermission("pos.discount_cashier"),
  });
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
      if (r.items[0]) setWarehouseId(String(r.items[0].id));
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
    void refreshHolds();
    void posApi
      .currentShift(branchId)
      .then((res) => setShift(res.item))
      .catch(() => setShift(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, holdsFilter]);

  async function refreshHolds() {
    if (!branchId) return;
    try {
      await posApi.expireHolds(branchId).catch(() => undefined);
      const res = await posApi.listHolds(branchId, holdsFilter);
      setHolds(res.items as HeldSaleListItem[]);
    } catch {
      /* ignore */
    }
  }

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
    if (walkIn || !customerQuery.trim() || !hasPermission("customers.read")) {
      setCustomerHits([]);
      return;
    }
    const orgId = organizationId ?? "";
    const handle = window.setTimeout(() => {
      void posCustomerRepository
        .search({
          q: customerQuery,
          online,
          organizationId: orgId,
          canRead: hasPermission("customers.read"),
        })
        .then(setCustomerHits)
        .catch(() => setCustomerHits([]));
    }, 250);
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
    const result = sessionAddProduct(p);
    if (!result.ok) {
      toast.push({
        title: "Cannot add product",
        description: result.error ?? "Check stock or quantity",
        tone: "danger",
      });
      return;
    }
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

  function requestInvoiceDiscount(value: string) {
    const base = Math.max(0, totals.subtotal - totals.itemDiscount);
    const applied = applyDiscount({
      base,
      mode: "fixed",
      value: Number(value || 0),
      kind: "fixed",
    });
    const decision = evaluateDiscountApproval({
      discountAmount: applied.amount,
      baseAmount: base,
      actingRole: actingDiscountRole,
    });
    if (decision.needsApproval && applied.amount > 0) {
      setPendingInvoiceDiscount(String(applied.amount));
      setApprovalReason("");
      setApprovalOpen(true);
      return;
    }
    setInvoiceDiscount(String(applied.amount));
  }

  async function selectCustomer(id: string) {
    setCustomerQuery("");
    setCustomerHits([]);
    try {
      const profile = await posCustomerRepository.get({
        id,
        online,
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
        online,
        organizationId: organizationId ?? "",
        canWrite: hasPermission("customers.write"),
        body: input,
      });
      toast.push({
        title: online ? "Customer created" : "Customer saved offline",
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
        online,
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
    if (busy || paymentConfirmation === "pending") return;

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
    if (!walkIn && customer && prep.remaining > 0) {
      const credit = evaluatePosCustomerCredit({
        customer,
        additionalCredit: String(prep.remaining),
      });
      if (customer.isBlocked) {
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

    const idempotencyKey = checkoutIdempotencyKey;
    try {
      paymentGateRef.current.begin(idempotencyKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Duplicate payment blocked";
      toast.push({ title: "Duplicate sale blocked", description: message, tone: "danger" });
      return;
    }

    setPaymentConfirmation("pending");
    setPaymentConfirmationError(null);
    setBusy(true);
    try {
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
        discountTotal: Number(invoiceDiscount || 0),
        discounts:
          Number(invoiceDiscount || 0) > 0
            ? [
                {
                  scope: "invoice",
                  kind: priceLevel === "wholesale" ? "wholesale" : "fixed",
                  amount: Number(invoiceDiscount),
                  approverRole: actingDiscountRole,
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
                frequency: installmentFrequency,
                lateFeePercent: Number(lateFeePercent) || 0,
                lateFeeFixed: lateFeeFixed || "0",
              }
            : undefined,
        deviceId,
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
      const message = err instanceof Error ? err.message : "Error";
      paymentGateRef.current.fail(idempotencyKey, message);
      setPaymentConfirmation("failure");
      setPaymentConfirmationError(message);
      setCheckoutIdempotencyKey(uuid());
      toast.push({
        title: "Payment failed",
        description: message,
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
        deviceId,
      });
      clearSale();
      setHoldReason("");
      setHoldNotes("");
      toast.push({ title: "Bill held", tone: "success" });
      await refreshHolds();
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

  async function resume(id: string, andCheckout = false) {
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
      toast.push({
        title: "Resume failed",
        description: err instanceof Error ? err.message : "Error",
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
      await posApi.duplicateHold(id, { warehouseId, deviceId });
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
        setTab("results");
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
            onHeldSales={() => setShowHolds(true)}
            onNotifications={() =>
              toast.push({
                title: "Notifications",
                description: "Notification feed not connected yet — integration point ready",
                tone: "info",
              })
            }
          />
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.95fr)]">
            <div className="flex min-h-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {warehouseId ? (
                  <POSBadge tone="neutral">WH {warehouseId.slice(0, 8)}</POSBadge>
                ) : (
                  <POSBadge tone="warning">No warehouse</POSBadge>
                )}
                {lastInvoice ? <POSBadge tone="success">Last {lastInvoice}</POSBadge> : null}
                <POSBadge tone="primary">Rs {totals.grand.toFixed(2)}</POSBadge>
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
                onCamera={() => void recognizeCamera()}
                onBarcodeScanHint={barcodeScanHint}
                onQrScan={() => void scanQrFromCamera()}
                onManualEntry={addManualQuick}
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
                onCreateCustomer={
                  hasPermission("customers.write") ? createCustomerFromPos : undefined
                }
                onUpdateCustomer={
                  hasPermission("customers.write") ? updateCustomerFromPos : undefined
                }
                onLoadHistory={
                  hasPermission("customers.read") || hasPermission("ledgers.view")
                    ? (id) =>
                        posCustomerRepository.history({
                          id,
                          online,
                          canRead:
                            hasPermission("customers.read") || hasPermission("ledgers.view"),
                        })
                    : undefined
                }
                creatingCustomer={creatingCustomer}
                canCreate={hasPermission("customers.write")}
                canEdit={hasPermission("customers.write")}
                canRead={hasPermission("customers.read")}
                priceLevel={priceLevel}
                onPriceLevel={setPriceLevel}
                salesmanId={salesmanUserId}
                salesmen={salesmen.map((s) => ({
                  id: s.id,
                  name: `${s.name} (${s.commissionPercent}%)`,
                }))}
                onSalesman={(id) => {
                  setSalesmanUserId(id);
                  const match = salesmen.find((s) => s.id === id);
                  setCommissionPercent(match?.commissionPercent ?? 0);
                }}
                referenceId={referenceId}
                references={references}
                onReference={setReferenceId}
                delivery={delivery}
                onDelivery={setDelivery}
                customerRef={customerRef}
                advanced={advanced}
                creditHint={
                  customer && !walkIn
                    ? (() => {
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
                      })()
                    : null
                }
              />

              <PosCartPanel
                cart={cart}
                advanced={advanced}
                locale={locale}
                onQty={(key, qty) => setQty(key, qty)}
                onIncrease={(key) => increaseQty(key)}
                onDecrease={(key) => decreaseQty(key)}
                onPrice={(key, unitPrice) => {
                  if (!canPriceOverride) {
                    setApprovalOpen(true);
                    setPendingInvoiceDiscount(null);
                    setApprovalReason(`price:${key}:${unitPrice}`);
                    return;
                  }
                  setPrice(key, unitPrice, true);
                }}
                onDiscount={(key, discount) => setLineDiscount(key, discount)}
                onUnitChange={(key, unitId) => changeUnit(key, unitId)}
                onRemove={(key) => removeLine(key)}
                onClear={() => clearCart()}
                onManual={addManualQuick}
                canDiscount={canDiscount}
                canPriceOverride={canPriceOverride}
                cartError={lastCartError}
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
                onRetry={() => {
                  setPaymentConfirmation("retry");
                  setPaymentConfirmationError(null);
                  setCheckoutIdempotencyKey(uuid());
                }}
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
              />

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

          <POSActionBar
            left={
              <div className="flex flex-wrap gap-2 text-[11px] text-[var(--pos-muted)]">
                {POS_SHORTCUTS.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-[var(--pos-border)] bg-[var(--pos-muted-bg)] px-1.5 py-0.5 font-semibold text-[var(--pos-ink)]">
                      {s.key}
                    </kbd>
                    <span className="hidden sm:inline">{s.label}</span>
                  </span>
                ))}
              </div>
            }
            right={
              <>
                <POSButton size="sm" variant="ghost" onClick={() => searchRef.current?.focus()}>
                  Search
                </POSButton>
                <POSButton size="sm" variant="ghost" onClick={() => setShowHolds(true)}>
                  Held ({holds.length})
                </POSButton>
                <POSButton size="sm" variant="ghost" onClick={clearSale} disabled={busy}>
                  Cancel
                </POSButton>
                <POSButton
                  size="sm"
                  variant="success"
                  onClick={() => void checkout()}
                  disabled={busy || !branchId || !warehouseId || !cart.length}
                  loading={busy}
                >
                  Pay Rs {totals.grand.toFixed(0)}
                </POSButton>
              </>
            }
          />
        </div>
      </POSLayout>

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
          pendingInvoiceDiscount != null
            ? (() => {
                const base = Math.max(0, totals.subtotal - totals.itemDiscount);
                const amount = Number(pendingInvoiceDiscount || 0);
                const decision = evaluateDiscountApproval({
                  discountAmount: amount,
                  baseAmount: base,
                  actingRole: actingDiscountRole,
                });
                return `Invoice discount ${decision.percent}% requires ${decision.requiredRole} approval (your role: ${actingDiscountRole}, max ${decision.maxAllowed === Number.POSITIVE_INFINITY ? "unlimited" : `${decision.maxAllowed}%`}).`;
              })()
            : "Manual price override requires manager/owner/special discount permission."
        }
        reason={approvalReason.startsWith("price:") ? "Price override requested" : approvalReason}
        onReasonChange={(v) => {
          if (!approvalReason.startsWith("price:")) setApprovalReason(v);
          else setApprovalReason(approvalReason);
        }}
        canApprove={
          pendingInvoiceDiscount != null
            ? evaluateDiscountApproval({
                discountAmount: Number(pendingInvoiceDiscount || 0),
                baseAmount: Math.max(0, totals.subtotal - totals.itemDiscount),
                actingRole: actingDiscountRole,
              }).allowed
            : canPriceOverride
        }
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
            if (key) setPrice(key, unitPrice, true);
          }
          setApprovalOpen(false);
          setApprovalReason("");
        }}
      />
    </div>
  );
}
