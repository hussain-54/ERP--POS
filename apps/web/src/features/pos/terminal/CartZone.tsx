import { money } from "../format";
import type { CartLine } from "../types";
import { lineTotal } from "../types";

export function CartZone({
  lines,
  onQty,
  onRemove,
  onClear,
  onEditDiscount,
  onEditPrice,
  canOverridePrice,
  selectedLineId,
  onSelectLine,
  onProceedToCheckout,
}: {
  lines: CartLine[];
  onQty: (id: string, qty: number, absolute?: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onEditDiscount: (line: CartLine) => void;
  onEditPrice: (line: CartLine) => void;
  canOverridePrice: boolean;
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onProceedToCheckout?: () => void;
}) {
  const totalUnits = lines.reduce((acc, l) => acc + l.qty, 0);

  return (
    <section className="pos-zone pos-zone-cart flex h-full flex-col" aria-label="Current sale cart">
      {/* Zone Header */}
      <div className="pos-zone-header shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="pos-zone-title flex items-center gap-1.5">
            <i className="fa-solid fa-cart-shopping text-xs text-blue-600" aria-hidden />
            Cart Ledger
          </h2>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            {lines.length} {lines.length === 1 ? "item" : "items"} ({totalUnits} pcs)
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={lines.length === 0}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50/80 px-2 py-0.5 text-[11px] font-bold text-red-600 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-30"
          title="Clear all items from cart (F7)"
        >
          <i className="fa-regular fa-trash-can text-[10px]" aria-hidden />
          Clear (F7)
        </button>
      </div>

      {/* Ledger Table Column Headers */}
      <div className="grid shrink-0 grid-cols-[minmax(0,1.4fr)_82px_80px_54px_74px_24px] items-center gap-1 border-b border-slate-200 bg-slate-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span>Item Details</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Disc</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      {/* Scrollable Cart Rows */}
      <div className="pos-zone-scroll flex-1 px-1.5 py-1">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[10rem] flex-col items-center justify-center p-4 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <i className="fa-solid fa-cart-shopping text-lg" aria-hidden />
            </div>
            <p className="text-xs font-bold text-slate-700">Cart is empty</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Scan a barcode or tap any product from the catalog to add.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {lines.map((line, idx) => {
              const selected = selectedLineId === line.id;
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
                  className={`grid grid-cols-[minmax(0,1.4fr)_82px_80px_54px_74px_24px] items-center gap-1 rounded-lg border px-2 py-1.5 transition ${
                    selected
                      ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/25"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  {/* Item Image + Details */}
                  <div className="flex min-w-0 items-center gap-2 pr-1">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 text-slate-400">
                      {line.imageUrl ? (
                        <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">{idx + 1}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-slate-900" title={line.name}>
                        {line.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1 text-[10px] text-slate-500">
                        <span className="font-medium text-slate-400">SKU: {line.sku}</span>
                        <span>·</span>
                        <span className="font-semibold text-slate-600">{line.unitLabel}</span>
                        {isOverStock ? (
                          <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-800">
                            Over stock ({line.stockAvailable})
                          </span>
                        ) : null}
                        {isZeroStock ? (
                          <span className="rounded bg-red-100 px-1 text-[9px] font-bold text-red-700">
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
                        aria-label="Decrease quantity (-)"
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
                        min={1}
                        value={line.qty}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => onQty(line.id, Number(e.target.value) || 0, true)}
                        className="pos-stepper-input"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        aria-label="Increase quantity (+)"
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
                    {isPriceOverridden || line.listPrice > line.rate ? (
                      <div className="leading-tight">
                        <span className="pos-price-original">{money(line.listPrice)}</span>
                        <span className="pos-price-selling">{money(line.rate)}</span>
                      </div>
                    ) : (
                      <span className="pos-price-selling">{money(line.rate)}</span>
                    )}
                    {canOverridePrice ? (
                      <button
                        type="button"
                        title="Override price (F4)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPrice(line);
                        }}
                        className="block w-full text-right text-[9px] font-semibold text-blue-600 hover:underline"
                      >
                        {isPriceOverridden ? "edit ovr" : "override"}
                      </button>
                    ) : null}
                  </div>

                  {/* Discount Column */}
                  <div className="text-right">
                    <button
                      type="button"
                      title="Edit item discount (F5)"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDiscount(line);
                      }}
                      className={`inline-block rounded px-1 py-0.5 text-right text-[11px] font-bold transition ${
                        hasDiscount
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      }`}
                    >
                      {hasDiscount ? `−${money(line.discount)}` : "0"}
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right text-xs font-black text-slate-900">
                    {money(lineTotal(line))}
                  </div>

                  {/* Remove Item Button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      title="Remove from cart (Delete)"
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

      {/* Optional Cart Bottom Action Bar */}
      {lines.length > 0 && onProceedToCheckout ? (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-2">
          <button
            type="button"
            onClick={onProceedToCheckout}
            className="flex w-full items-center justify-between rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-xs transition hover:bg-blue-700 active:scale-99"
          >
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-credit-card" />
              PROCEED TO CHECKOUT
            </span>
            <span>
              {lines.length} Items ({totalUnits} Pcs) →
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
