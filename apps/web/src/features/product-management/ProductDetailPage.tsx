import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ProductMaster } from "@electronic-erp/contracts";
import {
  Badge,
  Button,
  ErrorState,
  Form,
  FormActions,
  LoadingState,
  useToast,
} from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { catalogApi, notifyCatalogChanged } from "./catalog-api";
import { ProductDeleteDialog } from "./ProductDeleteDialog";
import { ProductFormSections } from "./ProductFormSections";
import { ProductMediaPanel } from "./ProductMediaPanel";
import { ProductShowcase } from "./ProductShowcase";
import { useProductMedia } from "./product-media";
import {
  buildProductPayload,
  EMPTY_PRODUCT_FORM,
  productToForm,
  type ProductFormState,
} from "./product-form-state";
import {
  firstProductFormError,
  validateProductForm,
  type ProductFormFieldErrors,
} from "./product-form-validation";
import { useProductTaxonomy } from "./useProductTaxonomy";

function primaryBarcodeFromList(items: Array<Record<string, unknown>>): string {
  const primary = items.find((b) => b.is_primary) ?? items[0];
  return primary ? String(primary.barcode ?? "") : "";
}

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { hasPermission, organizationId } = useAuth();
  const canWrite = hasPermission("products.write");
  const canDelete = hasPermission("products.delete");

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [product, setProduct] = useState<ProductMaster | null>(null);
  const [primaryBarcode, setPrimaryBarcode] = useState("");
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [fieldErrors, setFieldErrors] = useState<ProductFormFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const taxonomy = useProductTaxonomy();
  const media = useProductMedia(id, organizationId);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, barcodes] = await Promise.all([catalogApi.getProduct(id), catalogApi.listBarcodes(id)]);
      setProduct(p);
      const barcode = primaryBarcodeFromList(barcodes.items);
      setPrimaryBarcode(barcode);
      setForm({ ...productToForm(p), primaryBarcode: barcode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && product && canWrite && mode === "view") {
      setForm({ ...productToForm(product), primaryBarcode });
      setMode("edit");
      setSearchParams({}, { replace: true });
    }
  }, [canWrite, mode, primaryBarcode, product, searchParams, setSearchParams]);

  function setField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as keyof ProductFormFieldErrors];
      return next;
    });
  }

  function startEdit() {
    if (!product) return;
    setForm({ ...productToForm(product), primaryBarcode });
    setFieldErrors({});
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
    setFieldErrors({});
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id || saving || !canWrite) return;

    const localErrors = validateProductForm(form);
    setFieldErrors(localErrors);
    const firstLocal = firstProductFormError(localErrors);
    if (firstLocal) {
      toast.push({ title: "Check required fields", description: firstLocal, tone: "danger" });
      return;
    }

    setSaving(true);
    try {
      const updated = await catalogApi.updateProduct(id, buildProductPayload(form));
      setProduct(updated);
      notifyCatalogChanged({ productId: id });
      toast.push({ title: "Product updated", tone: "success" });
      try {
        await catalogApi.generateBarcode(id);
        const barcodes = await catalogApi.listBarcodes(id);
        const barcode = primaryBarcodeFromList(barcodes.items);
        setPrimaryBarcode(barcode);
      } catch {
        /* barcode refresh is best-effort */
      }
      setMode("view");
    } catch (err) {
      toast.push({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      await catalogApi.deactivateProduct(id);
      notifyCatalogChanged({ productId: id });
      toast.push({ title: "Product deactivated", tone: "success" });
      navigate("/products");
    } catch (err) {
      toast.push({
        title: "Deactivate failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading || taxonomy.loading) {
    return <LoadingState label="Loading product…" />;
  }

  if (error || !product || !id) {
    return (
      <ErrorState
        title="Product not found"
        description={error ?? "This product may have been removed or you lack access."}
        onRetry={() => void loadProduct()}
      />
    );
  }

  const mediaPanel = (
    <ProductMediaPanel
      mode="edit"
      primaryImageUrl={media.primaryImageUrl}
      imageMedia={media.imageMedia}
      mediaPreviewUrls={media.mediaPreviewUrls}
      media={media.media}
      uploading={media.uploading}
      onUploadImage={(file) => {
        void media.uploadMedia(file, "image").then(() => {
          toast.push({ title: "Media uploaded", tone: "success" });
        }).catch((err: unknown) => {
          toast.push({
            title: "Upload failed",
            description: err instanceof Error ? err.message : "Error",
            tone: "danger",
          });
        });
      }}
      onUploadOther={(file, type) => {
        void media.uploadMedia(file, type).then(() => {
          toast.push({ title: "Media uploaded", tone: "success" });
        }).catch((err: unknown) => {
          toast.push({
            title: "Upload failed",
            description: err instanceof Error ? err.message : "Error",
            tone: "danger",
          });
        });
      }}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--erp-muted)]">
            <Link className="text-[var(--erp-brand)] underline" to="/products">
              Products
            </Link>
            {" / "}
            {product.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <Badge tone={product.isActive ? "success" : "neutral"}>{product.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--erp-muted)]">
            SKU {product.sku} · Code {product.productCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "view" ? (
            <>
              {canWrite ? (
                <Button type="button" onClick={startEdit}>
                  Edit product
                </Button>
              ) : null}
              {canDelete && product.isActive ? (
                <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                  Deactivate
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" form="product-edit-form" loading={saving}>
                Save changes
              </Button>
            </>
          )}
        </div>
      </div>

      {mode === "view" ? (
        <ProductShowcase
          product={product}
          units={taxonomy.units}
          categories={taxonomy.categories}
          subcategories={taxonomy.subcategories}
          brands={taxonomy.brands}
          companies={taxonomy.companies}
          imageUrl={media.primaryImageUrl}
          primaryBarcode={primaryBarcode}
        />
      ) : (
        <Form id="product-edit-form" onSubmit={onSave} className="space-y-4">
          <ProductFormSections
            form={form}
            fieldErrors={fieldErrors}
            onChange={setField}
            units={taxonomy.units}
            categories={taxonomy.categories}
            subcategories={taxonomy.subcategories}
            brands={taxonomy.brands}
            companies={taxonomy.companies}
            onCreateTaxonomy={async (entity, name, code) => {
              try {
                const createdId = await taxonomy.createTaxonomy(entity, name, code);
                toast.push({ title: `${entity.slice(0, -1)} added`, tone: "success" });
                return createdId;
              } catch (err) {
                toast.push({
                  title: "Could not add taxonomy item",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                });
                return undefined;
              }
            }}
            mediaSlot={mediaPanel}
          />
          <FormActions>
            <Button type="submit" loading={saving} disabled={saving}>
              Save changes
            </Button>
            <Button type="button" variant="secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </FormActions>
        </Form>
      )}

      <ProductDeleteDialog
        open={deleteOpen}
        productName={product.name}
        busy={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void onDeactivate()}
      />
    </div>
  );
}
