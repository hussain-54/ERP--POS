import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProductListItem, ProductStats } from "@electronic-erp/contracts";
import {
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  useToast,
} from "@electronic-erp/ui";
import { useDocumentTitle } from "@/app/useDocumentTitle";
import { useAuth } from "@/features/auth/AuthContext";
import { catalogApi, CATALOG_CHANGED_EVENT } from "./catalog-api";
import { ProductDeleteDialog } from "./ProductDeleteDialog";
import { ProductListDesktop, ProductListMobile } from "./ProductListViews";
import { useDebouncedValue } from "./useDebouncedValue";
import { useProductListImages } from "./useProductListImages";
import { useProductTaxonomy } from "./useProductTaxonomy";

type StatusFilter = "" | "active" | "inactive" | "draft";

type ListFilters = {
  categoryId: string;
  brandId: string;
  companyId: string;
  status: StatusFilter;
  lowStock: boolean;
  onPromotion: boolean;
};

const EMPTY_FILTERS: ListFilters = {
  categoryId: "",
  brandId: "",
  companyId: "",
  status: "",
  lowStock: false,
  onPromotion: false,
};

const PAGE_SIZE = 20;

export function ProductsPage() {
  useDocumentTitle("All Products");
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("products.write");
  const canDelete = hasPermission("products.delete");
  const canImport = hasPermission("products.import");
  const taxonomy = useProductTaxonomy();

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 400);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const imageUrls = useProductListImages(items.map((i) => i.primaryImagePath));

  async function loadStats() {
    setStatsLoading(true);
    try {
      setStats(await catalogApi.getProductStats());
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  async function load(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listProducts({
        page: nextPage,
        pageSize: PAGE_SIZE,
        q: debouncedQ.trim() || undefined,
        categoryId: filters.categoryId || undefined,
        brandId: filters.brandId || undefined,
        companyId: filters.companyId || undefined,
        status: filters.status || undefined,
        lowStock: filters.lowStock || undefined,
        onPromotion: filters.onPromotion || undefined,
        sortBy: "name",
        sortDir: "asc",
      });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filters]);

  useEffect(() => {
    const onCatalogChanged = () => {
      void load(page);
      void loadStats();
    };
    window.addEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, filters]);

  async function bulk(action: "deactivate" | "activate" | "restore") {
    if (!selected.length) return;
    try {
      const res = await catalogApi.bulk(selected, action);
      toast.push({ title: `Updated ${res.affected} products`, tone: "success" });
      setSelected([]);
      await load();
      await loadStats();
    } catch (err) {
      toast.push({
        title: "Bulk action failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function confirmDeactivate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await catalogApi.deactivateProduct(deleteTarget.id);
      toast.push({ title: "Product deactivated", tone: "success" });
      setDeleteTarget(null);
      await load();
      await loadStats();
    } catch (err) {
      toast.push({
        title: "Deactivate failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? items.map((i) => i.id) : []);
  }

  const statValue = (n: number | undefined) =>
    statsLoading ? "…" : (n ?? 0).toLocaleString();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Manage product master data, pricing, inventory, and catalog information."
        actions={
          <>
            {canImport ? (
              <Link
                className="inline-flex h-10 items-center rounded-xl border border-[var(--erp-border)] bg-[var(--erp-surface)] px-4 text-sm font-medium hover:bg-[var(--erp-surface-muted)]"
                to="/import-export"
              >
                Import
              </Link>
            ) : null}
            {canWrite ? (
              <Link
                className="inline-flex h-10 items-center rounded-xl bg-[var(--erp-brand)] px-4 text-sm font-medium text-white hover:opacity-95"
                to="/products/new"
              >
                + Add New Product
              </Link>
            ) : null}
          </>
        }
      />

      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Products", href: "/products" },
          { label: "All Products" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total Products" value={statValue(stats?.totalProducts)} tone="brand" />
        <KpiCard label="Active Products" value={statValue(stats?.activeProducts)} tone="success" />
        <KpiCard label="Low Stock Items" value={statValue(stats?.lowStockItems)} tone="warning" />
        <KpiCard label="Inactive Products" value={statValue(stats?.inactiveProducts)} tone="neutral" />
        <KpiCard label="On Promotion" value={statValue(stats?.onPromotion)} tone="brand" />
      </div>

      <Card>
        <FilterBar className="mb-3 flex-wrap gap-2">
          <div className="min-w-0 flex-1 basis-full sm:min-w-[220px] sm:basis-auto">
            <SearchInput
              label="Search products"
              placeholder="Name, SKU, barcode, code, brand…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select
            label="Category"
            value={filters.categoryId}
            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            options={[
              { value: "", label: "All categories" },
              ...taxonomy.categories.map((c) => ({ value: c.value, label: c.label })),
            ]}
          />
          <Select
            label="Brand"
            value={filters.brandId}
            onChange={(e) => setFilters((f) => ({ ...f, brandId: e.target.value }))}
            options={[
              { value: "", label: "All brands" },
              ...taxonomy.brands.map((b) => ({ value: b.value, label: b.label })),
            ]}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))
            }
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "draft", label: "Draft" },
            ]}
          />
          <Button type="button" variant="secondary" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? "Hide filters" : "Additional filters"}
          </Button>
          {canDelete ? (
            <>
              <Button variant="secondary" disabled={!selected.length} onClick={() => void bulk("deactivate")}>
                Deactivate
              </Button>
              <Button variant="secondary" disabled={!selected.length} onClick={() => void bulk("restore")}>
                Restore
              </Button>
            </>
          ) : null}
        </FilterBar>

        {showAdvanced ? (
          <div className="mb-3 flex flex-wrap gap-3 rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface-muted)]/40 p-3">
            <Select
              label="Company"
              value={filters.companyId}
              onChange={(e) => setFilters((f) => ({ ...f, companyId: e.target.value }))}
              options={[
                { value: "", label: "All companies" },
                ...taxonomy.companies.map((c) => ({ value: c.value, label: c.label })),
              ]}
            />
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.lowStock}
                onChange={(e) => setFilters((f) => ({ ...f, lowStock: e.target.checked }))}
              />
              Low stock only
            </label>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.onPromotion}
                onChange={(e) => setFilters((f) => ({ ...f, onPromotion: e.target.checked }))}
              />
              On promotion only
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </Button>
          </div>
        ) : null}

        {error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : !loading && !items.length ? (
          <EmptyState
            title="No products found"
            description="Adjust your search or filters, or create a new product."
            action={
              canWrite ? (
                <Link
                  className="inline-flex h-10 items-center rounded-xl bg-[var(--erp-brand)] px-4 text-sm text-white"
                  to="/products/new"
                >
                  Add New Product
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ProductListDesktop
              items={items}
              imageUrls={imageUrls}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              canWrite={canWrite}
              canDelete={canDelete}
              onDelete={setDeleteTarget}
              loading={loading}
            />
            <ProductListMobile
              items={items}
              imageUrls={imageUrls}
              canWrite={canWrite}
              canDelete={canDelete}
              onDelete={setDeleteTarget}
              loading={loading}
            />
          </>
        )}

        {!error && total > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--erp-border)] pt-4">
            <p className="text-xs text-[var(--erp-muted)]">
              Showing {items.length.toLocaleString()} of {total.toLocaleString()} products
            </p>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={(p) => void load(p)} />
          </div>
        ) : null}
      </Card>

      <ProductDeleteDialog
        open={Boolean(deleteTarget)}
        productName={deleteTarget?.name ?? ""}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeactivate()}
      />
    </div>
  );
}
