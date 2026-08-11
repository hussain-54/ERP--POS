import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { catalogApi } from "./catalog-api";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthContext";

type Option = { value: string; label: string };

export function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const toast = useToast();
  const { organizationId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [media, setMedia] = useState<Array<Record<string, unknown>>>([]);
  const [uploading, setUploading] = useState(false);
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

  async function uploadMedia(file: File, mediaType: string) {
    if (!id || isNew) {
      toast.push({ title: "Save the product first", tone: "danger" });
      return;
    }
    setUploading(true);
    try {
      if (!organizationId) throw new Error("Missing organization context");
      const path = `${organizationId}/${id}/${Date.now()}-${file.name}`;
      const supabase = getSupabase();
      const { error } = await supabase.storage.from("product-media").upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      await catalogApi.registerMedia(id, {
        mediaType,
        storagePath: path,
        fileName: file.name,
        mimeType: file.type || undefined,
        fileSize: file.size,
        isPrimary: mediaType === "image" && media.length === 0,
      });
      const mediaRes = await catalogApi.listMedia(id);
      setMedia(mediaRes.items);
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

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        productCode: form.productCode,
        sku: form.sku,
        name: form.name,
        nameUr: form.nameUr || undefined,
        shortDescription: form.shortDescription || undefined,
        description: form.description || undefined,
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
        primaryBarcode: form.primaryBarcode || undefined,
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
        toast.push({ title: "Product created", tone: "success" });
        navigate(`/products/${created.id}`);
      } else if (id) {
        await catalogApi.updateProduct(id, payload);
        toast.push({ title: "Product updated", tone: "success" });
        await catalogApi.generateBarcode(id).catch(() => undefined);
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{isNew ? "New product" : "Edit product"}</h1>
        <Link className="text-sm text-[var(--erp-brand)] underline" to="/products">
          Back to list
        </Link>
      </div>

      <Card>
        <Form onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Product Code" required value={form.productCode} onChange={(e) => set("productCode", e.target.value)} />
            <Input label="SKU" required value={form.sku} onChange={(e) => set("sku", e.target.value)} />
            <Input label="Product Name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            <Input label="Urdu Product Name" value={form.nameUr} onChange={(e) => set("nameUr", e.target.value)} />
            <Select label="Base Unit" required options={units} value={form.baseUnitId} onChange={(e) => set("baseUnitId", e.target.value)} placeholder="Select unit" />
            <Select label="Category" options={categories} value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} placeholder="Optional" />
            <Select label="Brand" options={brands} value={form.brandId} onChange={(e) => set("brandId", e.target.value)} placeholder="Optional" />
            <Select label="Company" options={companies} value={form.companyId} onChange={(e) => set("companyId", e.target.value)} placeholder="Optional" />
            <Input label="Warranty (days)" value={form.warrantyDays} onChange={(e) => set("warrantyDays", e.target.value)} />
            <Input label="Primary Barcode" value={form.primaryBarcode} onChange={(e) => set("primaryBarcode", e.target.value)} />
            <Input label="Cost Price" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
            <Input label="Retail Price" value={form.retailPrice} onChange={(e) => set("retailPrice", e.target.value)} />
            <Input label="Wholesale Price" value={form.wholesalePrice} onChange={(e) => set("wholesalePrice", e.target.value)} />
            <Input label="Dealer Price" value={form.dealerPrice} onChange={(e) => set("dealerPrice", e.target.value)} />
            <Input label="Special Price" value={form.specialPrice} onChange={(e) => set("specialPrice", e.target.value)} />
            <Input label="Minimum Sale Price" value={form.minimumSalePrice} onChange={(e) => set("minimumSalePrice", e.target.value)} />
            <Input label="Size" value={form.size} onChange={(e) => set("size", e.target.value)} />
            <Input label="Color" value={form.color} onChange={(e) => set("color", e.target.value)} />
            <Input label="Watt" value={form.watt} onChange={(e) => set("watt", e.target.value)} />
            <Input label="Voltage" value={form.voltage} onChange={(e) => set("voltage", e.target.value)} />
            <Input label="Material" value={form.material} onChange={(e) => set("material", e.target.value)} />
          </div>
          <Input label="Short Description" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
          <Input label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
          <FormActions>
            <Button type="submit" loading={saving}>
              {isNew ? "Create product" : "Save changes"}
            </Button>
          </FormActions>
        </Form>
      </Card>

      {!isNew && id ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-medium">Media</h2>
          <p className="text-sm text-[var(--erp-muted)]">
            Images, video, datasheet, installation manual, and specification sheet (Supabase Storage).
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["image", "Product image"],
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
          <ul className="space-y-1 text-sm">
            {media.map((m) => (
              <li key={String(m.id)}>
                {String(m.media_type)} — {String(m.file_name)}
              </li>
            ))}
            {!media.length ? <li className="text-[var(--erp-muted)]">No media uploaded yet.</li> : null}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
