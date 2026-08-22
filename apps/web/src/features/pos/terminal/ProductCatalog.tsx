import type { ProductSearchResult } from "@electronic-erp/contracts";
import type { ProductTab } from "../types";

const PRODUCT_ICONS = [
  { icon: "fa-lightbulb", color: "text-amber-400", bg: "bg-amber-50" },
  { icon: "fa-toggle-on", color: "text-blue-400", bg: "bg-blue-50" },
  { icon: "fa-plug-circle-bolt", color: "text-gray-500", bg: "bg-gray-100" },
  { icon: "fa-bolt", color: "text-red-400", bg: "bg-red-50" },
  { icon: "fa-plug", color: "text-slate-500", bg: "bg-slate-100" },
  { icon: "fa-fan", color: "text-slate-400", bg: "bg-slate-100" },
  { icon: "fa-square", color: "text-gray-400", bg: "bg-gray-100" },
  { icon: "fa-tape", color: "text-gray-700", bg: "bg-gray-100" },
];

function iconFor(index: number) {
  return PRODUCT_ICONS[index % PRODUCT_ICONS.length]!;
}

export function ProductCatalog({
  search,
  onSearch,
  tab,
  onTab,
  products,
  favoriteIds,
  onAdd,
  onToggleFavorite,
  onLoadMore,
}: {
  search: string;
  onSearch: (v: string) => void;
  tab: ProductTab;
  onTab: (t: ProductTab) => void;
  products: ProductSearchResult[];
  favoriteIds: string[];
  onAdd: (p: ProductSearchResult) => void;
  onToggleFavorite: (id: string) => void;
  onLoadMore: () => void;
}) {
  const tabs: ProductTab[] = ["recent", "favorites", "categories"];

  return (
    <div className="pos-catalog">
      <div className="space-y-3.5">
        <div className="relative shadow-sm">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-sm text-gray-400" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search Product by name, barcode, sku, brand..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-12 text-xs font-medium placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <i className="fa-solid fa-keyboard absolute right-4 top-3.5 cursor-pointer text-sm text-gray-400 hover:text-blue-600" aria-hidden />
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[
            { icon: "fa-barcode", label: "Barcode Scan" },
            { icon: "fa-qrcode", label: "QR Scan" },
            { icon: "fa-camera", label: "Camera" },
            { icon: "fa-circle-plus", label: "Manual Entry" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className="group flex flex-col items-center justify-center space-y-1.5 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-blue-500 hover:shadow-sm"
            >
              <i className={`fa-solid ${item.icon} text-lg text-blue-600 transition-transform group-hover:scale-110`} aria-hidden />
              <span className="text-[11px] font-bold text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-6 border-b border-gray-200 text-xs">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTab(t)}
            className={`pb-2 capitalize ${tab === t ? "border-b-2 border-blue-600 font-bold text-blue-600" : "font-medium text-gray-500 hover:text-gray-800"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        {products.map((p, i) => {
          const style = iconFor(i);
          const fav = favoriteIds.includes(p.productId);
          return (
            <button
              key={p.productId}
              type="button"
              onClick={() => onAdd(p)}
              className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-blue-400 hover:shadow-md"
            >
              <i
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(p.productId);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onToggleFavorite(p.productId))}
                className={`fa-${fav ? "solid" : "regular"} fa-star absolute right-3 top-3 text-xs ${fav ? "text-amber-400" : "text-gray-300"}`}
                aria-label={fav ? "Remove favorite" : "Add favorite"}
              />
              <div className="mb-2.5 flex h-24 items-center justify-center">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${style.bg} transition-transform group-hover:scale-105`}>
                    <i className={`fa-solid ${style.icon} text-2xl ${style.color}`} aria-hidden />
                  </div>
                )}
              </div>
              <h4 className="mb-1 text-[11px] font-bold leading-snug text-gray-800">{p.name}</h4>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-bold text-gray-900">Rs.{Number(p.retailPrice ?? 0).toFixed(2)}</span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Stock: {p.stockAvailable ?? 0}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={onLoadMore}
          className="mx-auto flex items-center justify-center space-x-1.5 text-xs font-semibold text-blue-600 hover:underline"
        >
          <span>View More Products</span>
          <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden />
        </button>
      </div>
    </div>
  );
}
