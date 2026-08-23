import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import type {
  RefundMethod,
  ReturnCondition,
  ReturnDisposition,
  ReturnReasonCode,
} from "@electronic-erp/domain";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { posApi } from "../api";
import { money, uuid } from "../format";
import "../sales/sales-register.css";
import {
  buildPostReturnBody,
  buildSelectedLines,
  canApproveReturn,
  conditionLabel,
  defaultDisposition,
  defaultRefundMethod,
  formatSettlementLabel,
  fullReturnSelection,
  previewExchange,
  previewReturn,
  productMatchesBarcode,
  REFUND_METHOD_OPTIONS,
  RETURN_CONDITIONS,
  RETURN_REASON_CODES,
  reasonLabel,
  returnApprovalChainLabel,
  returnNeedsApproval,
  RETURN_STEP_LABELS,
  type ReturnableLineView,
  type ReturnWorkspaceMode,
  type SelectedReturnLine,
  workflowSteps,
} from "./return-utils";

type SaleSearchRow = Awaited<ReturnType<typeof posApi.searchSalesForReturn>>["items"][number];
type SaleView = Awaited<ReturnType<typeof posApi.getReturnableSale>>;

export function ReturnWorkflow({
  mode,
  initialSaleId,
  initialRefund,
}: {
  mode: ReturnWorkspaceMode;
  initialSaleId?: string | null;
  initialRefund?: boolean;
}) {
  const { branchId, organizationId, permissions, hasPermission } = useAuth();
  const { push } = useToast();

  const steps = useMemo(() => workflowSteps(mode), [mode]);
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex] ?? "find";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [searchResults, setSearchResults] = useState<SaleSearchRow[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(initialSaleId ?? null);
  const [saleView, setSaleView] = useState<SaleView | null>(null);
  const [qtyByItem, setQtyByItem] = useState<Map<string, number>>(new Map());
  const [lineMeta, setLineMeta] = useState<Map<string, LineMeta>>(new Map());
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("other");
  const [reasonDetail, setReasonDetail] = useState("");
  const [disposition, setDisposition] = useState<ReturnDisposition>(() =>
    initialRefund ? "refund" : defaultDisposition(mode),
  );
  const [refundMethod, setRefundMethod] = useState<RefundMethod>(() => defaultRefundMethod(mode));
  const [confirmationNotes, setConfirmationNotes] = useState("");
  const [approvalAcknowledged, setApprovalAcknowledged] = useState(false);
  const [replacementSearch, setReplacementSearch] = useState("");
  const [replacementProducts, setReplacementProducts] = useState<ProductSearchResult[]>([]);
  const [activeExchangeLineId, setActiveExchangeLineId] = useState<string | null>(null);

  const returnableLines = saleView?.returnableLines ?? [];
  const hasCustomer = Boolean(saleView?.sale.customerId);
  const canReturn = hasPermission("pos.return");

  const selectedLines = useMemo(
    () => mergeSelectedLines(returnableLines, qtyByItem, lineMeta),
    [returnableLines, qtyByItem, lineMeta],
  );

  const preview = useMemo(() => {
    try {
      if (!selectedLines.length) return null;
      return previewReturn({
        disposition,
        refundMethod,
        reasonCode,
        reasonDetail,
        hasCustomer,
        returnable: returnableLines,
        selected: selectedLines,
      });
    } catch {
      return null;
    }
  }, [disposition, refundMethod, reasonCode, reasonDetail, hasCustomer, returnableLines, selectedLines]);

  const exchangePreview = useMemo(() => {
    if (mode !== "exchange" || !selectedLines.every((l) => l.exchangeProductId)) return null;
    try {
      return previewExchange({
        reasonCode,
        reasonDetail,
        refundMethod,
        hasCustomer,
        returnable: returnableLines,
        selected: selectedLines,
      });
    } catch {
      return null;
    }
  }, [mode, reasonCode, reasonDetail, refundMethod, hasCustomer, returnableLines, selectedLines]);

  const needsApproval = preview ? returnNeedsApproval(preview.prepared.refundAmount, permissions) : false;
  const canApprove = canApproveReturn(permissions);

  const loadSale = useCallback(
    async (saleId: string) => {
      if (!branchId) return;
      setBusy(true);
      setError("");
      try {
        const view = await posApi.getReturnableSale(saleId);
        const open = view.returnableLines.filter((l) => l.maxReturnable > 0);
        if (!open.length) throw new Error("This sale has no returnable quantities left");

        setSaleView(view);
        setSelectedSaleId(saleId);

        let qtyMap = mode === "full" ? fullReturnSelection(view.returnableLines) : new Map<string, number>();
        if (mode === "by-barcode" && barcode.trim()) {
          const products = await posApi.searchProducts({ q: barcode.trim(), warehouseId: branchId, limit: 5 });
          const match = products.items.find((p) => productMatchesBarcode(p, barcode));
          qtyMap = new Map();
          if (match) {
            for (const line of open) {
              if (line.productId === match.productId) qtyMap.set(line.saleItemId, line.maxReturnable);
            }
          }
        }

        setQtyByItem(qtyMap);
        setLineMeta(new Map());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load sale");
        setSaleView(null);
      } finally {
        setBusy(false);
      }
    },
    [mode, barcode, branchId],
  );

  useEffect(() => {
    if (initialSaleId) void loadSale(initialSaleId);
  }, [initialSaleId, loadSale]);

  useEffect(() => {
    if (mode === "exchange") setDisposition("exchange");
  }, [mode]);

  async function searchSales() {
    if (!branchId) return;
    setBusy(true);
    setError("");
    try {
      const res = await posApi.searchSalesForReturn({
        branchId,
        invoiceNumber: invoiceQuery.trim() || undefined,
        customerQuery: customerQuery.trim() || undefined,
        limit: 40,
      });
      setSearchResults(res.items);
      if (!res.items.length) setError("No posted sales matched your search");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSearchResults([]);
    } finally {
      setBusy(false);
    }
  }

  async function resolveBarcodeSale() {
    if (!branchId || !barcode.trim()) {
      setError("Scan or enter a barcode first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const products = await posApi.searchProducts({ q: barcode.trim(), warehouseId: branchId, limit: 5 });
      const match = products.items.find((p) => productMatchesBarcode(p, barcode));
      if (!match) throw new Error("No product found for this barcode");

      const sales = await posApi.searchSalesForReturn({ branchId, limit: 40 });
      const candidates: SaleSearchRow[] = [];
      for (const row of sales.items) {
        const view = await posApi.getReturnableSale(String(row.id));
        if (view.returnableLines.some((l) => l.productId === match.productId && l.maxReturnable > 0)) {
          candidates.push(row);
        }
      }
      if (!candidates.length) throw new Error("No recent sale with returnable qty for this product");
      if (candidates.length === 1) {
        await loadSale(String(candidates[0].id));
        setStepIndex(Math.max(1, steps.indexOf("items")));
        return;
      }
      setSearchResults(candidates);
      setError("Multiple sales contain this product — pick the invoice below");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Barcode lookup failed");
    } finally {
      setBusy(false);
    }
  }

  function setLineQty(saleItemId: string, qty: number, max: number) {
    setQtyByItem((prev) => {
      const next = new Map(prev);
      const n = Math.max(0, Math.min(max, qty));
      if (n <= 0) next.delete(saleItemId);
      else next.set(saleItemId, n);
      return next;
    });
  }

  function patchLineMeta(saleItemId: string, patch: Partial<LineMeta>) {
    setLineMeta((prev) => {
      const next = new Map(prev);
      next.set(saleItemId, { ...defaultLineMeta(), ...prev.get(saleItemId), ...patch });
      return next;
    });
  }

  function goNext() {
    setError("");
    if (step === "find" && !saleView) return setError("Select a sale to continue");
    if (step === "items" && !selectedLines.length) return setError("Select at least one line with quantity");
    if (step === "exchange" && !selectedLines.every((l) => l.exchangeProductId)) {
      return setError("Pick a replacement product for each returned line");
    }
    if (step === "reason" && reasonCode === "other" && !reasonDetail.trim()) {
      return setError("Describe the return reason");
    }
    if (step === "refund") {
      if (disposition === "credit" && !hasCustomer) return setError("Store credit requires a customer on the sale");
      if (disposition === "refund" && refundMethod === "customer_credit" && !hasCustomer) {
        return setError("Customer credit refund requires a customer on the sale");
      }
    }
    if (step === "approval" && needsApproval && !canApprove && !approvalAcknowledged) {
      return setError("Manager approval is required before posting this return");
    }
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
  }

  async function confirmReturn() {
    if (!branchId || !organizationId || !selectedSaleId || !preview || !canReturn) return;
    if (needsApproval && !canApprove && !approvalAcknowledged) {
      push({ title: "Manager approval required", tone: "danger" });
      return;
    }

    setBusy(true);
    setError("");
    try {
      await posApi.postReturn(
        buildPostReturnBody({
          branchId,
          warehouseId: branchId,
          originalSaleId: selectedSaleId,
          disposition,
          refundMethod,
          reasonCode,
          reasonDetail,
          confirmationNotes,
          hasCustomer,
          returnable: returnableLines,
          selected: selectedLines,
          idempotencyKey: uuid(),
        }),
      );
      push({
        title: disposition === "exchange" ? "Exchange posted" : "Return posted",
        description:
          preview.settlement.kind === "none"
            ? "Stock updated per inspection rules."
            : formatSettlementLabel(preview.settlement),
        tone: "success",
      });
      setSaleView(null);
      setSelectedSaleId(null);
      setSearchResults([]);
      setQtyByItem(new Map());
      setStepIndex(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Return could not be posted";
      setError(msg);
      push({ title: "Return failed", description: msg, tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (!canReturn) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        You need the pos.return permission to process returns.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <Stepper steps={steps} stepIndex={stepIndex} />

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {step === "find" && (
          <FindStep
            mode={mode}
            busy={busy}
            invoiceQuery={invoiceQuery}
            customerQuery={customerQuery}
            barcode={barcode}
            saleView={saleView}
            searchResults={searchResults}
            onInvoiceQuery={setInvoiceQuery}
            onCustomerQuery={setCustomerQuery}
            onBarcode={setBarcode}
            onSearch={() => void searchSales()}
            onBarcodeResolve={() => void resolveBarcodeSale()}
            onSelectSale={(id) => void loadSale(id)}
          />
        )}
        {step === "items" && saleView && (
          <ItemsStep
            lines={returnableLines}
            qtyByItem={qtyByItem}
            lineMeta={lineMeta}
            onQty={setLineQty}
            onMeta={patchLineMeta}
          />
        )}
        {step === "exchange" && (
          <ExchangeStep
            selectedLines={selectedLines}
            activeLineId={activeExchangeLineId}
            search={replacementSearch}
            products={replacementProducts}
            preview={exchangePreview}
            onActiveLine={setActiveExchangeLineId}
            onSearch={setReplacementSearch}
            onSearchSubmit={async () => {
              if (!branchId || !replacementSearch.trim()) return;
              const res = await posApi.searchProducts({
                q: replacementSearch.trim(),
                warehouseId: branchId,
                limit: 12,
              });
              setReplacementProducts(res.items);
            }}
            onPick={(lineId, product) => {
              patchLineMeta(lineId, {
                exchangeProductId: product.productId,
                exchangeProductName: product.name,
                exchangeUnitPrice: Number(product.retailPrice),
              });
              setActiveExchangeLineId(null);
            }}
          />
        )}
        {step === "reason" && (
          <ReasonStep
            reasonCode={reasonCode}
            reasonDetail={reasonDetail}
            onCode={setReasonCode}
            onDetail={setReasonDetail}
          />
        )}
        {step === "refund" && (
          <RefundStep
            mode={mode}
            disposition={disposition}
            refundMethod={refundMethod}
            hasCustomer={hasCustomer}
            preview={preview}
            onDisposition={setDisposition}
            onRefundMethod={setRefundMethod}
          />
        )}
        {step === "approval" && (
          <ApprovalStep
            canApprove={canApprove}
            needsApproval={needsApproval}
            refundAmount={preview?.prepared.refundAmount ?? 0}
            acknowledged={approvalAcknowledged}
            onAcknowledge={setApprovalAcknowledged}
          />
        )}
        {step === "confirm" && preview && (
          <ConfirmStep
            saleView={saleView}
            selectedSaleId={selectedSaleId}
            preview={preview}
            selectedLines={selectedLines}
            notes={confirmationNotes}
            onNotes={setConfirmationNotes}
          />
        )}
        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
        {stepIndex > 0 ? (
          <button type="button" onClick={() => setStepIndex((i) => i - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">
            Back
          </button>
        ) : (
          <Link to="/pos/sales/completed" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">
            Sales register
          </Link>
        )}
        {step !== "confirm" ? (
          <button
            type="button"
            onClick={goNext}
            disabled={busy || (step === "find" && !saleView)}
            className="rounded-xl bg-[var(--pos-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void confirmReturn()}
            disabled={busy || (needsApproval && !canApprove && !approvalAcknowledged)}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {busy ? "Posting…" : "Confirm return"}
          </button>
        )}
      </div>
    </div>
  );
}

type LineMeta = {
  condition: ReturnCondition;
  originalPackaging: boolean;
  accessoriesComplete: boolean;
  inspectionNotes: string;
  exchangeProductId?: string | null;
  exchangeProductName?: string;
  exchangeUnitPrice?: number;
};

function defaultLineMeta(): LineMeta {
  return {
    condition: "good",
    originalPackaging: true,
    accessoriesComplete: true,
    inspectionNotes: "",
  };
}

function mergeSelectedLines(
  returnableLines: ReturnableLineView[],
  qtyByItem: Map<string, number>,
  lineMeta: Map<string, LineMeta>,
): SelectedReturnLine[] {
  return buildSelectedLines(returnableLines, qtyByItem).map((line) => {
    const meta = lineMeta.get(line.saleItemId);
    return {
      ...line,
      condition: meta?.condition ?? line.condition,
      originalPackaging: meta?.originalPackaging ?? line.originalPackaging,
      accessoriesComplete: meta?.accessoriesComplete ?? line.accessoriesComplete,
      inspectionNotes: meta?.inspectionNotes ?? "",
      exchangeProductId: meta?.exchangeProductId ?? null,
      exchangeProductName: meta?.exchangeProductName,
      exchangeUnitPrice: meta?.exchangeUnitPrice,
    };
  });
}

function Stepper({ steps, stepIndex }: { steps: ReturnWorkspaceMode extends never ? never : string[]; stepIndex: number }) {
  return (
    <nav className="shrink-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            {i > 0 ? <span className="text-slate-300">›</span> : null}
            <span
              className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                i === stepIndex ? "bg-[var(--pos-primary)] text-white" : i < stepIndex ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
              }`}
            >
              {RETURN_STEP_LABELS[s as keyof typeof RETURN_STEP_LABELS]}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function FindStep(props: {
  mode: ReturnWorkspaceMode;
  busy: boolean;
  invoiceQuery: string;
  customerQuery: string;
  barcode: string;
  saleView: SaleView | null;
  searchResults: SaleSearchRow[];
  onInvoiceQuery: (v: string) => void;
  onCustomerQuery: (v: string) => void;
  onBarcode: (v: string) => void;
  onSearch: () => void;
  onBarcodeResolve: () => void;
  onSelectSale: (id: string) => void;
}) {
  const openCount = props.saleView?.returnableLines.filter((l) => l.maxReturnable > 0).length ?? 0;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-slate-600">Find the original posted sale with returnable quantity remaining.</p>
      {props.mode === "by-barcode" && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input
            value={props.barcode}
            onChange={(e) => props.onBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onBarcodeResolve()}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Scan or type barcode…"
          />
          <button type="button" disabled={props.busy} onClick={props.onBarcodeResolve} className="rounded-xl bg-[var(--pos-primary)] px-4 py-2 text-xs font-bold text-white">
            Find sale by product
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={props.invoiceQuery} onChange={(e) => props.onInvoiceQuery(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Invoice #" />
        <input value={props.customerQuery} onChange={(e) => props.onCustomerQuery(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Customer name / phone" />
      </div>
      <button type="button" disabled={props.busy} onClick={props.onSearch} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">
        Search sales
      </button>
      {props.saleView && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-bold text-emerald-900">
            {props.saleView.invoiceNumber ?? props.saleView.sale.id.slice(0, 8)} · {props.saleView.customerName ?? "Walk-in"}
          </p>
          <p className="text-xs text-emerald-800">{openCount} returnable line(s)</p>
        </div>
      )}
      {props.searchResults.length > 0 && (
        <table className="pos-sales-table w-full text-left text-xs">
          <thead className="text-[10px] uppercase text-slate-400">
            <tr>
              <th className="py-2">Invoice</th>
              <th>Customer</th>
              <th className="text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.searchResults.map((row) => (
              <tr key={String(row.id)} className="border-t border-slate-100">
                <td className="py-2 font-semibold">{row.invoiceNumber ?? String(row.id).slice(0, 8)}</td>
                <td>{row.customerName ?? "Walk-in"}</td>
                <td className="text-right">{money(Number(row.grandTotal))}</td>
                <td className="text-right">
                  <button type="button" onClick={() => props.onSelectSale(String(row.id))} className="rounded-lg bg-[var(--pos-primary)] px-2 py-1 text-[10px] font-bold text-white">
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ItemsStep({
  lines,
  qtyByItem,
  lineMeta,
  onQty,
  onMeta,
}: {
  lines: ReturnableLineView[];
  qtyByItem: Map<string, number>;
  lineMeta: Map<string, LineMeta>;
  onQty: (id: string, qty: number, max: number) => void;
  onMeta: (id: string, patch: Partial<LineMeta>) => void;
}) {
  return (
    <div className="space-y-3">
      {lines.map((line) => {
        const qty = qtyByItem.get(line.saleItemId) ?? 0;
        const meta = lineMeta.get(line.saleItemId) ?? defaultLineMeta();
        const disabled = line.maxReturnable <= 0;
        return (
          <div key={line.saleItemId} className={`rounded-xl border p-3 ${disabled ? "opacity-50" : "border-slate-200"}`}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{line.name}</p>
                <p className="text-[11px] text-slate-500">Max {line.maxReturnable} @ {money(line.unitPrice)}</p>
              </div>
              <input
                type="number"
                min={0}
                max={line.maxReturnable}
                disabled={disabled}
                value={qty || ""}
                onChange={(e) => onQty(line.saleItemId, Number(e.target.value) || 0, line.maxReturnable)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </div>
            {qty > 0 && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <select value={meta.condition} onChange={(e) => onMeta(line.saleItemId, { condition: e.target.value as ReturnCondition })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
                  {RETURN_CONDITIONS.map((c) => (
                    <option key={c} value={c}>{conditionLabel(c)}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={meta.originalPackaging} onChange={(e) => onMeta(line.saleItemId, { originalPackaging: e.target.checked })} />
                  Packaging
                </label>
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={meta.accessoriesComplete} onChange={(e) => onMeta(line.saleItemId, { accessoriesComplete: e.target.checked })} />
                  Accessories
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExchangeStep({
  selectedLines,
  activeLineId,
  search,
  products,
  preview,
  onActiveLine,
  onSearch,
  onSearchSubmit,
  onPick,
}: {
  selectedLines: SelectedReturnLine[];
  activeLineId: string | null;
  search: string;
  products: ProductSearchResult[];
  preview: ReturnType<typeof previewExchange> | null;
  onActiveLine: (id: string | null) => void;
  onSearch: (v: string) => void;
  onSearchSubmit: () => void;
  onPick: (lineId: string, product: ProductSearchResult) => void;
}) {
  return (
    <div className="space-y-3">
      {selectedLines.map((line) => (
        <div key={line.saleItemId} className="rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-bold">{line.name} × {line.qty}</p>
          <p className="text-xs text-slate-600">Replacement: {line.exchangeProductName ?? "Not selected"}</p>
          <button type="button" onClick={() => onActiveLine(line.saleItemId)} className="mt-2 text-xs font-semibold text-[var(--pos-primary)]">
            Pick replacement
          </button>
        </div>
      ))}
      {activeLineId && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
          <input value={search} onChange={(e) => onSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Search replacement…" />
          <button type="button" onClick={onSearchSubmit} className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white">Search</button>
          {products.map((p) => (
            <button key={p.productId} type="button" onClick={() => onPick(activeLineId, p)} className="block w-full rounded-lg bg-white px-3 py-2 text-left text-xs hover:bg-blue-100">
              {p.name} — {money(Number(p.retailPrice))}
            </button>
          ))}
        </div>
      )}
      {preview && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs">
          <p>Difference: {money(preview.difference)} (informational — not auto-settled on exchange)</p>
        </div>
      )}
    </div>
  );
}

function ReasonStep({ reasonCode, reasonDetail, onCode, onDetail }: { reasonCode: ReturnReasonCode; reasonDetail: string; onCode: (c: ReturnReasonCode) => void; onDetail: (v: string) => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {RETURN_REASON_CODES.map((code) => (
          <button key={code} type="button" onClick={() => onCode(code)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${reasonCode === code ? "border-[var(--pos-primary)] bg-blue-50" : "border-slate-200"}`}>
            {reasonLabel(code)}
          </button>
        ))}
      </div>
      <textarea value={reasonDetail} onChange={(e) => onDetail(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={reasonCode === "other" ? "Required notes…" : "Optional notes…"} />
    </div>
  );
}

function RefundStep({ mode, disposition, refundMethod, hasCustomer, preview, onDisposition, onRefundMethod }: {
  mode: ReturnWorkspaceMode;
  disposition: ReturnDisposition;
  refundMethod: RefundMethod;
  hasCustomer: boolean;
  preview: ReturnType<typeof previewReturn> | null;
  onDisposition: (d: ReturnDisposition) => void;
  onRefundMethod: (m: RefundMethod) => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-3">
      {(["refund", "credit", "exchange"] as const).map((id) => (
        <button key={id} type="button" disabled={mode === "exchange" && id !== "exchange"} onClick={() => { onDisposition(id); if (id === "credit") onRefundMethod("customer_credit"); }} className={`block w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ${disposition === id ? "border-[var(--pos-primary)] bg-blue-50" : "border-slate-200"}`}>
          {id === "refund" ? "Cash / bank / credit refund" : id === "credit" ? "Store credit" : "Exchange (no tender)"}
        </button>
      ))}
      {disposition === "refund" && REFUND_METHOD_OPTIONS.map((m) => (
        <button key={m.id} type="button" disabled={m.id === "customer_credit" && !hasCustomer} onClick={() => onRefundMethod(m.id)} className={`block w-full rounded-xl border px-3 py-2 text-left text-xs ${refundMethod === m.id ? "border-[var(--pos-primary)] bg-blue-50" : "border-slate-200"}`}>
          {m.label}
        </button>
      ))}
      {preview && <p className="text-xs font-bold">Refund {money(preview.prepared.refundAmount)} · {formatSettlementLabel(preview.settlement)}</p>}
    </div>
  );
}

function ApprovalStep({ canApprove, needsApproval, refundAmount, acknowledged, onAcknowledge }: { canApprove: boolean; needsApproval: boolean; refundAmount: number; acknowledged: boolean; onAcknowledge: (v: boolean) => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-2 text-sm">
      <p>Chain: {returnApprovalChainLabel()}</p>
      {canApprove ? <p className="text-emerald-700">You can approve and post this return.</p> : needsApproval ? (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} />
          Manager approved refund {money(refundAmount)}
        </label>
      ) : (
        <p className="text-slate-500">No monetary refund — approval not required.</p>
      )}
    </div>
  );
}

function ConfirmStep({ saleView, selectedSaleId, preview, selectedLines, notes, onNotes }: {
  saleView: SaleView | null;
  selectedSaleId: string | null;
  preview: NonNullable<ReturnType<typeof previewReturn>>;
  selectedLines: SelectedReturnLine[];
  notes: string;
  onNotes: (v: string) => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-3 text-xs">
      <p><strong>Invoice:</strong> {saleView?.invoiceNumber ?? selectedSaleId?.slice(0, 8)}</p>
      <p><strong>Scope:</strong> {preview.prepared.scope} · <strong>Refund:</strong> {money(preview.prepared.refundAmount)}</p>
      <ul className="divide-y rounded-xl border">
        {selectedLines.map((l) => (
          <li key={l.saleItemId} className="flex justify-between px-3 py-2">
            <span>{l.name} × {l.qty}</span>
            <span>{money(l.qty * l.unitPrice)}</span>
          </li>
        ))}
      </ul>
      <textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={2} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Confirmation notes" />
      <p className="text-[10px] text-slate-500">Posts a real sale_return via POST /api/v1/pos/returns with stock reversal and refund settlement.</p>
    </div>
  );
}
