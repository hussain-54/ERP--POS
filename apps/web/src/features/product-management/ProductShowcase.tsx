import type { ReactNode } from "react";
import type { ProductMaster, ProductSpecifications, ProductStockSummary } from "@electronic-erp/contracts";
import { Badge, Card } from "@electronic-erp/ui";
import { BarcodeStrip } from "./BarcodeStrip";
import {
  formatCurrency,
  resolveDiscountAmount,
  resolveMarginPercent,
  resolveSalePrice,
  specialIsActive,
  statusTone,
} from "./product-display-utils";
import { labelForOption, money, type TaxonomyOption } from "./product-form-state";

function Row({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="grid gap-1 border-b border-[var(--erp-border)] py-2.5 last:border-0 sm:grid-cols-[180px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--erp-ink)]">{value}</dd>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card title={title}>
      <dl>{children}</dl>
    </Card>
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
  galleryUrls,
  primaryBarcode,
  stock,
  specifications,
}: {
  product: ProductMaster;
  units: TaxonomyOption[];
  categories: TaxonomyOption[];
  subcategories: TaxonomyOption[];
  brands: TaxonomyOption[];
  companies: TaxonomyOption[];
  imageUrl?: string | null;
  galleryUrls?: string[];
  primaryBarcode?: string;
  stock?: ProductStockSummary | null;
  specifications?: ProductSpecifications | null;
}) {
  const sale = resolveSalePrice(product);
  const discount = resolveDiscountAmount(product);
  const margin = resolveMarginPercent(product);
  const promo = specialIsActive(product);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card className="overflow-hidden p-0">
          <div className="aspect-square max-h-[min(70vw,22rem)] bg-[var(--erp-surface-muted)] lg:max-h-none">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm text-[var(--erp-muted)]">
                No product image
              </div>
            )}
          </div>
          <div className="space-y-2 border-t border-[var(--erp-border)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(product)}>{product.status}</Badge>
              {promo ? <Badge tone="brand">On promotion</Badge> : null}
            </div>
            <p className="font-mono text-xs text-[var(--erp-muted)]">SKU {product.sku}</p>
            {primaryBarcode ? (
              <div className="pt-1">
                <BarcodeStrip value={primaryBarcode} />
              </div>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <SectionCard title="Basic information">
            <Row label="Product name" value={product.name} />
            <Row label="Urdu name" value={product.nameUr ?? ""} />
            <Row label="Short description" value={product.shortDescription ?? ""} />
            <Row label="Description" value={product.description ?? ""} />
            <Row label="Status" value={product.status} />
          </SectionCard>

          <SectionCard title="Identification">
            <Row label="SKU" value={product.sku} />
            <Row label="Product code" value={product.productCode} />
            <Row label="Primary barcode" value={primaryBarcode ?? ""} />
          </SectionCard>

          <SectionCard title="Classification">
            <Row label="Category" value={labelForOption(categories, product.categoryId)} />
            <Row label="Subcategory" value={labelForOption(subcategories, product.subcategoryId)} />
            <Row label="Brand" value={labelForOption(brands, product.brandId)} />
          </SectionCard>

          <SectionCard title="Business information">
            <Row label="Company" value={labelForOption(companies, product.companyId)} />
          </SectionCard>

          <SectionCard title="Pricing">
            <Row label="Cost price" value={formatCurrency(product.costPrice)} />
            <Row label="Wholesale price" value={formatCurrency(product.wholesalePrice)} />
            <Row label="Retail price" value={formatCurrency(product.retailPrice)} />
            <Row label="Sale price" value={formatCurrency(sale)} />
            {discount > 0 ? <Row label="Discount" value={`−${formatCurrency(discount)}`} /> : null}
            <Row label="Dealer price" value={formatCurrency(product.dealerPrice)} />
            <Row label="Minimum sale price" value={formatCurrency(product.minimumSalePrice)} />
            {product.specialPrice != null ? (
              <Row label="Special / promo price" value={formatCurrency(product.specialPrice)} />
            ) : null}
            <Row label="Expected profit" value={money(product.expectedProfit)} />
            <Row label="Margin" value={margin != null ? `${margin.toFixed(1)}%` : ""} />
          </SectionCard>

          <SectionCard title="Inventory">
            {stock ? (
              <>
                <Row label="Stock on hand" value={String(stock.stockOnHand)} />
                <Row label="Available stock" value={String(stock.stockAvailable)} />
                <Row label="Reserved stock" value={String(stock.stockReserved)} />
                <Row label="Reorder level" value={String(stock.reorderLevel)} />
              </>
            ) : null}
            <Row label="Track inventory" value={product.trackInventory ? "Yes" : "No"} />
            <Row label="Track serial" value={product.trackSerial ? "Yes" : "No"} />
            <Row label="Track batch" value={product.trackBatch ? "Yes" : "No"} />
            <Row label="Unit" value={labelForOption(units, product.baseUnitId)} />
            <Row label="Reorder level (master)" value={String(product.reorderLevel ?? 0)} />
            <Row label="Warranty" value={`${product.warrantyDays} days`} />
          </SectionCard>

          {promo ? (
            <SectionCard title="Promotions">
              <Row label="Active promotion" value="Special price configured" />
              <Row label="Promo price" value={formatCurrency(product.specialPrice)} />
              <Row label="Retail reference" value={formatCurrency(product.retailPrice)} />
            </SectionCard>
          ) : null}
        </div>
      </div>

      {galleryUrls && galleryUrls.length > 1 ? (
        <SectionCard title="Media gallery">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {galleryUrls.map((url) => (
              <img
                key={url}
                src={url}
                alt=""
                className="aspect-square rounded-md border border-[var(--erp-border)] object-cover"
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {specifications ? (
        <SectionCard title="Specifications">
          <Row label="Size" value={specifications.size ?? ""} />
          <Row label="Color" value={specifications.color ?? ""} />
          <Row label="Watt" value={specifications.watt ?? ""} />
          <Row label="Voltage" value={specifications.voltage ?? ""} />
          <Row label="Ampere" value={specifications.ampere ?? ""} />
          <Row label="Material" value={specifications.material ?? ""} />
          <Row label="Length" value={specifications.length ?? ""} />
          <Row label="Width" value={specifications.width ?? ""} />
          <Row label="Height" value={specifications.height ?? ""} />
          <Row label="Weight" value={specifications.weight ?? ""} />
          <Row label="Gauge" value={specifications.gauge ?? ""} />
          <Row label="Phase" value={specifications.phase ?? ""} />
          <Row label="Frequency" value={specifications.frequency ?? ""} />
          <Row label="Capacity" value={specifications.capacity ?? ""} />
          <Row label="Model label" value={specifications.modelLabel ?? ""} />
        </SectionCard>
      ) : null}
    </div>
  );
}
