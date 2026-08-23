import type { DiscountPreviewResult } from "./discount-utils";
import { money } from "../format";

export function DiscountPreviewCard({
  preview,
  actingRole,
}: {
  preview: DiscountPreviewResult;
  actingRole: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Discount preview</p>
      <dl className="space-y-1.5">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Current amount</dt>
          <dd className="font-bold tabular-nums text-slate-900">{money(preview.currentAmount)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Discount type</dt>
          <dd className="font-semibold text-slate-800">{preview.discountType}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Discount value</dt>
          <dd className="font-semibold text-slate-800">{preview.discountValue || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2 text-red-600">
          <dt>Discount amount</dt>
          <dd className="font-bold tabular-nums">−{money(preview.discountAmount)}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-slate-200 pt-1.5 text-sm">
          <dt className="font-bold text-slate-800">Final amount</dt>
          <dd className="font-bold tabular-nums text-[var(--pos-primary)]">{money(preview.finalAmount)}</dd>
        </div>
      </dl>
      <p
        className={`mt-2 text-[10px] font-semibold ${
          preview.decision.allowed ? "text-emerald-700" : "text-amber-700"
        }`}
      >
        {preview.decision.allowed
          ? `Within ${actingRole} limit (${preview.decision.maxAllowed}% max)`
          : `Requires ${preview.decision.requiredRole} approval (${preview.decision.percent}% requested)`}
      </p>
      {preview.invalidPercent ? (
        <p className="mt-1 text-[10px] font-semibold text-red-600">Percent must be between 0 and 100.</p>
      ) : null}
      {preview.exceedsBase ? (
        <p className="mt-1 text-[10px] font-semibold text-red-600">Discount cannot exceed the line or invoice base.</p>
      ) : null}
    </div>
  );
}