import { useMemo } from "react";
import { money } from "../format";
import type { CartLine, PosCustomerView } from "../types";
import { lineTotal } from "../types";

export interface CartZoneProps {
  lines: CartLine[];
  customer?: PosCustomerView;
  totals?: {
    itemCount: number;
    totalQty: number;
    taxable: number;
    itemDiscount: number;
    invoiceDiscount: number;
    tax: number;
    subtotal: number;
    totalDiscount: number;
    deliveryCharges?: number;
    grand: number;
  };
  onQty: (id: string, qty: number, absolute?: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onEditDiscount: (line: CartLine) => void;
  onEditPrice: (line: CartLine) => void;
  onSelectCustomer?: () => void;
  onInvoiceDiscount?: () => void;
  onHold?: () => void;
  onAddProduct?: () => void;
  onPriceCheck?: () => void;
  canOverridePrice: boolean;
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onProceedToCheckout?: () => void;
  busy?: boolean;
}

export function CartZone({
  lines,
  customer,
  totals: providedTotals,
  onQty,
  onRemove,
  onClear,
  onEditDiscount,
  onEditPrice,
  onSelectCustomer,
  onInvoiceDiscount,
  onHold,
  onAddProduct,
  onPriceCheck,
  canOverridePrice,
  selectedLineId,
  onSelectLine,
  onProceedToCheckout,
  busy = false,
}: CartZoneProps) {
  const totalUnits = useMemo(() => lines.reduce((acc, l) => acc + l.qty, 0), [lines]);

  const totals = useMemo(() => {
    if (providedTotals) return providedTotals;
    const subtotal = lines.reduce((acc, l) => acc + lineTotal(l), 0);
    const itemDiscount = lines.reduce((acc, l) => acc + l.discount, 0);
    const tax = lines.reduce((acc, l) => acc + l.tax * l.qty, 0);
    return {
      itemCount: lines.length,
      totalQty: totalUnits,
      taxable: subtotal,
      itemDiscount,
      invoiceDiscount: 0,
      tax,
      subtotal,
      totalDiscount: itemDiscount,
      deliveryCharges: 0,
      grand: Math.max(0, subtotal + tax),
    };
  }, [providedTotals, lines, totalUnits]);

  const isEmpty = lines.length === 0;

  const actions = [
    { id: "add", label: "Add Product", icon: "fa-plus", onClick: onAddProduct, disabled: false },
    { id: "customer", label: "Customer", icon: "fa-user", onClick: onSelectCustomer, disabled: false },
    { id: "discount", label: "Discount", icon: "fa-percent", onClick: onInvoiceDiscount, disabled: isEmpty || busy },
    { id: "price", label: "Price Check", icon: "fa-tags", onClick: onPriceCheck, disabled: !canOverridePrice },
    { id: "hold", label: "Hold", icon: "fa-pause", onClick: onHold, disabled: isEmpty || busy },
  ] as const;

  return (
    <section
      className="pos-zone pos-zone-cart flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white"
      aria-label="Current sale cart"
    >
      <div className="pos-zone-header shrink-0 border-b border-slate-200 bg-white px-3">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <i className="fa-solid fa-cart-shopping text-xs" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="pos-zone-title truncate text-xs font-black text-slate-900">Current Sale</h2>
              <p className="text-[10px] font-bold text-slate-400">
                {lines.length} {lines.length === 1 ? "item" : "items"} · {totalUnits} pcs
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {onHold ? (
              <button
                type="button"
                onClick={onHold}
                disabled={isEmpty || busy}
                title="Hold / Suspend sale (F6)"
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-30"
              >
                <i className="fa-solid fa-pause text-[10px]" aria-hidden />
                Hold
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClear}
              disabled={isEmpty || busy}
              title="Clear all items from cart (F7)"
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-30"
            >
              <i className="fa-regular fa-trash-can text-[10px]" aria-hidden />
              Clear
            </button>
          </div>
        </div>
      </div>

      {customer ? (
        <button
          type="button"
          onClick={onSelectCustomer}
          className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-left transition hover:bg-blue-50/50"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <i className="fa-solid fa-user text-[11px]" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900">{customer.label}</p>
              <p className="truncate text-[10px] text-slate-500">
                {customer.priceTier}
                {customer.id && customer.outstanding > 0 ? ` · Due ${money(customer.outstanding)}` : ""}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-bold text-blue-600">
            {customer.id ? "Change" : "+ Select"}
          </span>
        </button>
      ) : null}

      <div className="grid shrink-0 grid-cols-5 gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={!action.onClick || action.disabled}
            onClick={() => action.onClick?.()}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1.5 text-[9px] font-bold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <i className={`fa-solid ${action.icon} text-[11px] text-blue-600`} aria-hidden />
            <span className="leading-tight">{action.label}</span>
          </button>
        ))}
      </div>

