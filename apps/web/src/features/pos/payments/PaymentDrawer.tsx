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

function newRow(kind: PosPaymentKind = "cash", amount = ""): SplitRow {
  return { id: crypto.randomUUID?.() ?? String(Math.random()), kind, amount, reference: "" };
}

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
    meta?: { downPayment: string; installmentCount: number },
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
  const [error, setError] = useState("");

  const method = PAYMENT_METHODS.find((m) => m.id === paymentKind);

  useEffect(() => {
    if (!open) return;
    setCashReceived(grandTotal);
    setPartialPaid(roundMoney(grandTotal / 2));
    setSplitRows([
      newRow("cash", String(roundMoney(grandTotal / 2))),
      newRow("card", String(roundMoney(Math.max(0, grandTotal - grandTotal / 2)))),
    ]);
    setError("");
  }, [open, grandTotal]);

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

  const splitPaid = splitRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const splitRemaining = roundMoney(Math.max(0, grandTotal - splitPaid));

  function confirm() {
    setError("");
    try {
      if ((paymentKind === "credit" || paymentKind === "installment") && !hasCustomer) {
        throw new Error("Credit and installment require a customer on the sale");
      }
      if (paymentKind === "installment") {
        onConfirm([], {
          downPayment: String(downPayment),
          installmentCount: Math.max(2, installmentCount),
        });
        onClose();
        return;
      }
      if (paymentKind === "credit") {
        onConfirm([]);
        onClose();
        return;
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

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="pos-sale-drawer"
        role="dialog"
        aria-modal
        aria-label="Payment"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Payment</p>
            <h2 className="text-base font-bold text-slate-900">{method?.label ?? paymentKind}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
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

          {paymentKind === "split" && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700">Split payment</p>
              {splitRows.map((row, index) => (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Payment {index + 1}</p>
                  <select
                    value={row.kind}
                    onChange={(e) =>
                      setSplitRows((rows) =>
                        rows.map((r) => (r.id === row.id ? { ...r, kind: e.target.value as PosPaymentKind } : r)),
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {PAYMENT_METHODS.filter((m) => !["split", "partial", "credit", "installment"].includes(m.id)).map(
                      (m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ),
                    )}
                  </select>
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
                    placeholder="Amount"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <input
                    value={row.reference}
                    onChange={(e) =>
                      setSplitRows((rows) =>
                        rows.map((r) => (r.id === row.id ? { ...r, reference: e.target.value } : r)),
                      )
                    }
                    placeholder="Reference (optional)"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
              <p className="text-xs text-slate-500">
                Remaining balance after split lines: <strong>{money(splitRemaining)}</strong>
              </p>
            </div>
          )}

          {(paymentKind === "credit" || paymentKind === "installment") && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {paymentKind === "credit"
                ? "Credit / udhar posts the full sale with remaining balance on the customer ledger. Server enforces credit limits."
                : "Installment plan is created server-side when permitted. Set down payment and term below."}
            </div>
          )}

          {paymentKind === "installment" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-600">
                Down payment
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={downPayment}
                  onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Installments
                <input
                  type="number"
                  min={2}
                  max={24}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value) || 3)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
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

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {!prep.ok && prep.errors.length && paymentKind !== "credit" ? (
            <p className="text-xs text-amber-700">{prep.errors[0]}</p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={confirm}
            className="w-full rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </aside>
    </div>
  );
}

/** @deprecated Use PaymentDrawer — kept for imports. */
export { PaymentDrawer as PaymentDialog };
