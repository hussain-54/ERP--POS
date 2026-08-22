import { money } from "../format";
import type { CartLine, PosCustomerView, PosPaymentKind } from "../types";
import { PAYMENT_METHODS } from "../types";

export function CartPanel({
  customer,
  lines,
  paymentKind,
  onPaymentKind,
  invoiceDiscount,
  deliveryCharges,
  roundOff,
  totals,
  onQty,
  onRemove,
  onClear,
  onApplyDiscount,
  onPay,
  onHold,
  onQuotation,
  busy,
}: {
  customer: PosCustomerView;
  lines: CartLine[];
  paymentKind: PosPaymentKind;
  onPaymentKind: (k: PosPaymentKind) => void;
  invoiceDiscount: number;
  deliveryCharges: number;
  roundOff: number;
  totals: {
    itemCount: number;
    totalQty: number;
    taxable: number;
    itemDiscount: number;
    tax: number;
    subtotal: number;
    totalDiscount: number;
    grand: number;
  };
  onQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onApplyDiscount: () => void;
  onPay: () => void;
  onHold: () => void;
  onQuotation: () => void;
  busy?: boolean;
}) {
  return (
    <div className="pos-cart-panel">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <i className="fa-solid fa-user text-xs" aria-hidden />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-400">Customer</div>
              <div className="flex cursor-pointer items-center space-x-1 text-xs font-bold text-gray-800">
                <span>{customer.label}</span>
                <i className="fa-solid fa-chevron-down text-[9px] text-gray-400" aria-hidden />
              </div>
            </div>
          </div>
          <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95">
            <i className="fa-solid fa-plus mr-1" aria-hidden /> New Customer
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-[10px]">
          {[
            ["Price Tier", customer.priceTier],
            ["Credit Limit", money(customer.creditLimit)],
            ["Outstanding", money(customer.outstanding)],
            ["Loyalty Pts", String(customer.loyaltyPoints)],
          ].map(([k, v]) => (
            <div key={k}>
              <span className="mb-0 block text-[9px] font-medium text-gray-400">{k}</span>
              <span className="font-bold text-gray-800">{v}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold tracking-wide text-gray-900">CART ({lines.length} Items)</span>
          <div className="space-x-1.5">
            <button
              type="button"
              onClick={onApplyDiscount}
              className="rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-100"
            >
              <i className="fa-solid fa-percent mr-1" aria-hidden /> Apply Discount
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-red-200 bg-red-50/60 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
            >
              <i className="fa-regular fa-trash-can mr-1" aria-hidden /> Clear Cart
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[20px_1.6fr_1fr_0.7fr_0.7fr_0.6fr_0.7fr_16px] gap-1 items-center px-1 text-[10px] font-bold uppercase text-gray-400">
          <span>#</span>
          <span>Product</span>
          <span className="text-center">Qty</span>
          <span className="text-center">Unit</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Disc.</span>
          <span className="text-right">Tax</span>
          <span />
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {lines.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">Cart is empty — add products from the grid.</p>
          ) : (
            lines.map((line, index) => (
              <div
                key={line.id}
                className="grid grid-cols-[20px_1.6fr_1fr_0.7fr_0.7fr_0.6fr_0.7fr_16px] gap-1 items-center rounded-xl border border-gray-200 bg-gray-50 p-2 text-[11px]"
              >
                <span className="font-bold text-gray-400">{index + 1}</span>
                <div className="flex min-w-0 items-center space-x-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <i className="fa-solid fa-box text-xs text-amber-400" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold text-gray-800">{line.name}</div>
                    <div className="text-[9px] text-gray-400">SKU: {line.sku}</div>
                  </div>
                </div>
                <div className="flex items-center justify-center space-x-1 rounded-lg border border-gray-300 bg-white px-1 py-0.5">
                  <button type="button" className="px-0.5 font-bold text-gray-500 hover:text-black" onClick={() => onQty(line.id, -1)}>
                    -
                  </button>
                  <span className="px-1 font-bold text-gray-800">{line.qty}</span>
                  <button type="button" className="px-0.5 font-bold text-gray-500 hover:text-black" onClick={() => onQty(line.id, 1)}>
                    +
                  </button>
                </div>
                <span className="text-center font-medium text-gray-500">{line.unitLabel}</span>
                <span className="text-right font-medium text-gray-700">{money(line.rate)}</span>
                <span className="text-right text-gray-400">{money(line.discount)}</span>
                <span className="text-right font-medium text-gray-600">{money(line.tax)}</span>
                <button type="button" onClick={() => onRemove(line.id)} aria-label="Remove line">
                  <i className="fa-regular fa-trash-can text-center text-red-400 hover:text-red-600" aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-gray-200 pt-2.5 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Total Items</span>
            <span className="font-bold text-gray-800">{totals.itemCount}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Taxable Amount</span>
            <span className="font-bold text-gray-800">{money(totals.taxable)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Total Quantity</span>
            <span className="font-bold text-gray-800">{totals.totalQty}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Sales Tax (17%)</span>
            <span className="font-bold text-gray-800">+ {money(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="font-bold text-gray-800">{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Delivery Charges</span>
            <span className="font-bold text-gray-800">+ {money(deliveryCharges)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Item Discount</span>
            <span className="font-bold text-gray-800">- {money(totals.itemDiscount)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Round Off</span>
            <span className="font-bold text-gray-800">{money(roundOff)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Invoice Discount</span>
            <span className="font-bold text-red-600">- {money(invoiceDiscount)}</span>
          </div>
          <div />
          <div className="col-span-2 flex justify-between border-t border-gray-200 pt-1.5 font-bold text-gray-800">
            <span>Total Discount</span>
            <span className="text-red-600">- {money(totals.totalDiscount)}</span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm font-bold text-blue-900">
          <span className="tracking-wide">GRAND TOTAL</span>
          <span className="text-xl font-black">{money(totals.grand)}</span>
        </div>

        <div className="space-y-2 pt-1">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">Payment Method</span>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-gray-700 sm:grid-cols-5">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPaymentKind(m.id)}
                className={`flex flex-col items-center space-y-1.5 rounded-xl p-2.5 transition ${
                  paymentKind === m.id
                    ? "border-2 border-blue-600 bg-gray-50 shadow-sm"
                    : "border border-gray-200 bg-gray-50 hover:border-gray-400"
                }`}
              >
                <i className={`fa-solid ${m.icon} text-base ${m.color}`} aria-hidden />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-2 border-t border-gray-200 pt-3">
        <button
          type="button"
          disabled={busy || lines.length === 0}
          onClick={onPay}
          className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50"
        >
          <span className="tracking-widest">PAY NOW</span>
          <i className="fa-solid fa-arrow-right text-xs" aria-hidden />
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || lines.length === 0}
            onClick={onHold}
            className="rounded-xl bg-amber-100 py-2.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-200 active:scale-[0.99] disabled:opacity-50"
          >
            <i className="fa-solid fa-clock-rotate-left mr-1" aria-hidden /> HOLD SALE
          </button>
          <button
            type="button"
            disabled={busy || lines.length === 0}
            onClick={onQuotation}
            className="rounded-xl bg-purple-100 py-2.5 text-[11px] font-bold text-purple-900 transition hover:bg-purple-200 active:scale-[0.99] disabled:opacity-50"
          >
            <i className="fa-solid fa-file-lines mr-1" aria-hidden /> QUOTATION
          </button>
        </div>
      </div>
    </div>
  );
}
