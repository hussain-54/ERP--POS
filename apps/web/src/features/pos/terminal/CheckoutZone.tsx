import { money } from "../format";
import type { PosCustomerView, PosPaymentKind } from "../types";
import { PAYMENT_METHODS } from "../types";

export function CheckoutZone({
  customer,
  totals,
  paymentKind,
  onPaymentKind,
  cashReceived,
  onCashReceived,
  couponCode,
  notes,
  onNotes,
  onSelectCustomer,
  onWalkIn,
  onNewCustomer,
  onDiscount,
  onHold,
  onSaveDraft,
  onPayment,
  onComplete,
  onProceedToCheckout,
  busy,
  recordOnlyHint,
  paymentRecorded,
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
  };
  paymentKind: PosPaymentKind;
  onPaymentKind: (k: PosPaymentKind) => void;
  cashReceived?: number;
  onCashReceived?: (amt: number) => void;
  couponCode: string;
  notes: string;
  onNotes: (v: string) => void;
  onSelectCustomer: () => void;
  onWalkIn: () => void;
  onNewCustomer: () => void;
  onDiscount: () => void;
  onHold: () => void;
  onSaveDraft?: () => void;
  onPayment: () => void;
  onComplete: () => void;
  onProceedToCheckout?: () => void;
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
  const currentCash = cashReceived != null ? cashReceived : totals.grand;
  const changeToReturn = Math.max(0, currentCash - totals.grand);

  const quickAmounts = [
    { label: "Exact", value: totals.grand },
    { label: "500", value: 500 },
    { label: "1,000", value: 1000 },
    { label: "2,000", value: 2000 },
    { label: "5,000", value: 5000 },
  ];

  return (
    <section className="pos-zone pos-zone-checkout flex h-full flex-col" aria-label="Checkout summary">
      {/* Zone Header */}
      <div className="pos-zone-header shrink-0">
        <h2 className="pos-zone-title flex items-center gap-1.5">
          <i className="fa-solid fa-cash-register text-xs text-blue-600" aria-hidden />
          Order Summary & Pay
        </h2>
        <span className="text-[10px] font-bold text-slate-400">
          {totals.totalQty} {totals.totalQty === 1 ? "unit" : "units"}
        </span>
      </div>

      {/* Scrollable Middle Area */}
      <div className="pos-zone-scroll min-h-0 flex-1 space-y-2 p-2.5">
        {/* Customer Mini-Card */}
        <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-2">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={onSelectCustomer}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs">
                <i className="fa-solid fa-user" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
                <p className="truncate text-xs font-black text-slate-900 group-hover:text-blue-600">
                  {customer.label}
                </p>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              {customer.id ? (
                <button
                  type="button"
                  onClick={onWalkIn}
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  Walk-in
                </button>
              ) : null}
              <button
                type="button"
                onClick={onNewCustomer}
                className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white transition hover:bg-blue-700"
              >
                + New
              </button>
            </div>
          </div>

          {/* Customer Meta Pill */}
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded bg-white p-1 text-center text-[9px] border border-slate-100">
            <div>
              <span className="text-slate-400">Tier: </span>
              <span className="font-bold text-slate-700 uppercase">{customer.priceTier}</span>
            </div>
            <div>
              <span className="text-slate-400">Credit: </span>
              <span className="font-bold text-slate-700">{money(customer.creditLimit)}</span>
            </div>
            <div>
              <span className="text-slate-400">Points: </span>
              <span className="font-bold text-blue-600">{customer.loyaltyPoints}</span>
            </div>
          </div>

          {customer.id && customer.outstanding > 0 ? (
            <p className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Udhaar Balance: {money(customer.outstanding)}
            </p>
          ) : null}
        </div>

        {/* Order Breakdown */}
        <div className="rounded-lg border border-slate-200/80 bg-white p-2 text-[11px] space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-bold text-slate-900">{money(totals.subtotal)}</span>
          </div>
          {totals.itemDiscount > 0 ? (
            <div className="flex justify-between text-red-600 font-semibold">
              <span>Item Discounts</span>
              <span>−{money(totals.itemDiscount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-slate-600">
            <span className="flex items-center gap-1">
              Invoice Discount
              <button
                type="button"
                onClick={onDiscount}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                ({totals.invoiceDiscount > 0 ? "Edit" : "+ Add"})
              </button>
            </span>
            <span className={totals.invoiceDiscount > 0 ? "font-bold text-red-600" : "font-medium text-slate-400"}>
              {totals.invoiceDiscount > 0 ? `−${money(totals.invoiceDiscount)}` : "0.00"}
            </span>
          </div>
          {couponCode ? (
            <div className="flex justify-between text-blue-700 font-semibold">
              <span>Coupon Applied</span>
              <span>{couponCode}</span>
            </div>
          ) : null}
          {totals.taxable > 0 ? (
            <div className="flex justify-between text-slate-500 text-[10px]">
              <span>Taxable Base</span>
              <span>{money(totals.taxable)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-slate-600">
            <span>GST / Tax</span>
            <span className="font-medium text-slate-800">{money(totals.tax)}</span>
          </div>
        </div>

        {/* GRAND TOTAL BOX */}
        <div className="pos-grand-box flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Payable</p>
            <p className="text-xl font-black tracking-tight text-white">{money(totals.grand)}</p>
          </div>
          <div className="text-right">
            <span className="rounded bg-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-200 uppercase">
              {paymentKind}
            </span>
          </div>
        </div>

        {/* Inline Cash Tender & Change (when Cash tender is active) */}
        {paymentKind === "cash" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pos-cash-received" className="text-[10px] font-bold uppercase text-emerald-900">
                Cash Received
              </label>
              <div className="relative w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                  Rs.
                </span>
                <input
                  id="pos-cash-received"
                  type="number"
                  min={0}
                  value={currentCash || ""}
                  onChange={(e) => onCashReceived?.(Number(e.target.value) || 0)}
                  className="w-full rounded border border-emerald-300 bg-white py-1 pl-7 pr-2 text-right text-xs font-black text-slate-900 focus:border-emerald-500 focus:outline-none"
                  aria-label="Cash received amount"
                />
              </div>
            </div>

            {/* Quick Cash Presets */}
            <div className="flex flex-wrap gap-1">
              {quickAmounts.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => onCashReceived?.(q.value)}
                  className="pos-quick-cash-chip"
                >
                  {q.label === "Exact" ? "Exact" : `Rs. ${q.label}`}
                </button>
              ))}
            </div>

            {/* Change to Return Display */}
            <div className="flex items-center justify-between border-t border-emerald-200/70 pt-1 text-xs font-black">
              <span className="text-emerald-900">Change to Return:</span>
              <span className="text-sm font-black text-emerald-700">{money(changeToReturn)}</span>
            </div>
          </div>
        ) : null}

        {/* Multi-Tender Status if recorded */}
        {paymentRecorded && paymentKind !== "cash" ? (
          <div className="grid grid-cols-3 gap-1 rounded bg-slate-100 p-1.5 text-center text-[10px]">
            <div>
              <span className="text-slate-500">Paid: </span>
              <span className="font-bold text-emerald-700">{money(paymentRecorded.paid)}</span>
            </div>
            <div>
              <span className="text-slate-500">Remain: </span>
              <span className="font-bold text-amber-700">{money(paymentRecorded.remaining)}</span>
            </div>
            <div>
              <span className="text-slate-500">Change: </span>
              <span className="font-bold text-slate-800">{money(paymentRecorded.change)}</span>
            </div>
          </div>
        ) : null}

        {/* Payment Methods Grid */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Tender</span>
            <button
              type="button"
              onClick={onPayment}
              className="text-[10px] font-bold text-blue-600 hover:underline"
            >
              Split / More
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {PAYMENT_METHODS.slice(0, 8).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPaymentKind(m.id)}
                className={`flex flex-col items-center justify-center rounded-md p-1.5 text-[9px] font-bold transition ${
                  paymentKind === m.id
                    ? "border-2 border-blue-600 bg-blue-50 text-blue-900 shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className={`fa-solid ${m.icon} mb-0.5 text-xs ${m.color}`} aria-hidden />
                <span className="truncate">{m.label}</span>
              </button>
            ))}
          </div>
          {recordOnlyHint ? (
            <p className="mt-1 text-[9px] text-slate-400">
              * Wallet/Card recorded in POS without live PSP terminal
            </p>
          ) : null}
        </div>

        {/* Sale Notes Input */}
        <div>
          <textarea
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            rows={1}
            placeholder="Sale note / salesman reference (optional)…"
            className="w-full resize-none rounded border border-slate-200 bg-white p-1.5 text-[11px] text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Pinned Action Footer (Always 100% visible on screen!) */}
      <div className="shrink-0 space-y-1.5 border-t border-slate-200 bg-slate-50 p-2.5">
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            disabled={busy || empty}
            onClick={onHold}
            className="flex items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-40"
          >
            <i className="fa-solid fa-pause text-[10px]" />
            Hold (F6)
          </button>
          <button
            type="button"
            disabled={busy || empty}
            onClick={onSaveDraft}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <i className="fa-regular fa-floppy-disk text-[10px]" />
            Draft
          </button>
          <button
            type="button"
            disabled={busy || empty}
            onClick={onPayment}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <i className="fa-solid fa-receipt text-[10px]" />
            Split
          </button>
        </div>

        {/* PRIMARY PROCEED TO CHECKOUT ACTION */}
        <button
          type="button"
          disabled={busy || empty}
          onClick={onProceedToCheckout ?? onComplete}
          className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-3.5 py-3 text-sm font-black text-white shadow-md transition hover:bg-blue-700 active:scale-98 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-cash-register text-base" aria-hidden />
            <span>CHECKOUT / PAY NOW (F4)</span>
          </span>
          <span className="rounded-lg bg-blue-800/60 px-2.5 py-0.5 text-xs font-black tracking-tight">
            {money(totals.grand)}
          </span>
        </button>

        {/* Quick Instant Cash Sale Button */}
        <button
          type="button"
          disabled={busy || empty}
          onClick={onComplete}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400 bg-emerald-50 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-99 disabled:cursor-not-allowed disabled:opacity-40"
          title="Instantly complete cash sale without opening checkout desk"
        >
          <i className="fa-solid fa-bolt text-emerald-600" />
          <span>Quick Cash Sale (F8)</span>
        </button>
      </div>
    </section>
  );
}
