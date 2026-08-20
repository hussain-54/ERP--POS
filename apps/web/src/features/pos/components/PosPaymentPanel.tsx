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
import {
  isCashPaymentKind,
  isCreditLikePaymentKind,
  isInstallmentPaymentKind,
  paymentMethodKind,
  paymentMethodLabel,
  paymentMethodSettlementNote,
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
  const cashSelected = isCashPaymentKind(selectedKind);
  const creditSelected = isCreditLikePaymentKind(selectedKind) || useInstallment;
  const defaultMethod = methods[0]?.id ?? "";
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

  function selectMethod(method: PosPaymentMethod) {
    const kind = paymentMethodKind(method);
    const lineId = payments[0]?.id ?? crypto.randomUUID();
    if (isInstallmentPaymentKind(kind)) {
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
    (!prep.ok ? prep.errors[0] : undefined) ||
    (prep.remaining > 0.009 && !allowCreditDue
      ? "Walk-in must be paid in full"
      : "Review and post this sale");

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
      {confirmationError ? (
        <p role="alert" className="mt-1 text-xs text-[var(--pos-danger)]">
          {confirmationError}
        </p>
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
        <div className="mt-3">
          <POSInput
            label="Cash amount received"
            type="number"
            value={cashReceived}
            onChange={(e) => onCashReceived(e.target.value)}
          />
        </div>
      ) : null}

      {advanced ? (
        <div className="mt-3 space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex gap-2">
              <div className="min-w-0 flex-1">
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
                aria-label="Amount"
              />
              {payments.length > 1 ? (
                <POSButton size="sm" variant="ghost" onClick={() => removeSplit(p.id)} aria-label="Remove payment">
                  ✕
                </POSButton>
              ) : null}
            </div>
          ))}
          <POSButton size="sm" variant="ghost" onClick={addSplit} disabled={!methods.length}>
            + Split payment
          </POSButton>
        </div>
      ) : null}

      <PaymentSummary
        methodLabel={methodLabel}
        settlementNote={settlementNote}
        paid={prep.paidTowardBill}
        due={prep.remaining}
        change={prep.change}
        tendered={tenderedDisplay}
      />

      {prep.remaining > 0.009 && !allowCreditDue ? (
        <p className="mt-2 text-xs text-[var(--pos-danger)]">
          Walk-in must be paid in full. Select a customer to allow credit / partial.
        </p>
      ) : null}
      {!prep.ok && prep.errors[0] ? (
        <p className="mt-2 text-xs text-[var(--pos-danger)]">{prep.errors[0]}</p>
      ) : null}

      {allowCreditDue && (creditSelected || advanced) ? (
        <div className="mt-3 space-y-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] p-2">
          {customer ? (
            <p className="text-xs text-[var(--pos-muted)]">
              Limit {customer.creditLimit} · outstanding {customer.outstanding}
              {credit?.reason ? ` · ${credit.reason}` : ""}
            </p>
          ) : null}
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
                  Period amount {installmentPreview.monthlyAmount} · first due{" "}
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

      <div className="mt-4 grid grid-cols-2 gap-2">
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
        {confirmation === "failure" && onRetry ? (
          <POSButton variant="secondary" className="col-span-2" onClick={onRetry} disabled={busy}>
            Retry payment
          </POSButton>
        ) : null}
        <PayNowButton
          className="col-span-2"
          onClick={requestPay}
          onDoubleClick={(event) => event.preventDefault()}
          disabled={payBlocked || !prep.ok || !methods.length}
          loading={busy || confirmation === "pending"}
          loadingLabel="Processing payment…"
          title={payTitle}
        >
          {confirmation === "pending"
            ? "Processing payment…"
            : prep.remaining > 0.009 && allowCreditDue
              ? "PAY NOW (credit remaining)"
              : "PAY NOW"}
        </PayNowButton>
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
        onTenderedChange={cashSelected ? onCashReceived : undefined}
        showTendered={cashSelected}
        paid={prep.paidTowardBill}
        due={prep.remaining}
        change={prep.change}
        customer={!walkIn ? customer : null}
        credit={credit}
      />
    </section>
  );
});
