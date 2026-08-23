import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { money } from "../format";
import type { ProductTab } from "../types";

function stockTone(stock: number | null | undefined) {
  if (stock == null) return "bg-slate-100 text-slate-600";
  if (stock <= 0) return "bg-red-50 text-red-700";
  if (stock <= 5) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export function ProductDiscovery({
  search,
  onSearch,
  tab,
  onTab,
  categoryFilter,
  onCategory,
  categories,
  products,
  favoriteIds,
  onAdd,
  onToggleFavorite,
  onLoadMore,
  loading,
  hasMore,
  searchRef,
}: {
  search: string;
  onSearch: (v: string) => void;
  tab: ProductTab;
  onTab: (t: ProductTab) => void;
  categoryFilter: string | null;
  onCategory: (c: string | null) => void;
  categories: string[];
  products: ProductSearchResult[];
  favoriteIds: string[];
  onAdd: (p: ProductSearchResult) => void;
  onToggleFavorite: (id: string) => void;
  onLoadMore: () => void;
  loading?: boolean;
  hasMore?: boolean;
  searchRef?: RefObject<HTMLInputElement>;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = searchRef ?? localRef;

  useEffect(() => {
    function onFocusSearch() {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("pos:focus-search", onFocusSearch);
    return () => window.removeEventListener("pos:focus-search", onFocusSearch);
  }, [inputRef]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && products[0]) {
      e.preventDefault();
      onAdd(products[0]);
      onSearch("");
    }
  }

  const tabs: Array<{ id: ProductTab; label: string }> = [
    { id: "all", label: "All" },
    { id: "recent", label: "Recent" },
    { id: "favorites", label: "Favorites" },
    { id: "categories", label: "Categories" },
  ];

  return (
    <section className="pos-zone pos-zone-products" aria-label="Product discovery">
      <div className="pos-zone-header">
        <h2 className="pos-zone-title">Products</h2>
        <span className="text-[11px] text-slate-400">{products.length} shown</span>
      </div>

      <div className="shrink-0 space-y-2 px-3 pb-2">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Name, SKU, barcode… (Enter adds first)"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-[var(--pos-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pos-primary)]/20"
            aria-label="Search product"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                tab === t.id
                  ? "bg-[var(--pos-primary)] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "categories" || categoryFilter ? (
          <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => onCategory(null)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                !categoryFilter ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-500"
              }`}
            >
              All categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCategory(c === categoryFilter ? null : c)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  categoryFilter === c ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-500"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pos-zone-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3">
        {loading && products.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Searching…</p>
        ) : products.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">No products found. Try another search.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {products.map((p) => {
              const fav = favoriteIds.includes(p.productId);
              const stock = p.stockAvailable != null ? Number(p.stockAvailable) : null;
              const zero = stock != null && stock <= 0;
              return (
                <div
                  key={p.productId}
                  className={`group rounded-xl border bg-white p-2.5 shadow-sm transition ${
                    zero ? "border-red-100 opacity-80" : "border-slate-200 hover:border-[var(--pos-primary)]"
                  }`}
                >
                  <div className="flex gap-2.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <i className="fa-solid fa-box text-lg text-slate-300" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="line-clamp-2 text-xs font-bold leading-snug text-slate-800">{p.name}</h3>
                        <button
                          type="button"
                          className="shrink-0 p-0.5"
                          aria-label={fav ? "Remove favorite" : "Add favorite"}
                          onClick={() => onToggleFavorite(p.productId)}
                        >
                          <i className={`fa-${fav ? "solid" : "regular"} fa-star text-xs ${fav ? "text-amber-400" : "text-slate-300"}`} />
                        </button>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">SKU {p.sku}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">{money(Number(p.retailPrice ?? 0))}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {p.unitName ?? "Pcs"}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${stockTone(stock)}`}>
                          Stock {stock == null ? "—" : stock}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={zero}
                    onClick={() => onAdd(p)}
                    className="mt-2 w-full rounded-lg bg-[var(--pos-primary)] py-1.5 text-[11px] font-bold text-white transition hover:bg-[var(--pos-primary-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {zero ? "Out of stock" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {hasMore ? (
          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="text-xs font-semibold text-[var(--pos-primary)] hover:underline"
            >
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
