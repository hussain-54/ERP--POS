import type { ProductSearchResult } from "@electronic-erp/contracts";

/** Flush typed search to the parent after this pause so cart/payment do not re-render per key. */
export const POS_SEARCH_FLUSH_MS = 180;

/** Visible cards per "View More" page — 3-column desktop grid, 4 rows. */
export const POS_PRODUCT_PAGE_SIZE = 12;

/** First POS search page. Existing API max is 50. */
export const POS_PRODUCT_SEARCH_LIMIT = 24;
export const POS_PRODUCT_SEARCH_LIMIT_MAX = 50;

export const POS_PRODUCT_SEARCH_PLACEHOLDER =
  "Search Product by name, barcode, sku, brand, model, category...";

export function nextProductSearchLimit(current: number): number {
  if (current >= POS_PRODUCT_SEARCH_LIMIT_MAX) return POS_PRODUCT_SEARCH_LIMIT_MAX;
  return Math.min(POS_PRODUCT_SEARCH_LIMIT_MAX, current + POS_PRODUCT_SEARCH_LIMIT);
}

export function visibleProductSlice<T>(items: readonly T[], visibleCount: number): T[] {
  return items.slice(0, Math.max(0, visibleCount));
}

export function canViewMoreProducts(total: number, visibleCount: number, hasRemoteMore = false): boolean {
  return visibleCount < total || hasRemoteMore;
}

export function appendUniqueProducts(
  current: ProductSearchResult[],
  extra: ProductSearchResult[],
): ProductSearchResult[] {
  const seen = new Set(current.map((item) => item.productId));
  const next = [...current];
  for (const item of extra) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    next.push(item);
  }
  return next;
}

export function productImageUrl(product: object): string | null {
  const value = (product as { imageUrl?: unknown }).imageUrl;
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

/**
 * Keep category browse on the existing POS search API.
 * Prefer the hydrated `category` field so a single category-name search does not
 * mix in products that only share a brand/model/name token.
 */
export function productsMatchingCategory(
  items: readonly ProductSearchResult[],
  categoryName: string,
): ProductSearchResult[] {
  const needle = categoryName.trim().toLowerCase();
  if (!needle) return [];
  const tagged = items.filter((item) => (item.category ?? "").trim().toLowerCase() === needle);
  return tagged.length ? tagged : [...items];
}

/**
 * Resolve category browse hits through the existing POS search API.
 * Runs the name lookups in parallel — sequential search-by-name was the lag on Categories.
 */
export async function mergeProductSearches(
  queries: string[],
  search: (q: string) => Promise<ProductSearchResult[]>,
  maxQueries = 8,
): Promise<ProductSearchResult[]> {
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, maxQueries);
  if (!unique.length) return [];
  const batches = await Promise.all(unique.map((q) => search(q)));
  const found: ProductSearchResult[] = [];
  const seen = new Set<string>();
  for (const items of batches) {
    for (const item of items) {
      if (seen.has(item.productId)) continue;
      seen.add(item.productId);
      found.push(item);
    }
  }
  return found;
}

export function isLatestRequest(current: number, started: number): boolean {
  return current === started;
}
