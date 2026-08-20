import { memo } from "react";
import type { PosTransactionSummary } from "../pos-transaction";

function SummaryRow({
  label,
  value,
  muted,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`flex justify-between gap-3 text-sm ${muted ? "text-[var(--pos-muted)]" : "text-[var(--pos-ink)]"}`}
      title={hint}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export type PosTotalsProps = {
  summary: PosTransactionSummary;
};

export const PosTotals = memo(function PosTotals({ summary }: PosTotalsProps) {
  return (
    <div className="pos-tx-totals space-y-1" data-grand={summary.grand.toFixed(2)}>
      <SummaryRow label="Total Items" value={String(summary.items)} />
      <SummaryRow label="Total Quantity" value={String(summary.qty)} />
      <SummaryRow label="Subtotal" value={summary.subtotal.toFixed(2)} />
      <SummaryRow label="Item Discount" value={`−${summary.itemDiscount.toFixed(2)}`} muted />
      <SummaryRow label="Invoice Discount" value={`−${summary.invoiceDiscount.toFixed(2)}`} muted />
      <SummaryRow label="Total Discount" value={`−${summary.totalDiscount.toFixed(2)}`} muted />
      <SummaryRow label="Taxable Amount" value={summary.taxableAmount.toFixed(2)} muted />
      <SummaryRow label="Sales Tax" value={summary.salesTax.toFixed(2)} muted />
      <SummaryRow
        label="Delivery Charges"
        value={summary.deliveryCharges.toFixed(2)}
        muted
        hint="Delivery is a sale flag. Checkout adds a fee only when domain deliveryCharges is set."
      />
      <SummaryRow
        label="Round Off"
        value={summary.roundOff.toFixed(2)}
        muted
        hint="Round-off comes from calculateSaleTotals. Live POS currently posts 0."
      />
      <div className="pos-grand-block flex items-end justify-between border-t border-[var(--pos-border)] pt-2">
        <span className="text-sm font-semibold text-[var(--pos-ink)]">GRAND TOTAL</span>
        <span className="pos-grand tabular-nums">Rs {summary.grand.toFixed(2)}</span>
      </div>
    </div>
  );
});
