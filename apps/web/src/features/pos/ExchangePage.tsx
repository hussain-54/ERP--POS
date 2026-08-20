import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import {
  addOrIncrementProduct,
  calculatePosCartTotals,
  createCartLineFromProduct,
  preparePosExchange,
  preparePosPayments,
  refundSettlementPlan,
  removeCartLine,
  toSaleItems,
  updateCartLineQty,
  type PosCartLine,
  type RefundMethod,
  type ReturnDisposition,
  type ReturnReasonCode,
} from "@electronic-erp/domain";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { partiesApi } from "@/features/customers/parties-api";
import { inventoryApi } from "@/features/inventory/inventory-api";
import {
  formatOnlineFailure,
  INTERNET_REQUIRED_MESSAGE,
  INTERNET_REQUIRED_TITLE,
  requireInternetConnection,
} from "@/lib/online-required";
import { PosInvoiceSearch, PosSaleReview, PosWorkflowAlert } from "./components/PosSaleReview";
import { posApi } from "./pos-api";
import { searchPosProducts } from "./pos-product-search";
import { formatMoney } from "./sales-workspace";
import {
  clampReturnQty,
  EXCHANGE_STEPS,
  exchangeOperationWarnings,
  REASON_OPTIONS,
  remainingQtyTotal,
  RETURN_LINE_COLUMNS,
  parseReturnableSale,
  selectedReturnLines,
  toReturnableRows,
  toReturnLineInputs,
  type ExchangeStepId,
  type ParsedReturnableSale,
  type ReturnableDraft,
} from "./returns-workspace";
import {
  POSActionBar,
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSConfirmDialog,
  POSEmptyState,
  POSInput,
  POSPageHeader,
  POSSearch,
  POSSelect,
  POSStatCard,
  POSStepper,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";

function uuid() {
  return crypto.randomUUID();
}

export function ExchangePage() {
  const toast = useToast();
  const { branchId, hasPermission } = useAuth();
  const canReturn = hasPermission("pos.return");
  const canSell = hasPermission("pos.sell");

  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [step, setStep] = useState<ExchangeStepId>("find");
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matches, setMatches] = useState<Array<Record<string, unknown>>>([]);
  const [sale, setSale] = useState<ParsedReturnableSale | null>(null);
  const [lines, setLines] = useState<ReturnableDraft[]>([]);
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("wrong_product");
  const [reasonDetail, setReasonDetail] = useState("");
  const [disposition, setDisposition] = useState<ReturnDisposition>("refund");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<ProductSearchResult[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [methods, setMethods] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [collectMethodId, setCollectMethodId] = useState("");
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [returnKey, setReturnKey] = useState(() => uuid());
  const [saleKey, setSaleKey] = useState(() => uuid());
  const [postedReturnId, setPostedReturnId] = useState<string | null>(null);
  const [postedSale, setPostedSale] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [partialError, setPartialError] = useState<string | null>(null);

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
    try {
      void inventoryApi
        .listWarehouses()
        .then((r) => {
          const list = r.items
            .map((w) => ({ id: String(w.id ?? ""), name: String(w.name ?? w.code ?? "Warehouse") }))
            .filter((w) => w.id);
          setWarehouses(list);
          if (list[0] && !warehouseId) setWarehouseId(list[0].id);
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void partiesApi
        .listPaymentMethods()
        .then((r) => {
          const list = r.items
            .filter((m) => m.is_active !== false && m.isActive !== false)
            .map((m) => ({
              id: String(m.id),
              name: String(m.name ?? m.code ?? "Payment"),
              kind: String(m.kind ?? ""),
            }));
          setMethods(list);
          const cash = list.find((m) => m.kind === "cash") ?? list[0];
          if (cash) setCollectMethodId(cash.id);
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
  }, [warehouseId]);

  const selected = useMemo(() => selectedReturnLines(lines), [lines]);
  const cartTotals = useMemo(() => calculatePosCartTotals(cart), [cart]);
  const collectKind = methods.find((m) => m.id === collectMethodId)?.kind ?? "cash";
  const warnings = useMemo(
    () =>
      exchangeOperationWarnings({
        lines,
        replacementCount: cart.length,
        hasCustomer: sale?.hasCustomer ?? false,
        disposition,
        refundMethod,
        reasonCode,
        reasonDetail,
        canSell,
      }),
    [lines, cart.length, sale?.hasCustomer, disposition, refundMethod, reasonCode, reasonDetail, canSell],
  );

  const preview = useMemo(() => {
    try {
      if (!selected.length) return { value: null, pay: null, error: "Select return items" };
      if (!cart.length) return { value: null, pay: null, error: "Add replacement items" };
      const replacements = cart.map((line) => ({
        productId: String(line.productId ?? ""),
        unitId: line.unitId,
        name: line.name,
        qty: Number(line.qty),
        unitPrice: line.unitPrice,
        stockAvailable: line.stock != null && line.stock !== "" ? Number(line.stock) : null,
      }));
      const value = preparePosExchange({
        reasonCode,
        reasonDetail,
        refundMethod: disposition === "refund" ? refundMethod : undefined,
        hasCustomer: sale?.hasCustomer ?? false,
        returnDisposition: disposition === "credit" ? "credit" : "refund",
        returnable: toReturnableRows(lines),
        returnLines: toReturnLineInputs(lines),
        replacements,
      });
      const pay = preparePosPayments({
        grandTotal: value.collectAmount,
        lines: collectMethodId
          ? [{ paymentMethodId: collectMethodId, amount: value.collectAmount, kind: collectKind }]
          : [],
        walkIn: !(sale?.hasCustomer ?? false),
        hasCustomer: sale?.hasCustomer ?? false,
        allowCreditDue: Boolean(sale?.hasCustomer),
        allowRemaining: Boolean(sale?.hasCustomer) && collectKind === "credit",
      });
      if (!pay.ok) {
        return { value: null, pay: null, error: pay.errors[0] ?? "Replacement payment is not valid" };
      }
      return { value, pay, error: null };
    } catch (err) {
      return { value: null, pay: null, error: err instanceof Error ? err.message : "Invalid exchange" };
    }
  }, [
    selected.length,
    cart,
    reasonCode,
    reasonDetail,
    refundMethod,
    disposition,
    sale?.hasCustomer,
    lines,
    collectMethodId,
    collectKind,
  ]);

  const settlement = preview.value
    ? refundSettlementPlan({
        disposition: preview.value.preparedReturn.disposition,
        refundMethod: preview.value.preparedReturn.refundMethod,
        refundAmount: preview.value.preparedReturn.refundAmount,
      })
    : null;

  const blocking = [...warnings, preview.error, partialError].filter((message, index, all): message is string =>
    Boolean(message) && all.indexOf(message) === index,
  );

  async function searchSales() {
    if (!branchId || !canReturn) return;
    if (!requireInternetConnection(toast.push)) return;
    setBusy(true);
    try {
      const res = await posApi.searchReturnInvoices({
        branchId,
        invoiceNumber: invoiceNumber || undefined,
        customerQuery: customerQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setMatches(res.items);
      if (!res.items.length) toast.push({ title: "No invoices found", tone: "info" });
    } catch (err) {
      const failed = formatOnlineFailure(err, "exchange");
      toast.push({ title: failed.title, description: failed.description, tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function selectSale(row: Record<string, unknown>) {
    setBusy(true);
    try {
      const data = await posApi.getReturnableSale(String(row.id));
      const parsed = parseReturnableSale(data);
      setSale(parsed);
      if (parsed.warehouseId) setWarehouseId(parsed.warehouseId);
      setLines(parsed.lines);
      setCart([]);
      setPostedReturnId(null);
      setPostedSale(null);
      setPartialError(null);
      setCompleted(false);
      setStep("return");
    } catch (err) {
      toast.push({
        title: "Could not load sale",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  function patchLine(saleItemId: string, patch: Partial<ReturnableDraft>) {
    setLines((prev) => prev.map((line) => (line.saleItemId === saleItemId ? { ...line, ...patch } : line)));
  }

  function toggleLine(line: ReturnableDraft, selectedLine: boolean) {
    patchLine(line.saleItemId, {
      selected: selectedLine,
      qty: selectedLine && !(Number(line.qty) > 0) ? String(line.maxReturnable) : line.qty,
    });
  }

  const searchProducts = useCallback(async () => {
    const q = productQuery.trim();
    if (!q) {
      setProductHits([]);
      return;
    }
    setSearchingProducts(true);
    try {
      const items = await searchPosProducts({
        q,
        warehouseId: warehouseId || undefined,
        customerId: sale?.customerId || undefined,
      });
      setProductHits(items);
    } catch (err) {
      toast.push({
        title: "Product search failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setSearchingProducts(false);
    }
  }, [productQuery, warehouseId, sale?.customerId, toast]);

  function addReplacement(product: ProductSearchResult) {
    const line = createCartLineFromProduct({
      key: uuid(),
      productId: product.productId,
      name: product.name,
      sku: product.sku,
      unitId: product.unitId,
      unitName: product.unitName,
      unitSymbolPlaces: product.unitSymbolPlaces,
      unitPrice: Number(product.customerPrice ?? product.retailPrice ?? 0),
      warrantyDays: product.warrantyDays,
      stock: product.stockAvailable,
      retailPrice: Number(product.retailPrice),
      wholesalePrice: Number(product.wholesalePrice),
      dealerPrice: Number(product.dealerPrice),
      customerPrice: product.customerPrice != null ? Number(product.customerPrice) : null,
      quantityBreaks: product.quantityBreaks?.map((b) => ({ minQty: b.minQty, unitPrice: Number(b.unitPrice) })),
    });
    const result = addOrIncrementProduct(cart, line);
    if (!result.ok) {
      toast.push({ title: "Could not add replacement", description: result.error ?? "Stock check failed", tone: "danger" });
      return;
    }
    setCart(result.cart);
  }

  async function completeExchange() {
    if (posting) return;
    if (!branchId || !warehouseId || !sale || !preview.value || !preview.pay) {
      toast.push({ title: "Complete all exchange steps first", tone: "danger" });
      return;
    }
    if (!canSell) {
      toast.push({ title: "Replacement sale needs pos.sell", tone: "danger" });
      return;
    }
    if (!requireInternetConnection(toast.push)) return;
    setPosting(true);
    setPartialError(null);
    let returnId = postedReturnId;
    try {
      if (!returnId) {
        const ret = (await posApi.postReturn({
          branchId,
          warehouseId,
          originalSaleId: sale.saleId,
          returnType: preview.value.preparedReturn.disposition,
          returnScope: preview.value.preparedReturn.scope,
          reasonCode,
          reason: reasonDetail || undefined,
          refundMethod: preview.value.preparedReturn.refundMethod ?? undefined,
          items: preview.value.preparedReturn.lines.map((line) => ({
            originalSaleItemId: line.originalSaleItemId,
            productId: line.productId || undefined,
            unitId: line.unitId,
            qty: line.qty,
            unitPrice: line.unitPrice,
            condition: line.condition,
            originalPackaging: line.originalPackaging,
            accessoriesComplete: line.accessoriesComplete,
            inspectionNotes: line.inspectionNotes || undefined,
            batchId: line.batchId || undefined,
          })),
          idempotencyKey: returnKey,
          operationId: returnKey,
        })) as { id?: string };
        returnId = String(ret.id ?? "");
        setPostedReturnId(returnId);
        toast.push({ title: "Return posted", description: returnId, tone: "success" });
      }

      if (!postedSale) {
        const posted = await posApi.postSale({
          branchId,
          warehouseId,
          customerId: sale.customerId || undefined,
          notes: `Exchange for ${sale.invoiceNumber || sale.saleId}`,
          items: toSaleItems(cart),
          payments: preview.pay.splits.map((s) => ({
            paymentMethodId: s.paymentMethodId,
            amount: s.amount,
            methodKind: s.kind,
          })),
          idempotencyKey: saleKey,
          operationId: saleKey,
        });
        setPostedSale({ id: posted.id, invoiceNumber: posted.invoiceNumber });
        toast.push({ title: "Replacement sale posted", description: posted.invoiceNumber, tone: "success" });
      }

      setConfirmOpen(false);
      setCompleted(true);
    } catch (err) {
      const failed = formatOnlineFailure(err, "exchange");
      const message = returnId
        ? `Return posted (${returnId}). Replacement sale failed: ${failed.description}`
        : failed.description;
      setPartialError(message);
      toast.push({ title: failed.title, description: message, tone: "danger" });
      if (returnId) setSaleKey(uuid());
    } finally {
      setPosting(false);
    }
  }

  function reset() {
    setStep("find");
    setSale(null);
    setLines([]);
    setCart([]);
    setPostedReturnId(null);
    setPostedSale(null);
    setPartialError(null);
    setCompleted(false);
    setConfirmOpen(false);
    setReturnKey(uuid());
    setSaleKey(uuid());
  }

  const hasRemaining = remainingQtyTotal(lines) > 0;
  const payableLabel =
    preview.value?.settlement === "refund"
      ? "Amount refundable"
      : preview.value?.settlement === "collect"
        ? "Amount payable"
        : "Even exchange";

  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Reports", to: "/pos/reports" },
          { label: "Exchange" },
        ]}
      />
      <POSPageHeader
        title="Exchange"
        subtitle="Find original invoice → select item → replacement → difference → payable/refundable → payment/refund method → confirm. Posts a real return, then a real replacement sale. No payment gateway."
      />

      {!canReturn ? (
        <POSEmptyState title="Exchange is not available" description="This cashier needs pos.return to run exchanges." />
      ) : null}

      {!online ? (
        <div role="alert" className="rounded-[var(--pos-radius)] border border-[var(--pos-danger)] bg-[var(--pos-danger-soft)] px-3 py-2 text-sm text-[var(--pos-danger)]">
          <strong>{INTERNET_REQUIRED_TITLE}</strong>
          <span className="mt-0.5 block">{INTERNET_REQUIRED_MESSAGE}</span>
        </div>
      ) : null}

      <POSStepper steps={[...EXCHANGE_STEPS]} activeId={step} />

      {step === "find" ? (
        <PosInvoiceSearch
          title="Find original invoice"
          invoiceNumber={invoiceNumber}
          customerQuery={customerQuery}
          dateFrom={dateFrom}
          dateTo={dateTo}
          warehouseId={warehouseId}
          warehouses={warehouses}
          matches={matches}
          busy={busy}
          canSearch={canReturn}
          onInvoiceNumber={setInvoiceNumber}
          onCustomerQuery={setCustomerQuery}
          onDateFrom={setDateFrom}
          onDateTo={setDateTo}
          onWarehouseId={setWarehouseId}
          onSearch={() => void searchSales()}
          onSelect={(row) => void selectSale(row)}
        />
      ) : null}

      {sale && step !== "find" ? (
        <POSCard title="Original sale">
          <PosSaleReview sale={sale} lines={lines} refundAmount={preview.value?.refundAmount ?? null} />
        </POSCard>
      ) : null}

      {step === "return" ? (
        <POSCard title="Select item to exchange" description="Choose the original line and quantity. Remaining quantity cannot be exceeded.">
          {!hasRemaining ? (
            <PosWorkflowAlert messages={["Nothing remaining to exchange. Every line on this invoice is already fully returned."]} />
          ) : null}
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <POSSelect
              label="Return reason"
              options={REASON_OPTIONS}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
            />
            <POSInput label="Reason detail" value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} />
          </div>
          <POSTable className="pos-register-table">
            <POSTableHead>
              <tr>
                <POSTh />
                {RETURN_LINE_COLUMNS.map((col) => (
                  <POSTh key={col}>{col}</POSTh>
                ))}
              </tr>
            </POSTableHead>
            <POSTableBody>
              {lines.map((line) => (
                <tr key={line.saleItemId} className={line.maxReturnable <= 0 ? "opacity-60" : undefined}>
                  <POSTd>
                    <input
                      type="checkbox"
                      checked={line.selected}
                      disabled={line.maxReturnable <= 0}
                      onChange={(e) => toggleLine(line, e.target.checked)}
                      aria-label={`Select ${line.name}`}
                    />
                  </POSTd>
                  <POSTd>{line.name}</POSTd>
                  <POSTd className="tabular-nums">{line.soldQty}</POSTd>
                  <POSTd className="tabular-nums">{line.previouslyReturnedQty}</POSTd>
                  <POSTd className="tabular-nums">{line.maxReturnable}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.unitPrice)}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.tax)}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.discount)}</POSTd>
                  <POSTd>
                    <POSInput
                      aria-label={`Return qty ${line.name}`}
                      disabled={!line.selected || line.maxReturnable <= 0}
                      value={line.qty}
                      onChange={(e) =>
                        patchLine(line.saleItemId, {
                          qty: String(clampReturnQty(line.soldQty, line.previouslyReturnedQty, Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
          <PosWorkflowAlert
            messages={warnings.filter(
              (w) =>
                w.includes("Select at least one return") ||
                w.includes("quantity") ||
                w.includes("remaining") ||
                w.includes("Describe the return"),
            )}
          />
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("find")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!selected.length} onClick={() => setStep("replace")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "replace" ? (
        <POSCard title="Select replacement product" description="Catalog search only. Quantity cannot exceed available stock.">
          <div className="flex items-end gap-2">
            <POSSearch
              compact
              label="Replacement product"
              placeholder="Search name, SKU, barcode…"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchProducts();
                }
              }}
            />
            <POSButton size="sm" onClick={() => void searchProducts()} loading={searchingProducts}>
              Search
            </POSButton>
          </div>
          <ul className="mt-2 max-h-40 divide-y overflow-auto text-sm">
            {productHits.map((p) => (
              <li key={p.productId} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  {p.name}
                  <span className="block text-[11px] text-[var(--pos-muted)]">
                    {p.sku}
                    {p.stockAvailable != null ? ` · stock ${p.stockAvailable}` : ""}
                  </span>
                </span>
                <POSButton size="sm" variant="secondary" onClick={() => addReplacement(p)}>
                  Add
                </POSButton>
              </li>
            ))}
          </ul>
          <POSTable className="pos-register-table">
            <POSTableHead>
              <tr>
                <POSTh>Replacement</POSTh>
                <POSTh>Qty</POSTh>
                <POSTh className="text-right">Price</POSTh>
                <POSTh />
              </tr>
            </POSTableHead>
            <POSTableBody>
              {cart.map((line) => (
                <tr key={line.key}>
                  <POSTd>
                    {line.name}
                    {line.stock != null ? (
                      <div className="text-[10px] text-[var(--pos-muted)]">Stock {line.stock}</div>
                    ) : null}
                  </POSTd>
                  <POSTd>
                    <POSInput
                      value={line.qty}
                      onChange={(e) => {
                        const result = updateCartLineQty(cart, line.key, e.target.value);
                        if (!result.ok) {
                          toast.push({
                            title: "Quantity rejected",
                            description: result.error ?? "Stock or qty rule failed",
                            tone: "danger",
                          });
                          return;
                        }
                        setCart(result.cart);
                      }}
                    />
                  </POSTd>
                  <POSTd className="text-right tabular-nums">{formatMoney(line.unitPrice)}</POSTd>
                  <POSTd>
                    <POSButton size="sm" variant="ghost" onClick={() => setCart(removeCartLine(cart, line.key))}>
                      Remove
                    </POSButton>
                  </POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
          {!cart.length ? (
            <POSEmptyState title="No replacements yet" description="Search catalog products. Qty cannot exceed available stock." />
          ) : null}
          <PosWorkflowAlert messages={warnings.filter((w) => w.includes("replacement"))} />
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("return")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!cart.length} onClick={() => setStep("difference")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "difference" ? (
        <POSCard title="Calculate difference" description="Difference is replacement total minus return value from the exchange plan. This screen does not invent a third writer.">
          {preview.value ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <POSStatCard label="Return value" value={formatMoney(preview.value.refundAmount)} />
              <POSStatCard label="Replacement total" value={formatMoney(preview.value.collectAmount)} tone="primary" />
              <POSStatCard
                label="Difference"
                value={formatMoney(preview.value.difference)}
                tone={preview.value.settlement === "even" ? "success" : "warning"}
                hint={preview.value.settlement}
              />
              <POSStatCard label="Replacement qty" value={String(cartTotals.qty)} />
            </div>
          ) : (
            <PosWorkflowAlert messages={blocking} />
          )}
          <p className="mt-2 text-xs text-[var(--pos-muted)]">
            Confirm posts the return through `/pos/returns`, then the replacement through `/pos/sales`. If the sale fails after the return, the return stays posted.
          </p>
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("replace")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!preview.value} onClick={() => setStep("payable")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "payable" ? (
        <POSCard title="Show amount payable/refundable">
          {preview.value ? (
            <div className="grid gap-2 md:grid-cols-3">
              <POSStatCard
                label={payableLabel}
                value={formatMoney(Math.abs(preview.value.difference))}
                tone={preview.value.settlement === "even" ? "success" : "primary"}
              />
              <POSStatCard label="Return refund" value={formatMoney(preview.value.refundAmount)} />
              <POSStatCard label="Replacement sale" value={formatMoney(preview.value.collectAmount)} />
            </div>
          ) : (
            <PosWorkflowAlert messages={blocking} />
          )}
          {preview.value ? (
            <p className="mt-3 text-sm text-[var(--pos-muted)]">
              {preview.value.settlement === "collect"
                ? `Customer pays the replacement sale of ${formatMoney(preview.value.collectAmount)}. The original return of ${formatMoney(preview.value.refundAmount)} is posted separately. Net payable ${formatMoney(preview.value.difference)}.`
                : preview.value.settlement === "refund"
                  ? `Original return of ${formatMoney(preview.value.refundAmount)} exceeds the replacement sale of ${formatMoney(preview.value.collectAmount)}. Net refundable ${formatMoney(Math.abs(preview.value.difference))}.`
                  : "Return value and replacement total match. No extra collect or refund."}
            </p>
          ) : null}
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("difference")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!preview.value} onClick={() => setStep("method")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "method" ? (
        <POSCard
          title="Select payment/refund method"
          description="Collect method records the replacement sale tender. Refund method records the original return. There is no fake gateway."
        >
          <div className="grid gap-2 md:grid-cols-2">
            <POSSelect
              label="Return settlement"
              options={[
                { value: "refund", label: "Refund original" },
                { value: "credit", label: "Customer credit" },
              ]}
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as ReturnDisposition)}
            />
            {disposition === "refund" ? (
              <POSSelect
                label="Refund method"
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank", label: "Bank" },
                  { value: "customer_credit", label: "Customer credit" },
                ]}
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
              />
            ) : null}
            <POSSelect
              label="Collect method"
              value={collectMethodId}
              onChange={(e) => setCollectMethodId(e.target.value)}
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
          </div>
          {settlement ? (
            <p className="mt-2 text-xs text-[var(--pos-muted)]">
              Return settlement plan: {settlement.kind}
              {settlement.paymentKind ? ` · recorded ${settlement.paymentKind} tender` : ""}
            </p>
          ) : null}
          <PosWorkflowAlert
            messages={warnings.filter((w) => w.includes("credit") || w.includes("pos.sell") || w.includes("Walk-in"))}
          />
          {preview.error && !warnings.includes(preview.error) ? <PosWorkflowAlert messages={[preview.error]} /> : null}
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("payable")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!preview.value || !preview.pay || !canSell} onClick={() => setStep("confirm")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "confirm" ? (
        <POSCard
          title={completed ? "Exchange complete" : "Confirm"}
          description={
            completed
              ? "Both legs posted. Keep these ids for audit."
              : "Confirm posts a real return, then a real replacement sale."
          }
        >
          {completed && postedReturnId && postedSale ? (
            <p className="text-sm">
              Exchange complete · return <code>{postedReturnId}</code> · replacement invoice{" "}
              <strong>{postedSale.invoiceNumber}</strong>
            </p>
          ) : null}
          {sale ? (
            <div className="mt-3">
              <PosSaleReview sale={sale} lines={lines} refundAmount={preview.value?.refundAmount ?? null} compact />
            </div>
          ) : null}
          {preview.value ? (
            <ul className="mt-3 text-sm text-[var(--pos-muted)]">
              <li>Return value: {formatMoney(preview.value.refundAmount)}</li>
              <li>Replacement total: {formatMoney(preview.value.collectAmount)}</li>
              <li>
                {payableLabel}: {formatMoney(Math.abs(preview.value.difference))} ({preview.value.settlement})
              </li>
            </ul>
          ) : null}
          {partialError ? <PosWorkflowAlert messages={[partialError]} /> : null}
          {!completed ? <PosWorkflowAlert messages={blocking.filter((m) => m !== partialError)} /> : null}
          {completed ? (
            <POSButton className="mt-3" onClick={reset}>
              New exchange
            </POSButton>
          ) : (
            <POSActionBar
              sticky={false}
              className="mt-3 border-0 px-0"
              left={
                <POSButton variant="secondary" onClick={() => setStep("method")}>
                  Back
                </POSButton>
              }
              right={
                <POSButton
                  disabled={!preview.value || !preview.pay || !canSell}
                  title={canSell ? "Confirm exchange" : "Replacement sale requires pos.sell"}
                  onClick={() => setConfirmOpen(true)}
                >
                  Confirm
                </POSButton>
              }
            />
          )}
        </POSCard>
      ) : null}

      <POSConfirmDialog
        open={confirmOpen}
        title="Confirm exchange"
        description={
          preview.value
            ? `Post return ${formatMoney(preview.value.refundAmount)} then replacement sale ${formatMoney(preview.value.collectAmount)} (net ${formatMoney(preview.value.difference)}) against ${sale?.invoiceNumber ?? "the original invoice"}?`
            : "Exchange is not valid yet."
        }
        confirmLabel={postedReturnId && !postedSale ? "Retry replacement sale" : "Complete exchange"}
        loading={posting}
        onCancel={() => {
          if (!posting) setConfirmOpen(false);
        }}
        onConfirm={() => void completeExchange()}
      />
    </div>
  );
}
