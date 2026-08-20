import { useEffect } from "react";
import type { CreditCheckResult, PosCustomerProfile } from "@electronic-erp/domain";
import { POSButton, POSInput, POSModal } from "../design-system";
import type { PosTransactionSummary } from "../pos-transaction";
import { PayNowButton } from "./PayNowButton";

function Row({
  label,
  value,
  strong,
  danger,
  success,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className="text-[var(--pos-muted)]">{label}</span>
      <span
        className={`tabular-nums ${
          danger
            ? "text-[var(--pos-danger)]"
            : success
              ? "text-emerald-700"
              : "text-[var(--pos-ink)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentConfirmModal({
  open,
  onClose,
  onConfirm,
  loading,
  disabled,
  confirmTitle,
  customerLabel,
  invoiceReference,
  summary,
  methodLabel,
  settlementNote,
  tendered,
  onTenderedChange,
  showTendered,
  paid,
  due,
  change,
  customer,
  credit,
  splitLabels,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  confirmTitle: string;
  customerLabel: string;
  invoiceReference: string;
  summary: PosTransactionSummary;
  methodLabel: string;
  settlementNote?: string | null;
  tendered: string;
  onTenderedChange?: (value: string) => void;
  showTendered?: boolean;
  paid: number;
  due: number;
  change: number;
  customer?: PosCustomerProfile | null;
  credit?: CreditCheckResult | null;
  splitLabels?: Array<{ label: string; amount: number }>;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.target instanceof HTMLTextAreaElement) return;
      if (loading || disabled) return;
      event.preventDefault();
      event.stopPropagation();
      onConfirm();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, loading, disabled, onConfirm]);

  return (
    <POSModal
      open={open}
      title="Complete sale"
      onClose={() => {
        if (!loading) onClose();
      }}
      size="md"
      footer={
        <>
          <POSButton variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </POSButton>
          <PayNowButton
            onClick={onConfirm}
            disabled={disabled}
            loading={loading}
            title={confirmTitle}
            className="min-w-[9rem]"
          >
            Complete Sale
          </PayNowButton>
        </>
      }
    >
      <div className="space-y-3">
        <Row label="Customer" value={customerLabel} />
        <Row label="Invoice / reference" value={invoiceReference} />
        <div className="space-y-1.5 rounded-[var(--pos-radius)] border border-[var(--pos-border)] px-3 py-2">
          <Row label="Subtotal" value={`Rs ${summary.subtotal.toFixed(2)}`} />
          <Row label="Discount" value={`−Rs ${summary.totalDiscount.toFixed(2)}`} />
          <Row label="Tax" value={`Rs ${summary.salesTax.toFixed(2)}`} />
          <div className="border-t border-[var(--pos-border)] pt-2">
            <Row label="Grand total" value={`Rs ${summary.grand.toFixed(2)}`} strong />
          </div>
        </div>
        <Row label="Payment method" value={methodLabel} />
        {settlementNote ? (
          <p className="text-[11px] text-[var(--pos-muted)]">{settlementNote}</p>
        ) : null}
        {splitLabels && splitLabels.length > 1 ? (
          <ul className="space-y-1 text-sm">
            {splitLabels.map((row) => (
              <li key={`${row.label}-${row.amount}`} className="flex justify-between gap-2">
                <span className="text-[var(--pos-muted)]">{row.label}</span>
                <span className="tabular-nums">Rs {row.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {showTendered ? (
          <POSInput
            label="Cash amount received"
            type="number"
            value={tendered}
            onChange={(e) => onTenderedChange?.(e.target.value)}
            autoFocus
            hint="Change is calculated automatically"
          />
        ) : (
          <Row label="Cash received" value={tendered ? `Rs ${Number(tendered || 0).toFixed(2)}` : "—"} />
        )}
        <div className="space-y-1.5 rounded-[var(--pos-radius)] bg-[var(--pos-muted-bg)] px-3 py-2">
          <Row label="Paid" value={`Rs ${paid.toFixed(2)}`} />
          <Row label="Change" value={`Rs ${change.toFixed(2)}`} success={change > 0.009} />
          <Row label="Balance" value={`Rs ${due.toFixed(2)}`} danger={due > 0.009} strong={due > 0.009} />
        </div>
        {customer && due > 0.009 ? (
          <div className="rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--pos-muted)]">
              Credit / Udhaar
            </div>
            <Row label="Credit limit" value={`Rs ${customer.creditLimit}`} />
            <Row label="Udhaar" value={`Rs ${customer.outstanding}`} />
            {credit?.projectedOutstanding ? (
              <Row label="Projected udhaar" value={`Rs ${credit.projectedOutstanding}`} />
            ) : null}
            {credit?.reason ? (
              <p className="mt-1 text-xs text-[var(--pos-warning)]">{credit.reason}</p>
            ) : null}
          </div>
        ) : null}
        <p className="text-[11px] text-[var(--pos-muted)]">
          Completing posts this sale through the existing POS payment API. Card and wallet tenders are
          recorded receipts only unless a gateway is configured.
        </p>
      </div>
    </POSModal>
  );
}
