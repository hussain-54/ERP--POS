import { money } from "../format";
import type { PosCustomerView, PosPaymentKind } from "../types";
import { PAYMENT_METHODS } from "../types";

/** Primary tender chips shown in Order Summary (split/partial stay under Split / More). */
const CHECKOUT_TENDERS = PAYMENT_METHODS.filter(
  (m) => m.id !== "split" && m.id !== "partial",
);

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
  const currentCash = cashReceived != null ? cashReceived : undefined;
  const cashValue = currentCash ?? "";
  const changeToReturn =
    currentCash != null ? Math.max(0, currentCash - totals.grand) : 0;
  const selectedMethod = CHECKOUT_TENDERS.find((m) => m.id === paymentKind);
  const showRecordHint = Boolean(recordOnlyHint || selectedMethod?.recordOnly);

  const quickAmounts = [
    { label: "Exact", value: totals.grand },
    { label: "500", value: 500 },
    { label: "1,000", value: 1000 },
    { label: "2,000", value: 2000 },
    { label: "5,000", value: 5000 },
  ];

  return (
    <section
      className="pos-zone pos-zone-checkout flex h-full min-h-0 flex-col overflow-hidden"
      aria-label="Order summary and payment"
    >
      <div className="pos-zone-header shrink-0">
        <h2 className="pos-zone-title flex items-center gap-1.5">
          <i className="fa-solid fa-cash-register text-xs text-blue-600" aria-hidden />
          Order Summary &amp; Pay
        </h2>
        <span className="text-[10px] font-bold text-slate-400">
          {totals.totalQty} {totals.totalQty === 1 ? "unit" : "units"}
        </span>
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 space-y-2 p-2.5">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={onSelectCustomer}
              className="group flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm text-blue-600">
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
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  Walk-in
                </button>
              ) : null}
              <button
                type="button"
                onClick={onNewCustomer}
                className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-blue-700"
              >
                + New
              </button>
              <button
                type="button"
                onClick={onSelectCustomer}
                className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100"
              >
                Change
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-slate-100 bg-white p-1.5 text-center text-[9px]">
            <div>
              <span className="text-slate-400">Tier </span>
              <span className="font-bold uppercase text-slate-700">{customer.priceTier}</span>
            </div>
            <div>
              <span className="text-slate-400">Credit </span>
              <span className="font-bold text-slate-700">{money(customer.creditLimit)}</span>
            </div>
            <div>
              <span className="text-slate-400">Pts </span>
              <span className="font-bold text-blue-600">{customer.loyaltyPoints}</span>
            </div>
          </div>

          {customer.id && customer.outstanding > 0 ? (
            <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
              Udhaar Balance: {money(customer.outstanding)}
            </p>
          ) : null}
        </div>

        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2.5 text-[11px]">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-bold text-slate-900">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Item Discount</span>
            <span className={totals.itemDiscount > 0 ? "font-semibold text-red-600" : "font-medium text-slate-400"}>
              {totals.itemDiscount > 0 ? `−${money(totals.itemDiscount)}` : "0.00"}
            </span>
          </div>
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
            <div className="flex justify-between font-semibold text-blue-700">
              <span>Coupon</span>
              <span>{couponCode}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-slate-600">
            <span>Tax / GST</span>
            <span className="font-medium text-slate-800">{money(totals.tax)}</span>
          </div>
        </div>

        <div className="pos-grand-box flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Total Payable</p>
            <p className="text-2xl font-black tracking-tight text-white">{money(totals.grand)}</p>
          </div>
          <span className="rounded-lg bg-blue-500/35 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-100">
            {paymentKind}
          </span>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Method</span>
            <button
              type="button"
              onClick={onPayment}
              className="text-[10px] font-bold text-blue-600 hover:underline"
            >
              Split / More
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {CHECKOUT_TENDERS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPaymentKind(m.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[10px] font-bold transition ${
                  paymentKind === m.id
                    ? "border-2 border-blue-600 bg-blue-50 text-blue-900 shadow-xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <i className={`fa-solid ${m.icon} text-xs ${m.color}`} aria-hidden />
                <span className="leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
          {showRecordHint ? (
            <p className="mt-1 text-[9px] text-slate-400">
              * Card / wallet / QR recorded in POS (no live PSP terminal)
            </p>
          ) : null}
        </div>

        {paymentKind === "cash" ? (
          <div className="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pos-cash-received" className="text-[10px] font-bold uppercase text-emerald-900">
                Cash Received
              </label>
              <div className="relative w-32">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                  Rs.
                </span>
                <input
                  id="pos-cash-received"
                  type="number"
                  min={0}
                  value={cashValue}
                  placeholder={String(totals.grand)}
                  onChange={(e) => onCashReceived?.(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-emerald-300 bg-white py-1.5 pl-7 pr-2 text-right text-xs font-black text-slate-900 focus:border-emerald-500 focus:outline-none"
                  aria-label="Cash received amount"
                />
              </div>
            </div>

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

            <div className="flex items-center justify-between border-t border-emerald-200/80 pt-1.5 text-xs font-black">
              <span className="text-emerald-900">Change to Return</span>
              <span className="text-sm font-black text-emerald-700">{money(changeToReturn)}</span>
            </div>
          </div>
        ) : null}

        {paymentRecorded && paymentKind !== "cash" ? (
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1.5 text-center text-[10px]">
            <div>
              <span className="text-slate-500">Paid </span>
              <span className="font-bold text-emerald-700">{money(paymentRecorded.paid)}</span>
            </div>
            <div>
              <span className="text-slate-500">Remain </span>
              <span className="font-bold text-amber-700">{money(paymentRecorded.remaining)}</span>
            </div>
            <div>
              <span className="text-slate-500">Change </span>
              <span className="font-bold text-slate-800">{money(paymentRecorded.change)}</span>
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="pos-sale-note" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Sale Note / Reference
          </label>
          <textarea
            id="pos-sale-note"
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            rows={2}
            placeholder="Optional note, salesman ref, delivery instructions…"
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="pos-zone-footer shrink-0 space-y-1.5 border-t border-slate-200 bg-white p-2.5 shadow-[0_-4px_12px_rgb(15_23_42/0.04)]">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={busy || empty}
            onClick={onDiscount}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <i className="fa-solid fa-percent text-[10px]" />
            Discount
          </button>
          <button
            type="button"
            disabled={busy || empty}
            onClick={onHold}
            className="flex items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-40"
          >
            <i className="fa-solid fa-pause text-[10px]" />
            Hold (F6)
          </button>
        </div>

        <button
          type="button"
          disabled={busy || empty}
          onClick={onComplete}
          className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-circle-check text-base" aria-hidden />
            <span>{busy ? "Processing…" : "COMPLETE SALE"}</span>
          </span>
          <span className="rounded-lg bg-blue-800/55 px-2.5 py-1 text-xs font-black tracking-tight">
            {money(totals.grand)}
          </span>
        </button>

        {onProceedToCheckout ? (
          <button
            type="button"
            disabled={busy || empty}
            onClick={onProceedToCheckout}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            <i className="fa-solid fa-expand text-[10px]" />
            Open full payment screen
          </button>
        ) : null}
      </div>
    </section>
  );
}
