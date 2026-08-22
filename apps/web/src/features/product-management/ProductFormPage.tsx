import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { catalogApi, notifyCatalogChanged } from "./catalog-api";
import {
  firstProductFormError,
  validateProductForm,
  type ProductFormFieldErrors,
} from "./product-form-validation";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthContext";

type Option = { value: string; label: string };

const PRODUCT_MEDIA_BUCKET = "product-media";
const MEDIA_SIGNED_URL_TTL_SEC = 3600;

function slugCode(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `cat-${Date.now()}`;
}

async function signedMediaUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrl(storagePath, MEDIA_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const toast = useToast();
  const { organizationId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ProductFormFieldErrors>({});
  const [units, setUnits] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [media, setMedia] = useState<Array<Record<string, unknown>>>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [form, setForm] = useState({
    productCode: "",
    sku: "",
    name: "",
    nameUr: "",
    shortDescription: "",
    description: "",
    baseUnitId: "",
    categoryId: "",
    brandId: "",
    companyId: "",
    warrantyDays: "0",
    costPrice: "0",
    retailPrice: "0",
    wholesalePrice: "0",
    dealerPrice: "0",
    minimumSalePrice: "0",
    specialPrice: "",
    primaryBarcode: "",
    size: "",
    color: "",
    watt: "",
    voltage: "",
    material: "",
  });

  const imageMedia = useMemo(
    () => media.filter((item) => String(item.media_type) === "image"),
    [media],
  );

  async function loadCategories() {
    const res = await catalogApi.listTaxonomy("categories");
    setCategories(res.items.map((x) => ({ value: String(x.id), label: String(x.name) })));
  }

  useEffect(() => {
    void (async () => {
      const [u, c, b, co] = await Promise.all([
        catalogApi.listTaxonomy("units"),
        catalogApi.listTaxonomy("categories"),
        catalogApi.listTaxonomy("brands"),
        catalogApi.listTaxonomy("companies"),
      ]);
      setUnits(u.items.map((x) => ({ value: String(x.id), label: String(x.name) })));
      setCategories(c.items.map((x) => ({ value: String(x.id), label: String(x.name) })));
      setBrands(b.items.map((x) => ({ value: String(x.id), label: String(x.name) })));
      setCompanies(co.items.map((x) => ({ value: String(x.id), label: String(x.name) })));
      if (!isNew && id) {
        const [p, mediaRes] = await Promise.all([catalogApi.getProduct(id), catalogApi.listMedia(id)]);
        setMedia(mediaRes.items);
        setForm((prev) => ({
          ...prev,
          productCode: p.productCode,
          sku: p.sku,
          name: p.name,
          nameUr: p.nameUr ?? "",
          shortDescription: p.shortDescription ?? "",
          description: p.description ?? "",
          baseUnitId: p.baseUnitId,
          categoryId: p.categoryId ?? "",
          brandId: p.brandId ?? "",
          companyId: p.companyId ?? "",
          warrantyDays: String(p.warrantyDays),
          costPrice: String(p.costPrice),
          retailPrice: String(p.retailPrice),
          wholesalePrice: String(p.wholesalePrice),
          dealerPrice: String(p.dealerPrice),
          minimumSalePrice: String(p.minimumSalePrice),
          specialPrice: p.specialPrice == null ? "" : String(p.specialPrice),
        }));
      }
    })().catch((err: unknown) => {
      toast.push({
        title: "Failed to load form data",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    });
  }, [id, isNew, toast]);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  useEffect(() => {
    if (!imageMedia.length) {
      setMediaPreviewUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        imageMedia.map(async (item) => {
          const storagePath = String(item.storage_path ?? "");
          if (!storagePath) return;
          const url = await signedMediaUrl(storagePath);
          if (url) next[String(item.id)] = url;
        }),
      );
      if (!cancelled) setMediaPreviewUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [imageMedia]);

  async function uploadMediaToProduct(
    productId: string,
    file: File,
    mediaType: string,
    options?: { isPrimary?: boolean },
  ) {
    if (!organizationId) throw new Error("Missing organization context");
    const path = `${organizationId}/${productId}/${Date.now()}-${file.name}`;
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    await catalogApi.registerMedia(productId, {
      mediaType,
      storagePath: path,
      fileName: file.name,
      mimeType: file.type || undefined,
      fileSize: file.size,
      isPrimary: options?.isPrimary ?? (mediaType === "image" && imageMedia.length === 0),
    });
    const mediaRes = await catalogApi.listMedia(productId);
    setMedia(mediaRes.items);
    notifyCatalogChanged({ productId });
  }

  async function uploadMedia(file: File, mediaType: string) {
    if (!id || isNew) {
      if (mediaType === "image") {
        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingImage(file);
        setPendingPreview(URL.createObjectURL(file));
        return;
      }
      toast.push({ title: "Save the product first", tone: "danger" });
      return;
    }
    setUploading(true);
    try {
      await uploadMediaToProduct(id, file, mediaType);
      toast.push({ title: "Media uploaded", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setUploading(false);
    }
  }

  async function createInlineCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      toast.push({ title: "Category name is required", tone: "danger" });
      return;
    }
    setCreatingCategory(true);
    try {
      const code = (newCategoryCode.trim() || slugCode(name)).toUpperCase();
      const created = (await catalogApi.createTaxonomy("categories", { code, name })) as {
        id?: string;
      };
      await loadCategories();
      if (created?.id) set("categoryId", created.id);
      setNewCategoryCode("");
      setNewCategoryName("");
      setShowAddCategory(false);
      toast.push({ title: "Category added", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Could not add category",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setCreatingCategory(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
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
      const payload = {
        productCode: form.productCode.trim(),
        sku: form.sku.trim(),
        name: form.name.trim(),
        nameUr: form.nameUr.trim() || undefined,
        shortDescription: form.shortDescription.trim() || undefined,
        description: form.description.trim() || undefined,
        baseUnitId: form.baseUnitId,
        categoryId: form.categoryId || undefined,
        brandId: form.brandId || undefined,
        companyId: form.companyId || undefined,
        warrantyDays: Number(form.warrantyDays || 0),
        costPrice: Number(form.costPrice || 0),
        retailPrice: Number(form.retailPrice || 0),
        wholesalePrice: Number(form.wholesalePrice || 0),
        dealerPrice: Number(form.dealerPrice || 0),
        minimumSalePrice: Number(form.minimumSalePrice || 0),
        specialPrice: form.specialPrice === "" ? undefined : Number(form.specialPrice),
        primaryBarcode: form.primaryBarcode.trim() || undefined,
        specifications: {
          size: form.size || undefined,
          color: form.color || undefined,
          watt: form.watt || undefined,
          voltage: form.voltage || undefined,
          material: form.material || undefined,
        },
      };
      if (isNew) {
        const created = await catalogApi.createProduct(payload);
        if (!created?.id) {
          throw new Error("Product was created but the API did not return a valid ID");
        }
        if (pendingImage) {
          try {
            await uploadMediaToProduct(created.id, pendingImage, "image", { isPrimary: true });
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
        navigate(`/products/${created.id}`);
      } else if (id) {
        await catalogApi.updateProduct(id, payload);
        notifyCatalogChanged({ productId: id });
        toast.push({ title: "Product updated", tone: "success" });
        try {
          await catalogApi.generateBarcode(id);
        } catch (barcodeErr) {
          toast.push({
            title: "Product saved, barcode refresh failed",
            description: barcodeErr instanceof Error ? barcodeErr.message : "Error",
            tone: "danger",
          });
        }
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isNew ? "New product" : "Edit product"}</h1>
          <p className="mt-1 text-sm text-[var(--erp-muted)]">
            {isNew
              ? "Create the product, assign a category, and add a photo so it appears in POS."
              : "Update pricing, classification, and media. POS refreshes automatically after save."}
          </p>
        </div>
        <Link className="text-sm text-[var(--erp-brand)] underline" to="/products">
          Back to list
        </Link>
      </div>

      <Form onSubmit={onSubmit} className="space-y-4">
        <Card title="Product identity" description="Codes and names used in search, barcode scan, and POS tiles.">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Product Code"
              required
              value={form.productCode}
              error={fieldErrors.productCode}
              onChange={(e) => set("productCode", e.target.value)}
            />
            <Input
              label="SKU"
              required
              value={form.sku}
              error={fieldErrors.sku}
              onChange={(e) => set("sku", e.target.value)}
            />
            <Input
              label="Product Name"
              required
              value={form.name}
              error={fieldErrors.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <Input label="Urdu Product Name" value={form.nameUr} onChange={(e) => set("nameUr", e.target.value)} />
            <Input label="Primary Barcode" value={form.primaryBarcode} onChange={(e) => set("primaryBarcode", e.target.value)} />
          </div>
        </Card>

        <Card title="Classification" description="Unit is required. Category helps POS browse and reporting.">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Base Unit"
              required
              options={units}
              value={form.baseUnitId}
              error={fieldErrors.baseUnitId}
              onChange={(e) => set("baseUnitId", e.target.value)}
              placeholder="Select unit"
            />
            <div className="space-y-2">
              <Select
                label="Category"
                options={categories}
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                placeholder="Optional"
              />
              {!showAddCategory ? (
                <Button type="button" variant="secondary" onClick={() => setShowAddCategory(true)}>
                  + Add category
                </Button>
              ) : (
                <div className="rounded-md border border-[var(--erp-border)] p-3 space-y-2">
                  <p className="text-sm font-medium text-[var(--erp-ink)]">New category</p>
                  <Input
                    label="Name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Input
                    label="Code"
                    hint="Leave blank to auto-generate from name"
                    value={newCategoryCode}
                    onChange={(e) => setNewCategoryCode(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" loading={creatingCategory} onClick={() => void createInlineCategory()}>
                      Save category
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setShowAddCategory(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Select label="Brand" options={brands} value={form.brandId} onChange={(e) => set("brandId", e.target.value)} placeholder="Optional" />
            <Select label="Company" options={companies} value={form.companyId} onChange={(e) => set("companyId", e.target.value)} placeholder="Optional" />
            <Input
              label="Warranty (days)"
              value={form.warrantyDays}
              error={fieldErrors.warrantyDays}
              onChange={(e) => set("warrantyDays", e.target.value)}
            />
          </div>
        </Card>

        <Card title="Pricing" description="Retail price is shown on POS by default.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Cost Price"
              value={form.costPrice}
              error={fieldErrors.costPrice}
              onChange={(e) => set("costPrice", e.target.value)}
            />
            <Input
              label="Retail Price"
              value={form.retailPrice}
              error={fieldErrors.retailPrice}
              onChange={(e) => set("retailPrice", e.target.value)}
            />
            <Input
              label="Wholesale Price"
              value={form.wholesalePrice}
              error={fieldErrors.wholesalePrice}
              onChange={(e) => set("wholesalePrice", e.target.value)}
            />
            <Input
              label="Dealer Price"
              value={form.dealerPrice}
              error={fieldErrors.dealerPrice}
              onChange={(e) => set("dealerPrice", e.target.value)}
            />
            <Input
              label="Special Price"
              value={form.specialPrice}
              error={fieldErrors.specialPrice}
              onChange={(e) => set("specialPrice", e.target.value)}
            />
            <Input
              label="Minimum Sale Price"
              value={form.minimumSalePrice}
              error={fieldErrors.minimumSalePrice}
              onChange={(e) => set("minimumSalePrice", e.target.value)}
            />
          </div>
        </Card>

        <Card title="Specifications">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Input label="Size" value={form.size} onChange={(e) => set("size", e.target.value)} />
            <Input label="Color" value={form.color} onChange={(e) => set("color", e.target.value)} />
            <Input label="Watt" value={form.watt} onChange={(e) => set("watt", e.target.value)} />
            <Input label="Voltage" value={form.voltage} onChange={(e) => set("voltage", e.target.value)} />
            <Input label="Material" value={form.material} onChange={(e) => set("material", e.target.value)} />
          </div>
        </Card>

        <Card title="Description">
          <div className="space-y-4">
            <Input label="Short Description" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
            <Input label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </Card>

        <Card
          title="Product image"
          description={
            isNew
              ? "Choose a photo now — it uploads automatically when you create the product and shows in POS."
              : "Primary image appears on POS product tiles after save."
          }
        >
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--erp-border)] bg-[var(--erp-surface-muted)]">
              {pendingPreview ? (
                <img src={pendingPreview} alt="Pending product" className="h-full w-full object-cover" />
              ) : imageMedia[0] && mediaPreviewUrls[String(imageMedia[0].id)] ? (
                <img
                  src={mediaPreviewUrls[String(imageMedia[0].id)]}
                  alt={String(imageMedia[0].file_name ?? "Product")}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-4 text-center text-sm text-[var(--erp-muted)]">No image yet</span>
              )}
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--erp-muted)]">Upload image (JPG, PNG, WebP)</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadMedia(file, "image");
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              {!isNew && imageMedia.length > 1 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {imageMedia.slice(1).map((item) => {
                    const preview = mediaPreviewUrls[String(item.id)];
                    return (
                      <div
                        key={String(item.id)}
                        className="aspect-square overflow-hidden rounded border border-[var(--erp-border)] bg-[var(--erp-surface-muted)]"
                      >
                        {preview ? (
                          <img src={preview} alt={String(item.file_name)} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center px-1 text-xs text-[var(--erp-muted)]">
                            {String(item.file_name)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        {!isNew && id ? (
          <Card title="Other media" description="Datasheets, manuals, and videos (optional).">
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["video", "Product video"],
                  ["datasheet", "Datasheet PDF"],
                  ["manual", "Installation manual"],
                  ["spec_sheet", "Specification sheet"],
                ] as const
              ).map(([type, label]) => (
                <label key={type} className="block text-sm">
                  <span className="mb-1 block text-[var(--erp-muted)]">{label}</span>
                  <input
                    type="file"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadMedia(file, type);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {media
                .filter((m) => String(m.media_type) !== "image")
                .map((m) => (
                  <li key={String(m.id)}>
                    {String(m.media_type)} — {String(m.file_name)}
                  </li>
                ))}
              {!media.some((m) => String(m.media_type) !== "image") ? (
                <li className="text-[var(--erp-muted)]">No documents uploaded yet.</li>
              ) : null}
            </ul>
          </Card>
        ) : null}

        <FormActions>
          <Button type="submit" loading={saving} disabled={saving}>
            {isNew ? "Create product" : "Save changes"}
          </Button>
        </FormActions>
      </Form>
    </div>
  );
}
