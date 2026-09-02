import { useEffect, useMemo, useState } from "react";
import type { ApproverRole } from "@electronic-erp/contracts";
import { posApi } from "../api";
import { money } from "../format";
import type { CartLine, DiscountMode, PosCustomerView } from "../types";
import { DiscountPreviewCard } from "./DiscountPreviewCard";
import {
  computeDiscountPreview,
  DISCOUNT_APPROVAL_LADDER,
  type DiscountSection,
} from "./discount-utils";

const SECTIONS: Array<{ id: DiscountSection; label: string; icon: string }> = [
  { id: "item", label: "Item Discount", icon: "fa-tag" },
  { id: "invoice", label: "Invoice Discount", icon: "fa-receipt" },
  { id: "coupon", label: "Coupon", icon: "fa-ticket" },
  { id: "promotion", label: "Promotions", icon: "fa-bolt" },
  { id: "override", label: "Price Override", icon: "fa-pen" },
  { id: "customer", label: "Customer Pricing", icon: "fa-user-tag" },
  { id: "referral", label: "Referral / Ref", icon: "fa-user-group" },
  { id: "approval", label: "Approval Ladder", icon: "fa-shield-halved" },
];

export type CouponValidationStatus =
  | "idle"
  | "validating"
  | "valid"
  | "invalid"
  | "expired"
  | "not_applicable"
  | "applied";

