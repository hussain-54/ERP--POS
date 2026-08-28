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
}) {
  const totalItems = lines.reduce((acc, l) => acc + l.qty, 0);

  return (
    <section className="pos-zone pos-zone-cart" aria-label="Current sale cart">
      {/* Zone Header */}
      <div className="pos-zone-header">
        <div className="flex items-center gap-2">
          <h2 className="pos-zone-title flex items-center gap-1.5">
            <i className="fa-solid fa-cart-shopping text-xs text-blue-600" aria-hidden />
            Cart
          </h2>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            {lines.length} {lines.length === 1 ? "item" : "items"} ({totalItems} pcs)
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={lines.length === 0}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50/80 px-2 py-0.5 text-[11px] font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-30 disabled:pointer-events-none"
        >
          <i className="fa-regular fa-trash-can text-[10px]" aria-hidden />
          Clear
        </button>
      </div>

      {/* Ledger Table Header */}
      <div className="grid shrink-0 grid-cols-[minmax(0,1.35fr)_78px_82px_56px_72px_24px] items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center p-4 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <i className="fa-solid fa-cart-shopping text-base" aria-hidden />
            </div>
            <p className="text-xs font-bold text-slate-600">Cart is empty</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Scan barcode or tap a product to add</p>
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
                  }}
                  className={`grid grid-cols-[minmax(0,1.35fr)_78px_82px_56px_72px_24px] items-center gap-1.5 rounded-lg border px-2 py-1.5 transition ${
                    selected
                      ? "border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-500/20"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                  }`}
                >
                  {/* Product Info & Dual Pricing */}
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <p className="truncate text-xs font-bold text-slate-900" title={line.name}>
                        {line.name}
                      </p>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500">
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

                  {/* Qty Stepper */}
                  <div className="flex items-center justify-center">
                    <div className="pos-stepper">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
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
                        onChange={(e) => onQty(line.id, Number(e.target.value) || 0, true)}
                        className="pos-stepper-input"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        aria-label="Increase quantity"
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

                  {/* Price Column (Shows both Original and Sale Rate when different) */}
                  <div className="text-right">
                    {isPriceOverridden || line.listPrice > line.rate ? (
                      <div>
                        <span className="pos-price-original">
                          {money(line.listPrice)}
                        </span>
                        <span className="pos-price-selling">
                          {money(line.rate)}
                        </span>
                      </div>
                    ) : (
                      <span className="pos-price-selling">
                        {money(line.rate)}
                      </span>
                    )}
                    {canOverridePrice ? (
                      <button
                        type="button"
                        title="Override item price"
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
                      title="Edit item discount"
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

                  {/* Delete Row */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
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
    </section>
  );
}
