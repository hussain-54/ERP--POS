import { useMemo, useState } from "react";
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
  onNewCustomer?: () => void;
  onInvoiceDiscount?: () => void;
  onHold?: () => void;
  onAddProduct?: () => void;
  onPriceCheck?: () => void;
  onAddNote?: () => void;
  onMore?: () => void;
  canOverridePrice: boolean;
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onProceedToCheckout?: () => void;
  busy?: boolean;
}

export function CartZone({
  lines,
  customer,
  onQty,
  onRemove,
  onClear,
  onEditDiscount,
  onEditPrice,
  onSelectCustomer,
  onNewCustomer,
  onInvoiceDiscount,
  onHold,
  onAddProduct,
  onPriceCheck,
  onAddNote,
  onMore,
  canOverridePrice,
  selectedLineId,
  onSelectLine,
  onProceedToCheckout,
  busy = false,
}: CartZoneProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const totalUnits = useMemo(() => lines.reduce((acc, l) => acc + l.qty, 0), [lines]);

  const isEmpty = lines.length === 0;

  const actions = [
    { id: "add", label: "Add Product", icon: "fa-plus", color: "text-blue-600", onClick: onAddProduct, disabled: false },
    { id: "customer", label: "Customer", icon: "fa-user", color: "text-violet-600", onClick: onSelectCustomer, disabled: false },
    { id: "discount", label: "Discount", icon: "fa-tags", color: "text-emerald-600", onClick: onInvoiceDiscount, disabled: isEmpty || busy },
    { id: "price", label: "Price Check", icon: "fa-magnifying-glass-plus", color: "text-orange-500", onClick: onPriceCheck, disabled: false },
    { id: "hold", label: "Hold", icon: "fa-cart-plus", color: "text-amber-500", onClick: onHold, disabled: isEmpty || busy },
    {
      id: "more",
      label: "More",
      icon: "fa-ellipsis",
      color: "text-slate-500",
      onClick: () => setMoreOpen((v) => !v),
      disabled: false,
    },
  ] as const;

  return (
    <section
      className="pos-zone pos-zone-cart flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white"
      aria-label="Current sale cart"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-black text-slate-900">Current Sale</h2>
          <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
            {lines.length} Items · {totalUnits} Pcs
          </span>
        </div>
          <div className="flex shrink-0 items-center gap-1.5">
          {onHold ? (
            <button
              type="button"
              onClick={onHold}
              disabled={isEmpty || busy}
              title="Hold / Suspend sale (F4)"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-30"
            >
              Hold
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            disabled={isEmpty || busy}
            title="Clear all items from cart (F7)"
            className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-30"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            aria-label="More cart actions"
            title="More"
          >
            <i className="fa-solid fa-ellipsis-vertical text-[11px]" aria-hidden />
          </button>
        </div>
      </div>

      {customer ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/70 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <i className="fa-solid fa-user text-xs" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-xs font-black text-slate-900">{customer.label}</p>
                <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                  {customer.priceTier}
                </span>
              </div>
              {customer.id && customer.outstanding > 0 ? (
                <p className="text-[10px] font-bold text-amber-700">Due {money(customer.outstanding)}</p>
              ) : null}
              {customer.mobile || customer.email ? (
                <p className="truncate text-[10px] text-slate-500">
                  {[customer.mobile, customer.email].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onNewCustomer ? (
              <button
                type="button"
                onClick={onNewCustomer}
                className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50"
              >
                + New
              </button>
            ) : null}
            {onSelectCustomer ? (
              <button
                type="button"
                onClick={onSelectCustomer}
                className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 transition hover:bg-blue-50"
              >
                + Change
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid shrink-0 grid-cols-[minmax(0,1.5fr)_76px_68px_52px_64px_22px] items-center gap-1 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
        <span>Product</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Disc.</span>
        <span className="text-right">Total</span>
        <span aria-hidden />
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 p-1.5">
        {isEmpty ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-center p-5 text-center">
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
                  className={`grid grid-cols-[minmax(0,1.5fr)_76px_68px_52px_64px_22px] items-center gap-1 rounded-xl border px-2 py-2 transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
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
                      <p className="truncate text-[9px] text-slate-500">
                        SKU: {line.sku} · {line.unitLabel}
                        {isOverStock ? ` · Max ${line.stockAvailable}` : ""}
                        {isZeroStock ? " · No stock" : ""}
                      </p>
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

                  <div className="text-right leading-tight">
                    {line.listPrice > line.rate || isPriceOverridden ? (
                      <>
                        <div className="pos-price-original">{money(line.listPrice)}</div>
                        <div className="pos-price-selling text-slate-900">{money(line.rate)}</div>
                        {line.listPrice > line.rate ? (
                          <span className="inline-block rounded bg-emerald-50 px-1 text-[8px] font-bold text-emerald-700">
                            Save {money(line.listPrice - line.rate)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="pos-price-selling text-slate-900">{money(line.rate)}</span>
                    )}
                    {canOverridePrice ? (
                      <button
                        type="button"
                        title="Override item price"
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
                      className={`inline-block rounded px-1 py-0.5 text-[10px] font-bold ${
                        hasDiscount ? "text-red-600" : "text-blue-600 hover:underline"
                      }`}
                    >
                      {hasDiscount ? `−${money(line.discount)}` : "—"}
                    </button>
                  </div>

                  <div className="text-right text-[11px] font-black text-slate-900">
                    {money(lineTotal(line))}
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
                      className="rounded p-0.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <i className="fa-regular fa-trash-can text-[11px]" aria-hidden />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pos-zone-footer pos-cart-footer shrink-0">
        <div className="pos-cart-footer-meta">
          <button
            type="button"
            onClick={onAddNote}
            className="font-bold text-blue-600 hover:underline disabled:opacity-40"
            disabled={!onAddNote}
          >
            + Add Note
          </button>
          <div className="flex items-center gap-3 text-slate-600">
            <span>
              Total Items: <span className="font-black text-slate-900">{lines.length}</span>
            </span>
            <span>
              Total Qty: <span className="font-black text-slate-900">{totalUnits}</span>
            </span>
          </div>
        </div>
        {onProceedToCheckout ? (
          <button
            type="button"
            disabled={isEmpty || busy}
            onClick={onProceedToCheckout}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 lg:hidden"
          >
            <i className="fa-solid fa-cash-register text-[11px]" aria-hidden />
            Go to Payment / COMPLETE SALE
          </button>
        ) : null}

        <div className="relative border-t border-slate-200 bg-white p-2">
          {moreOpen ? (
            <div className="absolute bottom-full left-2 right-2 z-10 mb-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <button
                type="button"
                disabled={isEmpty || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onInvoiceDiscount?.();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <i className="fa-solid fa-percent text-blue-600" aria-hidden />
                Invoice Discount
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onMore?.();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                <i className="fa-solid fa-scissors text-cyan-600" aria-hidden />
                Split / More payment
              </button>
              <button
                type="button"
                disabled={isEmpty || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onClear();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                <i className="fa-regular fa-trash-can" aria-hidden />
                Clear Cart
              </button>
            </div>
          ) : null}
          <div className="pos-cart-actions">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={!action.onClick || action.disabled}
                onClick={() => action.onClick?.()}
                className="pos-cart-action"
              >
                <i className={`fa-solid ${action.icon} text-base ${action.color}`} aria-hidden />
                <span className="leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
