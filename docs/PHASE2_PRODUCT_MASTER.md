# Phase 2 — Product Master Implementation

## Delivered

- Hierarchy CRUD: category, subcategory, brand, company, product type, model, unit, variant
- Product master fields (code/SKU/names/taxonomy/warranty/status/pricing/specs)
- Reusable custom attributes + technical specifications
- Units with decimal NUMERIC precision + product-specific conversions
- Pricing: cost/retail/wholesale/dealer/special/min + profit metrics
- Barcode/QR generation foundation + bulk generate API
- Media metadata API + Supabase Storage bucket/policies (`product-media`)
- Import/export CSV templates (products/customers/suppliers/stock/prices) with row errors
- Offline SQLite catalog schema + sync enqueue helpers (`enqueueProductUpsert`)
- Web UI: Products list/form, Taxonomy, Units/conversions/attributes, Import/Export

## Migration

Apply both (if not already):

1. `supabase/migrations/20260810000001_foundation.sql`
2. `supabase/migrations/20260810000002_product_master.sql`

## Web routes

- `/products`, `/products/new`, `/products/:id`
- `/categories` (taxonomy CRUD)
- `/units` (units, conversions, attributes)
- `/pricing` (price levels + customer-specific)
- `/barcodes` (generate / bulk / QR reprint)
- `/import-export` (templates + CSV import with row errors)

## API base

`/api/v1/catalog/*`

## Verify

```bash
npm run build:packages
npm run test:phase2
npm run typecheck --prefix apps/api
npm run typecheck --prefix apps/web
```

## Not in this phase

POS, scanning hardware UI, full Electron offline runtime packaging.
