import { money } from "../format";
import type { PosCustomerView, PosPaymentKind, PosPaymentLine } from "../types";
import { PAYMENT_METHODS } from "../types";

/** Immediate tenders shown in the 4×2 method grid. */
const GRID_TENDERS = PAYMENT_METHODS.filter((m) =>
  ["cash", "card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"].includes(m.id),
);

const RECORD_METHODS = new Set(["card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"]);

function methodLabel(kind: PosPaymentKind): string {
  return PAYMENT_METHODS.find((m) => m.id === kind)?.label ?? kind;
}

function defaultDueDateIso(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CheckoutZone({
  customer,
  totals,
  paymentKind,
  onPaymentKind,
  cashReceived,
  onCashReceived,
  paymentReference,
  onPaymentReference,
  creditDueDate,
  onCreditDueDate,
  paymentLines,
  installmentPlan,
  installmentConfirmed,
  couponCode,
  notes,
  onNotes,
  onSelectCustomer,
  onWalkIn,
  onNewCustomer,
  onDiscount,
  onHold,
  onPayment,
  onComplete,
  onDeliveryOrder,
  onClearCart,
  onSplitPayment,
  onInstallment,
  onClearSplit,
  onClearInstallment,
  deliveryCharges = 0,
  busy,
  recordOnlyHint,
}: {
  customer: PosCustomerView;
  totals: {
    itemCount: number;
    totalQty: number;
    taxable: number;
    itemDiscount: number;
    invoiceDiscount: number;
    tax: number;
    subtotal: number;
    totalDiscount: number;
    grand: number;
    expectedProfit: number | null;
    deliveryCharges?: number;
  };
  paymentKind: PosPaymentKind;
  onPaymentKind: (k: PosPaymentKind) => void;
  cashReceived?: number;
  onCashReceived?: (amt: number) => void;
  paymentReference?: string;
  onPaymentReference?: (v: string) => void;
  creditDueDate?: string;
  onCreditDueDate?: (v: string) => void;
  paymentLines?: PosPaymentLine[];
  installmentPlan?: {
    downPayment: string;
    installmentCount: number;
    frequency?: string;
    startDate?: string;
  } | null;
  installmentConfirmed?: boolean;
  couponCode: string;
  notes: string;
  onNotes: (v: string) => void;
  onSelectCustomer: () => void;
  onWalkIn?: () => void;
  onNewCustomer?: () => void;
  onDiscount: () => void;
  onHold: () => void;
  onSaveDraft?: () => void;
  onPayment: () => void;
  onComplete: () => void;
  onProceedToCheckout?: () => void;
  onDeliveryOrder?: () => void;
  onClearCart?: () => void;
  onSplitPayment?: () => void;
  onInstallment?: () => void;
  onClearSplit?: () => void;
  onClearInstallment?: () => void;
  deliveryCharges?: number;
  busy?: boolean;
  recordOnlyHint?: boolean;
  paymentRecorded?: {
    paid: number;
    remaining: number;
    change: number;
    lineCount: number;
  } | null;
}) {
  const empty = totals.itemCount === 0;
  const currentCash = cashReceived != null ? cashReceived : undefined;
  const cashValue = currentCash ?? "";
  const changeToReturn = currentCash != null ? Math.max(0, currentCash - totals.grand) : 0;
  const creditAvailable = Math.max(0, customer.creditLimit - customer.outstanding);
  const deliveryActive = deliveryCharges > 0 || Boolean(totals.deliveryCharges && totals.deliveryCharges > 0);
  const selectedGrid = GRID_TENDERS.find((m) => m.id === paymentKind);
  const showRecordHint = Boolean(recordOnlyHint || selectedGrid?.recordOnly);

  const splitLines = (paymentLines ?? []).filter((p) => p.amount > 0);
  const splitAllocated = splitLines.reduce((s, p) => s + p.amount, 0);
  const splitFullyAllocated =
    paymentKind === "split" &&
    splitLines.length > 0 &&
    Math.abs(splitAllocated - totals.grand) <= 0.009;

  const down = Number(installmentPlan?.downPayment ?? 0) || 0;
  const instCount = Math.max(2, installmentPlan?.installmentCount ?? 3);
  const remainingInstallment = Math.max(0, totals.grand - down);
  const perInstallment = instCount > 0 ? remainingInstallment / instCount : 0;

  const cashShort =
    paymentKind === "cash" && currentCash != null && currentCash + 0.009 < totals.grand && totals.grand > 0;
  const needsReference = RECORD_METHODS.has(paymentKind) && !(paymentReference ?? "").trim();
  const creditNeedsCustomer = paymentKind === "credit" && !customer.id;
  const installmentNeedsCustomer = paymentKind === "installment" && !customer.id;
  const installmentIncomplete = paymentKind === "installment" && !installmentConfirmed;
  const splitIncomplete = paymentKind === "split" && !splitFullyAllocated;

  const completeBlocked =
    busy ||
    empty ||
    cashShort ||
    needsReference ||
    creditNeedsCustomer ||
    installmentNeedsCustomer ||
    installmentIncomplete ||
    splitIncomplete;

  const quickAmounts = [
    { label: "Exact", value: totals.grand },
    { label: "500", value: 500 },
    { label: "1,000", value: 1000 },
    { label: "2,000", value: 2000 },
    { label: "5,000", value: 5000 },
  ];

  function selectImmediate(kind: PosPaymentKind) {
    onClearSplit?.();
    onClearInstallment?.();
    onPaymentKind(kind);
  }

  function openSplit() {
    if (onSplitPayment) onSplitPayment();
    else onPayment();
  }

  function openInstallment() {
    if (onInstallment) onInstallment();
    else {
      onPaymentKind("installment");
      onPayment();
    }
  }

  function selectCredit() {
    onClearSplit?.();
    onClearInstallment?.();
    onPaymentKind("credit");
    if (!creditDueDate) onCreditDueDate?.(defaultDueDateIso(30));
  }

  const referenceLabel =
    paymentKind === "card"
      ? "Card approval / last 4 digits"
      : paymentKind === "bank"
        ? "Bank transfer reference"
        : paymentKind === "qr"
          ? "QR transaction ID"
          : "Wallet / txn reference";

  return (
    <section
      className="pos-zone pos-zone-checkout flex h-full min-h-0 flex-col overflow-hidden"
      aria-label="Order summary and payment"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5">
        <h2 className="text-sm font-black text-slate-900">Order Summary &amp; Payment</h2>
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {/* Customer card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-900">{customer.label}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                <span className="inline-block min-w-[5.5rem]">Credit Limit:</span>
                <span className="font-semibold text-slate-700">{money(customer.creditLimit)}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="inline-block">Available:</span>{" "}
                <span className="font-semibold text-emerald-700">{money(creditAvailable)}</span>
              </p>
            </div>
            {onNewCustomer ? (
              <button
                type="button"
                onClick={onNewCustomer}
                className="shrink-0 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50"
              >
                + New
              </button>
            ) : null}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onSelectCustomer}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
            >
              Change
            </button>
            {customer.id && onWalkIn ? (
              <button
                type="button"
                onClick={onWalkIn}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
              >
                Walk-in
              </button>
            ) : null}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-[11px]">
          <div className="flex items-baseline justify-between gap-3 text-slate-600">
            <span className="shrink-0">Subtotal</span>
            <span className="text-right font-bold tabular-nums text-slate-900">{money(totals.subtotal)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-slate-600">
            <span className="shrink-0">Item Discount</span>
            <span
              className={`text-right tabular-nums ${
                totals.itemDiscount > 0 ? "font-semibold text-red-600" : "text-slate-400"
              }`}
            >
              {totals.itemDiscount > 0 ? `−${money(totals.itemDiscount)}` : "0.00"}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-slate-600">
            <span className="flex min-w-0 items-center gap-1.5">
              Invoice Discount
              <button type="button" onClick={onDiscount} className="font-bold text-blue-600 hover:underline">
                + Add
              </button>
            </span>
            <span
              className={`shrink-0 text-right tabular-nums ${
                totals.invoiceDiscount > 0 ? "font-bold text-red-600" : "text-slate-400"
              }`}
            >
              {totals.invoiceDiscount > 0 ? `−${money(totals.invoiceDiscount)}` : "0.00"}
            </span>
          </div>
          {couponCode ? (
            <div className="flex items-baseline justify-between gap-3 font-semibold text-blue-700">
              <span>Coupon</span>
              <span className="truncate text-right">{couponCode}</span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-3 text-slate-600">
            <span>Taxable Amount</span>
            <span className="text-right font-medium tabular-nums text-slate-800">{money(totals.taxable)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-slate-600">
            <span>GST / Tax (17%)</span>
            <span className="text-right font-medium tabular-nums text-slate-800">{money(totals.tax)}</span>
          </div>
          {(deliveryCharges > 0 || (totals.deliveryCharges ?? 0) > 0) ? (
            <div className="flex items-baseline justify-between gap-3 font-semibold text-orange-700">
              <span>Delivery Charges</span>
              <span className="text-right tabular-nums">+{money(deliveryCharges || totals.deliveryCharges || 0)}</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-[#1d4ed8] px-3.5 py-3 text-white shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">Total Payable</p>
          <p className="mt-0.5 text-2xl font-black tracking-tight tabular-nums">Rs. {money(totals.grand)}</p>
        </div>

        {/* Payment methods */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Method</p>
          <div className="grid grid-cols-4 gap-1.5">
            {GRID_TENDERS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectImmediate(m.id)}
                className={`flex min-h-[3.35rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-bold leading-tight transition ${
                  paymentKind === m.id
                    ? "border-2 border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <i className={`fa-solid ${m.icon} text-sm ${m.color}`} aria-hidden />
                <span className="px-0.5 text-center">{m.label.replace(" Payment", "").replace(" Transfer", "")}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={selectCredit}
              className={`flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-[11px] font-bold transition ${
                paymentKind === "credit"
                  ? "border-violet-600 bg-violet-50 text-violet-900"
                  : "border-violet-300 bg-white text-violet-700 hover:bg-violet-50"
              }`}
            >
              <i className="fa-solid fa-hand-holding-dollar shrink-0" aria-hidden />
              <span className="text-center leading-tight">Credit / Udhaar</span>
            </button>
            <button
              type="button"
              onClick={openSplit}
              className={`flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-[11px] font-bold transition ${
                paymentKind === "split"
                  ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                  : "border-cyan-300 bg-white text-cyan-700 hover:bg-cyan-50"
              }`}
            >
              <i className="fa-solid fa-scissors shrink-0" aria-hidden />
              <span className="text-center leading-tight">Split Payment</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={openInstallment}
              className={`flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-[11px] font-bold transition ${
                paymentKind === "installment"
                  ? "border-slate-700 bg-slate-100 text-slate-900"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <i className="fa-solid fa-calendar shrink-0" aria-hidden />
              <span className="text-center leading-tight">Installment</span>
            </button>
            <button
              type="button"
              onClick={() => onDeliveryOrder?.()}
              disabled={!onDeliveryOrder}
              className={`flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2 text-[11px] font-bold transition disabled:opacity-40 ${
                deliveryActive
                  ? "border-orange-500 bg-orange-50 text-orange-900"
                  : "border-orange-300 bg-white text-orange-700 hover:bg-orange-50"
              }`}
            >
              <i className="fa-solid fa-truck shrink-0" aria-hidden />
              <span className="text-center leading-tight">Delivery Order</span>
            </button>
          </div>
        </div>

        {/* Dynamic payment details — only one panel at a time */}
        {paymentKind === "cash" ? (
          <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-white p-3">
            <p className="text-[11px] font-bold text-emerald-700">Payment Details (Cash)</p>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="pos-cash-received" className="shrink-0 text-[11px] font-bold text-slate-700">
                Cash Received
              </label>
              <div className="relative w-[9.5rem] shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  Rs.
                </span>
                <input
                  id="pos-cash-received"
                  type="number"
                  min={0}
                  value={cashValue}
                  placeholder={String(totals.grand)}
                  onChange={(e) => onCashReceived?.(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-right text-sm font-black tabular-nums text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  aria-label="Cash received amount"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quickAmounts.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => onCashReceived?.(q.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {q.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const raw = window.prompt("Enter cash received amount", String(currentCash ?? totals.grand));
                  if (raw == null) return;
                  const n = Number(raw);
                  if (Number.isFinite(n) && n >= 0) onCashReceived?.(n);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
              >
                Other
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-emerald-100 pt-2.5">
              <span className="text-[11px] font-bold text-emerald-700">Change to Return</span>
              <span className="text-base font-black tabular-nums text-emerald-600">Rs. {money(changeToReturn)}</span>
            </div>
            {cashShort ? (
              <p className="text-[10px] font-bold leading-snug text-red-600">
                Cash received is less than total payable. Enter Exact or a higher amount before COMPLETE SALE.
              </p>
            ) : null}
          </div>
        ) : null}

        {RECORD_METHODS.has(paymentKind) ? (
          <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-bold text-slate-800">
              Payment Details ({selectedGrid?.label ?? methodLabel(paymentKind)})
            </p>
            <div className="flex items-baseline justify-between gap-3 text-[11px] text-slate-600">
              <span>Amount to collect</span>
              <span className="font-black tabular-nums text-slate-900">Rs. {money(totals.grand)}</span>
            </div>
            <label className="block text-[11px] font-bold text-slate-700">
              {referenceLabel}
              <input
                type="text"
                value={paymentReference ?? ""}
                onChange={(e) => onPaymentReference?.(e.target.value)}
                placeholder="Required for reconciliation"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            {needsReference ? (
              <p className="text-[10px] font-bold text-amber-700">Enter a reference before COMPLETE SALE.</p>
            ) : null}
            {showRecordHint ? (
              <p className="text-[9px] leading-relaxed text-slate-400">
                Recorded in POS for reconciliation — no live payment gateway charge.
              </p>
            ) : null}
          </div>
        ) : null}

        {paymentKind === "credit" ? (
          <div className="space-y-2.5 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
            <p className="text-[11px] font-bold text-violet-800">Credit / Udhaar Details</p>
            {!customer.id ? (
              <p className="text-[10px] font-bold text-red-600">
                Select a registered customer before posting credit.
              </p>
            ) : null}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Credit amount</span>
                <span className="font-black tabular-nums text-slate-900">Rs. {money(totals.grand)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Current outstanding</span>
                <span className="font-semibold tabular-nums text-amber-700">Rs. {money(customer.outstanding)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">After this sale</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  Rs. {money(customer.outstanding + totals.grand)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Available credit</span>
                <span className="font-semibold tabular-nums text-emerald-700">Rs. {money(creditAvailable)}</span>
              </div>
            </div>
            <label className="block text-[11px] font-bold text-slate-700">
              Due date / terms
              <input
                type="date"
                value={creditDueDate || defaultDueDateIso(30)}
                onChange={(e) => onCreditDueDate?.(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </label>
            <p className="text-[9px] leading-relaxed text-violet-700/80">
              Full receivable is saved against the customer ledger. No immediate tender is recorded.
            </p>
          </div>
        ) : null}

        {paymentKind === "split" ? (
          <div className="space-y-2.5 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-cyan-900">Split Payment</p>
              <button
                type="button"
                onClick={openSplit}
                className="rounded-lg border border-cyan-400 bg-white px-2.5 py-1 text-[10px] font-bold text-cyan-800 hover:bg-cyan-50"
              >
                {splitFullyAllocated ? "Edit Split" : "Configure Split"}
              </button>
            </div>
            {splitFullyAllocated ? (
              <div className="space-y-1.5 text-[11px]">
                {splitLines.map((line, i) => (
                  <div key={`${line.kind}-${i}`} className="flex justify-between gap-3 text-slate-700">
                    <span>{methodLabel(line.kind)}</span>
                    <span className="font-bold tabular-nums text-slate-900">Rs. {money(line.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-cyan-200 pt-1.5 font-black text-cyan-950">
                  <span>Total Paid</span>
                  <span className="tabular-nums">Rs. {money(splitAllocated)}</span>
                </div>
                <p className="text-[10px] font-bold text-emerald-700">Status: Fully Allocated</p>
              </div>
            ) : (
              <p className="text-[10px] font-bold leading-snug text-cyan-900">
                Open Split Payment, allocate methods until Remaining is Rs. 0.00, then Confirm before COMPLETE SALE.
              </p>
            )}
          </div>
        ) : null}

        {paymentKind === "installment" ? (
          <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-slate-900">Installment Plan</p>
              <button
                type="button"
                onClick={openInstallment}
                className="rounded-lg border border-slate-400 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-800 hover:bg-slate-100"
              >
                {installmentConfirmed ? "Edit Plan" : "Configure"}
              </button>
            </div>
            {!customer.id ? (
              <p className="text-[10px] font-bold text-red-600">Customer required for installment sales.</p>
            ) : null}
            {installmentConfirmed ? (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600">Down Payment</span>
                  <span className="font-black tabular-nums">Rs. {money(down)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600">Remaining</span>
                  <span className="font-bold tabular-nums text-amber-700">Rs. {money(remainingInstallment)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600">Plan</span>
                  <span className="text-right font-semibold text-slate-800">
                    {instCount} {installmentPlan?.frequency ?? "monthly"} · Rs. {money(perInstallment)} each
                  </span>
                </div>
                {installmentPlan?.startDate ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-600">First due</span>
                    <span className="font-semibold">{installmentPlan.startDate}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[10px] font-bold leading-snug text-slate-700">
                Configure down payment, term, and schedule, then Confirm Installment before COMPLETE SALE.
              </p>
            )}
          </div>
        ) : null}

        <div>
          <input
            id="pos-sale-note"
            type="text"
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Sale Note / Reference (optional)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="pos-zone-footer pos-checkout-footer shrink-0">
        <button
          type="button"
          disabled={completeBlocked}
          onClick={onComplete}
          className="pos-complete-sale-btn"
          aria-label={`Complete sale Rs. ${money(totals.grand)}`}
        >
          <i className="fa-solid fa-cart-shopping" aria-hidden />
          <span>{busy ? "Processing…" : `COMPLETE SALE  Rs. ${money(totals.grand)}`}</span>
        </button>

        <div className="pos-fkey-chips" role="group" aria-label="Keyboard shortcuts">
          <button
            type="button"
            disabled={completeBlocked}
            onClick={onComplete}
            title="Complete sale (F2)"
            className="pos-fkey-chip"
          >
            <kbd>F2</kbd> Pay
          </button>
          <button
            type="button"
            disabled={busy || empty}
            onClick={onHold}
            title="Hold sale (F4)"
            className="pos-fkey-chip"
          >
            <kbd>F4</kbd> Hold
          </button>
          <button
            type="button"
            disabled={!onDeliveryOrder}
            onClick={() => onDeliveryOrder?.()}
            title="Delivery order (F6)"
            className="pos-fkey-chip"
          >
            <kbd>F6</kbd> Delivery
          </button>
          <button
            type="button"
            onClick={onSelectCustomer}
            title="Select customer (F8)"
            className="pos-fkey-chip"
          >
            <kbd>F8</kbd> Customer
          </button>
          <button
            type="button"
            disabled={busy || empty || !onClearCart}
            onClick={() => onClearCart?.()}
            title="Clear cart (Esc)"
            className="pos-fkey-chip"
          >
            <kbd>Esc</kbd> Clear
          </button>
        </div>
      </div>
    </section>
  );
}
