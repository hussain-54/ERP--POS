import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { pickExactProductMatch, pickPriceLevel, resolvePosUnitPrice } from "@electronic-erp/domain";
import {
  canViewMoreProducts,
  POS_PRODUCT_PAGE_SIZE,
  POS_PRODUCT_SEARCH_PLACEHOLDER,
  POS_SEARCH_FLUSH_MS,
  productImageUrl,
  visibleProductSlice,
} from "../pos-catalog-load";
import type { PriceLevel, ProductTab } from "../pos-types";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSEmptyState,
  POSErrorState,
  POSLoadingState,
  POSSearch,
  POSTabs,
} from "../design-system";
import {
  productSearchEmptyCopy,
  type PosCatalogFeedback,
} from "../pos-user-messages";
import { PosDiscoveryTools } from "./PosDiscoveryTools";

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  searching: boolean;
  products: ProductSearchResult[];
  favorites: ProductSearchResult[];
  recent: ProductSearchResult[];
  categories: CategoryOption[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (p: ProductSearchResult) => void;
  tab: ProductTab;
  onTabChange: (t: ProductTab) => void;
  locale: "en" | "ur" | "en_ur";
  priceLevel: PriceLevel;
  onAdd: (p: ProductSearchResult) => boolean | void;
  onCommitSearch?: (query: string, highlighted: ProductSearchResult | null) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onCamera?: () => void;
  onBarcodeScanHint?: () => void;
  onQrScan?: () => void;
  onManualEntry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  meta?: ReactNode;
  /** Inline catalog feedback (search miss / load error / add failure). */
  catalogFeedback?: PosCatalogFeedback | null;
}

const DISCOVERY_TABS: { id: ProductTab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "favorites", label: "Favorites" },
  { id: "categories", label: "Categories" },
];

function productTitle(p: ProductSearchResult, locale: Props["locale"]) {
  if (locale === "ur" && p.nameUr) return p.nameUr;
  if (locale === "en_ur" && p.nameUr) return `${p.name} / ${p.nameUr}`;
  return p.name;
}

function sellingPrice(p: ProductSearchResult, priceLevel: PriceLevel): number {
  try {
    return resolvePosUnitPrice({
      retailPrice: Number(p.retailPrice),
      wholesalePrice: Number(p.wholesalePrice),
      dealerPrice: Number(p.dealerPrice),
      customerPrice: p.customerPrice != null ? Number(p.customerPrice) : null,
      promotionPrice: p.promotionPrice != null ? Number(p.promotionPrice) : null,
      priceLevel,
      qty: 1,
    }).unitPrice;
  } catch {
    return pickPriceLevel(p, priceLevel);
  }
}

