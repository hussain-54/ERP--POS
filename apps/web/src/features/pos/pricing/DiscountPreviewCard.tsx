import type { DiscountPreviewResult } from "./discount-utils";
import { money } from "../format";

export function DiscountPreviewCard({
  preview,
  actingRole,
  label = "Discount Preview",
}: {
  preview: DiscountPreviewResult;
  actingRole: string;
  label?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 uppercase">
          {preview.discountType}
        </span>
      </div>

      <dl className="space-y-1.5 border-b border-slate-200/80 pb-2">
        {/* 1. ORIGINAL PRICE */}
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500 font-semibold">Original Price / Base:</dt>
          <dd className="font-bold tabular-nums text-slate-800">
            Rs. {money(preview.currentAmount)}
          </dd>
        </div>

        {/* 2. DISCOUNT */}
        <div className="flex justify-between gap-2 text-red-600 font-semibold">
          <dt className="flex items-center gap-1">
            <span>Discount ({preview.discountValue || "0%"}):</span>
          </dt>
          <dd className="font-bold tabular-nums">
            −Rs. {money(preview.discountAmount)}
          </dd>
        </div>

        {/* 3. FINAL PRICE */}
        <div className="flex justify-between gap-2 border-t border-dashed border-slate-200 pt-1.5 text-sm">
          <dt className="font-black text-slate-900">Final Price:</dt>
          <dd className="font-black tabular-nums text-blue-600">
            Rs. {money(preview.finalAmount)}
          </dd>
        </div>
      </dl>

      {/* APPROVAL / POLICY CHECK */}
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span
          className={`font-bold ${
            preview.decision.allowed ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {preview.decision.allowed
            ? `✓ Within ${actingRole} limit (${preview.decision.maxAllowed}% max)`
            : `⚠️ Requires ${preview.decision.requiredRole} approval (${preview.decision.percent}% requested)`}
        </span>
      </div>

      {preview.invalidPercent ? (
        <p className="mt-1 text-[10px] font-bold text-red-600">Percent must be between 0 and 100.</p>
      ) : null}
      {preview.exceedsBase ? (
        <p className="mt-1 text-[10px] font-bold text-red-600">Discount cannot exceed the base price.</p>
      ) : null}
    </div>
  );
}