      <div className="grid shrink-0 grid-cols-[minmax(0,1.4fr)_78px_72px_52px_68px_22px] items-center gap-1 border-b border-slate-200 bg-slate-100/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
        <span>Product</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Disc</span>
        <span className="text-right">Total</span>
        <span aria-hidden className="w-5" />
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 p-1.5">
        {isEmpty ? (
          <div className="flex h-full min-h-[10rem] flex-col items-center justify-center p-5 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
              <i className="fa-solid fa-cart-arrow-down text-xl" aria-hidden />
            </div>
            <p className="text-sm font-black text-slate-800">Your cart is empty</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Scan a barcode or add products from the catalog to start this sale.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {lines.map((line, idx) => {
              const isSelected = selectedLineId === line.id;
              const hasDiscount = line.discount > 0 || line.discountPercent > 0;
              const isPriceOverridden = line.rate !== line.listPrice;
              const unitSaving = Math.max(0, line.listPrice - line.rate);
              const totalItemDiscount = line.discount + unitSaving * line.qty;
              const isOverStock =
                line.stockAvailable != null && line.stockAvailable > 0 && line.qty > line.stockAvailable;
              const isZeroStock = line.stockAvailable != null && line.stockAvailable <= 0;

              return (
                <div
                  key={line.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectLine(line.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelectLine(line.id);
                    if (e.key === "Delete" || e.key === "Backspace") {
                      e.preventDefault();
                      onRemove(line.id);
                    }
                    if (e.key === "+" || e.key === "=") {
                      e.preventDefault();
                      onQty(line.id, 1);
                    }
                    if (e.key === "-" || e.key === "_") {
                      e.preventDefault();
                      onQty(line.id, -1);
                    }
                  }}
                  className={`grid grid-cols-[minmax(0,1.4fr)_78px_72px_52px_68px_22px] items-center gap-1 rounded-lg border px-1.5 py-1.5 transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/25"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-400">
                      {line.imageUrl ? (
                        <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-black text-slate-900" title={line.name}>
                        {line.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1 text-[9px] text-slate-500">
                        <span className="font-mono text-slate-400">SKU: {line.sku}</span>
                        <span>·</span>
                        <span className="font-semibold text-slate-600">{line.unitLabel}</span>
                        {isOverStock ? (
                          <span className="rounded bg-amber-100 px-1 text-[8px] font-bold text-amber-800">
                            Max {line.stockAvailable}
                          </span>
                        ) : null}
                        {isZeroStock ? (
                          <span className="rounded bg-red-100 px-1 text-[8px] font-bold text-red-700">No stock</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="pos-stepper">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${line.name}`}
                        className="pos-stepper-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQty(line.id, -1);
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={line.qty}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onQty(line.id, Number.isFinite(val) ? val : 0, true);
                        }}
                        className="pos-stepper-input"
                        aria-label={`Quantity of ${line.name}`}
                      />
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${line.name}`}
                        className="pos-stepper-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQty(line.id, 1);
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    {line.listPrice > line.rate ? (
                      <div className="leading-tight">
                        <div className="pos-price-original">{money(line.listPrice)}</div>
                        <div className="pos-price-selling text-slate-900">{money(line.rate)}</div>
                        <span className="inline-block rounded bg-emerald-50 px-1 text-[8px] font-bold text-emerald-700">
                          Save {money(line.listPrice - line.rate)}
                        </span>
                      </div>
                    ) : isPriceOverridden ? (
                      <div className="leading-tight">
                        <div className="pos-price-original">{money(line.listPrice)}</div>
                        <div className="pos-price-selling text-blue-700">{money(line.rate)}</div>
                      </div>
                    ) : (
                      <span className="pos-price-selling text-slate-900">{money(line.rate)}</span>
                    )}
                    {canOverridePrice ? (
                      <button
                        type="button"
                        title="Override item price (F4)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPrice(line);
                        }}
                        className="block w-full text-right text-[8px] font-semibold text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      title="Apply or edit item discount (F5)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDiscount(line);
                      }}
                      className={`inline-block rounded px-1 py-0.5 text-right text-[10px] font-bold transition ${
                        hasDiscount
                          ? "bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100"
                          : "text-blue-600 hover:bg-slate-100"
                      }`}
                    >
                      {hasDiscount ? `−${money(line.discount)}` : "+ Disc"}
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] font-black text-slate-900">{money(lineTotal(line))}</div>
                    {totalItemDiscount > 0 ? (
                      <div className="text-[8px] font-medium text-emerald-700">−{money(totalItemDiscount)}</div>
                    ) : null}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label={`Remove ${line.name} from cart`}
                      title="Remove item (Delete)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(line.id);
                      }}
                      className="rounded p-0.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <i className="fa-solid fa-xmark text-xs" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pos-zone-footer shrink-0 border-t border-slate-200 bg-slate-50/95 p-2">
        <div className="space-y-0.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-[11px]">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal ({totalUnits} pcs)</span>
            <span className="font-bold text-slate-900">{money(totals.subtotal)}</span>
          </div>
          {totals.itemDiscount > 0 ? (
            <div className="flex justify-between font-semibold text-red-600">
              <span>Item Discounts</span>
              <span>−{money(totals.itemDiscount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-slate-600">
            <span className="flex items-center gap-1">
              Invoice Discount
              {onInvoiceDiscount ? (
                <button
                  type="button"
                  onClick={onInvoiceDiscount}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  ({totals.invoiceDiscount > 0 ? "Edit" : "+ Add"})
                </button>
              ) : null}
            </span>
            <span className={totals.invoiceDiscount > 0 ? "font-bold text-red-600" : "font-medium text-slate-400"}>
              {totals.invoiceDiscount > 0 ? `−${money(totals.invoiceDiscount)}` : "0.00"}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Sales Tax (GST)</span>
            <span className="font-medium text-slate-800">{money(totals.tax)}</span>
          </div>
        </div>

        <div className="pos-grand-box mt-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total</p>
            <p className="text-lg font-black tracking-tight text-white">{money(totals.grand)}</p>
          </div>
          <span className="rounded-full bg-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-blue-100">
            {lines.length} {lines.length === 1 ? "Item" : "Items"}
          </span>
        </div>

        {onProceedToCheckout ? (
          <button
            type="button"
            disabled={isEmpty || busy}
            onClick={onProceedToCheckout}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 lg:hidden"
          >
            <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden />
            Go to Payment
          </button>
        ) : null}
      </div>
    </section>
  );
}