const ProductCard = memo(function ProductCard({
  p,
  locale,
  priceLevel,
  onAdd,
  favorited,
  onToggleFavorite,
  highlighted,
}: {
  p: ProductSearchResult;
  locale: Props["locale"];
  priceLevel: PriceLevel;
  onAdd: (p: ProductSearchResult) => boolean | void;
  favorited: boolean;
  onToggleFavorite: (p: ProductSearchResult) => void;
  highlighted?: boolean;
}) {
  const title = productTitle(p, locale);
  const stock = p.stockAvailable != null ? Number(p.stockAvailable) : null;
  const outOfStock = stock != null && Number.isFinite(stock) && stock <= 0;
  const lowStock = stock != null && Number.isFinite(stock) && stock > 0 && stock <= 5;
  const initial = (title.trim()[0] ?? "?").toUpperCase();
  const price = useMemo(() => sellingPrice(p, priceLevel), [p, priceLevel]);
  const photo = productImageUrl(p);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photo) && !photoFailed;
  const model = p.model?.trim();

  function tryAdd() {
    if (outOfStock) return;
    onAdd(p);
  }

  return (
    <div
      className={`pos-product-card group relative flex flex-col overflow-hidden rounded-[var(--pos-radius)] border bg-[var(--pos-card)] text-left ${
        highlighted
          ? "border-[var(--pos-primary)] ring-1 ring-[var(--pos-ring)]"
          : outOfStock
            ? "border-[var(--pos-border)] opacity-75"
            : "border-[var(--pos-border)] hover:border-blue-400 hover:shadow-md"
      }`}
      data-product-id={p.productId}
    >
      <button
        type="button"
        className="absolute right-2 top-2 z-10"
        title={favorited ? "Remove favorite" : "Add favorite"}
        aria-label={favorited ? "Remove favorite" : "Add favorite"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(p);
        }}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-workspace)] text-sm text-amber-500"
          aria-hidden
        >
          {favorited ? "★" : "☆"}
        </span>
      </button>
      <button
        type="button"
        onClick={tryAdd}
        disabled={outOfStock}
        title={outOfStock ? "Out of stock — cannot add" : `Add ${title} to cart`}
        className="flex flex-1 flex-col text-left focus:outline-none focus-visible:shadow-[var(--pos-focus)] disabled:cursor-not-allowed"
      >
        <div
          className="pos-product-card-media relative flex items-center justify-center bg-[var(--pos-muted-bg)]"
          title={showPhoto ? title : undefined}
        >
          {showPhoto ? (
            <img
              src={photo ?? undefined}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain p-1.5"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-[var(--pos-radius)] bg-[var(--pos-workspace)] text-lg font-semibold text-[var(--pos-primary)]"
              aria-hidden
            >
              {initial}
            </span>
          )}
          {outOfStock ? (
            <span className="absolute left-2 top-2 rounded-[var(--pos-radius-sm)] bg-[var(--pos-danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              Out
            </span>
          ) : lowStock ? (
            <span className="absolute left-2 top-2 rounded-[var(--pos-radius-sm)] bg-[var(--pos-warning)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              Low
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-0.5 p-3 pb-1">
          <div className="line-clamp-2 text-[11px] font-bold leading-snug text-[var(--pos-ink)]">{title}</div>
          {p.nameUr && locale === "en" ? (
            <div className="truncate text-[10px] text-[var(--pos-muted)]" dir="auto">
              {p.nameUr}
            </div>
          ) : null}
          {p.brand?.trim() ? (
            <div className="truncate text-[10px] text-[var(--pos-muted)]">{p.brand}</div>
          ) : null}
          <div className="text-[10px] text-[var(--pos-muted)]">SKU {p.sku || "—"}</div>
          {model ? <div className="truncate text-[10px] text-[var(--pos-muted)]">Model {model}</div> : null}
          <div className="text-[10px] text-[var(--pos-muted)]">Unit {p.unitName?.trim() || "—"}</div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <span className="text-xs font-bold tabular-nums text-[var(--pos-ink)]">Rs {price.toFixed(2)}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                outOfStock
                  ? "bg-[var(--pos-danger-soft)] text-[var(--pos-danger)]"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {stock != null && Number.isFinite(stock) ? `Stock: ${p.stockAvailable}` : "Stock —"}
            </span>
          </div>
        </div>
      </button>
      <div className="p-3 pt-1">
        <button
          type="button"
          className="pos-product-card-add"
          disabled={outOfStock}
          title={outOfStock ? "Out of stock — this product cannot be sold right now" : "Quick add to cart"}
          onClick={tryAdd}
        >
          {outOfStock ? "Out of stock" : "Quick Add"}
        </button>
      </div>
    </div>
  );
});

