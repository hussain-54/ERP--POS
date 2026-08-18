import { memo } from "react";

export type PaymentSummaryProps = {
  methodLabel: string;
  settlementNote?: string | null;
  paid: number;
  due: number;
  change: number;
  tendered?: number | null;
};

export const PaymentSummary = memo(function PaymentSummary({
  methodLabel,
  settlementNote,
  paid,
  due,
  change,
  tendered,
}: PaymentSummaryProps) {
  return (
    <div className="pos-pay-summary mt-3 grid grid-cols-2 gap-2 text-sm">
      <div className="col-span-2 rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-2">
        <div className="text-xs text-[var(--pos-muted)]">Selected method</div>
        <div className="font-semibold text-[var(--pos-ink)]">{methodLabel}</div>
        {settlementNote ? (
          <p className="mt-0.5 text-[11px] text-[var(--pos-muted)]">{settlementNote}</p>
        ) : null}
      </div>
      {tendered != null ? (
        <div className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-2">
          <div className="text-xs text-[var(--pos-muted)]">Tendered</div>
          <div className="font-semibold tabular-nums">{tendered.toFixed(2)}</div>
        </div>
      ) : null}
      <div className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-2">
        <div className="text-xs text-[var(--pos-muted)]">Paid</div>
        <div className="font-semibold tabular-nums">{paid.toFixed(2)}</div>
      </div>
      <div className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-2">
        <div className="text-xs text-[var(--pos-muted)]">{change > 0 ? "Change" : "Amount due"}</div>
        <div
          className={`font-semibold tabular-nums ${due > 0 && change <= 0 ? "text-[var(--pos-danger)]" : ""}`}
        >
          {(change > 0 ? change : due).toFixed(2)}
        </div>
      </div>
    </div>
  );
});
