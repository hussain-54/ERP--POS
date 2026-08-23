import { money } from "../format";
import type { PosCustomerView, PosPaymentKind } from "../types";
import { PAYMENT_METHODS } from "../types";

export function CheckoutZone({
  customer,
  totals,
  paymentKind,
  onPaymentKind,
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
  couponCode: string;
  notes: string;
  onNotes: (v: string) => void;
  onSelectCustomer: () => void;
  onWalkIn: () => void;
  onNewCustomer: () => void;
  onDiscount: () => void;
  onHold: () => void;
  onSaveDraft: () => void;
  onPayment: () => void;
  onComplete: () => void;
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

  return (
    <section className="pos-zone pos-zone-checkout" aria-label="Checkout summary">
      <div className="pos-zone-header">
        <h2 className="pos-zone-title">Checkout</h2>
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 pb-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={onSelectCustomer} className="min-w-0 flex-1 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Customer</p>
              <p className="truncate text-sm font-bold text-slate-900">
                {customer.label}{" "}
                <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" aria-hidden />
              </p>
              {customer.mobile ? <p className="text-[10px] text-slate-500">{customer.mobile}</p> : null}
            </button>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={onWalkIn}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600"
              >
                Walk-in
              </button>
              <button
                type="button"
                onClick={onNewCustomer}
                className="rounded-lg bg-[var(--pos-primary)] px-2 py-1 text-[10px] font-bold text-white"
              >
                + New
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
            <div>
              <p className="text-slate-400">Tier</p>
              <p className="font-bold text-slate-800">{customer.priceTier}</p>
            </div>
            <div>
              <p className="text-slate-400">Credit</p>
              <p className="font-bold text-slate-800">{money(customer.creditLimit)}</p>
            </div>
            <div>
              <p className="text-slate-400">Loyalty</p>
              <p className="font-bold text-slate-800">{customer.loyaltyPoints}</p>
            </div>
          </div>
          {customer.id && customer.outstanding > 0 ? (
            <p className="mt-1 text-[10px] font-semibold text-amber-700">
              Udhar outstanding {money(customer.outstanding)}
            </p>
          ) : null}
        </div>

        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <dt>Subtotal</dt>
            <dd className="font-semibold text-slate-800">{money(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-500">
            <dt>Item discounts</dt>
            <dd className="font-semibold text-red-600">−{money(totals.itemDiscount)}</dd>
          </div>
          <div className="flex justify-between text-slate-500">
            <dt>
              Invoice discount
              <button type="button" onClick={onDiscount} className="ml-1 text-[var(--pos-primary)] hover:underline">
                Edit
              </button>
            </dt>
            <dd className="font-semibold text-red-600">−{money(totals.invoiceDiscount)}</dd>
          </div>
          {couponCode ? (
            <div className="flex justify-between text-slate-500">
              <dt>Coupon</dt>
              <dd className="font-semibold text-slate-800">{couponCode}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-slate-500">
            <dt>Tax</dt>
            <dd className="font-semibold text-slate-800">{money(totals.tax)}</dd>
          </div>
          {totals.expectedProfit != null ? (
            <div className="flex justify-between text-slate-500">
              <dt>Expected profit</dt>
              <dd className="font-semibold text-emerald-700">{money(totals.expectedProfit)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
            <dt>Total</dt>
            <dd className="text-lg text-[var(--pos-primary)]">{money(totals.grand)}</dd>
          </div>
        </dl>

        {paymentRecorded ? (
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 p-2.5">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Paid</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-900">{money(paymentRecorded.paid)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5">
              <p className="text-[10px] font-bold uppercase text-amber-700">Remaining</p>
              <p className="mt-0.5 text-sm font-bold text-amber-900">{money(paymentRecorded.remaining)}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-2.5">
              <p className="text-[10px] font-bold uppercase text-slate-600">Change</p>
              <p className="mt-0.5 text-sm font-bold text-slate-900">{money(paymentRecorded.change)}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5">
              <p className="text-[10px] font-bold uppercase text-blue-700">Tenders</p>
              <p className="mt-0.5 text-sm font-bold text-blue-900">{paymentRecorded.lineCount}</p>
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Payment method</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPaymentKind(m.id)}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 text-[9px] font-bold ${
                  paymentKind === m.id
                    ? "border-2 border-[var(--pos-primary)] bg-blue-50 text-slate-800"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                <i className={`fa-solid ${m.icon} text-sm ${m.color}`} aria-hidden />
                {m.label}
              </button>
            ))}
          </div>
          {recordOnlyHint ? (
            <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
              Wallet/card tenders are recorded in POS — no live PSP charge in this build.
            </p>
          ) : null}
        </div>

        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-slate-400">Sale notes</span>
          <textarea
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-[var(--pos-primary)] focus:outline-none"
            placeholder="Optional note / salesman reference"
          />
        </label>
      </div>

      <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || empty}
            onClick={onHold}
            className="rounded-xl bg-amber-100 py-2.5 text-xs font-bold text-amber-900 disabled:opacity-40"
          >
            Hold
          </button>
          <button
            type="button"
            disabled={busy || empty}
            onClick={onSaveDraft}
            className="rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-40"
          >
            Save Draft
          </button>
        </div>
        <button
          type="button"
          disabled={busy || empty}
          onClick={onPayment}
          className="w-full rounded-xl border border-[var(--pos-primary)] bg-white py-2.5 text-xs font-bold text-[var(--pos-primary)] disabled:opacity-40"
        >
          Payment
        </button>
        <button
          type="button"
          disabled={busy || empty}
          onClick={onComplete}
          className="flex w-full items-center justify-between rounded-xl bg-[var(--pos-primary)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-40"
        >
          <span>Complete Sale</span>
          <span>{money(totals.grand)}</span>
        </button>
      </div>
    </section>
  );
}
