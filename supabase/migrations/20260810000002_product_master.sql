-- Phase 2: Product Master + Units + Attributes + Pricing + Media + Barcodes

-- Permissions
insert into public.permissions (key, module, action, description) values
  ('products.read', 'products', 'read', 'View products'),
  ('products.write', 'products', 'write', 'Create/update products'),
  ('products.delete', 'products', 'delete', 'Deactivate products'),
  ('products.import', 'products', 'import', 'Import products'),
  ('products.export', 'products', 'export', 'Export products'),
  ('products.manage_media', 'products', 'manage_media', 'Manage product media'),
  ('catalog_taxonomy.manage', 'catalog_taxonomy', 'manage', 'Manage categories/brands/companies'),
  ('units.manage', 'units', 'manage', 'Manage units and conversions'),
  ('pricing.read', 'pricing', 'read', 'View prices'),
  ('pricing.write', 'pricing', 'write', 'Manage prices'),
  ('barcodes.manage', 'barcodes', 'manage', 'Manage barcodes/QR'),
  ('barcodes.print', 'barcodes', 'print', 'Print barcodes')
on conflict (key) do nothing;

-- Taxonomy
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  name_ur text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  category_id uuid not null references public.categories(id),
  code text not null,
  name text not null,
  name_ur text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  name_ur text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  name_ur text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  name_ur text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.product_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  brand_id uuid references public.brands(id),
  company_id uuid references public.companies(id),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

-- Units (NUMERIC for precision — never float)
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  symbol_places integer not null default 0 check (symbol_places >= 0 and symbol_places <= 4),
  is_base boolean not null default false,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid, -- null = org-wide; set for product-specific
  from_unit_id uuid not null references public.units(id),
  to_unit_id uuid not null references public.units(id),
  factor numeric(18,6) not null check (factor > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, product_id, from_unit_id, to_unit_id)
);

-- Attribute definitions (reusable)
create table if not exists public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  data_type text not null check (data_type in ('text','number','boolean','select')),
  unit_label text,
  options jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_code text not null,
  sku text not null,
  name text not null,
  name_ur text,
  short_description text,
  description text,
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  brand_id uuid references public.brands(id),
  company_id uuid references public.companies(id),
  product_type_id uuid references public.product_types(id),
  model_id uuid references public.product_models(id),
  base_unit_id uuid not null references public.units(id),
  warranty_days integer not null default 0 check (warranty_days >= 0),
  track_inventory boolean not null default true,
  track_serial boolean not null default false,
  track_batch boolean not null default false,
  reorder_level numeric(18,4) not null default 0,
  status text not null default 'active' check (status in ('draft','active','inactive')),
  is_active boolean not null default true,
  cost_price numeric(18,4) not null default 0,
  retail_price numeric(18,4) not null default 0,
  wholesale_price numeric(18,4) not null default 0,
  dealer_price numeric(18,4) not null default 0,
  special_price numeric(18,4),
  minimum_sale_price numeric(18,4) not null default 0,
  last_purchase_price numeric(18,4) not null default 0,
  average_purchase_price numeric(18,4) not null default 0,
  origin_device_id uuid,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, sku),
  unique (organization_id, product_code)
);

create index if not exists products_org_name_idx on public.products (organization_id, name) where deleted_at is null;
create index if not exists products_org_active_idx on public.products (organization_id, is_active) where deleted_at is null;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  name text not null,
  barcode text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, sku)
);

create table if not exists public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_definition_id uuid not null references public.attribute_definitions(id),
  value_text text,
  value_number numeric(18,6),
  value_boolean boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, attribute_definition_id)
);

create table if not exists public.price_levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id),
  price_level_id uuid references public.price_levels(id),
  customer_id uuid,
  branch_id uuid references public.branches(id),
  unit_id uuid not null references public.units(id),
  amount numeric(18,4) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create index if not exists product_prices_product_idx on public.product_prices (product_id) where deleted_at is null;

create table if not exists public.barcodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id),
  code text not null,
  code_type text not null default 'ean13' check (code_type in ('ean13','code128','sku','custom')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id),
  payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null check (media_type in ('image','video','datasheet','manual','spec_sheet')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create table if not exists public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  watt numeric(18,4),
  voltage numeric(18,4),
  ampere numeric(18,4),
  length numeric(18,4),
  width numeric(18,4),
  height numeric(18,4),
  material text,
  gauge text,
  phase text,
  frequency numeric(18,4),
  capacity text,
  model_label text,
  weight numeric(18,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

-- RLS
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.brands enable row level security;
alter table public.companies enable row level security;
alter table public.product_types enable row level security;
alter table public.product_models enable row level security;
alter table public.units enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_attributes enable row level security;
alter table public.price_levels enable row level security;
alter table public.product_prices enable row level security;
alter table public.barcodes enable row level security;
alter table public.qr_codes enable row level security;
alter table public.product_media enable row level security;
alter table public.product_specifications enable row level security;

create policy categories_org on public.categories for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy subcategories_org on public.subcategories for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy brands_org on public.brands for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy companies_org on public.companies for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy product_types_org on public.product_types for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy product_models_org on public.product_models for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy units_org on public.units for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy unit_conversions_org on public.unit_conversions for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy attribute_definitions_org on public.attribute_definitions for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy products_org on public.products for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy product_variants_org on public.product_variants for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy product_attributes_org on public.product_attributes for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy price_levels_org on public.price_levels for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy product_prices_org on public.product_prices for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy barcodes_org on public.barcodes for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy qr_codes_org on public.qr_codes for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy product_media_org on public.product_media for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy product_specifications_org on public.product_specifications for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());

-- Storage bucket (run-safe)
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', false)
on conflict (id) do nothing;

create policy product_media_storage_select on storage.objects
  for select using (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

create policy product_media_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

create policy product_media_storage_update on storage.objects
  for update using (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

create policy product_media_storage_delete on storage.objects
  for delete using (
    bucket_id = 'product-media'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );
