import { memo, useEffect, useState, type RefObject } from "react";
import { POSButton, POSInput } from "../design-system";

export type InvoiceDiscountMode = "fixed" | "percentage";

type Props = {
  /** Applied invoice discount amount in rupees (canonical cart total input). */
  appliedAmount: string;
  kind: InvoiceDiscountMode;
  percent: number;
  canDiscount: boolean;
  discountRef?: RefObject<HTMLInputElement | null>;
  onApply: (raw: string) => void;
};

/**
 * Invoice discount entry — % or fixed Rs.
 * Commits through existing parseDiscountValueInput / evaluateDiscountAgainstPolicy on Apply.
 */
export const PosInvoiceDiscountField = memo(function PosInvoiceDiscountField({
  appliedAmount,
  kind,
  percent,
  canDiscount,
  discountRef,
  onApply,
}: Props) {
  const [mode, setMode] = useState<InvoiceDiscountMode>(kind);
  const [draft, setDraft] = useState(() =>
    kind === "percentage" && percent > 0 ? String(percent) : appliedAmount || "",
  );

  useEffect(() => {
    setMode(kind);
    setDraft(kind === "percentage" && percent > 0 ? String(percent) : appliedAmount || "");
  }, [kind, percent, appliedAmount]);

  const applied = Number(appliedAmount) || 0;

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      onApply("0");
      return;
    }
    onApply(mode === "percentage" ? `${trimmed}%` : trimmed);
  }

  if (!canDiscount) {
    return (
      <POSButton
        size="sm"
        variant="ghost"
        disabled
        title="Invoice discount requires a POS discount permission"
      >
        Apply Discount
      </POSButton>
    );
  }

  return (
    <div className="pos-invoice-discount flex flex-wrap items-center gap-1.5">
      <div
        className="inline-flex overflow-hidden rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)]"
        role="group"
        aria-label="Discount type"
      >
        <button
          type="button"
          className={`px-2 py-1.5 text-[11px] font-semibold ${
            mode === "fixed"
              ? "bg-[var(--pos-primary)] text-white"
              : "bg-[var(--pos-workspace)] text-[var(--pos-muted)]"
          }`}
          onClick={() => setMode("fixed")}
          title="Fixed amount in rupees"
        >
          Rs
        </button>
        <button
          type="button"
          className={`px-2 py-1.5 text-[11px] font-semibold ${
            mode === "percentage"
              ? "bg-[var(--pos-primary)] text-white"
              : "bg-[var(--pos-workspace)] text-[var(--pos-muted)]"
          }`}
          onClick={() => setMode("percentage")}
          title="Percentage of bill after item discounts"
        >
          %
        </button>
      </div>
      <POSInput
        ref={discountRef as RefObject<HTMLInputElement>}
        aria-label="Invoice discount"
        placeholder={mode === "percentage" ? "e.g. 10" : "e.g. 100"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-[4.5rem]"
        inputMode="decimal"
        title={mode === "percentage" ? "Enter percent (example: 10 for 10%)" : "Enter rupees (example: 100)"}
      />
      <POSButton size="sm" variant="secondary" onClick={commit} title="Apply invoice discount">
        Apply
      </POSButton>
      <span
        className="text-[11px] tabular-nums text-[var(--pos-muted)]"
        title="Resulting invoice discount amount"
      >
        {applied > 0
          ? kind === "percentage" && percent > 0
            ? `−Rs ${applied.toFixed(2)} (${percent}%)`
            : `−Rs ${applied.toFixed(2)}`
          : "No bill discount"}
      </span>
    </div>
  );
});
