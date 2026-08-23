import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { CATALOG_CHANGED_EVENT } from "@/features/product-management/catalog-api";
import { posApi } from "../api";
import { money } from "../format";
import { PosComingSoonPanel, PosSubPageShell } from "../PosSubPageShell";

const RECENT_KEY = "erp-pos-v2-recent";
const FAVORITES_KEY = "erp-pos-v2-favorites";
const PRODUCT_CACHE_KEY = "erp-pos-v2-product-cache";

export type ProductWorkspaceMode =
  | "search"
  | "barcode"
  | "sku"
  | "favorites"
  | "recent"
  | "categories"
  | "stock"
  | "qr"
  | "camera";

const META: Record<ProductWorkspaceMode, { title: string; description: string }> = {
  search: {
    title: "Product search",
    description: "Fast lookup by name, SKU, or barcode for checkout.",
  },
  barcode: {
    title: "Barcode scan",
    description: "Hardware scanner or manual barcode entry — Enter adds the match to New Sale.",
  },
  sku: {
    title: "Manual SKU entry",
    description: "Type a SKU and add the product to the cart.",
  },
  favorites: {
    title: "Favorites",
    description: "Quick-pick products saved on this terminal.",
  },
  recent: {
    title: "Recent products",
    description: "Recently sold items on this device.",
  },
  categories: {
    title: "Categories",
    description: "Browse products by category.",
  },
  stock: {
    title: "Stock availability",
    description: "On-hand quantities for the current warehouse context.",
  },
  qr: {
    title: "QR scan",
    description: "Camera QR recognition is not available in this build.",
  },
  camera: {
    title: "Camera scan",
    description: "Camera-assisted product capture is not available in this build.",
  },
};

function loadIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids.slice(0, 40)));
}

function loadProductCache(): Record<string, ProductSearchResult> {
  try {
    const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ProductSearchResult>) : {};
  } catch {
    return {};
  }
}

function cacheProducts(items: ProductSearchResult[]) {
  const map = loadProductCache();
  for (const p of items) map[p.productId] = p;
  const ids = Object.keys(map).slice(-80);
  const next: Record<string, ProductSearchResult> = {};
  for (const id of ids) {
    const row = map[id];
    if (row) next[id] = row;
  }
  localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(next));
}

