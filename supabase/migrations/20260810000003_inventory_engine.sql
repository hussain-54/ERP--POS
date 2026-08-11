-- Phase 3: Inventory Engine — ledger, balances, batch/serial, adjustments, counts, reservations

insert into public.permissions (key, module, action, description) values
  ('inventory.view', 'inventory', 'view', 'View stock balances and ledger'),
  ('inventory.adjust', 'inventory', 'adjust', 'Create stock adjustments'),
  ('inventory.approve_adjust', 'inventory', 'approve_adjust', 'Approve stock adjustments'),
  ('inventory.count', 'inventory', 'count', 'Run stock counts'),
  ('inventory.approve_count', 'inventory', 'approve_count', 'Approve stock counts'),
  ('inventory.reserve', 'inventory', 'reserve', 'Reserve / release stock'),
  ('inventory.serial', 'inventory', 'serial', 'Manage serial numbers'),
  ('inventory.batch', 'inventory', 'batch', 'Manage batches'),
  ('inventory.transfer', 'inventory', 'transfer', 'Stock transfers'),
  ('warehouses.manage', 'warehouses', 'manage', 'Manage warehouses')
on conflict (key) do nothing;

-- Warehouses
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  code text not null,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  allow_negative_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create index if not exists warehouses_branch_idx on public.warehouses (branch_id) where deleted_at is null;

-- Costing methodology (configurable; not hardcoded to one method)
create table if not exists public.inventory_costing_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  costing_method text not null default 'moving_average'
    check (costing_method in ('moving_average','fifo','lifo','specific','standard')),
  currency text not null default 'PKR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (organization_id)
);

-- Immutable stock ledger (source of truth for quantity changes)
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid,
  serial_number_id uuid,
  unit_id uuid not null references public.units(id),
  movement_type text not null check (movement_type in (
    'opening','purchase','sale','sale_return','purchase_return','damage',
    'adjustment','transfer_out','transfer_in','stock_count',
    'reservation','release_reservation','warranty_replacement','repair_consumption'
  )),
  qty_delta numeric(18,4) not null,
  qty_before numeric(18,4) not null,
  qty_after numeric(18,4) not null,
  unit_cost numeric(18,4),
  source_type text not null,
  source_id uuid not null,
  reason text,
  occurred_at timestamptz not null default now(),
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  created_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1,
  -- immutable: no updated_at / deleted_at
  unique (organization_id, operation_id)
);

create index if not exists stock_movements_product_idx
  on public.stock_movements (organization_id, product_id, occurred_at desc);
create index if not exists stock_movements_warehouse_idx
  on public.stock_movements (warehouse_id, occurred_at desc);
create index if not exists stock_movements_source_idx
  on public.stock_movements (source_type, source_id);

-- Balance projection (never authoritative alone)
create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  qty_on_hand numeric(18,4) not null default 0,
  qty_reserved numeric(18,4) not null default 0,
  qty_damaged numeric(18,4) not null default 0,
  qty_in_transit numeric(18,4) not null default 0,
  reorder_level numeric(18,4) not null default 0,
  overstock_level numeric(18,4),
  average_unit_cost numeric(18,4) not null default 0,
  last_movement_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create unique index if not exists stock_balances_unique_slot
  on public.stock_balances (warehouse_id, product_id, (coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)));

create index if not exists stock_balances_org_product_idx
  on public.stock_balances (organization_id, product_id);

-- Batches
create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_number text not null,
  manufacturing_date date,
  expiry_date date,
  warranty_start date,
  warranty_end date,
  qty_on_hand numeric(18,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, product_id, batch_number)
);

alter table public.stock_movements
  drop constraint if exists stock_movements_batch_id_fkey;
alter table public.stock_movements
  add constraint stock_movements_batch_id_fkey
  foreign key (batch_id) references public.stock_batches(id);

-- Serial numbers
create table if not exists public.stock_serials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.stock_batches(id),
  serial_number text not null,
  status text not null default 'in_stock'
    check (status in ('in_stock','reserved','sold','damaged','in_transit','returned','scrapped')),
  warehouse_id uuid references public.warehouses(id),
  manufacturing_date date,
  expiry_date date,
  warranty_start date,
  warranty_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, serial_number)
);

alter table public.stock_movements
  drop constraint if exists stock_movements_serial_number_id_fkey;
alter table public.stock_movements
  add constraint stock_movements_serial_number_id_fkey
  foreign key (serial_number_id) references public.stock_serials(id);

create table if not exists public.stock_serial_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  serial_id uuid not null references public.stock_serials(id),
  stock_movement_id uuid not null references public.stock_movements(id),
  from_status text,
  to_status text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid
);

-- Adjustment requests (approval workflow)
create table if not exists public.stock_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid not null references public.units(id),
  qty_before numeric(18,4) not null,
  qty_after numeric(18,4) not null,
  qty_difference numeric(18,4) not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','posted')),
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  posted_movement_id uuid references public.stock_movements(id),
  requires_approval boolean not null default true,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (organization_id, idempotency_key)
);

-- Stock count sessions
create table if not exists public.stock_count_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  code text not null,
  status text not null default 'draft'
    check (status in ('draft','in_progress','submitted','approved','rejected','posted')),
  notes text,
  started_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  session_id uuid not null references public.stock_count_sessions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.stock_batches(id),
  serial_number text,
  barcode_scanned text,
  expected_qty numeric(18,4) not null default 0,
  counted_qty numeric(18,4) not null default 0,
  variance_qty numeric(18,4) not null default 0,
  unit_id uuid not null references public.units(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stock_count_lines_unique_slot
  on public.stock_count_lines (
    session_id,
    product_id,
    (coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    (coalesce(serial_number, ''))
  );

-- Reservations
create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.stock_batches(id),
  serial_id uuid references public.stock_serials(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  source_type text not null check (source_type in ('sale','order','quotation','delivery','b2b_order')),
  source_id uuid not null,
  status text not null default 'active'
    check (status in ('active','released','consumed','expired')),
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  expires_at timestamptz,
  reserve_movement_id uuid references public.stock_movements(id),
  release_movement_id uuid references public.stock_movements(id),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index if not exists stock_reservations_source_idx
  on public.stock_reservations (source_type, source_id) where status = 'active';

-- Cost layers for FIFO/LIFO/specific (architecture support)
create table if not exists public.inventory_cost_layers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  batch_id uuid references public.stock_batches(id),
  qty_remaining numeric(18,4) not null check (qty_remaining >= 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  received_at timestamptz not null default now(),
  source_movement_id uuid references public.stock_movements(id),
  created_at timestamptz not null default now(),
  version integer not null default 1
);

-- RLS
alter table public.warehouses enable row level security;
alter table public.inventory_costing_settings enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_batches enable row level security;
alter table public.stock_serials enable row level security;
alter table public.stock_serial_movements enable row level security;
alter table public.stock_adjustment_requests enable row level security;
alter table public.stock_count_sessions enable row level security;
alter table public.stock_count_lines enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.inventory_cost_layers enable row level security;

create policy warehouses_org on public.warehouses for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy inventory_costing_settings_org on public.inventory_costing_settings for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_movements_org on public.stock_movements for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_balances_org on public.stock_balances for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_batches_org on public.stock_batches for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_serials_org on public.stock_serials for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_serial_movements_org on public.stock_serial_movements for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_adjustment_requests_org on public.stock_adjustment_requests for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_count_sessions_org on public.stock_count_sessions for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_count_lines_org on public.stock_count_lines for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy stock_reservations_org on public.stock_reservations for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy inventory_cost_layers_org on public.inventory_cost_layers for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
