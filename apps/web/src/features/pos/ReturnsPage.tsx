import { useCallback, useEffect, useMemo, useState } from "react";
import {
  maxReturnableQty,
  prepareSaleReturn,
  restockDecision,
  RETURN_REASON_CODES,
  type ReturnCondition,
  type ReturnDisposition,
  type ReturnReasonCode,
  type RefundMethod,
} from "@electronic-erp/domain";
import { Button, Card, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { inventoryApi } from "@/features/inventory/inventory-api";
import {
  formatOnlineFailure,
  INTERNET_REQUIRED_MESSAGE,
  INTERNET_REQUIRED_TITLE,
  requireInternetConnection,
} from "@/lib/online-required";
import { posApi } from "./pos-api";

function uuid() {
  return crypto.randomUUID();
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

type ReturnableRow = {
  saleItemId: string;
  productId: string | null;
  unitId: string;
  name: string;
  soldQty: number;
  previouslyReturnedQty: number;
  maxReturnable: number;
  unitPrice: number;
  batchId?: string | null;
};

type LineDraft = ReturnableRow & {
  selected: boolean;
  qty: string;
  condition: ReturnCondition;
  originalPackaging: boolean;
  accessoriesComplete: boolean;
  inspectionNotes: string;
  exchangeProductId: string;
};

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: "Search invoice" },
  { id: 2, label: "Select items" },
  { id: 3, label: "Return details" },
  { id: 4, label: "Refund / exchange" },
  { id: 5, label: "Confirmation" },
];

