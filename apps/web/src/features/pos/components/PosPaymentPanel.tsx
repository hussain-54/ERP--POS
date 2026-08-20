import { memo, useMemo, useState } from "react";
import {
  buildInstallmentPlan,
  classifyPosPaymentType,
  evaluatePosCustomerCredit,
  preparePosPayments,
  type InstallmentFrequency,
  type PosCustomerProfile,
  type PosPaymentConfirmationStatus,
} from "@electronic-erp/domain";
import type { PaySplit } from "../pos-types";
import { confirmationStatusLabel, paymentTypeLabel } from "../pos-quotation";
import { toPosTransactionSummary } from "../pos-transaction";
import { humanizePaymentError } from "../pos-user-messages";
import {
  cashTenderSuggestions,
  isCashPaymentKind,
  isCreditLikePaymentKind,
  isInstallmentPaymentKind,
  paymentMethodKind,
  paymentMethodLabel,
  paymentMethodSettlementNote,
  sanitizePaymentAmountInput,
  selectedPaymentMethodId,
  type PosPaymentMethod,
} from "../pos-payment-ux";
import { POSBadge, POSButton, POSInput, POSSelect } from "../design-system";
import { PosTotals } from "./PosTotals";
import { PaymentMethodGrid } from "./PaymentMethodGrid";
import { PaymentSummary } from "./PaymentSummary";
import { PayNowButton } from "./PayNowButton";
import { HoldSaleButton } from "./HoldSaleButton";
import { QuotationButton } from "./QuotationButton";
import { PaymentConfirmModal } from "./PaymentConfirmModal";

interface Props {
  totals: {
    items: number;
    qty: number;
    subtotal: number;
    itemDiscount?: number;
    invoiceDiscount?: number;
    discount: number;
    tax: number;
    grand: number;
    taxInvoice?: { taxableAmount: number; taxTotal: number } | null;
  };
  invoiceDiscount: string;
  onInvoiceDiscount: (v: string) => void;
  canInvoiceDiscount: boolean;
  discountRef: React.RefObject<HTMLInputElement | null>;
  methods: PosPaymentMethod[];
  payments: PaySplit[];
  onPayments: (p: PaySplit[]) => void;
  notes: string;
  onNotes: (v: string) => void;
  busy: boolean;
  canPay: boolean;
  payBlockedReason?: string | null;
  allowCreditDue: boolean;
  canHold?: boolean;
  canInstallment?: boolean;
  onHold: () => void;
  onPay: () => void;
  onQuotation?: () => void;
  canQuote?: boolean;
  quoteReason?: string | null;
  quoting?: boolean;
  onRetry?: () => void;
  /** Focus in-terminal customer search (credit / udhaar). */
  onFocusCustomer?: () => void;
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
  customer?: PosCustomerProfile | null;
  walkIn?: boolean;
  invoiceReference?: string | null;
  couponCode?: string;
  onCouponCode?: (code: string) => void;
  onApplyCoupon?: () => void;
  couponBusy?: boolean;
  couponHint?: string | null;
}

