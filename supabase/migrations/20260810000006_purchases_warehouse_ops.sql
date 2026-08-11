-- Phase 6: Purchases + warehouse locations + transfers + delivery

insert into public.permissions (key, module, action, description) values
  ('purchases.read', 'purchases', 'read', 'View purchases'),
  ('purchases.write', 'purchases', 'write', 'Create purchase invoices'),
  ('purchases.return', 'purchases', 'return', 'Purchase returns'),
  ('purchases.prices', 'purchases', 'prices', 'Supplier price engine'),
  ('transfers.approve', 'inventory', 'approve_transfer', 'Approve stock transfers'),
  ('transfers.dispatch', 'inventory', 'dispatch_transfer', 'Dispatch stock transfers'),
  ('transfers.receive', 'inventory', 'receive_transfer', 'Receive stock transfers'),
  ('deliveries.manage', 'deliveries', 'manage', 'Manage delivery orders')
on conflict (key) do nothing;

-- Warehouse types (extend existing warehouses)
alter table public.warehouses
  add column if not exists warehouse_type text not null default 'branch'
    check (warehouse_type in ('main','branch','store','transit'));

-- Location hierarchy: Warehouse → Rack → Shelf → Bin
create table if not exists public.warehouse_racks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (warehouse_id, code)
);

create table if not exists public.warehouse_shelves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  rack_id uuid not null references public.warehouse_racks(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (rack_id, code)
);

create table if not exists public.warehouse_bins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  shelf_id uuid not null references public.warehouse_shelves(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (shelf_id, code)
);

-- Purchases
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  supplier_id uuid not null references public.suppliers(id),
  invoice_number text not null,
  invoice_date date not null default (current_date),
  status text not null default 'posted'
    check (status in ('draft','posted','partial_return','returned','void')),
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  tax_total numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  paid_total numeric(18,2) not null default 0,
  remaining_total numeric(18,2) not null default 0,
  due_date date,
  notes text,
  idempotency_key uuid not null,
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, idempotency_key),
  unique (organization_id, invoice_number)
);

create index if not exists purchases_supplier_idx on public.purchases (supplier_id, invoice_date desc);
create index if not exists purchases_branch_idx on public.purchases (branch_id, created_at desc);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  batch_code text,
  expiry_date date,
  bin_id uuid references public.warehouse_bins(id),
  created_at timestamptz not null default now(),
  unique (purchase_id, line_no)
);

-- Supplier price engine
create table if not exists public.supplier_product_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  supplier_id uuid not null references public.suppliers(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  last_purchase_rate numeric(18,2) not null default 0,
  average_purchase_rate numeric(18,2) not null default 0,
  supplier_price numeric(18,2) not null default 0,
  purchase_count integer not null default 0,
  last_purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create unique index if not exists supplier_product_prices_uidx
  on public.supplier_product_prices (
    organization_id,
    supplier_id,
    product_id,
    (coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

create table if not exists public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  supplier_id uuid not null references public.suppliers(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  purchase_id uuid references public.purchases(id),
  unit_cost numeric(18,2) not null,
  qty numeric(18,4) not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists supplier_price_history_product_idx
  on public.supplier_price_history (product_id, occurred_at desc);

-- Purchase returns
create table if not exists public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  original_purchase_id uuid not null references public.purchases(id),
  supplier_id uuid not null references public.suppliers(id),
  return_number text not null,
  reason text not null,
  refund_amount numeric(18,2) not null default 0,
  status text not null default 'posted'
    check (status in ('draft','posted','void')),
  idempotency_key uuid not null,
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1,
  unique (organization_id, idempotency_key),
  unique (organization_id, return_number)
);

create table if not exists public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  purchase_return_id uuid not null references public.purchase_returns(id) on delete cascade,
  original_purchase_item_id uuid references public.purchase_items(id),
  product_id uuid not null references public.products(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  unit_cost numeric(18,2) not null,
  line_total numeric(18,2) not null,
  created_at timestamptz not null default now()
);

-- Stock transfers lifecycle
create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  transfer_number text not null,
  source_warehouse_id uuid not null references public.warehouses(id),
  destination_warehouse_id uuid not null references public.warehouses(id),
  status text not null default 'requested'
    check (status in ('requested','approved','dispatched','in_transit','received','cancelled')),
  requested_by uuid,
  approved_by uuid,
  dispatched_by uuid,
  received_by uuid,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  dispatched_at timestamptz,
  received_at timestamptz,
  notes text,
  idempotency_key uuid not null,
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (organization_id, transfer_number),
  unique (organization_id, idempotency_key),
  check (source_warehouse_id <> destination_warehouse_id)
);

create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  created_at timestamptz not null default now(),
  unique (transfer_id, line_no)
);

-- Delivery orders
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid references public.warehouses(id),
  delivery_number text not null,
  sale_id uuid references public.sales(id),
  customer_id uuid references public.customers(id),
  address text,
  mobile text,
  delivery_boy_user_id uuid,
  expected_date date,
  status text not null default 'pending'
    check (status in ('pending','packed','dispatched','delivered','cancelled','returned')),
  notes text,
  idempotency_key uuid not null,
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  packed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1,
  unique (organization_id, delivery_number),
  unique (organization_id, idempotency_key)
);

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  created_at timestamptz not null default now(),
  unique (delivery_id, line_no)
);

-- RLS
alter table public.warehouse_racks enable row level security;
alter table public.warehouse_shelves enable row level security;
alter table public.warehouse_bins enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_product_prices enable row level security;
alter table public.supplier_price_history enable row level security;
alter table public.purchase_returns enable row level security;
alter table public.purchase_return_items enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;

create policy warehouse_racks_org on public.warehouse_racks for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy warehouse_shelves_org on public.warehouse_shelves for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy warehouse_bins_org on public.warehouse_bins for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy purchases_org on public.purchases for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy purchase_items_org on public.purchase_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy supplier_product_prices_org on public.supplier_product_prices for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy supplier_price_history_org on public.supplier_price_history for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy purchase_returns_org on public.purchase_returns for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy purchase_return_items_org on public.purchase_return_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_transfers_org on public.stock_transfers for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_transfer_items_org on public.stock_transfer_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy deliveries_org on public.deliveries for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy delivery_items_org on public.delivery_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
