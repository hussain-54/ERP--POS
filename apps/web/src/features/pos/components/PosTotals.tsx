import { memo } from "react";
import type { PosTransactionSummary } from "../pos-transaction";

function SummaryCell({
  label,
  value,
  muted,
  danger,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`flex justify-between gap-2 text-xs ${muted ? "text-[var(--pos-muted)]" : "text-[var(--pos-ink)]"}`}
      title={hint}
    >
      <span>{label}</span>
      <span className={`font-bold tabular-nums ${danger ? "text-[var(--pos-danger)]" : "text-[var(--pos-ink)]"}`}>
        {value}
      </span>
    </div>
  );
}

export type PosTotalsProps = {
  summary: PosTransactionSummary;
};

/** Two-column totals matrix matching the reference checkout panel. */
export const PosTotals = memo(function PosTotals({ summary }: PosTotalsProps) {
  return (
    <div className="pos-tx-totals" data-grand={summary.grand.toFixed(2)}>
      <div className="pos-totals-grid">
        <SummaryCell label="Total Items" value={String(summary.items)} />
        <SummaryCell label="Taxable Amount" value={summary.taxableAmount.toFixed(2)} muted />

        <SummaryCell label="Total Quantity" value={String(summary.qty)} />
        <SummaryCell label="Sales Tax" value={`+${summary.salesTax.toFixed(2)}`} muted />

        <SummaryCell label="Subtotal" value={summary.subtotal.toFixed(2)} />
        <SummaryCell
          label="Delivery Charges"
          value={`+${summary.deliveryCharges.toFixed(2)}`}
          muted
          hint="Delivery is a sale flag. Checkout adds a fee only when domain deliveryCharges is set."
        />

        <SummaryCell label="Item Discount" value={`−${summary.itemDiscount.toFixed(2)}`} muted />
        <SummaryCell
          label="Round Off"
          value={summary.roundOff.toFixed(2)}
          muted
          hint="Round-off comes from calculateSaleTotals. Live POS currently posts 0."
        />

        <SummaryCell
          label="Invoice Discount"
          value={`−${summary.invoiceDiscount.toFixed(2)}`}
          muted
          danger={summary.invoiceDiscount > 0}
        />
        <div />

        <div className="pos-totals-discount-row col-span-2 flex justify-between gap-2 border-t border-[var(--pos-border)] pt-1.5 text-xs font-bold text-[var(--pos-ink)]">
          <span>Total Discount</span>
          <span className="tabular-nums text-[var(--pos-danger)]">−{summary.totalDiscount.toFixed(2)}</span>
        </div>
      </div>

      <div className="pos-grand-block mt-2 flex items-center justify-between rounded-[var(--pos-radius)] border border-[var(--pos-primary-soft)] bg-[var(--pos-primary-soft)] px-3 py-3 text-[var(--pos-primary)]">
        <span className="text-sm font-bold tracking-wide">GRAND TOTAL</span>
        <span className="pos-grand tabular-nums">Rs {summary.grand.toFixed(2)}</span>
      </div>
    </div>
  );
});
