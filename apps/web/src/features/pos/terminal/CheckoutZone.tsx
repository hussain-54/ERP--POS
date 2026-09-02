import { money } from "../format";
import type { PosCustomerView, PosPaymentKind } from "../types";
import { PAYMENT_METHODS } from "../types";

/** Grid tenders matching the reference (Credit + Delivery are separate wide actions). */
const GRID_TENDERS = PAYMENT_METHODS.filter((m) =>
  ["cash", "card", "bank", "qr", "jazzcash", "easypaisa", "sadapay", "wallet"].includes(m.id),
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
  onDiscount,
  onHold,
  onPayment,
  onComplete,
  onDeliveryOrder,
  onClearCart,
  deliveryCharges = 0,
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
    deliveryCharges?: number;
  };
  paymentKind: PosPaymentKind;
  onPaymentKind: (k: PosPaymentKind) => void;
  cashReceived?: number;
  onCashReceived?: (amt: number) => void;
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
  const deliveryActive = deliveryCharges > 0 || Boolean(totals.deliveryCharges && totals.deliveryCharges > 0);
  const selectedGrid = GRID_TENDERS.find((m) => m.id === paymentKind);
  const showRecordHint = Boolean(recordOnlyHint || selectedGrid?.recordOnly);

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
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <h2 className="text-sm font-black text-slate-900">Order Summary &amp; Payment</h2>
        <span className="truncate text-[10px] font-semibold text-slate-500" title={customer.label}>
          {customer.label}
        </span>
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 space-y-2 p-2.5">
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2.5 text-[11px]">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-bold text-slate-900">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Item Discount</span>
            <span className={totals.itemDiscount > 0 ? "font-semibold text-red-600" : "text-slate-400"}>
              {totals.itemDiscount > 0 ? `−${money(totals.itemDiscount)}` : "0.00"}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span className="flex items-center gap-1">
              Invoice Discount
              <button type="button" onClick={onDiscount} className="font-bold text-blue-600 hover:underline">
                + Add
              </button>
            </span>
            <span className={totals.invoiceDiscount > 0 ? "font-bold text-red-600" : "text-slate-400"}>
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
            <span>Taxable Amount</span>
            <span className="font-medium text-slate-800">{money(totals.taxable)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST / Tax (17%)</span>
            <span className="font-medium text-slate-800">{money(totals.tax)}</span>
          </div>
          {(deliveryCharges > 0 || (totals.deliveryCharges ?? 0) > 0) ? (
            <div className="flex justify-between font-semibold text-orange-700">
              <span>Delivery Charges</span>
              <span>+{money(deliveryCharges || totals.deliveryCharges || 0)}</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-[#1d4ed8] px-3.5 py-3 text-white shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">Total Payable</p>
          <p className="mt-0.5 text-2xl font-black tracking-tight">Rs. {money(totals.grand)}</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Method</span>
            <button type="button" onClick={onPayment} className="text-[10px] font-bold text-blue-600 hover:underline">
              Split / More
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {GRID_TENDERS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPaymentKind(m.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-[9px] font-bold transition ${
                  paymentKind === m.id
                    ? "border-2 border-blue-600 bg-blue-50 text-blue-900"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <i className={`fa-solid ${m.icon} text-sm ${m.color}`} aria-hidden />
                <span className="leading-tight text-center">{m.label.replace(" Payment", "")}</span>
              </button>
            ))}
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onPaymentKind("credit")}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-[11px] font-bold transition ${
                paymentKind === "credit"
                  ? "border-violet-600 bg-violet-50 text-violet-900"
                  : "border-violet-300 bg-white text-violet-700 hover:bg-violet-50"
              }`}
            >
              <i className="fa-solid fa-hand-holding-dollar" aria-hidden />
              Credit / Udhar
            </button>
            <button
              type="button"
              onClick={() => onDeliveryOrder?.()}
              disabled={!onDeliveryOrder}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-[11px] font-bold transition disabled:opacity-40 ${
                deliveryActive
                  ? "border-orange-500 bg-orange-50 text-orange-900"
                  : "border-orange-300 bg-white text-orange-700 hover:bg-orange-50"
              }`}
            >
              <i className="fa-solid fa-truck" aria-hidden />
              Delivery Order
            </button>
          </div>
          {showRecordHint ? (
            <p className="mt-1 text-[9px] text-slate-400">
              * Card / wallet / QR recorded in POS (no live PSP terminal)
            </p>
          ) : null}
        </div>

        {paymentKind === "cash" ? (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-white p-2.5">
            <p className="text-[11px] font-bold text-emerald-700">Payment Details (Cash)</p>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pos-cash-received" className="text-[11px] font-bold text-slate-700">
                Cash Received
              </label>
              <div className="relative w-40">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  Rs.
                </span>
                <input
                  id="pos-cash-received"
                  type="number"
                  min={0}
                  value={cashValue}
                  placeholder={String(totals.grand)}
                  onChange={(e) => onCashReceived?.(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-2 text-right text-sm font-black text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {q.label === "Exact" ? "Exact" : q.label}
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
              >
                Other
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-emerald-100 pt-2">
              <span className="text-[11px] font-bold text-emerald-700">Change to Return</span>
              <span className="text-base font-black text-emerald-600">Rs. {money(changeToReturn)}</span>
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
          disabled={busy || empty}
          onClick={onComplete}
          className="pos-complete-sale-btn"
        >
          <i className="fa-solid fa-cart-shopping" aria-hidden />
          <span>{busy ? "Processing…" : `COMPLETE SALE  Rs. ${money(totals.grand)}`}</span>
        </button>

        <div className="pos-shortcut-chips" role="group" aria-label="Keyboard shortcuts">
          <button
            type="button"
            disabled={busy || empty}
            onClick={onComplete}
            title="Complete sale (F2)"
            className="pos-shortcut-chip"
          >
            <kbd>F2</kbd> Pay
          </button>
          <button
            type="button"
            disabled={busy || empty}
            onClick={onHold}
            title="Hold sale (F4)"
            className="pos-shortcut-chip"
          >
            <kbd>F4</kbd> Hold
          </button>
          <button
            type="button"
            disabled={!onDeliveryOrder}
            onClick={() => onDeliveryOrder?.()}
            title="Delivery order (F6)"
            className="pos-shortcut-chip"
          >
            <kbd>F6</kbd> Delivery
          </button>
          <button
            type="button"
            onClick={onSelectCustomer}
            title="Select customer (F8)"
            className="pos-shortcut-chip"
          >
            <kbd>F8</kbd> Customer
          </button>
          <button
            type="button"
            disabled={busy || empty || !onClearCart}
            onClick={() => onClearCart?.()}
            title="Clear cart (Esc)"
            className="pos-shortcut-chip"
          >
            <kbd>Esc</kbd> Clear
          </button>
        </div>
      </div>
    </section>
  );
}
