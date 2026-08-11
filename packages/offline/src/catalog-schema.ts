/** Offline SQLite mirror of product master operational subset. */
export const OFFLINE_CATALOG_SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ur TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS product_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol_places INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS unit_conversions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_id TEXT,
  from_unit_id TEXT NOT NULL,
  to_unit_id TEXT NOT NULL,
  factor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_code TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ur TEXT,
  category_id TEXT,
  subcategory_id TEXT,
  brand_id TEXT,
  company_id TEXT,
  product_type_id TEXT,
  model_id TEXT,
  base_unit_id TEXT NOT NULL,
  warranty_days INTEGER NOT NULL DEFAULT 0,
  reorder_level TEXT NOT NULL DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'active',
  is_active INTEGER NOT NULL DEFAULT 1,
  cost_price TEXT NOT NULL DEFAULT '0',
  retail_price TEXT NOT NULL DEFAULT '0',
  wholesale_price TEXT NOT NULL DEFAULT '0',
  dealer_price TEXT NOT NULL DEFAULT '0',
  special_price TEXT,
  minimum_sale_price TEXT NOT NULL DEFAULT '0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  origin_device_id TEXT,
  last_synced_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS products_org_sku_uidx ON products(organization_id, sku) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS barcodes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  code TEXT NOT NULL,
  code_type TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS barcodes_org_code_uidx ON barcodes(organization_id, code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS attribute_definitions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS product_attributes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  attribute_definition_id TEXT NOT NULL,
  value_text TEXT,
  value_number TEXT,
  value_boolean INTEGER
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
`;
