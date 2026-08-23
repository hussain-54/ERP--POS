import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Form, FormActions, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { catalogApi, notifyCatalogChanged } from "./catalog-api";
import { ProductFormSections } from "./ProductFormSections";
import { ProductMediaPanel } from "./ProductMediaPanel";
import { useProductMedia } from "./product-media";
import { buildProductPayload, EMPTY_PRODUCT_FORM, type ProductFormState } from "./product-form-state";
import {
  firstProductFormError,
  validateProductForm,
  type ProductFormFieldErrors,
} from "./product-form-validation";
import { useProductTaxonomy } from "./useProductTaxonomy";

export function ProductFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { organizationId } = useAuth();
  const returnTo = searchParams.get("returnTo");

  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT_FORM);
  const [fieldErrors, setFieldErrors] = useState<ProductFormFieldErrors>({});
  const [saving, setSaving] = useState(false);

  const taxonomy = useProductTaxonomy();
  const media = useProductMedia(undefined, organizationId);

  function setField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as keyof ProductFormFieldErrors];
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    const localErrors = validateProductForm(form);
    setFieldErrors(localErrors);
    const firstLocal = firstProductFormError(localErrors);
    if (firstLocal) {
      toast.push({ title: "Check required fields", description: firstLocal, tone: "danger" });
      return;
    }

    setSaving(true);
    try {
      const created = await catalogApi.createProduct(buildProductPayload(form));
      if (!created?.id) {
        throw new Error("Product was created but the API did not return a valid ID");
      }
      if (media.pendingImage) {
        try {
          await media.uploadMediaToProduct(created.id, media.pendingImage, "image", { isPrimary: true });
        } catch (uploadErr) {
          toast.push({
            title: "Product saved, image upload failed",
            description: uploadErr instanceof Error ? uploadErr.message : "Error",
            tone: "danger",
          });
        }
      }
      notifyCatalogChanged({ productId: created.id });
      toast.push({ title: "Product created", tone: "success" });
      if (returnTo && returnTo.startsWith("/pos")) {
        navigate(returnTo);
      } else {
        navigate(`/products/${created.id}`);
      }
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

  const mediaPanel = (
    <ProductMediaPanel
      mode="create"
      primaryImageUrl={media.primaryImageUrl}
      imageMedia={media.imageMedia}
      mediaPreviewUrls={media.mediaPreviewUrls}
      media={media.media}
      uploading={media.uploading}
      onUploadImage={(file) => {
        void media.uploadMedia(file, "image");
      }}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New product</h1>
          <p className="mt-1 text-sm text-[var(--erp-muted)]">
            Create the product, assign company and category, and add a photo so it appears in POS.
          </p>
        </div>
        <Link className="text-sm text-[var(--erp-brand)] underline" to="/products">
          Back to list
        </Link>
      </div>

      <Form onSubmit={onSubmit} className="space-y-4">
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
              toast.push({ title: "Taxonomy item added", tone: "success" });
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
          <Button type="submit" loading={saving || taxonomy.loading} disabled={saving}>
            Create product
          </Button>
        </FormActions>
      </Form>
    </div>
  );
}