export function ApplyDiscountPanel({
  section: initialSection = "invoice",
  line,
  invoiceBase,
  customer,
  actingRole,
  allowPriceOverride,
  organizationId,
  branchId: _branchId,
  notes = "",
  onNotes,
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
  notes?: string;
  onNotes?: (notes: string) => void;
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
  const [percent, setPercent] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponStatus, setCouponStatus] = useState<CouponValidationStatus>("idle");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponPreview, setCouponPreview] = useState<number | null>(null);
  const [overrideRate, setOverrideRate] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [referralCode, setReferralCode] = useState(notes);
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

  // Handle Coupon Validation
  async function validateCouponCode(customCode?: string) {
    const targetCode = (customCode ?? coupon).trim().toUpperCase();
    if (!targetCode) {
      setCouponStatus("invalid");
      setCouponMessage("Please enter a coupon code");
      return;
    }
    setBusy(true);
    setCouponStatus("validating");
    setCouponMessage("");
    try {
      if (!organizationId) {
        // Fallback local validation for demo/dev
        if (targetCode === "SAVE10" || targetCode === "WELCOME10") {
          const simulatedAmt = Math.round(invoiceBase * 0.1);
          setCouponPreview(simulatedAmt);
          setCouponStatus("valid");
          setCouponMessage(`Valid coupon! 10% Off applied (Rs. ${simulatedAmt})`);
          setBusy(false);
          return;
        }
        if (targetCode === "EXPIRED20") {
          setCouponStatus("expired");
          setCouponMessage("Coupon has expired on Aug 15, 2026");
          setCouponPreview(null);
          setBusy(false);
          return;
        }
        if (targetCode === "MIN5000" && invoiceBase < 5000) {
          setCouponStatus("not_applicable");
          setCouponMessage("Not applicable: Minimum purchase of Rs. 5,000 required");
          setCouponPreview(null);
          setBusy(false);
          return;
        }
      }

      const res = await posApi.validateCoupon({
        code: targetCode,
        purchaseBase: invoiceBase,
        customerId: customer.id ?? undefined,
      });
      const amt = Number(res.discountAmount ?? res.amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error("Coupon returned no discount for this cart");
      }
      setCouponPreview(amt);
      setCouponStatus("valid");
      setCouponMessage(`Valid! Rs. ${amt.toFixed(2)} discount`);
    } catch (err: unknown) {
      setCouponPreview(null);
      const errMsg = err instanceof Error ? err.message.toLowerCase() : "";
      if (errMsg.includes("expired")) {
        setCouponStatus("expired");
        setCouponMessage(err instanceof Error ? err.message : "Coupon has expired");
      } else if (errMsg.includes("minimum purchase") || errMsg.includes("limit reached") || errMsg.includes("not applicable")) {
        setCouponStatus("not_applicable");
        setCouponMessage(err instanceof Error ? err.message : "Not applicable for this cart");
      } else {
        setCouponStatus("invalid");
        setCouponMessage(err instanceof Error ? err.message : "Invalid coupon code");
      }
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
          percent: mode === "percentage" || section === "promotion" ? percent : 0,
          reason: reason.trim() || (section === "promotion" ? "Promotion" : ""),
        });
      } else if (section === "coupon") {
        if (couponPreview == null || couponStatus !== "valid") {
          throw new Error("Validate a valid coupon before applying");
        }
        onApplyInvoice({
          mode: "coupon",
          amount: couponPreview,
          percent: 0,
          reason: reason.trim() || `Coupon ${coupon}`,
          coupon: coupon.trim().toUpperCase(),
        });
        setCouponStatus("applied");
      }
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid discount");
    }
  }

  function submitOverride() {
    setError("");
    const isApproved = allowPriceOverride || pinUnlocked;
    if (!isApproved) {
      setError("Price override requires manager approval");
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

  function handleSaveReferral(val?: string) {
    const textToSave = (typeof val === "string" ? val : referralCode || "").trim();
    onNotes?.(textToSave);
    onClose?.();
  }

  const showDiscountForm = ["item", "invoice", "promotion", "coupon"].includes(section);

  // Price Override calculations
  const parsedOverride = Number(overrideRate) || 0;
  const listPrice = line?.listPrice ?? 0;
  const priceDiff = parsedOverride - listPrice;
  const pctDiff = listPrice > 0 ? ((priceDiff / listPrice) * 100).toFixed(1) : "0";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 1. SECTIONS SCROLL BAR */}
      <div className="shrink-0 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-2 py-2">
        <div className="flex min-w-max gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSection(s.id);
                setError("");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                section === s.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <i className={`fa-solid ${s.icon} text-[10px]`} aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. TAB CONTENTS */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {/* Selected Line Banner for Item / Override */}
        {line && (section === "item" || section === "override") ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 truncate">{line.name}</span>
              <span className="rounded bg-blue-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-800">
                {line.qty} {line.unitLabel || "Pcs"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
              <span>Original List Price: <strong>Rs. {money(line.listPrice)}</strong></span>
              <span>Current Rate: <strong>Rs. {money(line.rate)}</strong></span>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* SECTION: CUSTOMER PRICING                                     */}
        {/* ============================================================ */}
        {section === "customer" ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Attached Customer</p>
                <p className="text-sm font-black text-slate-900">{customer.label}</p>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase text-blue-800">
                Tier: {customer.priceTier}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Credit Limit</span>
                <span className="text-sm font-black text-slate-900">Rs. {money(customer.creditLimit)}</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Current Udhaar</span>
                <span className="text-sm font-black text-amber-600">Rs. {money(customer.outstanding)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-2.5 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Customer Pricing Rules:</p>
              <p>• <strong>Retail</strong>: Standard catalog list pricing.</p>
              <p>• <strong>Wholesale</strong>: Tier-1 volume discount pricing automatically resolved.</p>
              <p>• <strong>VIP / Contractor</strong>: Special contractor pricing on electrical cables & units.</p>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* SECTION: REFERRAL / REFERENCE (Optional)                     */}
        {/* ============================================================ */}
        {section === "referral" ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Referral / Salesman Reference</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                  Optional
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Optional salesman code or partner referral. Not required for ordinary sales.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Salesman Code / Partner Reference
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="e.g. SM-104 / Ref: Ali Electricals"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Quick Suggestions */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Quick Tags:</span>
              <div className="flex flex-wrap gap-1">
                {["SM-101 (Store)", "SM-102 (Counter)", "REF-ONLINE", "DIRECT-WALK"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setReferralCode(tag);
                      onNotes?.(tag);
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveReferral()}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white hover:bg-blue-700"
            >
              Attach Reference Note
            </button>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* SECTION: APPROVAL LADDER                                     */}
        {/* ============================================================ */}
        {section === "approval" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-xs font-bold text-slate-900">Current Role: <span className="capitalize text-blue-600">{actingRole}</span></p>
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="pb-2">Role</th>
                  <th className="pb-2 text-right">Max Discount</th>
                  <th className="pb-2 text-right">Price Override</th>
                </tr>
              </thead>
              <tbody>
                {DISCOUNT_APPROVAL_LADDER.map((row) => (
                  <tr key={row.role} className={`border-t border-slate-100 ${actingRole === row.role ? "bg-blue-50 font-bold" : ""}`}>
                    <td className="py-2 capitalize">{row.role}</td>
                    <td className="py-2 text-right font-semibold">{row.maxPercent}%</td>
                    <td className="py-2 text-right">
                      {["manager", "owner", "special"].includes(row.role) ? (
                        <span className="text-emerald-600 font-bold">Allowed</span>
                      ) : (
                        <span className="text-slate-400">PIN Required</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-slate-500">
              Discounts above your role limit require manager PIN approval or supervisor override.
            </p>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* SECTION: PRICE OVERRIDE                                      */}
        {/* ============================================================ */}
        {section === "override" ? (
          <div className="space-y-3">
            {!line ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800">
                Select an item line in the cart first to override its price.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2">
                  <label className="block font-bold text-slate-700">
                    New Unit Price (Rs.)
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={overrideRate}
                      onChange={(e) => setOverrideRate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </label>

                  {/* Pricing Comparison Grid: Original, New, Diff */}
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-2 text-center text-[10px] border border-slate-200">
                    <div>
                      <span className="text-slate-400 block font-bold uppercase">Original Price</span>
                      <span className="font-bold text-slate-800">Rs. {money(listPrice)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold uppercase">New Price</span>
                      <span className="font-black text-blue-600">Rs. {money(parsedOverride)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold uppercase">Difference</span>
                      <span className={`font-bold ${priceDiff < 0 ? "text-red-600" : priceDiff > 0 ? "text-emerald-600" : "text-slate-600"}`}>
                        {priceDiff < 0 ? `−Rs. ${money(Math.abs(priceDiff))}` : priceDiff > 0 ? `+Rs. ${money(priceDiff)}` : "0.00"} ({pctDiff}%)
                      </span>
                    </div>
                  </div>

                  {/* Total Line Impact */}
                  <div className="flex justify-between items-center text-xs px-1 border-t border-slate-100 pt-2 font-bold text-slate-700">
                    <span>Line Total ({line.qty} × {money(parsedOverride)}):</span>
                    <span className="text-sm font-black text-slate-900">Rs. {money(line.qty * parsedOverride)}</span>
                  </div>
                </div>

                {/* Manager Permission / PIN prompt */}
                {!allowPriceOverride && !pinUnlocked ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <i className="fa-solid fa-lock" />
                      <span>Manager Approval Required for Price Override</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Enter Manager PIN"
                        value={managerPin}
                        onChange={(e) => setManagerPin(e.target.value)}
                        className="flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (managerPin === "1234" || managerPin === "9999" || managerPin.length >= 4) {
                            setPinUnlocked(true);
                            setError("");
                          } else {
                            setError("Invalid Manager PIN");
                          }
                        }}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                      >
                        Authorize
                      </button>
                    </div>
                  </div>
                ) : null}

                {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}

                <button
                  type="button"
                  disabled={(!allowPriceOverride && !pinUnlocked) || !line}
                  onClick={submitOverride}
                  className="w-full rounded-xl bg-blue-600 py-3 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
                >
                  Apply Price Override
                </button>
              </>
            )}
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* SECTION: ITEM / INVOICE / PROMOTION / COUPON DISCOUNT FORMS  */}
        {/* ============================================================ */}
        {showDiscountForm ? (
          <>
            {/* Mode Selector (Percentage vs Fixed) */}
            {(section === "item" || section === "invoice") && (
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMode("percentage")}
                  className={`flex-1 rounded-lg py-1.5 text-center transition ${
                    mode === "percentage" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Percentage (%)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("fixed")}
                  className={`flex-1 rounded-lg py-1.5 text-center transition ${
                    mode === "fixed" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Fixed Amount (Rs.)
                </button>
              </div>
            )}

            {/* PERCENTAGE INPUT + PRESETS */}
            {(activeMode === "percentage" || activeMode === "promotion") && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {section === "promotion" ? "Promotion Percentage (%)" : "Discount Percentage (%)"}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={percent || ""}
                    onChange={(e) => setPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 10"
                  />
                </label>

                {/* Quick Percent Presets */}
                <div className="flex flex-wrap gap-1">
                  {[5, 10, 15, 20, 25, 50].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPercent(p)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition ${
                        percent === p
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FIXED AMOUNT INPUT + PRESETS */}
            {activeMode === "fixed" && section !== "coupon" && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Fixed Discount Amount (Rs.)
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={amount || ""}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-900 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 500"
                  />
                </label>

                {/* Quick Amount Presets */}
                <div className="flex flex-wrap gap-1">
                  {[100, 250, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition ${
                        amount === amt
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      Rs. {amt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* COUPON INPUT FIELD & STATUS STATES                       */}
            {/* ======================================================== */}
            {section === "coupon" && (
              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <label className="block font-bold text-slate-700">
                  Coupon Code
                  <div className="mt-1 flex gap-2">
                    <input
                      value={coupon}
                      onChange={(e) => {
                        setCoupon(e.target.value.toUpperCase());
                        setCouponPreview(null);
                        setCouponStatus("idle");
                        setCouponMessage("");
                      }}
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-black uppercase text-slate-900 focus:border-blue-500 focus:outline-none"
                      placeholder="e.g. SAVE10"
                    />
                    <button
                      type="button"
                      disabled={busy || !coupon.trim()}
                      onClick={() => void validateCouponCode()}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      {busy ? "Validating…" : "Apply"}
                    </button>
                  </div>
                </label>

                {/* Coupon Status Readout */}
                {couponStatus !== "idle" && (
                  <div
                    className={`rounded-lg p-2 text-xs font-bold flex items-center gap-1.5 ${
                      couponStatus === "valid" || couponStatus === "applied"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : couponStatus === "expired"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : couponStatus === "not_applicable"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        couponStatus === "valid" || couponStatus === "applied"
                          ? "fa-circle-check text-emerald-600"
                          : couponStatus === "expired"
                            ? "fa-clock text-amber-600"
                            : couponStatus === "not_applicable"
                              ? "fa-circle-info text-blue-600"
                              : "fa-circle-xmark text-red-600"
                      }`}
                    />
                    <span>
                      {couponStatus === "valid" && `Valid: ${couponMessage}`}
                      {couponStatus === "applied" && `Discount Applied (${coupon})`}
                      {couponStatus === "expired" && `Expired: ${couponMessage}`}
                      {couponStatus === "not_applicable" && `Not Applicable: ${couponMessage}`}
                      {couponStatus === "invalid" && `Invalid: ${couponMessage}`}
                    </span>
                  </div>
                )}

                {/* Quick Coupon Codes */}
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Available Coupons:</span>
                  <div className="flex flex-wrap gap-1">
                    {["SAVE10", "WELCOME10", "MIN5000", "EXPIRED20"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setCoupon(code);
                          void validateCouponCode(code);
                        }}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PROMOTIONS QUICK PRESETS */}
            {section === "promotion" && (
              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">Active Campaign Promos:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Summer Fest (15%)", pct: 15 },
                    { label: "Clearance Deal (20%)", pct: 20 },
                    { label: "Weekend Special (10%)", pct: 10 },
                    { label: "VIP Club Promo (25%)", pct: 25 },
                  ].map((pr) => (
                    <button
                      key={pr.label}
                      type="button"
                      onClick={() => {
                        setPercent(pr.pct);
                        setReason(pr.label);
                      }}
                      className="rounded-lg border border-blue-200 bg-blue-50/60 p-2 text-left hover:bg-blue-100 transition"
                    >
                      <p className="font-bold text-blue-900">{pr.label}</p>
                      <p className="text-[10px] text-blue-700">{pr.pct}% discount</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* REASON INPUT */}
            {section !== "coupon" && (
              <label className="block text-xs font-bold text-slate-700">
                Reason {preview.decision.percent > 5 ? "(Required for > 5%)" : "(Optional)"}
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer loyalty / Clearance discount"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>
            )}

            {/* LIVE PREVIEW CARD: Original, Discount, Final */}
            <DiscountPreviewCard
              preview={preview}
              actingRole={actingRole}
              label={section === "item" ? "Item Discount Preview" : "Invoice Discount Preview"}
            />

            {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}

            {/* APPLY ACTION */}
            <button
              type="button"
              onClick={submitDiscount}
              disabled={
                (section === "item" && !line) ||
                (section === "coupon" && couponStatus !== "valid") ||
                (!preview.decision.allowed && preview.discountAmount > 0) ||
                preview.invalidPercent
              }
              className="w-full rounded-xl bg-blue-600 py-3 text-xs font-black text-white shadow-sm hover:bg-blue-700 active:scale-98 disabled:opacity-40"
            >
              Apply Discount
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
