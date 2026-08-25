import type { ProductListItem } from "@electronic-erp/contracts";
import { Badge, Button, LoadingState } from "@electronic-erp/ui";
import { Link, useNavigate } from "react-router-dom";
import { BarcodeStrip } from "./BarcodeStrip";
import {
  formatCurrency,
  resolveDiscountAmount,
  resolveMarginPercent,
  resolveSalePrice,
  specialIsActive,
  statusTone,
  stockTone,
} from "./product-display-utils";

function ProductThumb({ url, name }: { url?: string | null; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] text-[10px] font-semibold uppercase text-[var(--erp-muted)]"
    >
      {name.slice(0, 2)}
    </div>
  );
}

function PriceCell({ value, muted }: { value: number; muted?: boolean }) {
  return (
    <span className={muted ? "text-[var(--erp-muted)]" : "tabular-nums text-[var(--erp-ink)]"}>
      {formatCurrency(value)}
    </span>
  );
}

function RowActions({
  product,
  canWrite,
  canDelete,
  onDelete,
}: {
  product: ProductListItem;
  canWrite: boolean;
  canDelete: boolean;
  onDelete: (p: ProductListItem) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Link
        className="inline-flex h-8 items-center rounded-lg border border-[var(--erp-border)] px-2.5 text-xs font-medium hover:bg-[var(--erp-surface-muted)]"
        to={`/products/${product.id}`}
      >
        View
      </Link>
      {canWrite ? (
        <Link
          className="inline-flex h-8 items-center rounded-lg border border-[var(--erp-border)] px-2.5 text-xs font-medium hover:bg-[var(--erp-surface-muted)]"
          to={`/products/${product.id}?edit=1`}
        >
          Edit
        </Link>
      ) : null}
      {canDelete && product.isActive ? (
        <Button type="button" size="sm" variant="danger" onClick={() => onDelete(product)}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}

export function ProductListDesktop({
  items,
  imageUrls,
  selected,
  onToggleSelect,
  onToggleAll,
  canWrite,
  canDelete,
  onDelete,
  loading,
}: {
  items: ProductListItem[];
  imageUrls: Record<string, string>;
  selected: string[];
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  canWrite: boolean;
  canDelete: boolean;
  onDelete: (p: ProductListItem) => void;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const allSelected = items.length > 0 && items.every((r) => selected.includes(r.id));

  if (loading) {
    return (
      <div className="hidden min-h-[240px] items-center justify-center md:flex">
        <LoadingState label="Loading products…" />
      </div>
    );
  }

  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="erp-table w-full min-w-[1200px] text-sm">
        <thead>
          <tr className="border-b border-[var(--erp-border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">
            <th className="w-10 px-2 py-2.5">
              <input
                type="checkbox"
                aria-label="Select all products on this page"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th className="px-2 py-2.5">Product</th>
            <th className="px-2 py-2.5">Company / Brand</th>
            <th className="px-2 py-2.5">SKU</th>
            <th className="px-2 py-2.5">Barcode / Code</th>
            <th className="px-2 py-2.5 text-right">Cost</th>
            <th className="px-2 py-2.5 text-right">Wholesale</th>
            <th className="px-2 py-2.5 text-right">Retail</th>
            <th className="px-2 py-2.5 text-right">Discount</th>
            <th className="px-2 py-2.5 text-right">Sale</th>
            <th className="px-2 py-2.5">Promo</th>
            <th className="px-2 py-2.5 text-right">Margin</th>
            <th className="px-2 py-2.5 text-right">Stock</th>
            <th className="px-2 py-2.5">Status</th>
            <th className="px-2 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const img = r.primaryImagePath ? imageUrls[r.primaryImagePath] : null;
            const sale = resolveSalePrice(r);
            const discount = resolveDiscountAmount(r);
            const margin = resolveMarginPercent(r);
            const promo = specialIsActive(r);
            return (
              <tr
                key={r.id}
                className="cursor-pointer border-b border-[var(--erp-border)]/70 transition hover:bg-[var(--erp-surface-muted)]/60"
                onClick={() => navigate(`/products/${r.id}`)}
              >
                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={(e) => onToggleSelect(r.id, e.target.checked)}
                    aria-label={`Select ${r.name}`}
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="flex min-w-[180px] items-center gap-2.5">
                    <ProductThumb url={img} name={r.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--erp-brand)]">{r.name}</p>
                      {r.nameUr ? (
                        <p className="truncate text-xs text-[var(--erp-muted)]" dir="rtl">
                          {r.nameUr}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="min-w-[100px]">
                    <p className="truncate">{r.companyName ?? "—"}</p>
                    <p className="truncate text-xs text-[var(--erp-muted)]">{r.brandName ?? "—"}</p>
                  </div>
                </td>
                <td className="px-2 py-2 font-mono text-xs">{r.sku}</td>
                <td className="px-2 py-2">
                  <div className="space-y-1">
                    {r.primaryBarcode ? <BarcodeStrip value={r.primaryBarcode} compact /> : null}
                    <p className="font-mono text-[10px] text-[var(--erp-muted)]">{r.productCode}</p>
                  </div>
                </td>
                <td className="px-2 py-2 text-right">
                  <PriceCell value={r.costPrice} muted />
                </td>
                <td className="px-2 py-2 text-right">
                  <PriceCell value={r.wholesalePrice} />
                </td>
                <td className="px-2 py-2 text-right">
                  <PriceCell value={r.retailPrice} />
                </td>
                <td className="px-2 py-2 text-right">
                  {discount > 0 ? (
                    <span className="tabular-nums text-[var(--erp-danger)]">−{formatCurrency(discount)}</span>
                  ) : (
                    <span className="text-[var(--erp-muted)]">—</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-medium">
                  <PriceCell value={sale} />
                </td>
                <td className="px-2 py-2">
                  {promo ? <Badge tone="brand">Promo</Badge> : <span className="text-[var(--erp-muted)]">—</span>}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {margin != null ? `${margin.toFixed(1)}%` : "—"}
                </td>
                <td className="px-2 py-2 text-right">
                  {r.trackInventory ? (
                    <Badge tone={stockTone(r)}>{Number(r.stockAvailable ?? 0).toLocaleString()}</Badge>
                  ) : (
                    <span className="text-xs text-[var(--erp-muted)]">N/A</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Badge tone={statusTone(r)}>{r.status}</Badge>
                </td>
                <td className="px-2 py-2">
                  <RowActions product={r} canWrite={canWrite} canDelete={canDelete} onDelete={onDelete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProductListMobile({
  items,
  imageUrls,
  canWrite,
  canDelete,
  onDelete,
  loading,
}: {
  items: ProductListItem[];
  imageUrls: Record<string, string>;
  canWrite: boolean;
  canDelete: boolean;
  onDelete: (p: ProductListItem) => void;
  loading?: boolean;
}) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center md:hidden">
        <LoadingState label="Loading products…" />
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <ul className="space-y-3 md:hidden">
      {items.map((r) => {
        const img = r.primaryImagePath ? imageUrls[r.primaryImagePath] : null;
        const sale = resolveSalePrice(r);
        const promo = specialIsActive(r);
        return (
          <li key={r.id}>
            <article
              className="rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3 shadow-[var(--erp-shadow)]"
              onClick={() => navigate(`/products/${r.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/products/${r.id}`);
              }}
            >
              <div className="flex gap-3">
                <ProductThumb url={img} name={r.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--erp-ink)]">{r.name}</p>
                      {r.nameUr ? (
                        <p className="truncate text-xs text-[var(--erp-muted)]" dir="rtl">
                          {r.nameUr}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={statusTone(r)}>{r.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--erp-muted)]">
                    {r.brandName ?? "—"} · SKU {r.sku}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-[var(--erp-muted)]">Retail</span>
                    <span className="text-right tabular-nums">{formatCurrency(r.retailPrice)}</span>
                    <span className="text-[var(--erp-muted)]">Sale</span>
                    <span className="text-right font-medium tabular-nums">{formatCurrency(sale)}</span>
                    <span className="text-[var(--erp-muted)]">Stock</span>
                    <span className="text-right">
                      {r.trackInventory ? Number(r.stockAvailable ?? 0).toLocaleString() : "N/A"}
                    </span>
                    {promo ? (
                      <>
                        <span className="text-[var(--erp-muted)]">Promotion</span>
                        <span>
                          <Badge tone="brand">Active</Badge>
                        </span>
                      </>
                    ) : null}
                  </div>
                  {r.primaryBarcode ? (
                    <div className="mt-2">
                      <BarcodeStrip value={r.primaryBarcode} compact />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 border-t border-[var(--erp-border)] pt-3" onClick={(e) => e.stopPropagation()}>
                <RowActions product={r} canWrite={canWrite} canDelete={canDelete} onDelete={onDelete} />
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
