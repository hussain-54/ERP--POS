import { useEffect, useMemo, useState } from "react";
import type { ApproverRole } from "@electronic-erp/contracts";
import { posApi } from "../api";
import { money } from "../format";
import type { CartLine, DiscountMode, PosCustomerView } from "../types";
import { lineTotal } from "../types";
import { DiscountPreviewCard } from "./DiscountPreviewCard";
import {
  computeDiscountPreview,
  DISCOUNT_APPROVAL_LADDER,
  type DiscountSection,
} from "./discount-utils";

const SECTIONS: Array<{ id: DiscountSection; label: string; icon: string }> = [
  { id: "item", label: "Item", icon: "fa-tag" },
  { id: "invoice", label: "Invoice", icon: "fa-receipt" },
  { id: "override", label: "Price override", icon: "fa-pen" },
  { id: "promotion", label: "Promotions", icon: "fa-bolt" },
  { id: "coupon", label: "Coupons", icon: "fa-ticket" },
  { id: "customer", label: "Customer pricing", icon: "fa-user-tag" },
  { id: "approval", label: "Approval", icon: "fa-shield-halved" },
];

export function ApplyDiscountPanel({
  section: initialSection = "invoice",
  line,
  invoiceBase,
  customer,
  actingRole,
  allowPriceOverride,
  organizationId,
  branchId: _branchId,
  onApplyItem,
  onApplyInvoice,
  onApplyPriceOverride,
  onClose,
}: {
  section?: DiscountSection;
  line: CartLine | null;
  invoiceBase: number;
  customer: PosCustomerView;
  actingRole: ApproverRole;
  allowPriceOverride: boolean;
  organizationId: string | null;
  branchId: string | null;
  onApplyItem: (lineId: string, amount: number, percent: number) => void;
  onApplyInvoice: (input: {
    mode: DiscountMode;
    amount: number;
    percent: number;
    reason: string;
    coupon?: string;
  }) => void;
  onApplyPriceOverride: (lineId: string, rate: number) => void;
  onClose?: () => void;
}) {
  const [section, setSection] = useState<DiscountSection>(initialSection);
  const [mode, setMode] = useState<DiscountMode>("percentage");
  const [percent, setPercent] = useState(0);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [coupon, setCoupon] = useState("");
  const [overrideRate, setOverrideRate] = useState("");
  const [couponPreview, setCouponPreview] = useState<number | null>(null);
  const [couponError, setCouponError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (line && section === "override") {
      setOverrideRate(String(line.rate));
    }
  }, [line, section]);

  const activeMode: DiscountMode =
    section === "promotion" ? "promotion" : section === "coupon" ? "coupon" : mode;

  const base =
    section === "item" || (section === "override" && line)
      ? line
        ? line.qty * line.rate
        : 0
      : invoiceBase;

  const preview = useMemo(() => {
    const amt = section === "coupon" && couponPreview != null ? couponPreview : amount;
    return computeDiscountPreview({
      mode: activeMode,
      base,
      percent,
      amount: amt,
      actingRole,
    });
  }, [activeMode, base, percent, amount, couponPreview, actingRole, section]);

  async function validateCouponCode() {
    if (!coupon.trim() || !organizationId) {
      setCouponError("Enter a coupon code");
      return;
    }
    setBusy(true);
    setCouponError("");
    try {
      const res = await posApi.validateCoupon({
        code: coupon.trim().toUpperCase(),
        purchaseBase: invoiceBase,
        customerId: customer.id ?? undefined,
      });
      const amt = Number(res.discountAmount ?? res.amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error("Coupon returned no discount for this cart");
      }
      setCouponPreview(amt);
    } catch (err) {
      setCouponPreview(null);
      setCouponError(err instanceof Error ? err.message : "Invalid coupon");
    } finally {
      setBusy(false);
    }
  }

  function submitDiscount() {
    setError("");
    try {
      if (preview.invalidPercent) throw new Error("Invalid percentage (0–100)");
      if (preview.exceedsBase || preview.isNegativeTotal) throw new Error("Discount exceeds allowed amount");
      if (!preview.decision.allowed && preview.discountAmount > 0) {
        throw new Error(`Requires ${preview.decision.requiredRole} approval`);
      }
      if (preview.decision.percent > 5 && !reason.trim() && section !== "coupon") {
        throw new Error("Reason required for discounts above 5%");
      }

      if (section === "item") {
        if (!line) throw new Error("Select a cart line first");
        onApplyItem(line.id, preview.discountAmount, mode === "percentage" ? percent : preview.decision.percent);
      } else if (section === "invoice" || section === "promotion") {
        onApplyInvoice({
          mode: section === "promotion" ? "promotion" : mode,
          amount: preview.discountAmount,
          percent,
          reason: reason.trim() || (section === "promotion" ? "Promotion" : ""),
        });
      } else if (section === "coupon") {
        if (couponPreview == null) throw new Error("Validate the coupon before applying");
        onApplyInvoice({
          mode: "coupon",
          amount: couponPreview,
          percent: 0,
          reason: reason.trim() || `Coupon ${coupon}`,
          coupon: coupon.trim().toUpperCase(),
        });
      }
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid discount");
    }
  }

  function submitOverride() {
    setError("");
    if (!allowPriceOverride) {
      setError("Price override requires manager-level permission");
      return;
    }
    if (!line) {
      setError("Select a cart line first");
      return;
    }
    const n = Number(overrideRate);
    if (!Number.isFinite(n) || n < 0) {
      setError("Enter a valid price (0 or greater)");
      return;
    }
    if (line.listPrice > 0 && n < line.listPrice * 0.5) {
      setError("Override is unusually low — check minimum sale price policy");
      return;
    }
    onApplyPriceOverride(line.id, n);
    onClose?.();
  }

  const showDiscountForm = ["item", "invoice", "promotion", "coupon"].includes(section);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 overflow-x-auto border-b border-slate-100 px-2 py-2">
        <div className="flex min-w-max gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSection(s.id);
                setError("");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                section === s.id ? "bg-[var(--pos-primary)] text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              <i className={`fa-solid ${s.icon} text-[10px]`} aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {line && section !== "approval" && section !== "customer" ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-bold text-slate-900">{line.name}</span> · {line.qty} × {money(line.rate)} ={" "}
            {money(lineTotal(line))}
          </p>
        ) : null}

        {section === "customer" ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-bold text-slate-900">{customer.label}</p>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Price tier</dt>
                <dd className="font-semibold">{customer.priceTier}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Credit limit</dt>
                <dd className="font-semibold">{money(customer.creditLimit)}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500">
              Customer-specific prices apply when a customer is attached on the terminal. Catalog customer prices are
              resolved server-side at checkout.
            </p>
          </div>
        ) : null}

        {section === "approval" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-bold text-slate-900">Your role: {actingRole}</p>
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="pb-2">Role</th>
                  <th className="pb-2 text-right">Max discount</th>
                </tr>
              </thead>
              <tbody>
                {DISCOUNT_APPROVAL_LADDER.map((row) => (
                  <tr key={row.role} className="border-t border-slate-100">
                    <td className="py-2 capitalize">{row.role}</td>
                    <td className="py-2 text-right font-semibold">{row.maxPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-slate-500">
              Discounts above your limit are blocked in POS. Higher roles require separate user login or approval
              workflow (coming soon).
            </p>
          </div>
        ) : null}

        {section === "override" ? (
          <div className="space-y-3">
            {!allowPriceOverride ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Price override requires manager, owner, or special discount permission.
              </p>
            ) : null}
            {!line ? (
              <p className="text-sm text-slate-500">Select a line in the cart, then override its unit price.</p>
            ) : (
              <>
                <label className="block text-xs font-semibold text-slate-600">
                  New unit price
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={overrideRate}
                    onChange={(e) => setOverrideRate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="flex justify-between">
                    <span>List price</span>
                    <span className="font-bold">{money(line.listPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current</span>
                    <span className="font-bold">{money(line.rate)}</span>
                  </div>
                </div>
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
                <button
                  type="button"
                  disabled={!allowPriceOverride || !line}
                  onClick={submitOverride}
                  className="w-full rounded-xl bg-[var(--pos-primary)] py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Apply price override
                </button>
              </>
            )}
          </div>
        ) : null}

        {showDiscountForm ? (
          <>
            {(section === "item" || section === "invoice") && (
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["percentage", "Percentage"],
                    ["fixed", "Fixed amount"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      mode === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(activeMode === "percentage" || activeMode === "promotion") && (
              <label className="block text-xs font-semibold text-slate-600">
                {section === "promotion" ? "Promotion percent" : "Percent off"}
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            )}

            {activeMode === "fixed" && section !== "coupon" && (
              <label className="block text-xs font-semibold text-slate-600">
                Fixed discount amount
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            )}

            {section === "coupon" && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Coupon code
                  <input
                    value={coupon}
                    onChange={(e) => {
                      setCoupon(e.target.value.toUpperCase());
                      setCouponPreview(null);
                      setCouponError("");
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
                    placeholder="SAVE10"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !coupon.trim()}
                  onClick={() => void validateCouponCode()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                >
                  {busy ? "Validating…" : "Validate coupon"}
                </button>
                {couponError ? <p className="text-xs text-red-600">{couponError}</p> : null}
                {couponPreview != null ? (
                  <p className="text-xs font-semibold text-emerald-700">Coupon discount {money(couponPreview)}</p>
                ) : null}
              </div>
            )}

            {section !== "coupon" && (
              <label className="block text-xs font-semibold text-slate-600">
                Reason {preview.decision.percent > 5 ? "(required)" : "(optional)"}
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            )}

            <DiscountPreviewCard preview={preview} actingRole={actingRole} />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button
              type="button"
              onClick={submitDiscount}
              disabled={
                (section === "item" && !line) ||
                (!preview.decision.allowed && preview.discountAmount > 0) ||
                preview.invalidPercent
              }
              className="w-full rounded-xl bg-[var(--pos-primary)] py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Apply discount
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
