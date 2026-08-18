import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { partiesApi } from "@/features/customers/parties-api";
import { adminApi } from "@/features/users/admin-api";
import { infrastructureApi } from "@/features/system/infrastructure-api";
import { formatMoney, formatSaleDate, terminalLabel } from "./sales-workspace";
import {
  defaultPaymentDates,
  methodSettlementNote,
  parsePaymentRow,
  parsePaymentSummary,
  PAYMENT_STATUS_FILTERS,
  PAYMENT_TABLE_COLUMNS,
  paymentBackendHint,
  paymentNumber,
  paymentStatusText,
  paymentStatusTone,
  rowHasRecordOnlyMethod,
  type PaymentRow,
} from "./payment-center";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSModal,
  POSPageHeader,
  POSSearch,
  POSSelect,
  POSStatCard,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";
import type { PaymentRegisterSummary } from "@electronic-erp/domain";

function namedOptions(
  items: Array<{ id: string; name: string }>,
  empty: string,
): Array<{ value: string; label: string }> {
  return [{ value: "", label: empty }, ...items.map((i) => ({ value: i.id, label: i.name }))];
}

function uuid() {
  return crypto.randomUUID();
}

export function PaymentsPage() {
  const toast = useToast();
  const { branchId, hasPermission } = useAuth();
  const canReceive = hasPermission("payments.receive");

  const [dates, setDates] = useState(defaultPaymentDates);
  const [search, setSearch] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [cashierUserId, setCashierUserId] = useState("");
  const [view, setView] = useState("");
  const [filterBranchId, setFilterBranchId] = useState(branchId ?? "");
  const [deviceId, setDeviceId] = useState("");

  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [cashiers, setCashiers] = useState<Array<{ id: string; name: string }>>([]);
  const [methods, setMethods] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [terminals, setTerminals] = useState<Array<{ id: string; name: string }>>([]);
  const [terminalNames, setTerminalNames] = useState<Record<string, string>>({});

  const [items, setItems] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentRegisterSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PaymentRow | null>(null);

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordCustomerId, setRecordCustomerId] = useState("");
  const [recordMethodId, setRecordMethodId] = useState("");
  const [recordAmount, setRecordAmount] = useState("");
  const [recordReference, setRecordReference] = useState("");
  const [recordBusy, setRecordBusy] = useState(false);

  useEffect(() => {
    if (branchId && !filterBranchId) setFilterBranchId(branchId);
  }, [branchId, filterBranchId]);

  const queryParams = useMemo(
    () => ({
      branchId: filterBranchId || branchId || undefined,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      query: search.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      customerId: customerId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      cashierUserId: cashierUserId || undefined,
      view: view || undefined,
      deviceId: deviceId || undefined,
      direction: "receive",
      limit,
      offset,
    }),
    [
      filterBranchId,
      branchId,
      dates,
      search,
      invoiceNumber,
      customerId,
      paymentMethodId,
      cashierUserId,
      view,
      deviceId,
      offset,
    ],
  );

  const load = useCallback(async () => {
    if (!canReceive) {
      setItems([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const res = await partiesApi.searchPayments(queryParams);
      setItems(res.items.map((row) => parsePaymentRow(row)));
      setSummary(parsePaymentSummary(res.summary));
      setTotal(res.total);
    } catch (err) {
      toast.push({
        title: "Payments load failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [canReceive, queryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [dates, search, invoiceNumber, customerId, paymentMethodId, cashierUserId, view, deviceId, filterBranchId]);

  useEffect(() => {
    try {
      void partiesApi
        .listPaymentMethods()
        .then((r) =>
          setMethods(
            r.items
              .filter((m) => m.is_active !== false && m.isActive !== false)
              .map((m) => ({
                id: String(m.id),
                name: String(m.name ?? m.code ?? "Payment"),
                kind: String(m.kind ?? ""),
              })),
          ),
        )
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void partiesApi
        .listCustomers()
        .then((r) => setCustomers(r.items.map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void adminApi
        .listUsers()
        .then((r) =>
          setCashiers(
            r.items
              .map((u) => ({
                id: String(u.id ?? ""),
                name: String(u.full_name ?? u.fullName ?? u.email ?? "Cashier"),
              }))
              .filter((u) => u.id),
          ),
        )
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void adminApi
        .listBranches()
        .then((r) =>
          setBranches(
            r.items
              .map((b) => ({ id: String(b.id ?? ""), name: String(b.name ?? "Branch") }))
              .filter((b) => b.id),
          ),
        )
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void infrastructureApi
        .devices()
        .then((r) => {
          const list: Array<{ id: string; name: string }> = [];
          const names: Record<string, string> = {};
          for (const d of r.items) {
            const id = String(d.id ?? d.device_id ?? "");
            if (!id) continue;
            const name = String(d.name ?? d.label ?? d.code ?? "Terminal");
            list.push({ id, name });
            names[id] = name;
          }
          setTerminals(list);
          setTerminalNames(names);
        })
        .catch(() => undefined);
    } catch {
      /* devices list is optional */
    }
  }, []);

  async function openDetail(id: string) {
    try {
      const res = await partiesApi.getPayment(id);
      setSelected(parsePaymentRow(res.item));
    } catch (err) {
      toast.push({
        title: "Payment load failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    }
  }

  async function recordPayment() {
    if (recordBusy) return;
    if (!branchId) {
      toast.push({ title: "Select a branch", tone: "danger" });
      return;
    }
    const amount = Number(recordAmount);
    if (!recordCustomerId || !recordMethodId || !Number.isFinite(amount) || amount <= 0) {
      toast.push({ title: "Customer, method, and amount are required", tone: "danger" });
      return;
    }
    setRecordBusy(true);
    try {
      const payment = await partiesApi.postPayment({
        branchId,
        direction: "receive",
        partyType: "customer",
        customerId: recordCustomerId,
        splits: [{ paymentMethodId: recordMethodId, amount: String(amount), reference: recordReference.trim() || undefined }],
        billTotal: String(amount),
        reference: recordReference.trim() || undefined,
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      setRecordOpen(false);
      setRecordAmount("");
      setRecordReference("");
      await load();
      toast.push({
        title: "Receipt recorded",
        description: String(payment.receiptNumber ?? payment.id),
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setRecordBusy(false);
    }
  }

  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const recordKind = methods.find((m) => m.id === recordMethodId)?.kind ?? "";
  const recordNote = methodSettlementNote(recordKind);

  return (
    <div className="space-y-3">
      <POSPageHeader
        title="Payments"
        subtitle="Recorded receipts from POS checkout and on-account collects. Wallet and card methods are stored locally — there is no payment gateway."
        actions={
          <>
            <POSButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </POSButton>
            <POSButton onClick={() => setRecordOpen(true)} disabled={!canReceive}>
              Record payment
            </POSButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <POSStatCard label="Recorded" value={String(summary?.recordedCount ?? 0)} hint={formatMoney(summary?.recordedAmount ?? 0)} tone="success" />
        <POSStatCard label="Pending" value={String(summary?.pendingCount ?? 0)} tone="warning" />
        <POSStatCard label="Failed" value={String(summary?.failedCount ?? 0)} tone="danger" />
        <POSStatCard label="Reversed" value={String(summary?.reversedCount ?? 0)} />
        <POSStatCard label="Today" value={String(summary?.todayCount ?? 0)} hint={formatMoney(summary?.todayAmount ?? 0)} tone="primary" />
      </div>

      <POSCard title="Filters" padding="sm">
        <div className="mb-2">
          <POSSearch
            label="Search"
            placeholder="Payment #, invoice #, customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <POSInput
            label="Date"
            type="date"
            value={dates.dateFrom}
            onChange={(e) => setDates((d) => ({ ...d, dateFrom: e.target.value }))}
          />
          <POSInput
            label="To"
            type="date"
            value={dates.dateTo}
            onChange={(e) => setDates((d) => ({ ...d, dateTo: e.target.value }))}
          />
          <POSInput
            label="Invoice"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Invoice #"
          />
          <POSSelect
            label="Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={namedOptions(customers, "All customers")}
          />
          <POSSelect
            label="Payment Method"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            options={namedOptions(methods, "All methods")}
          />
          <POSSelect
            label="Cashier"
            value={cashierUserId}
            onChange={(e) => setCashierUserId(e.target.value)}
            options={namedOptions(cashiers, "All cashiers")}
          />
          <POSSelect
            label="Status"
            value={view}
            onChange={(e) => setView(e.target.value)}
            options={PAYMENT_STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label }))}
          />
          <POSSelect
            label="Branch"
            value={filterBranchId}
            onChange={(e) => setFilterBranchId(e.target.value)}
            options={namedOptions(branches, "Current branch")}
          />
          <POSSelect
            label="Terminal"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            options={namedOptions(terminals, "All terminals")}
          />
        </div>
      </POSCard>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.85fr)]">
        <POSCard padding="none">
          {loading && items.length === 0 ? (
            <POSLoadingState label="Loading payments…" rows={8} className="p-3" />
          ) : (
            <POSTable>
              <POSTableHead>
                <tr>
                  {PAYMENT_TABLE_COLUMNS.map((col) => (
                    <POSTh key={col} className={col === "Amount" ? "text-right" : undefined}>
                      {col}
                    </POSTh>
                  ))}
                </tr>
              </POSTableHead>
              <POSTableBody>
                {items.map((row) => (
                  <tr key={row.id} onClick={() => void openDetail(row.id)}>
                    <POSTd>
                      <span className="font-medium">{paymentNumber(row)}</span>
                    </POSTd>
                    <POSTd className="whitespace-nowrap">{formatSaleDate(row.occurredAt)}</POSTd>
                    <POSTd>{row.invoiceNumber?.trim() || "—"}</POSTd>
                    <POSTd>{row.customerName?.trim() || (row.customerId ? "Customer" : "Walk-in")}</POSTd>
                    <POSTd className="text-right tabular-nums">{formatMoney(row.totalAmount)}</POSTd>
                    <POSTd>
                      {row.paymentMethods?.trim() || "—"}
                      {rowHasRecordOnlyMethod(row) ? (
                        <div className="text-[10px] text-[var(--pos-muted)]">No gateway</div>
                      ) : null}
                    </POSTd>
                    <POSTd>{row.cashierName?.trim() || "Cashier"}</POSTd>
                    <POSTd>
                      <span className="line-clamp-2">{row.reference?.trim() || "—"}</span>
                    </POSTd>
                    <POSTd>
                      <POSBadge tone={paymentStatusTone(row)}>{paymentStatusText(row)}</POSBadge>
                      <div className="mt-0.5 text-[10px] text-[var(--pos-muted)]">{paymentBackendHint(row)}</div>
                    </POSTd>
                    <POSTd>
                      <POSButton
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openDetail(row.id);
                        }}
                      >
                        View
                      </POSButton>
                    </POSTd>
                  </tr>
                ))}
              </POSTableBody>
            </POSTable>
          )}
          {!canReceive ? (
            <POSEmptyState
              title="Payments are not available"
              description="This cashier needs payments.receive to view the payment center."
            />
          ) : !loading && items.length === 0 ? (
            <POSEmptyState
              title="No payments found"
              description="Posted POS receipts and on-account collects appear here. Status uses payments.status and sync_state."
            />
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--pos-border)] px-3 py-2 text-sm">
            <span className="text-[var(--pos-muted)]">
              {total} payment{total === 1 ? "" : "s"} · page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <POSButton
                size="sm"
                variant="secondary"
                disabled={offset <= 0 || loading}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                Previous
              </POSButton>
              <POSButton
                size="sm"
                variant="secondary"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset((o) => o + limit)}
              >
                Next
              </POSButton>
            </div>
          </div>
        </POSCard>

        <POSCard padding="sm" title="Payment details">
          {!selected ? (
            <POSEmptyState title="Select a payment" description="Choose a row to see splits, invoice, and settlement notes." />
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <h2 className="font-semibold">{paymentNumber(selected)}</h2>
                <POSBadge tone={paymentStatusTone(selected)}>{paymentStatusText(selected)}</POSBadge>
                <p className="mt-1 text-[11px] text-[var(--pos-muted)]">{paymentBackendHint(selected)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Date / Time</dt>
                  <dd>{formatSaleDate(selected.occurredAt)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Amount</dt>
                  <dd className="tabular-nums">{formatMoney(selected.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Customer</dt>
                  <dd>{selected.customerName?.trim() || (selected.customerId ? "Customer" : "Walk-in")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Invoice #</dt>
                  <dd>{selected.invoiceNumber?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Cashier</dt>
                  <dd>{selected.cashierName?.trim() || "Cashier"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Terminal</dt>
                  <dd>{terminalLabel(selected.deviceId, terminalNames)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Reference</dt>
                  <dd>{selected.reference?.trim() || "—"}</dd>
                </div>
                {selected.notes?.trim() ? (
                  <div className="col-span-2">
                    <dt className="text-[11px] uppercase text-[var(--pos-muted)]">Notes</dt>
                    <dd>{selected.notes}</dd>
                  </div>
                ) : null}
              </dl>
              <div>
                <h3 className="mb-1 text-[13px] font-semibold">Splits</h3>
                {selected.splits.length === 0 ? (
                  <p className="text-xs text-[var(--pos-muted)]">No split rows on this receipt.</p>
                ) : (
                  <ul className="space-y-1">
                    {selected.splits.map((split, i) => (
                      <li key={`${split.paymentMethodId}-${i}`} className="flex justify-between gap-2 border-b border-[var(--pos-border)] py-1">
                        <span>
                          {split.methodName}
                          {methodSettlementNote(split.methodKind) ? (
                            <span className="block text-[10px] text-[var(--pos-muted)]">
                              {methodSettlementNote(split.methodKind)}
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums">{formatMoney(split.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </POSCard>
      </div>

      <POSModal
        open={recordOpen}
        title="Record payment"
        onClose={() => setRecordOpen(false)}
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setRecordOpen(false)} disabled={recordBusy}>
              Close
            </POSButton>
            <POSButton onClick={() => void recordPayment()} loading={recordBusy}>
              Record
            </POSButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--pos-muted)]">
            Posts an on-account customer receipt through the existing payments API. Invoice remaining is updated at POS checkout, not here. There is no payment reversal endpoint.
          </p>
          <POSSelect
            label="Customer"
            value={recordCustomerId}
            onChange={(e) => setRecordCustomerId(e.target.value)}
            options={namedOptions(customers, "Select customer")}
          />
          <POSSelect
            label="Payment Method"
            value={recordMethodId}
            onChange={(e) => setRecordMethodId(e.target.value)}
            options={namedOptions(methods, "Select method")}
          />
          {recordNote ? <p className="text-xs text-[var(--pos-warning)]">{recordNote}</p> : null}
          <POSInput
            label="Amount"
            type="number"
            min={0}
            step="0.01"
            value={recordAmount}
            onChange={(e) => setRecordAmount(e.target.value)}
          />
          <POSInput
            label="Reference"
            value={recordReference}
            onChange={(e) => setRecordReference(e.target.value)}
          />
        </div>
      </POSModal>
    </div>
  );
}
