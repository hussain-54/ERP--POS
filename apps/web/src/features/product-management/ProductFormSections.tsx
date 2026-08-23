import { useMemo, useState } from "react";
import { Button, Card, Input, Select, Tabs } from "@electronic-erp/ui";
import type { ProductFormFieldErrors } from "./product-form-validation";
import type { ProductFormState, TaxonomyOption, SubcategoryOption } from "./product-form-state";

const FORM_TABS = [
  { id: "identity", label: "Identity" },
  { id: "business", label: "Business & taxonomy" },
  { id: "pricing", label: "Pricing" },
  { id: "inventory", label: "Inventory" },
  { id: "specs", label: "Specifications" },
  { id: "description", label: "Description" },
  { id: "media", label: "Media" },
] as const;

type FormTab = (typeof FORM_TABS)[number]["id"];

type InlineTaxonomy = "categories" | "companies" | "brands";

export function ProductFormSections({
  form,
  fieldErrors,
  onChange,
  units,
  categories,
  subcategories,
  brands,
  companies,
  onCreateTaxonomy,
  mediaSlot,
  showMediaTab = true,
}: {
  form: ProductFormState;
  fieldErrors: ProductFormFieldErrors;
  onChange: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  units: TaxonomyOption[];
  categories: TaxonomyOption[];
  subcategories: SubcategoryOption[];
  brands: TaxonomyOption[];
  companies: TaxonomyOption[];
  onCreateTaxonomy: (entity: InlineTaxonomy, name: string, code?: string) => Promise<string | undefined>;
  mediaSlot?: React.ReactNode;
  showMediaTab?: boolean;
}) {
  const [tab, setTab] = useState<FormTab>("identity");
  const [inline, setInline] = useState<InlineTaxonomy | null>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineCode, setInlineCode] = useState("");
  const [inlineBusy, setInlineBusy] = useState(false);

  const filteredSubcategories = useMemo(() => {
    if (!form.categoryId) return subcategories;
    return subcategories.filter((s) => s.categoryId === form.categoryId);
  }, [form.categoryId, subcategories]);

  const tabs = showMediaTab ? FORM_TABS : FORM_TABS.filter((t) => t.id !== "media");

  async function saveInline() {
    if (!inline || !inlineName.trim()) return;
    setInlineBusy(true);
    try {
      const id = await onCreateTaxonomy(inline, inlineName.trim(), inlineCode.trim() || undefined);
      if (inline === "categories" && id) onChange("categoryId", id);
      if (inline === "companies" && id) onChange("companyId", id);
      if (inline === "brands" && id) onChange("brandId", id);
      setInline(null);
      setInlineName("");
      setInlineCode("");
    } finally {
      setInlineBusy(false);
    }
  }

  function inlinePanel(entity: InlineTaxonomy, label: string) {
    if (inline !== entity) {
      return (
        <Button type="button" variant="secondary" onClick={() => setInline(entity)}>
          + Add {label.toLowerCase()}
        </Button>
      );
    }
    return (
      <div className="rounded-xl border border-[var(--erp-border)] p-3 space-y-2">
        <p className="text-sm font-medium">New {label.toLowerCase()}</p>
        <Input label="Name" value={inlineName} onChange={(e) => setInlineName(e.target.value)} />
        <Input
          label="Code"
          hint="Leave blank to auto-generate"
          value={inlineCode}
          onChange={(e) => setInlineCode(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={inlineBusy} onClick={() => void saveInline()}>
            Save {label.toLowerCase()}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setInline(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs items={[...tabs]} value={tab} onChange={(id) => setTab(id as FormTab)} />

      {tab === "identity" && (
        <Card title="Product identity" description="Codes and names used in search, barcode scan, and POS.">
          <div className="erp-form-grid grid gap-4 md:grid-cols-2">
            <Input
              label="Product code"
              required
              value={form.productCode}
              error={fieldErrors.productCode}
              onChange={(e) => onChange("productCode", e.target.value)}
            />
            <Input
              label="SKU"
              required
              value={form.sku}
              error={fieldErrors.sku}
              onChange={(e) => onChange("sku", e.target.value)}
            />
            <Input
              label="Business / product name"
              required
              hint="Primary name shown on invoices, receipts, and POS"
              value={form.name}
              error={fieldErrors.name}
              onChange={(e) => onChange("name", e.target.value)}
            />
            <Input label="Urdu name" value={form.nameUr} onChange={(e) => onChange("nameUr", e.target.value)} />
            <Input
              label="Primary barcode"
              value={form.primaryBarcode}
              onChange={(e) => onChange("primaryBarcode", e.target.value)}
            />
          </div>
        </Card>
      )}

      {tab === "business" && (
        <Card title="Business & taxonomy" description="Company, brand, and category for reporting and POS browse.">
          <div className="erp-form-grid grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Select
                label="Company"
                options={companies}
                value={form.companyId}
                onChange={(e) => onChange("companyId", e.target.value)}
                placeholder="Select company"
              />
              <p className="text-xs text-[var(--erp-muted)]">Manufacturer or business entity for this product</p>
              {inlinePanel("companies", "Company")}
            </div>
            <div className="space-y-2">
              <Select
                label="Brand"
                options={brands}
                value={form.brandId}
                onChange={(e) => onChange("brandId", e.target.value)}
                placeholder="Optional"
              />
              {inlinePanel("brands", "Brand")}
            </div>
            <div className="space-y-2">
              <Select
                label="Category"
                options={categories}
                value={form.categoryId}
                onChange={(e) => {
                  onChange("categoryId", e.target.value);
                  onChange("subcategoryId", "");
                }}
                placeholder="Optional"
              />
              {inlinePanel("categories", "Category")}
            </div>
            <Select
              label="Subcategory"
              options={filteredSubcategories}
              value={form.subcategoryId}
              onChange={(e) => onChange("subcategoryId", e.target.value)}
              placeholder="Optional"
            />
            <Select
              label="Base unit"
              required
              options={units}
              value={form.baseUnitId}
              error={fieldErrors.baseUnitId}
              onChange={(e) => onChange("baseUnitId", e.target.value)}
              placeholder="Select unit"
            />
            <Select
              label="Status"
              options={[
                { value: "active", label: "Active" },
                { value: "draft", label: "Draft" },
                { value: "inactive", label: "Inactive" },
              ]}
              value={form.status}
              onChange={(e) => onChange("status", e.target.value as ProductFormState["status"])}
            />
            <Input
              label="Warranty (days)"
              value={form.warrantyDays}
              error={fieldErrors.warrantyDays}
              onChange={(e) => onChange("warrantyDays", e.target.value)}
            />
          </div>
        </Card>
      )}

      {tab === "pricing" && (
        <Card title="Pricing" description="Retail price is shown on POS by default.">
          <div className="erp-form-grid grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["costPrice", "Cost price"],
                ["retailPrice", "Retail price"],
                ["wholesalePrice", "Wholesale price"],
                ["dealerPrice", "Dealer price"],
                ["specialPrice", "Special price"],
                ["minimumSalePrice", "Minimum sale price"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                label={label}
                value={form[key]}
                error={fieldErrors[key]}
                onChange={(e) => onChange(key, e.target.value)}
              />
            ))}
          </div>
        </Card>
      )}

      {tab === "inventory" && (
        <Card title="Inventory tracking">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Reorder level"
              value={form.reorderLevel}
              error={fieldErrors.reorderLevel}
              onChange={(e) => onChange("reorderLevel", e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.trackInventory}
                onChange={(e) => onChange("trackInventory", e.target.checked)}
              />
              Track inventory
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.trackSerial}
                onChange={(e) => onChange("trackSerial", e.target.checked)}
              />
              Track serial numbers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.trackBatch}
                onChange={(e) => onChange("trackBatch", e.target.checked)}
              />
              Track batches
            </label>
          </div>
        </Card>
      )}

      {tab === "specs" && (
        <Card title="Specifications">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(["size", "color", "watt", "voltage", "material"] as const).map((key) => (
              <Input
                key={key}
                label={key.charAt(0).toUpperCase() + key.slice(1)}
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--erp-muted)]">
            Specifications are persisted on create. Editing specifications after create depends on catalog API support.
          </p>
        </Card>
      )}

      {tab === "description" && (
        <Card title="Description">
          <div className="space-y-4">
            <Input
              label="Short description"
              value={form.shortDescription}
              onChange={(e) => onChange("shortDescription", e.target.value)}
            />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--erp-ink)]">Full description</span>
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-[var(--erp-border)] px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => onChange("description", e.target.value)}
              />
            </label>
          </div>
        </Card>
      )}

      {tab === "media" && showMediaTab && mediaSlot ? <div>{mediaSlot}</div> : null}
    </div>
  );
}