export function ReturnsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [step, setStep] = useState<WizardStep>(1);
  const [warehouseId, setWarehouseId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matches, setMatches] = useState<Array<Record<string, unknown>>>([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [invoiceNumberLabel, setInvoiceNumberLabel] = useState("");
  const [hasCustomer, setHasCustomer] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode>("defective");
  const [reasonDetail, setReasonDetail] = useState("");
  const [disposition, setDisposition] = useState<ReturnDisposition>("refund");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [confirmationNotes, setConfirmationNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [postedId, setPostedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuid());

  useEffect(() => {
    void inventoryApi.listWarehouses().then((r) => {
      if (r.items[0]) setWarehouseId(String(r.items[0].id));
    });
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

  const refreshHistory = useCallback(async () => {
    if (!branchId) return;
    try {
      const [list, rep] = await Promise.all([
        posApi.listReturns(branchId),
        posApi.returnReport({ branchId }),
      ]);
      setHistory(list.items.slice(0, 20));
      setReport(rep.summary);
    } catch {
      /* ignore */
    }
  }, [branchId]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  async function search() {
    if (!branchId) return;
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
    } catch (err) {
      const failed = formatOnlineFailure(err, "generic");
      toast.push({
        title: failed.title,
        description: failed.description,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function selectSale(sale: Record<string, unknown>) {
    setBusy(true);
    try {
      const data = await posApi.getReturnableSale(String(sale.id));
      const returnable = (data.returnableLines as ReturnableRow[]) ?? [];
      setSelectedSaleId(String(sale.id));
      setInvoiceNumberLabel(String(sale.invoiceNumber ?? ""));
      setHasCustomer(Boolean((data.sale as { customerId?: string | null })?.customerId));
      setLines(
        returnable
          .filter((r) => r.maxReturnable > 0)
          .map((r) => ({
            ...r,
            selected: true,
            qty: String(r.maxReturnable),
            condition: "good" as ReturnCondition,
            originalPackaging: true,
            accessoriesComplete: true,
            inspectionNotes: "",
            exchangeProductId: "",
          })),
      );
      setStep(2);
    } catch (err) {
      toast.push({
        title: "Could not load sale",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  const selectedLines = useMemo(() => lines.filter((l) => l.selected && Number(l.qty) > 0), [lines]);

  const preview = useMemo(() => {
    try {
      return prepareSaleReturn({
        disposition,
        reasonCode,
        reasonDetail,
        refundMethod: disposition === "refund" ? refundMethod : undefined,
        hasCustomer,
        returnable: lines.map((l) => ({
          saleItemId: l.saleItemId,
          productId: l.productId,
          unitId: l.unitId,
          soldQty: l.soldQty,
          previouslyReturnedQty: l.previouslyReturnedQty,
          unitPrice: l.unitPrice,
          batchId: l.batchId,
        })),
        lines: selectedLines.map((l) => ({
          originalSaleItemId: l.saleItemId,
          productId: l.productId,
          unitId: l.unitId,
          qty: Number(l.qty),
          unitPrice: l.unitPrice,
          exchangeProductId: l.exchangeProductId || null,
          condition: l.condition,
          originalPackaging: l.originalPackaging,
          accessoriesComplete: l.accessoriesComplete,
          inspectionNotes: l.inspectionNotes || null,
          batchId: l.batchId,
        })),
      });
    } catch {
      return null;
    }
  }, [disposition, reasonCode, reasonDetail, refundMethod, hasCustomer, lines, selectedLines]);

  async function confirmPost() {
    if (!branchId || !warehouseId || !selectedSaleId || !preview) {
      toast.push({ title: "Complete all return steps first", tone: "danger" });
      return;
    }
    if (!requireInternetConnection(toast.push)) return;
    setBusy(true);
    try {
      const ret = (await posApi.postReturn({
        branchId,
        warehouseId,
        originalSaleId: selectedSaleId,
        returnType: disposition,
        returnScope: preview.scope,
        reasonCode,
        reason: reasonDetail || undefined,
        refundMethod: disposition === "refund" ? refundMethod : undefined,
        confirmationNotes: confirmationNotes || undefined,
        items: preview.lines.map((l) => ({
          originalSaleItemId: l.originalSaleItemId,
          productId: l.productId || undefined,
          unitId: l.unitId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          exchangeProductId: l.exchangeProductId || undefined,
          condition: l.condition,
          originalPackaging: l.originalPackaging,
          accessoriesComplete: l.accessoriesComplete,
          inspectionNotes: l.inspectionNotes || undefined,
          batchId: l.batchId || undefined,
        })),
        idempotencyKey,
        operationId: idempotencyKey,
      })) as { id?: string };
      setPostedId(ret.id ?? "posted");
      setStep(5);
      toast.push({ title: "Return posted", tone: "success" });
      await refreshHistory();
    } catch (err) {
      const failed = formatOnlineFailure(
        err,
        disposition === "exchange" ? "exchange" : "return",
      );
      toast.push({
        title: failed.title,
        description: failed.description,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setSelectedSaleId("");
    setLines([]);
    setPostedId(null);
    setReasonDetail("");
    setConfirmationNotes("");
    setIdempotencyKey(uuid());
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Returns / Exchange</h1>
        <p className="text-sm text-[var(--erp-muted)]">
          Search invoice → select items → inspection → refund/exchange → confirm. Qty cannot exceed
          sold minus previously returned.
        </p>
      </div>

      {!online ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <strong>{INTERNET_REQUIRED_TITLE}</strong>
          <span className="mt-0.5 block">{INTERNET_REQUIRED_MESSAGE}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={step === s.id ? "primary" : "secondary"}
            onClick={() => {
              if (s.id < step || (postedId && s.id === 5)) setStep(s.id);
            }}
          >
            {s.id}. {s.label}
          </Button>
        ))}
      </div>

      {step === 1 ? (
        <Card title="1. Search invoice">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Invoice number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
            <Input
              label="Customer / mobile"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
            />
            <Input
              label="Date from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              label="Date to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Input
              label="Warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <Button onClick={() => void search()} disabled={busy}>
              Search
            </Button>
          </div>
          <ul className="mt-3 max-h-64 divide-y overflow-auto text-sm">
            {matches.map((s) => (
              <li key={String(s.id)} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <strong>{String(s.invoiceNumber)}</strong>
                  <div className="text-[var(--erp-muted)]">
                    {Number(s.grandTotal ?? 0).toFixed(2)} · {String(s.status)}
                    {s.customerName ? ` · ${String(s.customerName)}` : ""}
                    {s.customerMobile ? ` · ${String(s.customerMobile)}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void selectSale(s)}>
                  Select
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card title={`2. Select items · ${invoiceNumberLabel}`}>
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li key={line.saleItemId} className="rounded-lg border px-3 py-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={line.selected}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.saleItemId === line.saleItemId
                            ? { ...x, selected: e.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  <div className="flex-1">
                    <div className="font-medium">{line.name}</div>
                    <div className="text-xs text-[var(--erp-muted)]">
                      Sold {line.soldQty} · Returned {line.previouslyReturnedQty} · Max{" "}
                      {line.maxReturnable}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                      <Input
                        label="Return qty"
                        value={line.qty}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.saleItemId === line.saleItemId
                                ? {
                                    ...x,
                                    qty: String(
                                      Math.min(
                                        Number(e.target.value) || 0,
                                        maxReturnableQty(
                                          x.soldQty,
                                          x.previouslyReturnedQty,
                                        ),
                                      ),
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Input label="Unit price" value={String(line.unitPrice)} readOnly />
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              disabled={!selectedLines.length}
              onClick={() => setStep(3)}
            >
              Next
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card title="3. Return details & inspection">
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <Select
              label="Reason"
              options={RETURN_REASON_CODES.map((c) => ({
                value: c,
                label: c.replace(/_/g, " "),
              }))}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReturnReasonCode)}
            />
            <Input
              label="Reason detail"
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              placeholder={reasonCode === "other" ? "Required for other" : "Optional"}
            />
          </div>
          <ul className="space-y-3 text-sm">
            {selectedLines.map((line) => {
              const decision = restockDecision({
                condition: line.condition,
                originalPackaging: line.originalPackaging,
                accessoriesComplete: line.accessoriesComplete,
              });
              return (
                <li key={line.saleItemId} className="rounded-lg border px-3 py-2">
                  <div className="font-medium">{line.name}</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <Select
                      label="Condition"
                      options={[
                        { value: "good", label: "Good" },
                        { value: "opened", label: "Opened" },
                        { value: "damaged", label: "Damaged" },
                        { value: "defective", label: "Defective" },
                        { value: "incomplete", label: "Incomplete" },
                      ]}
                      value={line.condition}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.saleItemId === line.saleItemId
                              ? { ...x, condition: e.target.value as ReturnCondition }
                              : x,
                          ),
                        )
                      }
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={line.originalPackaging}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.saleItemId === line.saleItemId
                                ? { ...x, originalPackaging: e.target.checked }
                                : x,
                            ),
                          )
                        }
                      />
                      Original packaging
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={line.accessoriesComplete}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.saleItemId === line.saleItemId
                                ? { ...x, accessoriesComplete: e.target.checked }
                                : x,
                            ),
                          )
                        }
                      />
                      Accessories complete
                    </label>
                    <Input
                      label="Inspection notes"
                      value={line.inspectionNotes}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.saleItemId === line.saleItemId
                              ? { ...x, inspectionNotes: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="mt-1 text-xs text-[var(--erp-muted)]">
                    Restock: {decision.restock ? decision.target : "none"}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)}>Next</Button>
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card title="4. Refund / exchange">
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Return type"
              options={[
                { value: "refund", label: "Refund" },
                { value: "credit", label: "Customer credit" },
                { value: "exchange", label: "Exchange" },
              ]}
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as ReturnDisposition)}
            />
            {disposition === "refund" ? (
              <Select
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
          {disposition === "exchange" ? (
            <ul className="mt-3 space-y-2 text-sm">
              {selectedLines.map((line) => (
                <li key={line.saleItemId}>
                  <Input
                    label={`Exchange product ID · ${line.name}`}
                    value={line.exchangeProductId}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x) =>
                          x.saleItemId === line.saleItemId
                            ? { ...x, exchangeProductId: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            label="Confirmation notes"
            value={confirmationNotes}
            onChange={(e) => setConfirmationNotes(e.target.value)}
          />
          {preview ? (
            <div className="mt-3 rounded-lg border p-3 text-sm">
              <div>
                Scope: <strong>{preview.scope}</strong> · Method:{" "}
                <strong>{preview.refundMethod ?? "—"}</strong> · Amount:{" "}
                <strong>{preview.refundAmount.toFixed(2)}</strong>
              </div>
              <div className="text-[var(--erp-muted)]">{preview.reason}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-[var(--erp-danger)]">
              Fix validation errors before confirming (qty, reason, exchange product, credit
              customer).
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button disabled={!preview || busy} onClick={() => void confirmPost()}>
              {busy ? "Posting…" : "Confirm return"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card title="5. Confirmation">
          <p className="text-sm">
            Return posted successfully
            {postedId ? (
              <>
                {" "}
                · id <code>{postedId}</code>
              </>
            ) : null}
            {invoiceNumberLabel ? <> · invoice {invoiceNumberLabel}</> : null}
          </p>
          {preview ? (
            <ul className="mt-2 text-sm text-[var(--erp-muted)]">
              <li>Scope: {preview.scope}</li>
              <li>Type: {preview.disposition}</li>
              <li>Refund: {preview.refundMethod ?? "—"}</li>
              <li>Amount: {preview.refundAmount.toFixed(2)}</li>
            </ul>
          ) : null}
          <Button className="mt-3" onClick={resetWizard}>
            New return
          </Button>
        </Card>
      ) : null}

      <Card title="Return history & report">
        {report ? (
          <div className="mb-3 grid gap-2 text-sm md:grid-cols-3">
            <div>Count: {String(report.count ?? 0)}</div>
            <div>Total: {Number(report.totalRefundAmount ?? 0).toFixed(2)}</div>
            <div>By type: {JSON.stringify(report.byDisposition ?? {})}</div>
          </div>
        ) : null}
        <ul className="max-h-48 divide-y overflow-auto text-sm">
          {history.map((h) => (
            <li key={String(h.id)} className="py-2">
              <strong>{String(h.return_type)}</strong> · {Number(h.refund_amount ?? 0).toFixed(2)} ·{" "}
              {String(h.reason_code ?? h.reason ?? "")} · {String(h.return_scope ?? "")}
            </li>
          ))}
          {!history.length ? (
            <li className="py-2 text-[var(--erp-muted)]">No returns yet</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