export const PosProductPanel = memo(function PosProductPanel({
  query,
  onQueryChange,
  searching,
  products,
  favorites,
  recent,
  categories,
  selectedCategoryId,
  onSelectCategory,
  favoriteIds,
  onToggleFavorite,
  tab,
  onTabChange,
  locale,
  priceLevel,
  onAdd,
  onCommitSearch,
  searchRef,
  onCamera,
  onBarcodeScanHint,
  onQrScan,
  onManualEntry,
  hasMore = false,
  onLoadMore,
  meta,
  catalogFeedback = null,
}: Props) {
  const searchingCatalog = query.trim().length > 0;
  const [draft, setDraft] = useState(query);
  const [visibleCount, setVisibleCount] = useState(POS_PRODUCT_PAGE_SIZE);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const normalized = draft.trim() === "" ? "" : draft;
    if (normalized === query) return;
    const handle = window.setTimeout(() => onQueryChange(normalized), POS_SEARCH_FLUSH_MS);
    return () => window.clearTimeout(handle);
  }, [draft, query, onQueryChange]);

  const visibleTab: ProductTab =
    tab === "favorites" || tab === "categories" ? tab : "recent";
  const list = useMemo(() => {
    if (searchingCatalog) return products;
    if (visibleTab === "favorites") return favorites;
    if (visibleTab === "categories") return products;
    return recent;
  }, [searchingCatalog, products, visibleTab, favorites, recent]);

  useEffect(() => {
    setVisibleCount(POS_PRODUCT_PAGE_SIZE);
  }, [query, visibleTab, selectedCategoryId]);

  const visible = useMemo(
    () => visibleProductSlice(list, visibleCount),
    [list, visibleCount],
  );
  const showViewMore = canViewMoreProducts(list.length, visibleCount, hasMore);

  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    setHighlight(0);
  }, [list, query, tab]);

  useEffect(() => {
    const id = visible[highlight]?.productId;
    if (!id) return;
    const node = document.querySelector(`[data-product-id="${id}"]`);
    node?.scrollIntoView?.({ block: "nearest" });
  }, [highlight, visible]);

  function addHighlightedOrExact() {
    const exact = pickExactProductMatch(list, query);
    const target = exact ?? visible[highlight] ?? visible[0];
    if (target) onAdd(target);
  }

  function viewMore() {
    setVisibleCount((count) => count + POS_PRODUCT_PAGE_SIZE);
    if (visibleCount >= list.length) onLoadMore?.();
  }

  const empty = productSearchEmptyCopy({
    searchingCatalog,
    tab: visibleTab,
    query,
  });

  return (
    <section className="pos-product-discovery flex min-h-0 flex-1 flex-col space-y-3.5 overflow-y-auto">
      <div className="pos-product-search-block shrink-0 space-y-3.5">
        <POSSearch
          ref={searchRef as React.RefObject<HTMLInputElement>}
          aria-label="Product search"
          placeholder={POS_PRODUCT_SEARCH_PLACEHOLDER}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((i) => Math.min(i + 1, Math.max(0, visible.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const next = draft.trim();
              if (next !== query) onQueryChange(next);
              const highlighted = visible[highlight] ?? null;
              if (onCommitSearch) onCommitSearch(next, highlighted);
              else addHighlightedOrExact();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft("");
              onQueryChange("");
            }
          }}
          autoComplete="off"
          autoFocus
          title="Name · Urdu · SKU · barcode · model · specification · ↑↓ · Enter add · Esc clear"
        />

        <PosDiscoveryTools
          onBarcodeScan={onBarcodeScanHint}
          onQrScan={onQrScan}
          onCamera={onCamera}
          onManualEntry={onManualEntry}
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {meta}
          <POSBadge tone={searching ? "warning" : "neutral"}>
            {searching ? "Searching…" : `${list.length} items`}
          </POSBadge>
        </div>

        <POSTabs items={DISCOVERY_TABS} value={visibleTab} onChange={onTabChange} />
      </div>

      {catalogFeedback ? (
        <div
          role="alert"
          className={`shrink-0 rounded-[var(--pos-radius)] border px-3 py-2 text-xs ${
            catalogFeedback.tone === "danger"
              ? "border-[var(--pos-danger)]/40 bg-[var(--pos-danger-soft)] text-[var(--pos-danger)]"
              : "border-[var(--pos-border)] bg-[var(--pos-muted-bg)] text-[var(--pos-ink)]"
          }`}
        >
          <strong className="font-semibold">{catalogFeedback.title}</strong>
          {catalogFeedback.description ? (
            <span className="mt-0.5 block opacity-90">{catalogFeedback.description}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-1 min-h-0 flex-1 overflow-auto">
        {visibleTab === "categories" && !searchingCatalog ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            <POSButton
              size="sm"
              variant={!selectedCategoryId ? "primary" : "ghost"}
              onClick={() => onSelectCategory(null)}
            >
              All
            </POSButton>
            {categories.map((c) => (
              <POSButton
                key={c.id}
                size="sm"
                variant={selectedCategoryId === c.id ? "primary" : "ghost"}
                onClick={() => onSelectCategory(c.id)}
              >
                {c.name}
              </POSButton>
            ))}
            {!categories.length ? (
              <span className="text-sm text-[var(--pos-muted)]">No categories in catalog yet</span>
            ) : null}
          </div>
        ) : null}

        {searchingCatalog ? (
          <p className="mb-2 text-[11px] text-[var(--pos-muted)]">
            Live catalog search — name, Urdu, SKU, barcode, brand, model, specification
          </p>
        ) : null}

        {searching && list.length === 0 ? (
          <POSLoadingState label="Searching products…" rows={5} />
        ) : list.length === 0 ? (
          <POSCard className="border-dashed">
            {catalogFeedback?.tone === "danger" ? (
              <POSErrorState
                title={catalogFeedback.title}
                description={catalogFeedback.description}
                actionLabel="Focus search"
                onAction={() => searchRef.current?.focus()}
              />
            ) : (
              <POSEmptyState
                title={catalogFeedback?.title ?? empty.title}
                description={catalogFeedback?.description ?? empty.description}
                actionLabel="Focus search"
                onAction={() => searchRef.current?.focus()}
              />
            )}
          </POSCard>
        ) : (
          <>
            <div
              className="pos-product-grid"
              aria-busy={searching || undefined}
              style={searching ? { opacity: 0.72 } : undefined}
            >
              {visible.map((p, index) => (
                <ProductCard
                  key={`${p.productId}:${p.sku ?? ""}:${p.unitId}`}
                  p={p}
                  locale={locale}
                  priceLevel={priceLevel}
                  onAdd={onAdd}
                  favorited={favoriteIds.has(p.productId)}
                  onToggleFavorite={onToggleFavorite}
                  highlighted={index === highlight}
                />
              ))}
            </div>
            {showViewMore ? (
              <div className="mt-3 flex justify-center">
                <POSButton size="sm" variant="secondary" onClick={viewMore}>
                  View More Products
                </POSButton>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
});
