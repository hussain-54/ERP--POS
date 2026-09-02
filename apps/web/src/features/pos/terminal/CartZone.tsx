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
  onQuickCashPay?: () => void;
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
  onHold,
  canOverridePrice,
  selectedLineId,
  onSelectLine,
  onProceedToCheckout,
  busy = false,
}: CartZoneProps) {
  const totalUnits = useMemo(() => lines.reduce((acc, l) => acc + l.qty, 0), [lines]);

  // Fallback calculations if parent does not supply pre-computed totals
  const totals = useMemo(() => {
    if (providedTotals) return providedTotals;
    const subtotal = lines.reduce((acc, l) => acc + lineTotal(l), 0);
    const itemDiscount = lines.reduce((acc, l) => acc + l.discount, 0);
    const tax = lines.reduce((acc, l) => acc + l.tax * l.qty, 0);
    const totalDiscount = itemDiscount;
    const grand = Math.max(0, subtotal + tax);
    return {
      itemCount: lines.length,
      totalQty: totalUnits,
      taxable: subtotal,
      itemDiscount,
      invoiceDiscount: 0,
      tax,
      subtotal,
      totalDiscount,
      deliveryCharges: 0,
      grand,
    };
  }, [providedTotals, lines, totalUnits]);

  const isEmpty = lines.length === 0;

  return (
    <section className="pos-zone pos-zone-cart flex h-full min-h-0 flex-1 flex-col bg-white" aria-label="Current sale cart">
      {/* 1. PROFESSIONAL CART HEADER */}
      <div className="pos-zone-header shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <i className="fa-solid fa-cart-shopping text-xs" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="pos-zone-title truncate text-xs font-black text-slate-900">
                  Current Sale
                </h2>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-black text-blue-700">
                  {lines.length} {lines.length === 1 ? "item" : "items"} · {totalUnits} pcs
                </span>
              </div>
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
                <span className="hidden sm:inline">Hold</span>
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
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* CUSTOMER CONTEXT STRIP (Compact & Clickable) */}
      {customer ? (
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-slate-50/60 px-3 py-1.5 text-xs">
          <div className="flex min-w-0 items-center gap-1.5">
            <i className="fa-solid fa-user text-[11px] text-slate-400" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer:</span>
            <span className="truncate font-black text-slate-900">{customer.label}</span>
            <span className="rounded bg-slate-200/70 px-1.5 py-0.2 text-[9px] font-bold uppercase text-slate-600">
              {customer.priceTier}
            </span>
            {customer.id && customer.outstanding > 0 ? (
              <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-900" title="Udhaar balance">
                Due: {money(customer.outstanding)}
              </span>
            ) : null}
          </div>

          {onSelectCustomer ? (
            <button
              type="button"
              onClick={onSelectCustomer}
              className="shrink-0 text-[10px] font-bold text-blue-600 hover:underline"
              title="Change or select customer (F9)"
            >
              {customer.id ? "Change" : "+ Attach"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* TABLE COLUMN HEADERS */}
      <div className="grid shrink-0 grid-cols-[minmax(0,1.5fr)_84px_86px_56px_74px_24px] items-center gap-1 border-b border-slate-200 bg-slate-100/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span>Product</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Disc</span>
        <span className="text-right">Subtotal</span>
        <span aria-hidden className="w-6" />
      </div>

      {/* 2. SCROLLABLE CART ITEMS LEDGER */}
      <div className="pos-zone-scroll flex-1 p-1.5">
        {isEmpty ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center p-6 text-center">
            <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 shadow-inner">
              <i className="fa-solid fa-cart-arrow-down text-2xl" aria-hidden />
            </div>
            <p className="text-sm font-black text-slate-800">Your cart is empty</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Scan barcode or click items from the catalog on the left to add them to this sale.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
              <i className="fa-solid fa-barcode text-slate-400" />
              <span>Barcode scanner ready</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {lines.map((line, idx) => {
              const isSelected = selectedLineId === line.id;
              const hasDiscount = line.discount > 0 || line.discountPercent > 0;
              const isPriceOverridden = line.rate !== line.listPrice;
              const unitSaving = Math.max(0, line.listPrice - line.rate);
              const totalItemDiscount = line.discount + (unitSaving * line.qty);
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
                  className={`grid grid-cols-[minmax(0,1.5fr)_84px_86px_56px_74px_24px] items-center gap-1 rounded-lg border px-2 py-1.5 transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/30"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                  }`}
                >
                  {/* Item Image + Details */}
                  <div className="flex min-w-0 items-center gap-2 pr-1">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-400">
                      {line.imageUrl ? (
                        <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-slate-900" title={line.name}>
                        {line.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500">
                        <span className="font-mono text-slate-400">SKU: {line.sku}</span>
                        <span>·</span>
                        <span className="font-semibold text-slate-600">{line.unitLabel}</span>
                        {isOverStock ? (
                          <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                            Max {line.stockAvailable}
                          </span>
                        ) : null}
                        {isZeroStock ? (
                          <span className="rounded bg-red-100 px-1 py-0.2 text-[9px] font-bold text-red-700">
                            No stock
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
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

                  {/* Price Column (Original vs Selling Price) */}
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
                        <span className="inline-block rounded bg-blue-50 px-1 text-[8px] font-bold text-blue-700">
                          Ovr Price
                        </span>
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
                        className="block w-full text-right text-[9px] font-semibold text-blue-600 hover:underline"
                      >
                        {isPriceOverridden ? "Edit ovr" : "+ Override"}
                      </button>
                    ) : null}
                  </div>

                  {/* Discount Column */}
                  <div className="text-right">
                    <button
                      type="button"
                      title="Apply or edit item discount (F5)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDiscount(line);
                      }}
                      className={`inline-block rounded px-1.5 py-0.5 text-right text-[11px] font-bold transition ${
                        hasDiscount
                          ? "bg-red-50 text-red-600 hover:bg-red-100 ring-1 ring-red-200"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                    >
                      {hasDiscount ? (
                        <span>−{money(line.discount)}</span>
                      ) : (
                        <span className="text-[10px] text-blue-600 hover:underline">+ Disc</span>
                      )}
                    </button>
                    {hasDiscount && line.discountPercent > 0 ? (
                      <div className="text-[9px] text-red-500 font-medium">({line.discountPercent.toFixed(0)}%)</div>
                    ) : null}
                  </div>

                  {/* Line Total */}
                  <div className="text-right">
                    <div className="text-xs font-black text-slate-900">
                      {money(lineTotal(line))}
                    </div>
                    {totalItemDiscount > 0 ? (
                      <div className="text-[9px] font-medium text-emerald-700" title="Total saved on this item">
                        −{money(totalItemDiscount)}
                      </div>
                    ) : null}
                  </div>

                  {/* Remove Item Button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label={`Remove ${line.name} from cart`}
                      title="Remove item (Delete)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(line.id);
                      }}
                      className="rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
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

      {/* Compact checkout bar — full totals live in Checkout zone */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/95 p-2 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-600">
            {totalUnits} pcs · {lines.length} {lines.length === 1 ? "item" : "items"}
          </span>
          <span className="text-sm font-black text-slate-900">Rs. {money(totals.grand)}</span>
        </div>

        <button
          type="button"
          disabled={isEmpty || busy}
          onClick={onProceedToCheckout}
          className="flex w-full items-center justify-between rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-blue-700 active:scale-98 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-credit-card text-base" aria-hidden />
            <span>CHECKOUT</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-lg bg-blue-800/60 px-2 py-0.5 text-xs font-black">
            <span>Rs. {money(totals.grand)}</span>
            <i className="fa-solid fa-arrow-right text-[10px]" />
          </span>
        </button>
      </div>
    </section>
  );
}
