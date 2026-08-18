import { useCallback, useEffect, useMemo, useState } from "react";
import {
  prepareSaleReturn,
  refundSettlementPlan,
  type RefundMethod,
  type ReturnDisposition,
  type ReturnReasonCode,
} from "@electronic-erp/domain";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { inventoryApi } from "@/features/inventory/inventory-api";
import {
  formatOnlineFailure,
  INTERNET_REQUIRED_MESSAGE,
  INTERNET_REQUIRED_TITLE,
  requireInternetConnection,
} from "@/lib/online-required";
import { PosInvoiceSearch, PosSaleReview, PosWorkflowAlert } from "./components/PosSaleReview";
import { posApi } from "./pos-api";
import { formatMoney, formatSaleDate } from "./sales-workspace";
import {
  clampReturnQty,
  CONDITION_OPTIONS,
  lineRestockLabel,
  parseReturnableSale,
  parseReturnHistoryRow,
  REASON_OPTIONS,
  remainingQtyTotal,
  RETURN_LINE_COLUMNS,
  RETURN_STEPS,
  returnOperationWarnings,
  restockEffectLabel,
  selectedReturnLines,
  toReturnableRows,
  toReturnLineInputs,
  type ParsedReturnableSale,
  type ReturnHistoryRow,
  type ReturnStepId,
  type ReturnableDraft,
} from "./returns-workspace";
import {
  POSActionBar,
  POSBadge,
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSConfirmDialog,
  POSEmptyState,
  POSInput,
  POSPageHeader,
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

export function ReturnsPage() {
  const toast = useToast();
  const { branchId, hasPermission } = useAuth();
  const canReturn = hasPermission("pos.return");

  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [step, setStep] = useState<ReturnStepId>("find");
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matches, setMatches] = useState<Array<Record<string, unknown>>>([]);
  const [sale, setSale] = useState<ParsedReturnableSale | null>(null);
  const [lines, setLines] = useState<ReturnableDraft[]>([]);
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("defective");
  const [reasonDetail, setReasonDetail] = useState("");
  const [disposition, setDisposition] = useState<ReturnDisposition>("refund");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ReturnHistoryRow[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuid());

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
  }, [warehouseId]);

  const refreshHistory = useCallback(async () => {
    if (!branchId || !canReturn) return;
    try {
      const [list, rep] = await Promise.all([
        posApi.listReturns(branchId),
        posApi.returnReport({ branchId }),
      ]);
      setHistory(list.items.slice(0, 20).map((row) => parseReturnHistoryRow(row)));
      setReport(rep.summary);
    } catch (err) {
      toast.push({
        title: "Return history failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    }
  }, [branchId, canReturn]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const selected = useMemo(() => selectedReturnLines(lines), [lines]);
  const warnings = useMemo(
    () =>
      returnOperationWarnings({
        lines,
        hasCustomer: sale?.hasCustomer ?? false,
        disposition,
        refundMethod,
        reasonCode,
        reasonDetail,
      }),
    [lines, sale?.hasCustomer, disposition, refundMethod, reasonCode, reasonDetail],
  );

  const preview = useMemo(() => {
    try {
      if (!selected.length) return { value: null, error: "Select at least one returnable line" };
      return {
        value: prepareSaleReturn({
          disposition,
          reasonCode,
          reasonDetail,
          refundMethod: disposition === "refund" ? refundMethod : undefined,
          hasCustomer: sale?.hasCustomer ?? false,
          returnable: toReturnableRows(lines),
          lines: toReturnLineInputs(lines),
        }),
        error: null,
      };
    } catch (err) {
      return { value: null, error: err instanceof Error ? err.message : "Invalid return" };
    }
  }, [disposition, reasonCode, reasonDetail, refundMethod, sale?.hasCustomer, lines, selected.length]);

  const settlement = preview.value
    ? refundSettlementPlan({
        disposition: preview.value.disposition,
        refundMethod: preview.value.refundMethod,
        refundAmount: preview.value.refundAmount,
      })
    : null;

  const blocking = [...warnings, preview.error].filter((message, index, all): message is string =>
    Boolean(message) && all.indexOf(message) === index,
  );
  const canConfirm = Boolean(preview.value) && !blocking.length;

  async function search() {
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
      if (!res.items.length) {
        toast.push({ title: "No invoices found", tone: "info" });
      }
    } catch (err) {
      const failed = formatOnlineFailure(err, "return");
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
      setPostedId(null);
      setStep("review");
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

  async function postReturn() {
    if (posting) return;
    if (!branchId || !warehouseId || !sale || !preview.value) {
      toast.push({ title: "Complete all return steps first", tone: "danger" });
      return;
    }
    if (!requireInternetConnection(toast.push)) return;
    setPosting(true);
    try {
      const ret = (await posApi.postReturn({
        branchId,
        warehouseId,
        originalSaleId: sale.saleId,
        returnType: disposition,
        returnScope: preview.value.scope,
        reasonCode,
        reason: reasonDetail || undefined,
        refundMethod: disposition === "refund" ? refundMethod : undefined,
        confirmationNotes: notes || undefined,
        items: preview.value.lines.map((line) => ({
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
        idempotencyKey,
        operationId: idempotencyKey,
      })) as { id?: string };
      setPostedId(String(ret.id ?? "posted"));
      setConfirmOpen(false);
      setStep("result");
      toast.push({ title: "Return posted", description: String(ret.id ?? sale.invoiceNumber), tone: "success" });
      await refreshHistory();
    } catch (err) {
      setStep("confirm");
      const failed = formatOnlineFailure(err, "return");
      toast.push({ title: failed.title, description: failed.description, tone: "danger" });
    } finally {
      setPosting(false);
    }
  }

  function reset() {
    setStep("find");
    setSale(null);
    setLines([]);
    setPostedId(null);
    setReasonDetail("");
    setNotes("");
    setConfirmOpen(false);
    setIdempotencyKey(uuid());
  }

  const hasRemaining = remainingQtyTotal(lines) > 0;

  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Reports", to: "/pos/reports" },
          { label: "Returns" },
        ]}
      />
      <POSPageHeader
        title="Returns"
        subtitle="Find invoice → review sale → select items → quantities → return amount → refund method → confirm. Refund and stock follow existing return rules. Cash/bank/credit are recorded tenders, not a payment gateway."
      />

      {!canReturn ? (
        <POSEmptyState title="Returns are not available" description="This cashier needs pos.return to post returns." />
      ) : null}

      {!online ? (
        <div role="alert" className="rounded-[var(--pos-radius)] border border-[var(--pos-danger)] bg-[var(--pos-danger-soft)] px-3 py-2 text-sm text-[var(--pos-danger)]">
          <strong>{INTERNET_REQUIRED_TITLE}</strong>
          <span className="mt-0.5 block">{INTERNET_REQUIRED_MESSAGE}</span>
        </div>
      ) : null}

      <POSStepper steps={[...RETURN_STEPS]} activeId={step} />

      {step === "find" ? (
        <PosInvoiceSearch
          title="Find invoice"
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
          onSearch={() => void search()}
          onSelect={(row) => void selectSale(row)}
        />
      ) : null}

      {sale && step !== "find" && step !== "result" ? (
        <POSCard title="Original sale">
          <PosSaleReview sale={sale} lines={lines} refundAmount={preview.value?.refundAmount ?? null} />
        </POSCard>
      ) : null}

      {step === "review" && sale ? (
        <POSCard title="Review sale" description="Confirm the original invoice before selecting return lines.">
          {!hasRemaining ? (
            <PosWorkflowAlert messages={["Nothing remaining to return. Every line on this invoice is already fully returned."]} />
          ) : null}
          <POSTable className="mt-3 pos-register-table">
            <POSTableHead>
              <tr>
                <POSTh>Item</POSTh>
                <POSTh>Original Qty</POSTh>
                <POSTh>Returned Qty</POSTh>
                <POSTh>Remaining Returnable Qty</POSTh>
                <POSTh className="text-right">Original price</POSTh>
              </tr>
            </POSTableHead>
            <POSTableBody>
              {lines.map((line) => (
                <tr key={line.saleItemId}>
                  <POSTd>{line.name}</POSTd>
                  <POSTd className="tabular-nums">{line.soldQty}</POSTd>
                  <POSTd className="tabular-nums">{line.previouslyReturnedQty}</POSTd>
                  <POSTd className="tabular-nums">{line.maxReturnable}</POSTd>
                  <POSTd className="text-right tabular-nums">{formatMoney(line.unitPrice)}</POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("find")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!hasRemaining} onClick={() => setStep("items")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "items" ? (
        <POSCard title="Select return items" description="Tick the lines to return. Condition drives restock; it does not change the refund formula.">
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <POSSelect
              label="Return reason"
              options={REASON_OPTIONS}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
            />
            <POSInput
              label="Reason detail"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder={reasonCode === "other" ? "Required" : "Optional"}
            />
          </div>
          <POSTable className="pos-register-table">
            <POSTableHead>
              <tr>
                <POSTh />
                {RETURN_LINE_COLUMNS.filter((col) => col !== "Return qty").map((col) => (
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
                  <POSTd>
                    <span className="font-medium">{line.name}</span>
                    {line.selected ? (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <POSSelect
                          label="Condition"
                          options={CONDITION_OPTIONS}
                          value={line.condition}
                          onChange={(e) => patchLine(line.saleItemId, { condition: e.target.value as ReturnableDraft["condition"] })}
                        />
                        <POSInput
                          label="Inspection notes"
                          value={line.inspectionNotes}
                          onChange={(e) => patchLine(line.saleItemId, { inspectionNotes: e.target.value })}
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={line.originalPackaging}
                            onChange={(e) => patchLine(line.saleItemId, { originalPackaging: e.target.checked })}
                          />
                          Original packaging
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={line.accessoriesComplete}
                            onChange={(e) => patchLine(line.saleItemId, { accessoriesComplete: e.target.checked })}
                          />
                          Accessories complete
                        </label>
                        <p className="text-xs text-[var(--pos-muted)] md:col-span-2">Stock effect: {lineRestockLabel(line)}</p>
                      </div>
                    ) : null}
                  </POSTd>
                  <POSTd className="tabular-nums">{line.soldQty}</POSTd>
                  <POSTd className="tabular-nums">{line.previouslyReturnedQty}</POSTd>
                  <POSTd className="tabular-nums">{line.maxReturnable}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.unitPrice)}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.tax)}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.discount)}</POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
          {!lines.length ? (
            <POSEmptyState title="Nothing left to return" description="Every line on this invoice is already fully returned." />
          ) : null}
          <PosWorkflowAlert messages={warnings.filter((w) => w.includes("Select at least") || w.includes("Describe the return"))} />
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("review")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!lines.some((line) => line.selected && line.maxReturnable > 0)} onClick={() => setStep("qty")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "qty" ? (
        <POSCard title="Select quantities" description="Return quantity cannot exceed remaining returnable quantity.">
          <POSTable className="pos-register-table">
            <POSTableHead>
              <tr>
                {RETURN_LINE_COLUMNS.map((col) => (
                  <POSTh key={col}>{col}</POSTh>
                ))}
              </tr>
            </POSTableHead>
            <POSTableBody>
              {lines
                .filter((line) => line.selected)
                .map((line) => (
                  <tr key={line.saleItemId}>
                    <POSTd className="font-medium">{line.name}</POSTd>
                    <POSTd className="tabular-nums">{line.soldQty}</POSTd>
                    <POSTd className="tabular-nums">{line.previouslyReturnedQty}</POSTd>
                    <POSTd className="tabular-nums">{line.maxReturnable}</POSTd>
                    <POSTd className="tabular-nums">{formatMoney(line.unitPrice)}</POSTd>
                    <POSTd className="tabular-nums">{formatMoney(line.tax)}</POSTd>
                    <POSTd className="tabular-nums">{formatMoney(line.discount)}</POSTd>
                    <POSTd>
                      <POSInput
                        aria-label={`Return qty ${line.name}`}
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
            messages={warnings.filter((w) => w.includes("quantity") || w.includes("greater than zero") || w.includes("exceeds"))}
          />
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("items")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!selected.length} onClick={() => setStep("amount")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "amount" ? (
        <POSCard title="Show return amount" description="Amount comes from the posted-sale return plan. This screen does not recalculate refunds.">
          {preview.value ? (
            <div className="grid gap-2 md:grid-cols-3">
              <POSStatCard label="Refund amount" value={formatMoney(preview.value.refundAmount)} tone="primary" />
              <POSStatCard label="Scope" value={preview.value.scope} />
              <POSStatCard
                label="Stock effect"
                value={preview.value.lines.some((l) => l.restock) ? "Restock" : "No restock"}
                hint={preview.value.lines.map((l) => restockEffectLabel(l.restockTarget, l.restock)).join(" · ")}
              />
            </div>
          ) : (
            <PosWorkflowAlert messages={blocking} />
          )}
          {preview.value ? (
            <ul className="mt-3 space-y-1 text-sm text-[var(--pos-muted)]">
              {preview.value.lines.map((line) => (
                <li key={line.originalSaleItemId}>
                  {lines.find((l) => l.saleItemId === line.originalSaleItemId)?.name ?? line.originalSaleItemId}
                  {" · "}qty {line.qty}
                  {" · "}line {formatMoney(line.lineTotal)}
                  {" · "}
                  {restockEffectLabel(line.restockTarget, line.restock)}
                </li>
              ))}
            </ul>
          ) : null}
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("qty")}>
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
          title="Select refund method"
          description="Cash and bank are recorded tenders. Customer credit posts to the original customer. There is no payment-gateway refund."
        >
          <div className="grid gap-2 md:grid-cols-2">
            <POSSelect
              label="Settlement"
              options={[
                { value: "refund", label: "Refund" },
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
          </div>
          {settlement ? (
            <p className="mt-2 text-xs text-[var(--pos-muted)]">
              Settlement plan: {settlement.kind}
              {settlement.paymentKind ? ` · recorded ${settlement.paymentKind} tender` : ""}
              {settlement.kind === "none" ? " · no cash movement" : ""}
              {preview.value ? ` · ${formatMoney(settlement.amount)}` : ""}
            </p>
          ) : null}
          <PosWorkflowAlert messages={warnings.filter((w) => w.includes("credit") || w.includes("Walk-in"))} />
          {preview.error && !warnings.includes(preview.error) ? <PosWorkflowAlert messages={[preview.error]} /> : null}
          <POSActionBar
            sticky={false}
            className="mt-3 border-0 px-0"
            left={
              <POSButton variant="secondary" onClick={() => setStep("amount")}>
                Back
              </POSButton>
            }
            right={
              <POSButton disabled={!preview.value} onClick={() => setStep("confirm")}>
                Next
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "confirm" ? (
        <POSCard title="Confirm return" description="Posting writes a real return. Stock and refund follow the prepared return plan.">
          {sale ? <PosSaleReview sale={sale} lines={lines} refundAmount={preview.value?.refundAmount ?? null} compact /> : null}
          <POSInput className="mt-3" label="Confirmation notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {preview.value ? (
            <ul className="mt-3 text-sm text-[var(--pos-muted)]">
              <li>Refund amount: {formatMoney(preview.value.refundAmount)}</li>
              <li>Scope: {preview.value.scope}</li>
              <li>Reason: {preview.value.reason}</li>
              <li>Settlement: {preview.value.disposition}{settlement ? ` · ${settlement.kind}` : ""}</li>
            </ul>
          ) : null}
          <PosWorkflowAlert messages={blocking} />
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
                disabled={!canConfirm}
                onClick={() => setConfirmOpen(true)}
              >
                Confirm return
              </POSButton>
            }
          />
        </POSCard>
      ) : null}

      {step === "result" ? (
        <POSCard title="Show completion state">
          <p className="text-sm">
            Return posted
            {postedId ? (
              <>
                {" "}
                · <code>{postedId}</code>
              </>
            ) : null}
            {sale?.invoiceNumber ? <> · original invoice {sale.invoiceNumber}</> : null}
          </p>
          {sale ? (
            <div className="mt-3">
              <PosSaleReview sale={sale} lines={lines} refundAmount={preview.value?.refundAmount ?? null} />
            </div>
          ) : null}
          {preview.value ? (
            <ul className="mt-3 text-sm text-[var(--pos-muted)]">
              <li>Refund amount: {formatMoney(preview.value.refundAmount)}</li>
              <li>Scope: {preview.value.scope}</li>
              <li>Settlement: {preview.value.disposition}{settlement ? ` · ${settlement.kind}` : ""}</li>
              {preview.value.lines.map((line) => (
                <li key={line.originalSaleItemId}>
                  Stock effect: {restockEffectLabel(line.restockTarget, line.restock)}
                </li>
              ))}
            </ul>
          ) : null}
          <POSButton className="mt-3" onClick={reset}>
            New return
          </POSButton>
        </POSCard>
      ) : null}

      <POSCard title="Return history" description="Posted returns for this branch. Amounts come from the return register.">
        {report ? (
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <POSStatCard label="Count" value={String(report.count ?? 0)} />
            <POSStatCard label="Refund Amount" value={formatMoney(Number(report.totalRefundAmount ?? 0))} />
            <POSStatCard label="Posted" value={String((report.byDisposition as Record<string, number> | undefined)?.refund ?? 0)} hint="refund rows" />
          </div>
        ) : null}
        <ul className="max-h-48 divide-y overflow-auto text-sm">
          {history.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <POSBadge>{row.type || "return"}</POSBadge> {row.reason} · {row.scope}
              </span>
              <span className="tabular-nums">
                {formatMoney(row.amount)} · {row.createdAt ? formatSaleDate(row.createdAt) : ""}
              </span>
            </li>
          ))}
          {!history.length ? <li className="py-2 text-[var(--pos-muted)]">No returns yet</li> : null}
        </ul>
      </POSCard>

      <POSConfirmDialog
        open={confirmOpen}
        title="Confirm return"
        description={
          preview.value
            ? `Post this ${preview.value.scope} return for ${formatMoney(preview.value.refundAmount)} against ${sale?.invoiceNumber ?? "the original invoice"}? Stock will follow the inspection restock rules.`
            : "Return is not valid yet."
        }
        confirmLabel="Post return"
        loading={posting}
        onCancel={() => {
          if (!posting) setConfirmOpen(false);
        }}
        onConfirm={() => void postReturn()}
      />
    </div>
  );
}
