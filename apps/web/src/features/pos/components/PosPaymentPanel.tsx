import { useMemo } from "react";
import {
  buildInstallmentPlan,
  classifyPosPaymentType,
  preparePosPayments,
  type InstallmentFrequency,
  type PosPaymentConfirmationStatus,
} from "@electronic-erp/domain";
import type { PaySplit } from "../pos-types";
import { POSBadge, POSButton, POSCard, POSInput, POSSelect } from "../design-system";

interface Method {
  id: string;
  name: string;
  code?: string;
  kind?: string;
}

interface Props {
  totals: {
    items: number;
    qty: number;
    subtotal: number;
    discount: number;
    tax: number;
    grand: number;
  };
  invoiceDiscount: string;
  onInvoiceDiscount: (v: string) => void;
  canInvoiceDiscount: boolean;
  discountRef: React.RefObject<HTMLInputElement | null>;
  methods: Method[];
  payments: PaySplit[];
  onPayments: (p: PaySplit[]) => void;
  notes: string;
  onNotes: (v: string) => void;
  busy: boolean;
  canPay: boolean;
  allowCreditDue: boolean;
  onHold: () => void;
  onPay: () => void;
  onCancel: () => void;
  onRetry?: () => void;
  advanced: boolean;
  useInstallment: boolean;
  onUseInstallment: (v: boolean) => void;
  installmentCount: string;
  onInstallmentCount: (v: string) => void;
  downPayment: string;
  onDownPayment: (v: string) => void;
  installmentFrequency: InstallmentFrequency;
  onInstallmentFrequency: (v: InstallmentFrequency) => void;
  lateFeePercent: string;
  onLateFeePercent: (v: string) => void;
  lateFeeFixed: string;
  onLateFeeFixed: (v: string) => void;
  isAdvance: boolean;
  onIsAdvance: (v: boolean) => void;
  cashReceived: string;
  onCashReceived: (v: string) => void;
  confirmation?: PosPaymentConfirmationStatus | null;
  confirmationError?: string | null;
}

function methodKind(m: Method | undefined): string {
  return String(m?.kind ?? m?.code ?? "").toLowerCase();
}

