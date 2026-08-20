import { memo } from "react";

export type PaymentSummaryProps = {
  methodLabel: string;
  settlementNote?: string | null;
  grandTotal: number;
  paid: number;
  due: number;
  change: number;
  tendered?: number | null;
  splitLabels?: Array<{ label: string; amount: number }>;
};

function Cell({
  label,
  value,
  emphasize,
  danger,
  success,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--pos-radius-sm)] px-2 py-2 ${
        emphasize ? "bg-[var(--pos-primary-soft)]" : "bg-[var(--pos-muted-bg)]"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--pos-muted)]">{label}</div>
      <div
        className={`mt-0.5 font-bold tabular-nums ${
          danger
            ? "text-[var(--pos-danger)]"
            : success
              ? "text-emerald-700"
              : emphasize
                ? "text-[var(--pos-primary)]"
                : "text-[var(--pos-ink)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export const PaymentSummary = memo(function PaymentSummary({
  methodLabel,
  settlementNote,
  grandTotal,
  paid,
  due,
  change,
  tendered,
  splitLabels,
}: PaymentSummaryProps) {
  return (
    <div className="pos-pay-summary mt-3 space-y-2 text-sm">
      <div className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--pos-muted)]">
          Selected method
        </div>
        <div className="font-semibold text-[var(--pos-ink)]">{methodLabel}</div>
        {settlementNote ? (
          <p className="mt-0.5 text-[11px] text-[var(--pos-muted)]">{settlementNote}</p>
        ) : null}
      </div>

      {splitLabels && splitLabels.length > 1 ? (
        <ul className="space-y-1 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2 py-1.5 text-xs">
          {splitLabels.map((row) => (
            <li key={`${row.label}-${row.amount}`} className="flex justify-between gap-2">
              <span className="text-[var(--pos-muted)]">{row.label}</span>
              <span className="font-semibold tabular-nums">Rs {row.amount.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Cell label="Grand total" value={`Rs ${grandTotal.toFixed(2)}`} emphasize />
        <Cell label="Paid" value={`Rs ${paid.toFixed(2)}`} />
        {tendered != null ? (
          <Cell label="Cash received" value={`Rs ${tendered.toFixed(2)}`} />
        ) : null}
        <Cell
          label="Change"
          value={`Rs ${change.toFixed(2)}`}
          success={change > 0.009}
        />
        <Cell
          label="Balance"
          value={`Rs ${due.toFixed(2)}`}
          danger={due > 0.009}
          emphasize={due > 0.009}
        />
      </div>
    </div>
  );
});
