import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { money } from "../format";
import type { ProductTab } from "../types";

function productDisplayPrices(p: ProductSearchResult) {
  const retail = Number(p.retailPrice ?? 0);
  const selling = Number(p.customerPrice ?? p.promotionPrice ?? p.retailPrice ?? 0);
  const hasDiscount = retail > 0 && selling > 0 && selling < retail - 0.009;
  const discountPct = hasDiscount ? Math.round(((retail - selling) / retail) * 100) : 0;
  const isPromo = p.promotionPrice != null && Number(p.promotionPrice) < retail;
  const isCustomer = p.customerPrice != null && Number(p.customerPrice) < retail;
  return { retail, selling, hasDiscount, discountPct, isPromo, isCustomer };
}

function stockBadge(stock: number | null | undefined, unitName?: string | null) {
  const unit = unitName || "Pcs";
  if (stock == null) {
    return (
      <span className="text-[9px] font-medium text-slate-400" title={`Unit: ${unit}`}>
        Stock — · {unit}
      </span>
    );
  }
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center rounded bg-red-100 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-red-700">
        Out · {unit}
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span
        className="inline-flex items-center rounded bg-amber-100 px-1 py-px text-[8px] font-bold text-amber-800"
        title={`Low stock: ${stock} ${unit}`}
      >
        {stock} {unit}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded bg-emerald-100 px-1 py-px text-[8px] font-bold text-emerald-800"
      title={`In stock: ${stock} ${unit}`}
    >
      {stock} {unit}
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

      const exactMatch =
        products.find(
          (p) =>
            p.sku?.toLowerCase() === trimmed ||
            p.barcode?.toLowerCase() === trimmed ||
            p.name.toLowerCase() === trimmed,
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
    <section className="pos-zone pos-zone-products flex h-full min-h-0 flex-1 flex-col overflow-hidden" aria-label="Product discovery">
      {/* Pinned zone header — stays visible while grid scrolls */}
      <div className="pos-zone-header shrink-0">
        <h2 className="pos-zone-title flex items-center gap-1.5">
          <i className="fa-solid fa-boxes-stacked text-xs text-blue-600" aria-hidden />
          Products
        </h2>
        <span className="text-[10px] font-bold tabular-nums text-slate-400">
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Pinned search & filters — stays visible while grid scrolls */}
      <div className="pos-products-toolbar shrink-0 space-y-1.5 p-2">
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <i
              className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Scan barcode, SKU, name… (Enter)"
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-7 pr-7 text-xs font-medium placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Search products"
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            ) : (
              <i
                className="fa-solid fa-barcode absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
                title="Barcode ready"
              />
            )}
          </div>

          {onOpenScanner ? (
            <button
              type="button"
              onClick={onOpenScanner}
              title="Open Camera & QR Scanner"
              className="flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600"
            >
              <i className="fa-solid fa-camera text-xs" />
            </button>
          ) : null}
        </div>

        <div className="pos-products-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <i className={`fa-solid ${t.icon} text-[9px]`} aria-hidden />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "categories" || categoryFilter ? (
          <div className="flex max-h-14 flex-wrap gap-1 overflow-y-auto overscroll-contain">
            <button
              type="button"
              onClick={() => onCategory(null)}
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold transition ${
                !categoryFilter
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
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
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Independently scrollable product grid — only this region scrolls */}
      <div className="pos-products-grid min-h-0 flex-1">
        {loading && products.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center text-xs text-slate-400">
            <i className="fa-solid fa-circle-notch fa-spin mb-1 text-base text-blue-500" />
            Loading catalog…
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-24 flex-col items-center justify-center p-3 text-center">
            <i className="fa-solid fa-magnifying-glass mb-1 text-lg text-slate-300" />
            <p className="text-xs font-bold text-slate-600">No products found</p>
            <p className="text-[10px] text-slate-400">Search by SKU, barcode, or name</p>
          </div>
        ) : (
          <div className="pos-products-grid-inner">
            {products.map((p) => {
              const fav = favoriteIds.includes(p.productId);
              const stock = p.stockAvailable != null ? Number(p.stockAvailable) : null;
              const zero = stock != null && stock <= 0;
              const { retail, selling, hasDiscount, discountPct, isPromo, isCustomer } =
                productDisplayPrices(p);

              return (
                <article
                  key={p.productId}
                  className={`pos-product-card ${zero ? "pos-product-card-disabled" : ""}`}
                >
                  <div
                    role="button"
                    tabIndex={zero ? -1 : 0}
                    onClick={() => !zero && handleAddProduct(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!zero) handleAddProduct(p);
                      }
                    }}
                    className={`group min-w-0 ${zero ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex gap-1.5">
                      <div className="pos-product-thumb" aria-hidden>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" loading="lazy" />
                        ) : (
                          <i className="fa-solid fa-box text-sm text-slate-300" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-0.5">
                          <h3
                            className="line-clamp-2 min-w-0 flex-1 text-[11px] font-bold leading-snug text-slate-900 group-hover:text-blue-600"
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
                            <i
                              className={`fa-${fav ? "solid" : "regular"} fa-star text-[10px] ${fav ? "text-amber-400" : ""}`}
                            />
                          </button>
                        </div>

                        <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500" title={p.sku || undefined}>
                          SKU: {p.sku || "—"}
                        </p>

                        <div className="mt-1 flex items-end justify-between gap-1">
                          <div className="min-w-0 shrink">{stockBadge(stock, p.unitName)}</div>
                          <div className="min-w-0 text-right leading-tight">
                            {hasDiscount ? (
                              <>
                                <div className="flex flex-wrap items-center justify-end gap-x-1">
                                  <span className="pos-price-original">{money(retail)}</span>
                                  {discountPct > 0 ? (
                                    <span className="pos-price-discount-badge">-{discountPct}%</span>
                                  ) : null}
                                </div>
                                <div className="pos-price-selling">{money(selling)}</div>
                              </>
                            ) : (
                              <div className="pos-price-selling">{money(selling)}</div>
                            )}
                            {isPromo ? (
                              <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wide text-emerald-600">
                                Promo
                              </span>
                            ) : isCustomer ? (
                              <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wide text-blue-600">
                                Customer
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={zero}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddProduct(p);
                    }}
                    className="mt-auto flex w-full items-center justify-center gap-1 rounded-md bg-blue-600 py-1.5 text-[11px] font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {zero ? (
                      "Out of stock"
                    ) : (
                      <>
                        <i className="fa-solid fa-plus text-[9px]" aria-hidden />
                        Add to Cart
                      </>
                    )}
                  </button>
                </article>
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