export function PosPaymentPanel({
  totals,
  invoiceDiscount,
  onInvoiceDiscount,
  canInvoiceDiscount,
  discountRef,
  methods,
  payments,
  onPayments,
  notes,
  onNotes,
  busy,
  canPay,
  allowCreditDue,
  onHold,
  onPay,
  onCancel,
  onRetry,
  advanced,
  useInstallment,
  onUseInstallment,
  installmentCount,
  onInstallmentCount,
  downPayment,
  onDownPayment,
  installmentFrequency,
  onInstallmentFrequency,
  lateFeePercent,
  onLateFeePercent,
  lateFeeFixed,
  onLateFeeFixed,
  isAdvance,
  onIsAdvance,
  cashReceived,
  onCashReceived,
  confirmation,
  confirmationError,
}: Props) {
  const kindById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of methods) map.set(m.id, methodKind(m));
    return map;
  }, [methods]);

  const prep = useMemo(
    () =>
      preparePosPayments({
        grandTotal: totals.grand,
        lines: payments.map((p) => ({
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
          amountReceived:
            kindById.get(p.paymentMethodId) === "cash" && cashReceived
              ? cashReceived
              : p.amountReceived,
          kind: kindById.get(p.paymentMethodId) ?? p.methodKind,
        })),
        walkIn: !allowCreditDue,
        hasCustomer: allowCreditDue,
        allowCreditDue,
        useInstallment,
        isAdvance,
        allowRemaining: allowCreditDue || useInstallment,
      }),
    [totals.grand, payments, kindById, cashReceived, allowCreditDue, useInstallment, isAdvance],
  );

  const installmentPreview = useMemo(() => {
    if (!useInstallment) return null;
    try {
      return buildInstallmentPlan({
        totalAmount: String(totals.grand),
        downPayment: downPayment || "0",
        installmentCount: Math.max(1, Number(installmentCount) || 1),
        startDate: new Date().toISOString().slice(0, 10),
        frequency: installmentFrequency,
        lateFeePercent: Number(lateFeePercent) || 0,
        lateFeeFixed: lateFeeFixed || "0",
      });
    } catch {
      return null;
    }
  }, [
    useInstallment,
    totals.grand,
    downPayment,
    installmentCount,
    installmentFrequency,
    lateFeePercent,
    lateFeeFixed,
  ]);

  const paymentType = classifyPosPaymentType({
    lines: payments.map((p) => ({
      paymentMethodId: p.paymentMethodId,
      amount: p.amount,
      kind: kindById.get(p.paymentMethodId),
    })),
    grandTotal: totals.grand,
    paidTowardBill: prep.paidTowardBill,
    useInstallment,
    isAdvance,
  });

  const defaultMethod = methods[0]?.id ?? "";
  const creditMethod = methods.find((m) => methodKind(m) === "credit" || /udhaar/i.test(m.name));
  const payBlocked =
    busy || !canPay || confirmation === "pending" || (prep.remaining > 0.009 && !allowCreditDue);

  function setAmount(id: string, amount: string) {
    onPayments(payments.map((p) => (p.id === id ? { ...p, amount } : p)));
  }

  function setMethod(id: string, paymentMethodId: string) {
    const kind = kindById.get(paymentMethodId);
    onPayments(
      payments.map((p) => (p.id === id ? { ...p, paymentMethodId, methodKind: kind } : p)),
    );
  }

  function addSplit() {
    onPayments([
      ...payments,
      {
        id: crypto.randomUUID(),
        paymentMethodId: defaultMethod,
        amount: prep.remaining > 0 ? String(prep.remaining) : "",
        methodKind: kindById.get(defaultMethod),
      },
    ]);
  }

  function removeSplit(id: string) {
    if (payments.length <= 1) return;
    onPayments(payments.filter((p) => p.id !== id));
  }

  function quickPay(methodId: string) {
    const kind = kindById.get(methodId);
    onPayments([
      {
        id: crypto.randomUUID(),
        paymentMethodId: methodId,
        amount: String(totals.grand),
        methodKind: kind,
      },
    ]);
    if (kind === "cash") onCashReceived(String(totals.grand));
  }

  function chargeToCredit() {
    if (!creditMethod) return;
    onPayments([
      {
        id: crypto.randomUUID(),
        paymentMethodId: creditMethod.id,
        amount: "0",
        methodKind: "credit",
      },
    ]);
  }

  return (
    <POSCard padding="sm">
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Items / Qty</span>
          <span className="tabular-nums">
            {totals.items} / {totals.qty}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{totals.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Discount</span>
          <span className="tabular-nums">−{totals.discount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Tax</span>
          <span className="tabular-nums">{totals.tax.toFixed(2)}</span>
        </div>
        <div className="flex items-end justify-between border-t border-[var(--pos-border)] pt-2">
          <span className="font-semibold">Grand Total</span>
          <span className="pos-grand tabular-nums">Rs {totals.grand.toFixed(2)}</span>
        </div>
      </div>

      {canInvoiceDiscount ? (
        <div className="mt-3">
          <POSInput
            ref={discountRef as React.RefObject<HTMLInputElement>}
            label="Invoice discount (F5)"
            type="number"
            value={invoiceDiscount}
            onChange={(e) => onInvoiceDiscount(e.target.value)}
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <POSBadge tone="primary">{paymentType}</POSBadge>
        {confirmation ? (
          <POSBadge
            tone={
              confirmation === "success"
                ? "success"
                : confirmation === "failure"
                  ? "danger"
                  : confirmation === "pending"
                    ? "warning"
                    : "neutral"
            }
          >
            {confirmation}
          </POSBadge>
        ) : null}
      </div>
      {confirmationError ? (
        <p className="mt-1 text-xs text-[var(--pos-danger)]">{confirmationError}</p>
      ) : null}

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--pos-muted)]">
          Payment methods
        </p>
        <div className="flex flex-wrap gap-1">
          {methods.slice(0, 8).map((m) => (
            <POSButton
              key={m.id}
              size="sm"
              variant="ghost"
              onClick={() => quickPay(m.id)}
              disabled={!totals.grand || busy}
            >
              {m.name}
            </POSButton>
          ))}
          {allowCreditDue && creditMethod ? (
            <POSButton size="sm" variant="secondary" onClick={chargeToCredit} disabled={!totals.grand || busy}>
              Credit / Udhar
            </POSButton>
          ) : null}
        </div>
      </div>

      {payments.some((p) => kindById.get(p.paymentMethodId) === "cash") ? (
        <div className="mt-3">
          <POSInput
            label="Cash amount received"
            type="number"
            value={cashReceived}
            onChange={(e) => onCashReceived(e.target.value)}
          />
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="flex gap-2">
            <div className="min-w-0 flex-1">
              <POSSelect
                value={p.paymentMethodId}
                onChange={(e) => setMethod(p.id, e.target.value)}
                options={methods.map((m) => ({ value: m.id, label: m.name }))}
                aria-label="Payment method"
              />
            </div>
            <POSInput
              className="w-28"
              type="number"
              value={p.amount}
              onChange={(e) => setAmount(p.id, e.target.value)}
              aria-label="Amount"
            />
            {payments.length > 1 ? (
              <POSButton size="sm" variant="ghost" onClick={() => removeSplit(p.id)} aria-label="Remove payment">
                ✕
              </POSButton>
            ) : null}
          </div>
        ))}
        {advanced ? (
          <POSButton size="sm" variant="ghost" onClick={addSplit}>
            + Split payment
          </POSButton>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-2">
          <div className="text-xs text-[var(--pos-muted)]">Paid</div>
          <div className="font-semibold tabular-nums">{prep.paidTowardBill.toFixed(2)}</div>
        </div>
        <div className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-2">
          <div className="text-xs text-[var(--pos-muted)]">
            {prep.change > 0 ? "Change" : "Remaining"}
          </div>
          <div
            className={`font-semibold tabular-nums ${prep.remaining > 0 ? "text-[var(--pos-danger)]" : ""}`}
          >
            {(prep.change > 0 ? prep.change : prep.remaining).toFixed(2)}
          </div>
        </div>
      </div>

      {prep.remaining > 0.009 && !allowCreditDue ? (
        <p className="mt-2 text-xs text-[var(--pos-danger)]">
          Walk-in must be paid in full. Select a customer to allow credit / partial.
        </p>
      ) : null}
      {!prep.ok && prep.errors[0] ? (
        <p className="mt-2 text-xs text-[var(--pos-danger)]">{prep.errors[0]}</p>
      ) : null}

      {advanced && allowCreditDue ? (
        <div className="mt-3 space-y-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] p-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAdvance}
              onChange={(e) => onIsAdvance(e.target.checked)}
            />
            Advance / deposit payment
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useInstallment}
              onChange={(e) => onUseInstallment(e.target.checked)}
            />
            Create installment plan
          </label>
          {useInstallment ? (
            <div className="grid grid-cols-2 gap-2">
              <POSInput
                label="Down payment"
                type="number"
                value={downPayment}
                onChange={(e) => onDownPayment(e.target.value)}
              />
              <POSInput
                label="Installments"
                type="number"
                value={installmentCount}
                onChange={(e) => onInstallmentCount(e.target.value)}
              />
              <POSSelect
                label="Frequency"
                value={installmentFrequency}
                onChange={(e) => onInstallmentFrequency(e.target.value as InstallmentFrequency)}
                options={[
                  { value: "weekly", label: "Weekly" },
                  { value: "biweekly", label: "Biweekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "quarterly", label: "Quarterly" },
                ]}
              />
              <POSInput
                label="Late fee %"
                type="number"
                value={lateFeePercent}
                onChange={(e) => onLateFeePercent(e.target.value)}
              />
              <POSInput
                label="Late fee fixed"
                type="number"
                value={lateFeeFixed}
                onChange={(e) => onLateFeeFixed(e.target.value)}
              />
              {installmentPreview ? (
                <div className="col-span-2 text-xs text-[var(--pos-muted)]">
                  Monthly/period amount {installmentPreview.monthlyAmount} · first due{" "}
                  {installmentPreview.schedule[0]?.dueDate ?? "—"} · remaining{" "}
                  {installmentPreview.remainingAmount}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {advanced ? (
        <div className="mt-3">
          <POSInput label="Notes" value={notes} onChange={(e) => onNotes(e.target.value)} />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <POSButton variant="ghost" onClick={onHold} disabled={busy || !canPay} title="F2 Hold">
          Hold
        </POSButton>
        {confirmation === "failure" && onRetry ? (
          <POSButton variant="secondary" onClick={onRetry} disabled={busy}>
            Retry
          </POSButton>
        ) : (
          <POSButton variant="ghost" onClick={onCancel} disabled={busy} title="F8 Cancel">
            Cancel
          </POSButton>
        )}
        <POSButton
          variant="success"
          onClick={onPay}
          disabled={payBlocked || !prep.ok}
          loading={busy || confirmation === "pending"}
        >
          {prep.remaining > 0.009 && allowCreditDue ? "Complete" : "Pay"}
        </POSButton>
      </div>
    </POSCard>
  );
}
