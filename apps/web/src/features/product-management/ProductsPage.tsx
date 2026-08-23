import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProductMaster } from "@electronic-erp/contracts";
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  FilterBar,
  Pagination,
  SearchInput,
  useToast,
} from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { catalogApi, CATALOG_CHANGED_EVENT } from "./catalog-api";
import { ProductDeleteDialog } from "./ProductDeleteDialog";
import { labelForOption } from "./product-form-state";
import { useProductTaxonomy } from "./useProductTaxonomy";

export function ProductsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("products.write");
  const canDelete = hasPermission("products.delete");
  const taxonomy = useProductTaxonomy();

  const [items, setItems] = useState<ProductMaster[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ProductMaster | null>(null);
  const [deleting, setDeleting] = useState(false);

  const companyLabel = (id?: string | null) => labelForOption(taxonomy.companies, id);

  async function load(nextPage = page, query = q) {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listProducts({ page: nextPage, pageSize: 20, q: query || undefined });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, "");
  }, []);

  useEffect(() => {
    const onCatalogChanged = () => {
      void load(page, q);
    };
    window.addEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onCatalogChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q]);

  async function bulk(action: "deactivate" | "activate" | "restore") {
    if (!selected.length) return;
    try {
      const res = await catalogApi.bulk(selected, action);
      toast.push({ title: `Updated ${res.affected} products`, tone: "success" });
      setSelected([]);
      await load();
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

  return (
    <div className="space-y-4">
      <div className="erp-page-toolbar flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-[var(--erp-muted)]">Product master, pricing, barcodes, and attributes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex h-10 items-center rounded-xl border px-4 text-sm" to="/categories">
            Taxonomy
          </Link>
          <Link className="inline-flex h-10 items-center rounded-xl border px-4 text-sm" to="/units">
            Units
          </Link>
          <Link className="inline-flex h-10 items-center rounded-xl border px-4 text-sm" to="/import-export">
            Import / Export
          </Link>
          {canWrite ? (
            <Link
              className="inline-flex h-10 items-center rounded-xl bg-[var(--erp-brand)] px-4 text-sm text-white"
              to="/products/new"
            >
              New product
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <FilterBar className="mb-3">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[240px]">
            <SearchInput
              label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(1, q);
              }}
            />
          </div>
          <Button variant="secondary" onClick={() => void load(1, q)}>
            Search
          </Button>
          {canDelete ? (
            <>
              <Button variant="secondary" disabled={!selected.length} onClick={() => void bulk("deactivate")}>
                Deactivate
              </Button>
              <Button variant="secondary" disabled={!selected.length} onClick={() => void bulk("activate")}>
                Activate
              </Button>
              <Button variant="secondary" disabled={!selected.length} onClick={() => void bulk("restore")}>
                Restore
              </Button>
            </>
          ) : null}
        </FilterBar>

        {error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : (
          <DataTable
            loading={loading}
            rows={items}
            rowKey={(r) => r.id}
            emptyTitle="No products yet"
            emptyDescription="Create your first product or import a CSV template."
            columnVisibility
            columns={[
              {
                key: "select",
                header: "",
                hideable: false,
                cell: (r) => (
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={(e) => {
                      setSelected((prev) =>
                        e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                      );
                    }}
                  />
                ),
              },
              {
                key: "name",
                header: "Product",
                sortValue: (r) => r.name,
                filterValue: (r) => `${r.name} ${r.nameUr ?? ""}`,
                cell: (r) => (
                  <div>
                    <Link className="font-medium text-[var(--erp-brand)] underline" to={`/products/${r.id}`}>
                      {r.name}
                    </Link>
                    <div className="text-xs text-[var(--erp-muted)]">{r.nameUr}</div>
                  </div>
                ),
              },
              {
                key: "company",
                header: "Company",
                sortValue: (r) => companyLabel(r.companyId),
                filterValue: (r) => companyLabel(r.companyId),
                cell: (r) => companyLabel(r.companyId),
              },
              { key: "sku", header: "SKU", sortValue: (r) => r.sku, filterValue: (r) => r.sku, cell: (r) => r.sku },
              {
                key: "code",
                header: "Code",
                sortValue: (r) => r.productCode,
                filterValue: (r) => r.productCode,
                cell: (r) => r.productCode,
              },
              {
                key: "price",
                header: "Retail",
                align: "right",
                sortValue: (r) => r.retailPrice,
                cell: (r) => r.retailPrice.toFixed(2),
              },
              {
                key: "margin",
                header: "Margin",
                align: "right",
                sortValue: (r) => r.profitMarginPercent ?? 0,
                cell: (r) => `${r.profitMarginPercent ?? 0}%`,
              },
              {
                key: "status",
                header: "Status",
                sortValue: (r) => r.status,
                filterValue: (r) => r.status,
                cell: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.status}</Badge>,
              },
              {
                key: "actions",
                header: "",
                hideable: false,
                cell: (r) => (
                  <div className="flex flex-wrap justify-end gap-1">
                    {canWrite ? (
                      <Link
                        className="inline-flex h-8 items-center rounded-lg border px-2 text-xs"
                        to={`/products/${r.id}?edit=1`}
                      >
                        Edit
                      </Link>
                    ) : null}
                    {canDelete && r.isActive ? (
                      <Button type="button" size="sm" variant="danger" onClick={() => setDeleteTarget(r)}>
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        )}

        <div className="mt-4">
          <Pagination page={page} pageSize={20} total={total} onPageChange={(p) => void load(p)} />
        </div>
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
