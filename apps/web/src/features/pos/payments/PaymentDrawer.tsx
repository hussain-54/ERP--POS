import { useEffect, useMemo, useState } from "react";
import { money } from "../format";
import type { PosPaymentKind, PosPaymentLine } from "../types";
import { PAYMENT_METHODS, tenderToMethodKind } from "../types";
import { roundMoney, validatePosPayment } from "./payment-utils";
import "../sales/sales-register.css";

type SplitRow = {
  id: string;
  kind: PosPaymentKind;
  amount: string;
  reference: string;
};

type InstallmentFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";

function newRow(kind: PosPaymentKind = "cash", amount = ""): SplitRow {
  return { id: crypto.randomUUID?.() ?? String(Math.random()), kind, amount, reference: "" };
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextDue(start: string, index: number, frequency: InstallmentFrequency): string {
  if (frequency === "weekly") return addDays(start, index * 7);
  if (frequency === "biweekly") return addDays(start, index * 14);
  if (frequency === "quarterly") return addMonths(start, index * 3);
  return addMonths(start, index);
}

const IMMEDIATE_KINDS = PAYMENT_METHODS.filter(
  (m) => !["split", "partial", "credit", "installment"].includes(m.id),
);

export function PaymentDrawer({
  open,
  grandTotal,
  paymentKind,
  methodsByKind,
  hasCustomer,
  walkIn,
  onClose,
  onConfirm,
  confirmLabel = "Record payment",
}: {
  open: boolean;
  grandTotal: number;
  paymentKind: PosPaymentKind;
  methodsByKind: Record<string, string>;
  hasCustomer: boolean;
  walkIn: boolean;
  onClose: () => void;
  onConfirm: (
    lines: PosPaymentLine[],
    meta?: {
      downPayment: string;
      installmentCount: number;
      frequency?: InstallmentFrequency;
      startDate?: string;
    },
  ) => void;
  confirmLabel?: string;
}) {
  const [cashReceived, setCashReceived] = useState(grandTotal);
  const [reference, setReference] = useState("");
  const [splitRows, setSplitRows] = useState<SplitRow[]>(() => [
    newRow("cash", String(roundMoney(grandTotal / 2))),
    newRow("card", String(roundMoney(grandTotal / 2))),
  ]);
  const [partialPaid, setPartialPaid] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [frequency, setFrequency] = useState<InstallmentFrequency>("monthly");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  const method = PAYMENT_METHODS.find((m) => m.id === paymentKind);
  const isSplit = paymentKind === "split";
  const isInstallment = paymentKind === "installment";

  useEffect(() => {
    if (!open) return;
    setCashReceived(grandTotal);
    setPartialPaid(roundMoney(grandTotal / 2));
    setSplitRows([
      newRow("cash", String(roundMoney(grandTotal / 2))),
      newRow("card", String(roundMoney(Math.max(0, grandTotal - grandTotal / 2)))),
    ]);
    setDownPayment(roundMoney(Math.min(grandTotal * 0.3, grandTotal)));
    setInstallmentCount(3);
    setFrequency("monthly");
    setStartDate(new Date().toISOString().slice(0, 10));
    setReference("");
    setError("");
  }, [open, grandTotal, paymentKind]);

  function resolveId(kind: PosPaymentKind): string | null {
    return methodsByKind[tenderToMethodKind(kind)] ?? methodsByKind.cash ?? null;
  }

  function buildLines(): PosPaymentLine[] {
    if (paymentKind === "credit") return [];
    if (paymentKind === "installment") return [];

    if (paymentKind === "split") {
      const rows: PosPaymentLine[] = [];
      for (const row of splitRows) {
        const amt = roundMoney(Number(row.amount) || 0);
        if (amt <= 0) continue;
        const id = resolveId(row.kind);
        if (!id) throw new Error(`Payment method not configured for ${row.kind}`);
        rows.push({
          kind: row.kind,
          paymentMethodId: id,
          amount: amt,
          amountReceived: row.kind === "cash" ? amt : undefined,
          reference: row.reference || undefined,
        });
      }
      return rows;
    }

    if (paymentKind === "partial") {
      const id = resolveId("cash");
      if (!id) throw new Error("Payment method not configured");
      const paid = roundMoney(Math.min(partialPaid, grandTotal));
      if (paid <= 0) throw new Error("Enter partial amount received");
      return [
        {
          kind: "partial",
          paymentMethodId: id,
          amount: paid,
          amountReceived: paid,
          reference: reference || undefined,
        },
      ];
    }

    const id = resolveId(paymentKind);
    if (!id) throw new Error("Payment method not configured — seed payment methods first");
    if (paymentKind === "cash" && cashReceived + 1e-9 < grandTotal) {
      throw new Error("Cash received is less than total");
    }
    return [
      {
        kind: paymentKind,
        paymentMethodId: id,
        amount: grandTotal,
        amountReceived: paymentKind === "cash" ? cashReceived : grandTotal,
        reference: reference || undefined,
      },
    ];
  }

  const draftLines = useMemo(() => {
    try {
      return buildLines();
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentKind, cashReceived, partialPaid, splitRows, reference, grandTotal, methodsByKind]);

  const prep = useMemo(
    () =>
      validatePosPayment({
        grandTotal,
        lines: draftLines,
        paymentKind,
        walkIn,
        hasCustomer,
        useInstallment: paymentKind === "installment",
      }),
    [draftLines, grandTotal, paymentKind, walkIn, hasCustomer],
  );

  const splitPaid = roundMoney(splitRows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const splitRemaining = roundMoney(Math.max(0, grandTotal - splitPaid));
  const splitOver = splitPaid > grandTotal + 0.009;
  const splitFullyAllocated = !splitOver && Math.abs(splitPaid - grandTotal) <= 0.009;

  const remainingAfterDown = roundMoney(Math.max(0, grandTotal - downPayment));
  const perInstallment = installmentCount > 0 ? roundMoney(remainingAfterDown / installmentCount) : 0;
  const schedule = useMemo(() => {
    if (!isInstallment) return [];
    return Array.from({ length: installmentCount }, (_, i) => ({
      n: i + 1,
      due: nextDue(startDate, i, frequency),
      amount: perInstallment,
    }));
  }, [isInstallment, installmentCount, startDate, frequency, perInstallment]);

  function confirm() {
    setError("");
    try {
      if ((paymentKind === "credit" || paymentKind === "installment") && !hasCustomer) {
        throw new Error("Credit and installment require a customer on the sale");
      }
      if (paymentKind === "installment") {
        if (downPayment < 0 || downPayment > grandTotal + 0.001) {
          throw new Error("Down payment must be between 0 and total due");
        }
        if (installmentCount < 2) throw new Error("Need at least 2 installments");
        onConfirm([], {
          downPayment: String(downPayment),
          installmentCount: Math.max(2, installmentCount),
          frequency,
          startDate,
        });
        onClose();
        return;
      }
      if (paymentKind === "credit") {
        onConfirm([]);
        onClose();
        return;
      }
      if (paymentKind === "split") {
        if (!splitFullyAllocated) {
          throw new Error(
            splitOver
              ? "Allocated amount exceeds total due"
              : `Remaining ${money(splitRemaining)} must be allocated before confirming`,
          );
        }
      }
      const lines = buildLines();
      const validation = validatePosPayment({
        grandTotal,
        lines,
        paymentKind,
        walkIn,
        hasCustomer,
      });
      if (!validation.ok) {
        throw new Error(validation.errors[0] ?? "Payment could not be prepared");
      }
      onConfirm(lines);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment invalid");
    }
  }

  if (!open) return null;

  const title = isSplit
    ? "Split Payment"
    : isInstallment
      ? "Installment Plan"
      : (method?.label ?? paymentKind);

  const primaryLabel = isSplit
    ? "Confirm Split Payment"
    : isInstallment
      ? "Confirm Installment"
      : confirmLabel;

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="pos-sale-drawer"
        role="dialog"
        aria-modal
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment</p>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {isSplit ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-blue-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-blue-700">Total Due</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-blue-900">{money(grandTotal)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Allocated</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-emerald-900">{money(splitPaid)}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-amber-700">Remaining</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-amber-900">{money(splitRemaining)}</p>
                </div>
                <div className={`rounded-xl p-2.5 ${splitFullyAllocated ? "bg-emerald-100" : "bg-slate-100"}`}>
                  <p className="text-[10px] font-bold uppercase text-slate-600">Status</p>
                  <p className={`mt-0.5 text-xs font-black ${splitFullyAllocated ? "text-emerald-800" : "text-slate-700"}`}>
                    {splitOver ? "Over Allocated" : splitFullyAllocated ? "Fully Allocated" : "Remaining"}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {splitRows.map((row, index) => (
                  <div key={row.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Payment {index + 1}
                      </p>
                      {splitRows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setSplitRows((rows) => rows.filter((r) => r.id !== row.id))}
                          className="text-[10px] font-bold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Method
                      <select
                        value={row.kind}
                        onChange={(e) =>
                          setSplitRows((rows) =>
                            rows.map((r) => (r.id === row.id ? { ...r, kind: e.target.value as PosPaymentKind } : r)),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                      >
                        {IMMEDIATE_KINDS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Amount
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          Rs.
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.amount}
                          onChange={(e) =>
                            setSplitRows((rows) =>
                              rows.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r)),
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-2.5 text-right text-sm font-bold tabular-nums"
                        />
                      </div>
                    </label>
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Reference (optional)
                      <input
                        value={row.reference}
                        onChange={(e) =>
                          setSplitRows((rows) =>
                            rows.map((r) => (r.id === row.id ? { ...r, reference: e.target.value } : r)),
                          )
                        }
                        placeholder="Txn / slip #"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSplitRows((rows) => [
                    ...rows,
                    newRow("cash", splitRemaining > 0 ? String(splitRemaining) : ""),
                  ])
                }
                className="w-full rounded-xl border border-dashed border-cyan-400 bg-cyan-50 py-2.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100"
              >
                + Add Payment
              </button>
            </>
          ) : null}

          {isInstallment ? (
            <>
              {!hasCustomer ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                  Attach a customer before confirming an installment plan.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-blue-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-blue-700">Total Amount</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-blue-900">{money(grandTotal)}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-amber-700">Remaining</p>
                  <p className="mt-0.5 text-sm font-black tabular-nums text-amber-900">{money(remainingAfterDown)}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Down Payment
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Number of Installments
                  <input
                    type="number"
                    min={2}
                    max={24}
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Number(e.target.value) || 3)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Frequency
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as InstallmentFrequency)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  First Due Date
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-800">Installment Schedule</p>
                  <p className="text-[11px] font-black tabular-nums text-slate-900">
                    Rs. {money(perInstallment)} each
                  </p>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
                  {schedule.map((row) => (
                    <div
                      key={row.n}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
                    >
                      <span className="font-semibold text-slate-600">#{row.n} · {row.due}</span>
                      <span className="font-black tabular-nums text-slate-900">{money(row.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {!isSplit && !isInstallment ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-blue-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-blue-700">Total</p>
                  <p className="mt-0.5 text-sm font-bold text-blue-900">{money(grandTotal)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Paid</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-900">{money(prep.paidTowardBill)}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-amber-700">Remaining</p>
                  <p className="mt-0.5 text-sm font-bold text-amber-900">{money(prep.remaining)}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-600">Change</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{money(prep.change)}</p>
                </div>
              </div>

              {method?.recordOnly ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  Record-only tender — no live gateway charge. Reference is stored on the sale for reconciliation.
                </p>
              ) : null}

              {(paymentKind === "cash" || paymentKind === "partial") && (
                <label className="block text-xs font-semibold text-slate-600">
                  {paymentKind === "partial" ? "Partial amount received" : "Cash received"}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paymentKind === "partial" ? partialPaid : cashReceived}
                    onChange={(e) =>
                      paymentKind === "partial"
                        ? setPartialPaid(Number(e.target.value) || 0)
                        : setCashReceived(Number(e.target.value) || 0)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              )}

              {(paymentKind === "credit") && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Credit / udhar posts the full sale with remaining balance on the customer ledger. Server enforces
                  credit limits.
                </div>
              )}

              {!["cash", "credit", "installment", "split"].includes(paymentKind) ? (
                <label className="block text-xs font-semibold text-slate-600">
                  Reference (optional)
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Txn / slip #"
                  />
                </label>
              ) : null}

              {!prep.ok && prep.errors.length && paymentKind !== "credit" ? (
                <p className="text-xs text-amber-700">{prep.errors[0]}</p>
              ) : null}
            </>
          ) : null}

          {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={isSplit && !splitFullyAllocated}
            className="flex-1 rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {primaryLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}

/** @deprecated Use PaymentDrawer — kept for imports. */
export { PaymentDrawer as PaymentDialog };
