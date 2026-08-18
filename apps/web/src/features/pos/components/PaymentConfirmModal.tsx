import { useEffect } from "react";
import type { CreditCheckResult, PosCustomerProfile } from "@electronic-erp/domain";
import { POSButton, POSInput, POSModal } from "../design-system";
import type { PosTransactionSummary } from "../pos-transaction";
import { PayNowButton } from "./PayNowButton";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-[var(--pos-muted)]">{label}</span>
      <span className="tabular-nums text-[var(--pos-ink)]">{value}</span>
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
      title="Confirm payment"
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
            PAY NOW
          </PayNowButton>
        </>
      }
    >
      <div className="space-y-3">
        <Row label="Customer" value={customerLabel} />
        <Row label="Invoice / reference" value={invoiceReference} />
        <Row label="Subtotal" value={summary.subtotal.toFixed(2)} />
        <Row label="Discounts" value={`−${summary.totalDiscount.toFixed(2)}`} />
        <Row label="Tax" value={summary.salesTax.toFixed(2)} />
        <div className="flex justify-between gap-3 border-t border-[var(--pos-border)] pt-2 text-sm font-semibold">
          <span>Grand total</span>
          <span className="tabular-nums text-[var(--pos-primary)]">Rs {summary.grand.toFixed(2)}</span>
        </div>
        <Row label="Payment method" value={methodLabel} />
        {settlementNote ? (
          <p className="text-[11px] text-[var(--pos-muted)]">{settlementNote}</p>
        ) : null}
        {showTendered ? (
          <POSInput
            label="Amount tendered"
            type="number"
            value={tendered}
            onChange={(e) => onTenderedChange?.(e.target.value)}
            autoFocus
          />
        ) : (
          <Row label="Amount tendered" value={tendered || "0.00"} />
        )}
        <Row label="Amount due" value={due.toFixed(2)} />
        <Row label="Change" value={change.toFixed(2)} />
        <Row label="Paid toward bill" value={paid.toFixed(2)} />
        {customer && due > 0.009 ? (
          <div className="rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--pos-muted)]">
              Credit
            </div>
            <Row label="Credit limit" value={customer.creditLimit} />
            <Row label="Outstanding" value={customer.outstanding} />
            {credit?.projectedOutstanding ? (
              <Row label="Projected outstanding" value={credit.projectedOutstanding} />
            ) : null}
            {credit?.reason ? (
              <p className="mt-1 text-xs text-[var(--pos-warning)]">{credit.reason}</p>
            ) : null}
          </div>
        ) : null}
        <p className="text-[11px] text-[var(--pos-muted)]">
          Confirmation posts this sale with the existing POS payment API. Card and wallet tenders are
          recorded receipts only unless a gateway is configured.
        </p>
      </div>
    </POSModal>
  );
}
