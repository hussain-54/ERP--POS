import type { ProductSearchResult } from "@electronic-erp/contracts";
import type { ProductTab } from "../pos-types";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSEmptyState,
  POSLoadingState,
  POSSearch,
} from "../design-system";

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
  onAdd: (p: ProductSearchResult) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

function ProductCard({
  p,
  locale,
  onAdd,
  favorited,
  onToggleFavorite,
}: {
  p: ProductSearchResult;
  locale: Props["locale"];
  onAdd: (p: ProductSearchResult) => void;
  favorited: boolean;
  onToggleFavorite: (p: ProductSearchResult) => void;
}) {
  const title =
    locale === "ur" && p.nameUr
      ? p.nameUr
      : locale === "en_ur" && p.nameUr
        ? `${p.name} / ${p.nameUr}`
        : p.name;
  const stock = Number(p.stockAvailable);
  const low = stock <= 0;
  const meta = [p.brand, p.category, p.unitName].filter(Boolean).join(" · ");

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[var(--pos-radius)] border border-[var(--pos-border)] bg-[var(--pos-card)] text-left shadow-sm transition hover:border-[var(--pos-primary)] hover:shadow-md">
      <button
        type="button"
        className="absolute right-2 top-2 z-10"
        title={favorited ? "Remove favorite" : "Add favorite"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(p);
        }}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--pos-radius-sm)] bg-[var(--pos-workspace)]/95 text-sm shadow-[var(--pos-shadow)]">
          {favorited ? "★" : "☆"}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onAdd(p)}
        className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pos-primary)]"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-3">
          <div className="line-clamp-3 text-center text-sm font-semibold text-slate-700">{title}</div>
          {low ? (
            <span className="absolute left-2 top-2 rounded bg-[var(--pos-danger)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Out of stock
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <div className="line-clamp-2 text-sm font-medium leading-snug">{title}</div>
          <div className="text-[11px] text-[var(--pos-muted)]">{p.sku || p.barcode || "—"}</div>
          {meta ? <div className="text-[10px] text-[var(--pos-muted)]">{meta}</div> : null}
          <div className="mt-auto flex items-end justify-between gap-2 pt-1">
            <div>
              <div className="text-base font-semibold tabular-nums">Rs {Number(p.retailPrice).toFixed(0)}</div>
              <div className="text-[10px] text-[var(--pos-muted)]">Stock {p.stockAvailable}</div>
            </div>
            <span className="rounded-md bg-[var(--pos-primary)] px-2 py-1 text-xs font-medium text-white opacity-90 group-hover:opacity-100">
              Add
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

export function PosProductPanel({
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
  onAdd,
  searchRef,
}: Props) {
  const list =
    tab === "favorites"
      ? favorites
      : tab === "categories"
        ? products
        : tab === "recent"
          ? recent
          : products.length
            ? products
            : recent;

  const tabs: { id: ProductTab; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "favorites", label: "Favorites" },
    { id: "categories", label: "Categories" },
    { id: "results", label: "Search" },
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <POSCard padding="sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <POSSearch
              ref={searchRef as React.RefObject<HTMLInputElement>}
              label="Search / Barcode / SKU"
              placeholder="Scan or type product…"
              value={query}
              onChange={(e) => {
                onQueryChange(e.target.value);
                onTabChange("results");
              }}
              autoComplete="off"
            />
          </div>
          <POSBadge tone={searching ? "warning" : "neutral"}>
            {searching ? "Searching…" : `${list.length} items`}
          </POSBadge>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {tabs.map((t) => (
            <POSButton
              key={t.id}
              size="sm"
              variant={tab === t.id ? "primary" : "ghost"}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </POSButton>
          ))}
        </div>
      </POSCard>

      {tab === "categories" ? (
        <div className="flex flex-wrap gap-2">
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

      <div className="min-h-0 flex-1 overflow-auto">
        {searching && list.length === 0 ? (
          <POSLoadingState label="Searching products…" rows={5} />
        ) : list.length === 0 ? (
          <POSCard className="border-dashed">
            <POSEmptyState
              title={
                tab === "favorites"
                  ? "No favorites yet"
                  : "No products yet"
              }
              description={
                tab === "favorites"
                  ? "Tap ★ on a product card"
                  : "Scan a barcode or search by name / SKU"
              }
            />
          </POSCard>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {list.map((p) => (
              <ProductCard
                key={p.productId}
                p={p}
                locale={locale}
                onAdd={onAdd}
                favorited={favoriteIds.has(p.productId)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