export const PosPaymentPanel = memo(function PosPaymentPanel({
  totals,
  invoiceDiscount: _invoiceDiscount,
  onInvoiceDiscount: _onInvoiceDiscount,
  canInvoiceDiscount,
  discountRef: _discountRef,
  methods,
  payments,
  onPayments,
  notes,
  onNotes,
  busy,
  canPay,
  payBlockedReason,
  allowCreditDue,
  canHold = true,
  canInstallment = true,
  onHold,
  onPay,
  onQuotation,
  canQuote,
  quoteReason,
  quoting,
  onRetry,
  onFocusCustomer,
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
  customer = null,
  walkIn = true,
  invoiceReference = null,
  couponCode = "",
  onCouponCode,
  onApplyCoupon,
  couponBusy = false,
  couponHint = null,
}: Props) {
  void _invoiceDiscount;
  void _onInvoiceDiscount;
  void _discountRef;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const summary = useMemo(() => toPosTransactionSummary(totals), [totals]);
  const kindById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of methods) map.set(m.id, paymentMethodKind(m));
    return map;
  }, [methods]);

  const prep = useMemo(
    () =>
      preparePosPayments({
        grandTotal: summary.grand,
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
    [summary.grand, payments, kindById, cashReceived, allowCreditDue, useInstallment, isAdvance],
  );

  const installmentPreview = useMemo(() => {
    if (!useInstallment) return null;
    try {
      return buildInstallmentPlan({
        totalAmount: String(summary.grand),
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
    summary.grand,
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
    grandTotal: summary.grand,
    paidTowardBill: prep.paidTowardBill,
    useInstallment,
    isAdvance,
  });

  const selectedId = useInstallment
    ? (methods.find((m) => isInstallmentPaymentKind(paymentMethodKind(m)))?.id ??
      selectedPaymentMethodId(payments))
    : selectedPaymentMethodId(payments);
  const selectedMethod = methods.find((m) => m.id === selectedId);
  const selectedKind = paymentMethodKind(selectedMethod) || String(payments[0]?.methodKind ?? "");
  const methodLabel = selectedMethod ? paymentMethodLabel(selectedMethod) : "None";
  const settlementNote = paymentMethodSettlementNote(selectedKind);
  const cashSelected = isCashPaymentKind(selectedKind) || payments.some((p) => isCashPaymentKind(kindById.get(p.paymentMethodId) ?? p.methodKind));
  const creditSelected = isCreditLikePaymentKind(selectedKind) || useInstallment;
  const payBlocked =
    busy ||
    !canPay ||
    confirmation === "pending" ||
    (prep.remaining > 0.009 && !allowCreditDue);
  const statusLabel = confirmationStatusLabel(confirmation);
  const customerLabel = walkIn || !customer ? "Walk-in" : customer.name;
  const credit =
    customer && !walkIn && prep.remaining > 0.009
      ? evaluatePosCustomerCredit({ customer, additionalCredit: String(prep.remaining) })
      : null;
  const tenderedDisplay = cashSelected
    ? Number(cashReceived || prep.amountReceived || summary.grand)
    : prep.amountReceived || null;
  const cashSuggestions = useMemo(() => cashTenderSuggestions(summary.grand), [summary.grand]);
  const splitLabels = useMemo(
    () =>
      payments
        .map((p) => {
          const method = methods.find((m) => m.id === p.paymentMethodId);
          const amount = Number(p.amount) || 0;
          if (!(amount > 0) && !isCreditLikePaymentKind(kindById.get(p.paymentMethodId) ?? "")) {
            return null;
          }
          return {
            label: method ? paymentMethodLabel(method) : "Tender",
            amount: isCreditLikePaymentKind(kindById.get(p.paymentMethodId) ?? p.methodKind)
              ? prep.remaining
              : amount,
          };
        })
        .filter((row): row is { label: string; amount: number } => Boolean(row && row.amount > 0)),
    [payments, methods, kindById, prep.remaining],
  );

  const paymentAlert =
    confirmationError ||
    (!prep.ok ? prep.errors[0] : null) ||
    (prep.remaining > 0.009 && !allowCreditDue ? "Walk-in sales must be paid in full" : null) ||
    (creditSelected && !allowCreditDue ? "Customer required for credit sale" : null);

  function setAmount(id: string, amount: string) {
    const next = sanitizePaymentAmountInput(amount);
    if (next == null) return;
    onPayments(payments.map((p) => (p.id === id ? { ...p, amount: next } : p)));
  }

  function setCashReceivedSafe(value: string) {
    const next = sanitizePaymentAmountInput(value);
    if (next == null) return;
    onCashReceived(next);
  }

  function setMethod(id: string, paymentMethodId: string) {
    const kind = kindById.get(paymentMethodId);
    onPayments(
      payments.map((p) => (p.id === id ? { ...p, paymentMethodId, methodKind: kind } : p)),
    );
  }

  function addSplit() {
    const preferred =
      methods.find((m) => !isCashPaymentKind(paymentMethodKind(m)) && !isCreditLikePaymentKind(paymentMethodKind(m))) ??
      methods.find((m) => !isCashPaymentKind(paymentMethodKind(m))) ??
      methods[0];
    if (!preferred) return;
    onPayments([
      ...payments,
      {
        id: crypto.randomUUID(),
        paymentMethodId: preferred.id,
        amount: prep.remaining > 0 ? String(prep.remaining) : "",
        methodKind: kindById.get(preferred.id),
      },
    ]);
  }

  function removeSplit(id: string) {
    if (payments.length <= 1) return;
    onPayments(payments.filter((p) => p.id !== id));
  }

  function selectMethod(method: PosPaymentMethod) {
    const kind = paymentMethodKind(method);
    const lineId = payments[0]?.id ?? crypto.randomUUID();
    if (isInstallmentPaymentKind(kind)) {
      if (!allowCreditDue) {
        onFocusCustomer?.();
        return;
      }
      onUseInstallment(true);
      const down = downPayment && Number(downPayment) > 0 ? downPayment : "0";
      const cash = methods.find((m) => isCashPaymentKind(paymentMethodKind(m)));
      onPayments([
        {
          id: lineId,
          paymentMethodId: cash?.id ?? method.id,
          amount: down,
          methodKind: cash ? "cash" : kind,
        },
      ]);
      return;
    }
    if (isCreditLikePaymentKind(kind) && !allowCreditDue) {
      onFocusCustomer?.();
      return;
    }
    if (useInstallment) onUseInstallment(false);
    onPayments([
      {
        id: lineId,
        paymentMethodId: method.id,
        amount: isCreditLikePaymentKind(kind) ? "0" : String(summary.grand),
        methodKind: kind,
      },
    ]);
    if (isCashPaymentKind(kind) && !cashReceived) onCashReceived(String(summary.grand));
  }

  const payTitle =
    payBlockedReason ||
    (paymentAlert ? humanizePaymentError(paymentAlert) : undefined) ||
    "Review and complete this sale";

  function requestPay() {
    if (payBlocked || !prep.ok || !methods.length) return;
    setConfirmOpen(true);
  }

  function confirmPay() {
    if (busy || confirmation === "pending") return;
    setConfirmOpen(false);
    onPay();
  }

  return (
    <section className="pos-sale-pay-dock pos-tx-pay px-3 py-3">
      <PosTotals summary={summary} />

      {canInvoiceDiscount ? null : (
        <p className="mt-3 text-[11px] text-[var(--pos-muted)]">
          Invoice discount requires a POS discount permission
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <POSBadge tone="primary">{paymentTypeLabel(paymentType)}</POSBadge>
        {statusLabel ? (
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
            {statusLabel}
          </POSBadge>
        ) : null}
      </div>

      {confirmation === "success" ? (
        <p role="status" className="mt-2 rounded-[var(--pos-radius-sm)] bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-800">
          Sale completed — receipt is ready and the register was reset for the next customer.
        </p>
      ) : null}

      {paymentAlert ? (
        <div
          role="alert"
          className="mt-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-danger)]/40 bg-[var(--pos-danger-soft)] px-2.5 py-2 text-xs text-[var(--pos-danger)]"
        >
          <p>{humanizePaymentError(paymentAlert)}</p>
          {(creditSelected && !allowCreditDue) || /customer required|select a customer/i.test(paymentAlert) ? (
            <POSButton size="sm" variant="secondary" className="mt-2" onClick={() => onFocusCustomer?.()}>
              Select customer
            </POSButton>
          ) : null}
        </div>
      ) : null}

      {onCouponCode && onApplyCoupon ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <POSInput
              label="Coupon code"
              value={couponCode}
              onChange={(e) => onCouponCode(e.target.value)}
              placeholder="Optional — validated on apply"
            />
          </div>
          <POSButton
            size="sm"
            variant="secondary"
            onClick={onApplyCoupon}
            disabled={busy || couponBusy || !couponCode.trim()}
            loading={couponBusy}
            loadingLabel="Checking…"
          >
            Apply coupon
          </POSButton>
          {couponHint ? (
            <p className="w-full text-[11px] text-[var(--pos-muted)]">{couponHint}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--pos-muted)]">
          Payment method
        </p>
        <PaymentMethodGrid
          methods={methods}
          selectedId={selectedId}
          onSelect={selectMethod}
          disabled={!summary.grand || busy}
          creditAllowed={allowCreditDue}
          installmentAllowed={allowCreditDue && canInstallment}
        />
      </div>

      {cashSelected ? (
        <div className="mt-3 space-y-2 rounded-[var(--pos-radius)] border border-[var(--pos-border)] bg-[var(--pos-muted-bg)]/40 p-2.5">
          <POSInput
            label="Cash amount received"
            type="number"
            value={cashReceived}
            onChange={(e) => setCashReceivedSafe(e.target.value)}
            hint="Change is calculated automatically"
          />
          <div className="flex flex-wrap gap-1.5">
            {cashSuggestions.map((amount) => (
              <POSButton
                key={amount}
                size="sm"
                variant="secondary"
                onClick={() => setCashReceivedSafe(String(amount))}
                title={`Tender Rs ${amount.toFixed(2)}`}
              >
                {amount === summary.grand ? "Exact" : `Rs ${amount.toFixed(0)}`}
              </POSButton>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 rounded-[var(--pos-radius-sm)] bg-[var(--pos-workspace)] px-2.5 py-2">
            <span className="text-xs font-medium text-[var(--pos-muted)]">Change to return</span>
            <span
              className={`text-lg font-bold tabular-nums ${
                prep.change > 0.009 ? "text-emerald-700" : "text-[var(--pos-ink)]"
              }`}
              data-pos-cash-change={prep.change.toFixed(2)}
            >
              Rs {prep.change.toFixed(2)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--pos-muted)]">
            Tender amounts
          </p>
          <POSButton size="sm" variant="ghost" onClick={addSplit} disabled={!methods.length || busy}>
            + Split payment
          </POSButton>
        </div>
        {payments.map((p) => {
          const kind = kindById.get(p.paymentMethodId) ?? p.methodKind ?? "";
          return (
            <div key={p.id} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[8rem] flex-1">
                <POSSelect
                  value={p.paymentMethodId}
                  onChange={(e) => setMethod(p.id, e.target.value)}
                  options={methods.map((m) => ({
                    value: m.id,
                    label: paymentMethodLabel(m),
                  }))}
                  aria-label="Payment method"
                />
              </div>
              <POSInput
                className="w-28"
                type="number"
                value={p.amount}
                onChange={(e) => setAmount(p.id, e.target.value)}
                aria-label={`${paymentMethodLabel(methods.find((m) => m.id === p.paymentMethodId) ?? { id: p.paymentMethodId, name: "Tender" })} amount`}
                disabled={isCreditLikePaymentKind(kind)}
                title={
                  isCreditLikePaymentKind(kind)
                    ? "Udhaar balance is the unpaid remainder"
                    : "Tender amount (no negatives)"
                }
              />
              {payments.length > 1 ? (
                <POSButton size="sm" variant="ghost" onClick={() => removeSplit(p.id)} aria-label="Remove payment">
                  ✕
                </POSButton>
              ) : null}
            </div>
          );
        })}
      </div>

      <PaymentSummary
        methodLabel={methodLabel}
        settlementNote={settlementNote}
        grandTotal={summary.grand}
        paid={prep.paidTowardBill}
        due={prep.remaining}
        change={prep.change}
        tendered={tenderedDisplay}
        splitLabels={splitLabels}
      />

      {allowCreditDue || creditSelected ? (
        <div className="mt-3 space-y-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] p-2.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--pos-muted)]">
            Credit / Udhaar
          </div>
          {!allowCreditDue ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--pos-warning)]">
                Customer required for credit / udhaar. Search and select a named customer on this screen —
                do not leave the POS.
              </p>
              <POSButton size="sm" variant="secondary" onClick={() => onFocusCustomer?.()}>
                Select customer
              </POSButton>
            </div>
          ) : customer ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[var(--pos-muted)]">Credit limit</div>
                <div className="font-semibold tabular-nums">Rs {customer.creditLimit}</div>
              </div>
              <div>
                <div className="text-[var(--pos-muted)]">Udhaar</div>
                <div className="font-semibold tabular-nums">Rs {customer.outstanding}</div>
              </div>
              <div>
                <div className="text-[var(--pos-muted)]">Available</div>
                <div className="font-semibold tabular-nums">
                  Rs{" "}
                  {Math.max(
                    0,
                    (Number(customer.creditLimit) || 0) - (Number(customer.outstanding) || 0),
                  ).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[var(--pos-muted)]">This sale balance</div>
                <div className="font-semibold tabular-nums">Rs {prep.remaining.toFixed(2)}</div>
              </div>
              {credit?.reason ? (
                <p className="col-span-2 text-[11px] text-[var(--pos-warning)]">{credit.reason}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--pos-warning)]">Loading customer credit details…</p>
          )}
          {allowCreditDue ? (
            <>
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
                  disabled={!canInstallment}
                  title={canInstallment ? "Create installment plan" : "Requires installments.manage"}
                />
                Create installment plan
              </label>
              {useInstallment ? (
                <div className="grid grid-cols-2 gap-2">
                  <POSInput
                    label="Down payment"
                    type="number"
                    value={downPayment}
                    onChange={(e) => {
                      const next = sanitizePaymentAmountInput(e.target.value);
                      if (next != null) onDownPayment(next);
                    }}
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
                    onChange={(e) => {
                      const next = sanitizePaymentAmountInput(e.target.value);
                      if (next != null) onLateFeeFixed(next);
                    }}
                  />
                  {installmentPreview ? (
                    <div className="col-span-2 text-xs text-[var(--pos-muted)]">
                      Period amount {installmentPreview.monthlyAmount} · first due{" "}
                      {installmentPreview.schedule[0]?.dueDate ?? "—"} · remaining{" "}
                      {installmentPreview.remainingAmount}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {advanced ? (
        <div className="mt-3">
          <POSInput label="Notes" value={notes} onChange={(e) => onNotes(e.target.value)} />
        </div>
      ) : null}

      <div className="pos-pay-actions mt-3 space-y-2 border-t border-[var(--pos-border)] pt-3">
        <PayNowButton
          className="w-full"
          data-pos-complete-sale=""
          onClick={requestPay}
          onDoubleClick={(event) => event.preventDefault()}
          disabled={payBlocked || !prep.ok || !methods.length}
          loading={busy || confirmation === "pending"}
          loadingLabel="Processing payment…"
          title={payTitle.includes("F6") ? payTitle : `${payTitle} · F6`}
        >
          {confirmation === "pending"
            ? "Processing payment…"
            : prep.remaining > 0.009 && allowCreditDue
              ? "COMPLETE SALE (udhaar remaining)"
              : "COMPLETE SALE"}
        </PayNowButton>
        <div className="grid grid-cols-2 gap-2">
          <HoldSaleButton
            onClick={onHold}
            disabled={busy || !canPay || !canHold}
            loading={busy && confirmation !== "pending"}
            loadingLabel="Holding sale…"
            title={
              !canHold
                ? "Requires pos.hold permission"
                : !canPay
                  ? payBlockedReason ?? "Add products before holding"
                  : busy
                    ? "Hold in progress…"
                    : "F2 Hold"
            }
          />
          <QuotationButton
            onClick={onQuotation}
            disabled={busy || quoting || !canQuote}
            loading={quoting}
            title={quoteReason ?? "Save this cart as a quotation"}
          />
        </div>
        {confirmation === "failure" && onRetry ? (
          <POSButton variant="secondary" className="w-full" onClick={onRetry} disabled={busy}>
            Retry payment
          </POSButton>
        ) : null}
      </div>

      <PaymentConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmPay}
        loading={busy || confirmation === "pending"}
        disabled={payBlocked || !prep.ok}
        confirmTitle={payTitle}
        customerLabel={customerLabel}
        invoiceReference={invoiceReference?.trim() || "Assigned on post"}
        summary={summary}
        methodLabel={methodLabel}
        settlementNote={settlementNote}
        tendered={cashSelected ? cashReceived || String(summary.grand) : String(prep.amountReceived || 0)}
        onTenderedChange={cashSelected ? setCashReceivedSafe : undefined}
        showTendered={cashSelected}
        paid={prep.paidTowardBill}
        due={prep.remaining}
        change={prep.change}
        customer={!walkIn ? customer : null}
        credit={credit}
        splitLabels={splitLabels}
      />
    </section>
  );
});
