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
  return (
    <section className="pos-zone pos-zone-cart" aria-label="Current sale cart">
      <div className="pos-zone-header">
        <h2 className="pos-zone-title">
          Cart <span className="font-semibold text-slate-400">({lines.length})</span>
        </h2>
        <button
          type="button"
          onClick={onClear}
          disabled={lines.length === 0}
          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      <div className="hidden shrink-0 grid-cols-[minmax(0,1.4fr)_70px_72px_64px_72px_28px] gap-1 border-b border-slate-100 px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 md:grid">
        <span>Product</span>
        <span className="text-center">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Disc</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-4 text-center">
            <i className="fa-solid fa-cart-shopping mb-2 text-2xl text-slate-300" aria-hidden />
            <p className="text-sm font-semibold text-slate-500">Cart is empty</p>
            <p className="mt-1 text-xs text-slate-400">Search or tap a product to add it here.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line) => {
              const selected = selectedLineId === line.id;
              const low =
                line.stockAvailable != null && line.stockAvailable > 0 && line.qty > line.stockAvailable;
              return (
                <li key={line.id}>
                  <div
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
                    className={`rounded-xl border p-2.5 transition ${
                      selected
                        ? "border-[var(--pos-primary)] bg-blue-50/50 ring-1 ring-[var(--pos-primary)]/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{line.name}</p>
                        <p className="text-[10px] text-slate-400">
                          SKU {line.sku} · {line.unitLabel}
                          {low ? <span className="ml-1 font-semibold text-amber-600">Over stock</span> : null}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(line.id);
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <i className="fa-regular fa-trash-can text-xs" aria-hidden />
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          className="px-2 py-1 font-bold text-slate-500"
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
                          className="w-10 border-0 bg-transparent text-center text-sm font-bold text-slate-800 focus:outline-none"
                          aria-label="Quantity"
                        />
                        <button
                          type="button"
                          className="px-2 py-1 font-bold text-slate-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            onQty(line.id, 1);
                          }}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={!canOverridePrice}
                        title={canOverridePrice ? "Override price" : "Price override not permitted"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPrice(line);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {money(line.rate)}
                        {line.rate !== line.listPrice ? (
                          <span className="ml-1 text-[9px] text-amber-600">ovr</span>
                        ) : null}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDiscount(line);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold text-red-600"
                      >
                        −{money(line.discount)}
                      </button>

                      <div className="rounded-lg bg-slate-900 px-2 py-1 text-right text-xs font-bold text-white">
                        {money(lineTotal(line))}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
