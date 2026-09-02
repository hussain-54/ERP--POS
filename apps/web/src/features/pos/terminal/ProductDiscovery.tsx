import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { money } from "../format";
import type { ProductTab } from "../types";

function stockBadge(stock: number | null | undefined) {
  if (stock == null) return <span className="text-[10px] text-slate-400">Stock —</span>;
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.2 text-[9px] font-bold text-red-700">
        Out of stock
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
        Low: {stock}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
      Stock: {stock}
    </span>
  );
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
  onOpenScanner,
  onUnknownBarcode,
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
  onOpenScanner?: () => void;
  onUnknownBarcode?: (code: string) => void;
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
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = search.trim().toLowerCase();
      if (!trimmed) return;

      // Look for exact barcode/SKU match first, else pick top search result
      const exactMatch = products.find(
        (p) =>
          p.sku?.toLowerCase() === trimmed ||
          p.barcode?.toLowerCase() === trimmed ||
          p.name.toLowerCase() === trimmed
      ) ?? (products.length > 0 ? products[0] : null);

      if (exactMatch) {
        onAdd(exactMatch);
        onSearch("");
        inputRef.current?.focus();
      } else {
        onUnknownBarcode?.(search.trim());
      }
    }
  }

  function handleAddProduct(p: ProductSearchResult) {
    onAdd(p);
    inputRef.current?.focus();
  }

  const tabs: Array<{ id: ProductTab; label: string; icon: string }> = [
    { id: "all", label: "All", icon: "fa-list" },
    { id: "favorites", label: "Favorites", icon: "fa-star" },
    { id: "recent", label: "Recent", icon: "fa-clock-rotate-left" },
    { id: "categories", label: "Categories", icon: "fa-layer-group" },
  ];

  return (
    <section className="pos-zone pos-zone-products" aria-label="Product discovery">
      {/* Zone Header */}
      <div className="pos-zone-header">
        <h2 className="pos-zone-title flex items-center gap-1.5">
          <i className="fa-solid fa-boxes-stacked text-xs text-blue-600" aria-hidden />
          Products
        </h2>
        <span className="text-[10px] font-bold text-slate-400">
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Search & Tabs Controls */}
      <div className="shrink-0 space-y-1.5 border-b border-slate-200 bg-slate-50/70 p-2">
        {/* Fast Search Input & Camera Scanner Action */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <i
              className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Scan barcode, SKU, name… (Enter to add)"
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-8 text-xs font-medium placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Search products"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            ) : (
              <i
                className="fa-solid fa-barcode absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                title="Barcode ready"
              />
            )}
          </div>

          {onOpenScanner ? (
            <button
              type="button"
              onClick={onOpenScanner}
              title="Open Camera & QR Scanner"
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 shadow-2xs"
            >
              <i className="fa-solid fa-camera text-xs" />
            </button>
          ) : null}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <i className={`fa-solid ${t.icon} text-[9px]`} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        {/* Category Filter Pills (when categories tab or active category) */}
        {tab === "categories" || categoryFilter ? (
          <div className="flex max-h-16 flex-wrap gap-1 overflow-y-auto pt-0.5">
            <button
              type="button"
              onClick={() => onCategory(null)}
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold transition ${
                !categoryFilter
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCategory(c === categoryFilter ? null : c)}
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold transition ${
                  categoryFilter === c
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Product Cards Grid */}
      <div className="pos-zone-scroll flex-1 p-2">
        {loading && products.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-xs text-slate-400">
            <i className="fa-solid fa-circle-notch fa-spin mb-1 text-base text-blue-500" />
            Loading catalog…
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-center p-4">
            <i className="fa-solid fa-magnifying-glass mb-1 text-lg text-slate-300" />
            <p className="text-xs font-bold text-slate-600">No products found</p>
            <p className="text-[10px] text-slate-400">Try searching by SKU, barcode or name</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => {
              const fav = favoriteIds.includes(p.productId);
              const stock = p.stockAvailable != null ? Number(p.stockAvailable) : null;
              const zero = stock != null && stock <= 0;
              const rate = Number(p.retailPrice ?? 0);
              const wholesale = Number(p.wholesalePrice ?? 0);
              const hasTierDifference = wholesale > 0 && wholesale < rate;

              return (
                <div
                  key={p.productId}
                  role="button"
                  tabIndex={0}
                  onClick={() => !zero && handleAddProduct(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!zero) handleAddProduct(p);
                    }
                  }}
                  className={`group relative flex cursor-pointer flex-col justify-between rounded-lg border bg-white p-2 transition select-none ${
                    zero
                      ? "cursor-not-allowed border-slate-200 bg-slate-50/60 opacity-75"
                      : "border-slate-200/90 hover:border-blue-500 hover:shadow-xs active:scale-[0.99]"
                  }`}
                >
                  {/* Top line: image + info */}
                  <div>
                    <div className="flex items-start gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-slate-50">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <i className="fa-solid fa-box text-sm text-slate-300" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <h3
                            className="line-clamp-2 text-[11px] font-bold leading-tight text-slate-900 group-hover:text-blue-600"
                            title={p.name}
                          >
                            {p.name}
                          </h3>
                          <button
                            type="button"
                            className="shrink-0 p-0.5 text-slate-300 hover:text-amber-400"
                            aria-label={fav ? "Remove favorite" : "Add favorite"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(p.productId);
                            }}
                          >
                            <i className={`fa-${fav ? "solid" : "regular"} fa-star text-[10px] ${fav ? "text-amber-400" : ""}`} />
                          </button>
                        </div>
                        <p className="mt-0.5 truncate text-[9px] text-slate-400">
                          SKU: {p.sku || "—"} · {p.unitName || "Pcs"}
                        </p>
                      </div>
                    </div>

                    {/* Stock & Price Line */}
                    <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1">
                      <div>{stockBadge(stock)}</div>
                      <div className="text-right">
                        {hasTierDifference ? (
                          <div className="leading-tight">
                            <span className="text-[11px] font-black text-slate-900">{money(rate)}</span>
                            <span className="ml-1 text-[9px] font-medium text-slate-400">ws:{money(wholesale)}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-black text-slate-900">{money(rate)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add Action Button */}
                  <button
                    type="button"
                    disabled={zero}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddProduct(p);
                    }}
                    className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-blue-600 py-1 text-[11px] font-bold text-white transition hover:bg-blue-700 active:scale-98 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <i className="fa-solid fa-plus text-[9px]" aria-hidden />
                    {zero ? "Out of stock" : "Add to Cart"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {hasMore ? (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-blue-600 transition hover:bg-slate-50"
            >
              Load more products
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
