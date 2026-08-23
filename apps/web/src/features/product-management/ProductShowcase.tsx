import type { ProductMaster } from "@electronic-erp/contracts";
import { Badge, Card } from "@electronic-erp/ui";
import { labelForOption, money, type TaxonomyOption } from "./product-form-state";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-[var(--erp-border)] py-2.5 sm:grid-cols-[180px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--erp-ink)]">{value || "—"}</dd>
    </div>
  );
}

export function ProductShowcase({
  product,
  units,
  categories,
  subcategories,
  brands,
  companies,
  imageUrl,
  primaryBarcode,
}: {
  product: ProductMaster;
  units: TaxonomyOption[];
  categories: TaxonomyOption[];
  subcategories: TaxonomyOption[];
  brands: TaxonomyOption[];
  companies: TaxonomyOption[];
  imageUrl?: string | null;
  primaryBarcode?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <Card className="overflow-hidden p-0">
        <div className="aspect-square max-h-[min(60vw,20rem)] bg-[var(--erp-surface-muted)] sm:max-h-none">
          {imageUrl ? (
            <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--erp-muted)]">
              No product image
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <Badge tone={product.isActive ? "success" : "neutral"}>{product.status}</Badge>
          <p className="text-xs text-[var(--erp-muted)]">SKU {product.sku}</p>
          <p className="text-xs text-[var(--erp-muted)]">Code {product.productCode}</p>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Identity">
          <dl>
            <Row label="Business / product name" value={product.name} />
            <Row label="Urdu name" value={product.nameUr ?? ""} />
            <Row label="Primary barcode" value={primaryBarcode ?? ""} />
          </dl>
        </Card>

        <Card title="Business & classification">
          <dl>
            <Row label="Company" value={labelForOption(companies, product.companyId)} />
            <Row label="Brand" value={labelForOption(brands, product.brandId)} />
            <Row label="Category" value={labelForOption(categories, product.categoryId)} />
            <Row label="Subcategory" value={labelForOption(subcategories, product.subcategoryId)} />
            <Row label="Base unit" value={labelForOption(units, product.baseUnitId)} />
            <Row label="Warranty" value={`${product.warrantyDays} days`} />
          </dl>
        </Card>

        <Card title="Pricing">
          <dl>
            <Row label="Cost" value={money(product.costPrice)} />
            <Row label="Retail" value={money(product.retailPrice)} />
            <Row label="Wholesale" value={money(product.wholesalePrice)} />
            <Row label="Dealer" value={money(product.dealerPrice)} />
            <Row label="Special" value={product.specialPrice == null ? "—" : money(product.specialPrice)} />
            <Row label="Minimum sale" value={money(product.minimumSalePrice)} />
            <Row label="Expected profit" value={money(product.expectedProfit)} />
            <Row label="Margin" value={`${product.profitMarginPercent ?? 0}%`} />
          </dl>
        </Card>

        <Card title="Inventory tracking">
          <dl>
            <Row label="Track inventory" value={product.trackInventory ? "Yes" : "No"} />
            <Row label="Track serial" value={product.trackSerial ? "Yes" : "No"} />
            <Row label="Track batch" value={product.trackBatch ? "Yes" : "No"} />
            <Row label="Reorder level" value={String(product.reorderLevel ?? 0)} />
          </dl>
        </Card>

        <Card title="Description">
          <dl>
            <Row label="Short description" value={product.shortDescription ?? ""} />
            <Row label="Full description" value={product.description ?? ""} />
          </dl>
        </Card>
      </div>
    </div>
  );
}