function stockTone(stock: number | null | undefined) {
  if (stock == null) return "bg-slate-100 text-slate-600";
  if (stock <= 0) return "bg-red-50 text-red-700";
  if (stock <= 5) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export function ProductWorkspace({ mode }: { mode: ProductWorkspaceMode }) {
  const meta = META[mode];
  const { branchId, hasPermission } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(36);
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadIds(FAVORITES_KEY));
  const [recentIds] = useState<string[]>(() => loadIds(RECENT_KEY));
  const [refreshTick, setRefreshTick] = useState(0);

  const canCreateProduct = hasPermission("products.write");

  const loadProducts = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const q = search.trim() || " ";
      const res = await posApi.searchProducts({
        q,
        limit,
        warehouseId: branchId,
      });
      setProducts(res.items);
      cacheProducts(res.items);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, search, limit]);

  useEffect(() => {
    const id = window.setTimeout(() => void loadProducts(), mode === "barcode" ? 120 : 250);
    return () => window.clearTimeout(id);
  }, [loadProducts, mode, refreshTick]);

  useEffect(() => {
    function onCatalogChanged() {
      setRefreshTick((n) => n + 1);
      void loadProducts();
    }
    window.addEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
  }, [loadProducts]);

  useEffect(() => {
    if (mode === "barcode" || mode === "sku" || mode === "search") {
      inputRef.current?.focus();
    }
  }, [mode]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return [...set].sort();
  }, [products]);

  const visible = useMemo(() => {
    const cache = loadProductCache();
    if (mode === "favorites") {
      return favoriteIds
        .map((id) => cache[id] || products.find((p) => p.productId === id))
        .filter((p): p is ProductSearchResult => Boolean(p));
    }
    if (mode === "recent") {
      return recentIds
        .map((id) => cache[id] || products.find((p) => p.productId === id))
        .filter((p): p is ProductSearchResult => Boolean(p));
    }
    let list = products;
    if (mode === "categories" && categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    if (mode === "stock") {
      list = [...list].sort((a, b) => {
        const sa = a.stockAvailable == null ? 999999 : Number(a.stockAvailable);
        const sb = b.stockAvailable == null ? 999999 : Number(b.stockAvailable);
        return sa - sb;
      });
    }
    return list;
  }, [products, mode, favoriteIds, recentIds, categoryFilter]);

  function toggleFavorite(productId: string) {
    const hit = products.find((p) => p.productId === productId) || loadProductCache()[productId];
    if (hit) cacheProducts([hit]);
    setFavoriteIds((ids) => {
      const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [productId, ...ids];
      saveIds(FAVORITES_KEY, next);
      return next;
    });
  }

  function addToSale(p: ProductSearchResult) {
    const stock = p.stockAvailable != null ? Number(p.stockAvailable) : null;
    if (stock != null && stock <= 0) {
      push({ title: "Out of stock", description: p.name, tone: "danger" });
      return;
    }
    navigate("/pos/sales/new", { state: { addProducts: [p] } });
  }

  function onScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const needle = search.trim().toLowerCase();
    if (!needle) return;
    const exact =
      products.find((p) => (p.barcode ?? "").toLowerCase() === needle) ||
      products.find((p) => (p.sku ?? "").toLowerCase() === needle) ||
      products[0];
    if (exact) {
      addToSale(exact);
      setSearch("");
    } else {
      push({ title: "No product found", description: "Try another barcode or SKU.", tone: "danger" });
    }
  }

  if (mode === "qr" || mode === "camera") {
    return (
      <PosSubPageShell moduleNumber="04" moduleLabel="Products" title={meta.title} description={meta.description}>
        <PosComingSoonPanel
          title={mode === "qr" ? "QR camera scan unavailable" : "Camera scan unavailable"}
          reason={
            mode === "qr"
              ? "This POS build does not include camera QR recognition. Use Barcode Scan with a USB/HID scanner, or enter a QR payload in Product Search (API matches qr_codes)."
              : "Camera-assisted capture is not implemented. Use barcode hardware or Manual SKU Entry."
          }
        />
      </PosSubPageShell>
    );
  }

  const placeholder =
    mode === "barcode"
      ? "Scan barcode or type it, then Enter…"
      : mode === "sku"
        ? "Enter SKU, then Enter…"
        : "Name, SKU, barcode…";

  return (
    <PosSubPageShell
      moduleNumber="04"
      moduleLabel="Products"
      title={meta.title}
      description={meta.description}
      actions={
        <>
          {canCreateProduct ? (
            <Link
              to={`/products/new?returnTo=${encodeURIComponent(
                mode === "search" ? "/pos/products" : `/pos/products/${mode}`,
              )}`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
            >
              + New Product
            </Link>
          ) : null}
          <Link to="/pos/sales/new" className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white">
            New Sale
          </Link>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
          <div className="relative">
            <i
              className={`fa-solid absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 ${
                mode === "barcode" ? "fa-barcode" : "fa-magnifying-glass"
              }`}
              aria-hidden
            />
            <input
              ref={inputRef}
              type={mode === "barcode" ? "text" : "search"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onScanKeyDown}
              placeholder={placeholder}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-[var(--pos-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pos-primary)]/20"
              autoComplete="off"
              aria-label={meta.title}
            />
          </div>
          {mode === "barcode" ? (
            <p className="text-[11px] text-slate-400">
              USB/HID scanners type into this field and send Enter. No camera required.
            </p>
          ) : null}
          {mode === "categories" ? (
            <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  !categoryFilter ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-500"
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c === categoryFilter ? null : c)}
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

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Searching…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {mode === "favorites"
                ? "No favorites yet — star products on the terminal or here."
                : mode === "recent"
                  ? "No recent products on this device yet."
                  : "No products found."}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => {
                const stock = p.stockAvailable != null ? Number(p.stockAvailable) : null;
                const fav = favoriteIds.includes(p.productId);
                return (
                  <article
                    key={p.productId}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900">{p.name}</h3>
                        <p className="text-[11px] text-slate-400">
                          {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ""}
                          {p.category ? ` · ${p.category}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(p.productId)}
                        className={`rounded-lg p-1.5 ${fav ? "text-amber-500" : "text-slate-300"}`}
                        aria-label={fav ? "Unfavorite" : "Favorite"}
                      >
                        <i className="fa-solid fa-star" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stockTone(stock)}`}>
                        {stock == null ? "Stock n/a" : `Stock ${stock}`}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{money(Number(p.retailPrice ?? 0))}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToSale(p)}
                      className="mt-3 rounded-xl bg-[var(--pos-primary)] py-2 text-xs font-bold text-white"
                    >
                      Add to New Sale
                    </button>
                  </article>
                );
              })}
            </div>
          )}
          {products.length >= limit ? (
            <button
              type="button"
              onClick={() => setLimit((n) => n + 24)}
              className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600"
            >
              Load more
            </button>
          ) : null}
        </div>
      </div>
    </PosSubPageShell>
  );
}

