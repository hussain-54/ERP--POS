import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { money } from "../format";
import type { ProductTab } from "../types";

function productDisplayPrices(p: ProductSearchResult) {
  const retail = Number(p.retailPrice ?? 0);
  const selling = Number(p.customerPrice ?? p.promotionPrice ?? p.retailPrice ?? 0);
  const hasDiscount = retail > 0 && selling > 0 && selling < retail - 0.009;
  const discountPct = hasDiscount ? Math.round(((retail - selling) / retail) * 100) : 0;
  return { retail, selling, hasDiscount, discountPct };
}

function stockBadge(stock: number | null | undefined, unitName?: string | null) {
  const unit = unitName || "Pcs";
  if (stock == null) {
    return <span className="text-[9px] font-medium text-slate-400">Stock — · {unit}</span>;
  }
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
        Out of Stock
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
        Low Stock: {stock} {unit}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
      Stock: {stock} {unit}
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
  onManualEntry,
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
  onManualEntry?: () => void;
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
    if (e.key !== "Enter") return;
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

  function handleAddProduct(p: ProductSearchResult) {
    onAdd(p);
    inputRef.current?.focus();
  }

  const tabs: Array<{ id: ProductTab; label: string }> = [
    { id: "all", label: "All" },
    { id: "favorites", label: "Favorites" },
    { id: "recent", label: "Recent" },
    { id: "categories", label: "Categories" },
  ];

  const quickActions = [
    {
      id: "barcode",
      label: "Barcode Scan",
      icon: "fa-barcode",
      onClick: () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      },
    },
    {
      id: "qr",
      label: "QR Scan",
      icon: "fa-qrcode",
      onClick: () => onOpenScanner?.(),
      disabled: !onOpenScanner,
    },
    {
      id: "camera",
      label: "Camera",
      icon: "fa-camera",
      onClick: () => onOpenScanner?.(),
      disabled: !onOpenScanner,
    },
    {
      id: "manual",
      label: "Manual Entry",
      icon: "fa-keyboard",
      onClick: () => onManualEntry?.(),
      disabled: !onManualEntry,
    },
  ] as const;

  return (
    <section
      className="pos-zone pos-zone-products flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      aria-label="Product discovery"
    >
      <div className="pos-zone-header shrink-0">
        <h2 className="pos-zone-title flex items-center gap-1.5">
          <i className="fa-solid fa-boxes-stacked text-xs text-blue-600" aria-hidden />
          Products
        </h2>
        <span className="text-[10px] font-bold tabular-nums text-slate-400">
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="pos-products-toolbar shrink-0 space-y-2 p-2.5">
        <div className="relative">
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
            placeholder="Search Product by name, barcode, sku, brand..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs font-medium placeholder-slate-400 shadow-xs transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Search products"
            autoComplete="off"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label="Clear search"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          ) : (
            <i className="fa-solid fa-barcode absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={"disabled" in action ? Boolean(action.disabled) : false}
              onClick={action.onClick}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-2 text-[10px] font-bold text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className={`fa-solid ${action.icon} text-sm text-blue-600`} aria-hidden />
              <span className="leading-tight">{action.label}</span>
            </button>
          ))}
        </div>

        <div className="pos-products-tabs border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-1.5 text-[11px] font-bold transition ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "categories" || categoryFilter ? (
          <div className="flex max-h-14 flex-wrap gap-1 overflow-y-auto overscroll-contain">
            <button
              type="button"
              onClick={() => onCategory(null)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
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
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${
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
              const { retail, selling, hasDiscount, discountPct } = productDisplayPrices(p);

              return (
                <article
                  key={p.productId}
                  className={`pos-product-card ${zero ? "pos-product-card-disabled" : ""}`}
                >
                  <div className="relative mb-1.5 flex h-16 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <i className="fa-solid fa-box text-2xl text-slate-300" aria-hidden />
                    )}
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-300 shadow-xs hover:text-amber-400"
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

                  <button
                    type="button"
                    disabled={zero}
                    onClick={() => !zero && handleAddProduct(p)}
                    className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                  >
                    <h3 className="line-clamp-2 min-h-[2rem] text-[11px] font-bold leading-snug text-slate-900" title={p.name}>
                      {p.name}
                    </h3>
                    <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">SKU: {p.sku || "—"}</p>
                    <div className="mt-1.5 flex items-end justify-between gap-1">
                      <div className="min-w-0">{stockBadge(stock, p.unitName)}</div>
                      <div className="shrink-0 text-right leading-tight">
                        {hasDiscount ? (
                          <>
                            <div className="pos-price-original">{money(retail)}</div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs font-black text-slate-900">{money(selling)}</span>
                              {discountPct > 0 ? (
                                <span className="pos-price-discount-badge">-{discountPct}%</span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs font-black text-slate-900">{money(selling)}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={zero}
                    onClick={() => handleAddProduct(p)}
                    className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg bg-blue-600 py-1.5 text-[11px] font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {zero ? (
                      "Out of Stock"
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
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
            >
              View More Products
              <i className="fa-solid fa-chevron-down text-[9px]" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
