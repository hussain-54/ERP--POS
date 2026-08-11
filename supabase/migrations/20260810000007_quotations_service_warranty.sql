-- Phase 7: Quotations → Sales Orders → Invoice + Service/Repair + Warranty claims

insert into public.permissions (key, module, action, description) values
  ('quotations.read', 'quotations', 'read', 'View quotations'),
  ('quotations.write', 'quotations', 'write', 'Create and convert quotations'),
  ('orders.read', 'orders', 'read', 'View sales orders'),
  ('orders.write', 'orders', 'write', 'Create and convert sales orders'),
  ('service.manage', 'service', 'manage', 'Manage service job cards'),
  ('warranty.manage', 'warranty', 'manage', 'Manage warranty claims and replacements')
on conflict (key) do nothing;

-- Quotations
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  quotation_number text not null,
  customer_id uuid references public.customers(id),
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','converted_to_order','expired','cancelled')),
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  tax_total numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  validity_date date,
  terms text,
  notes text,
  converted_order_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, quotation_number),
  unique (organization_id, idempotency_key)
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (quotation_id, line_no)
);

-- Sales orders
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid references public.warehouses(id),
  order_number text not null,
  customer_id uuid references public.customers(id),
  quotation_id uuid references public.quotations(id),
  status text not null default 'draft'
    check (status in ('draft','confirmed','converted_to_invoice','cancelled')),
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  tax_total numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  notes text,
  converted_sale_id uuid references public.sales(id),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, order_number),
  unique (organization_id, idempotency_key)
);

alter table public.quotations
  drop constraint if exists quotations_converted_order_id_fkey;
alter table public.quotations
  add constraint quotations_converted_order_id_fkey
  foreign key (converted_order_id) references public.sales_orders(id);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  line_no integer not null,
  product_id uuid not null references public.products(id),
  variant_id uuid references public.product_variants(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (sales_order_id, line_no)
);

-- Service / repair job cards
create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid references public.warehouses(id),
  job_number text not null,
  customer_id uuid references public.customers(id),
  product_id uuid references public.products(id),
  serial_number_id uuid references public.stock_serials(id),
  serial_code text,
  sale_id uuid references public.sales(id),
  sale_warranty_id uuid references public.sale_warranties(id),
  under_warranty boolean not null default false,
  complaint text not null,
  issue_found text,
  received_date date not null default (current_date),
  technician_user_id uuid,
  repair_cost numeric(18,2) not null default 0,
  service_charges numeric(18,2) not null default 0,
  status text not null default 'received'
    check (status in ('received','diagnosis','repairing','ready','delivered','cancelled')),
  notes text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1,
  unique (organization_id, job_number),
  unique (organization_id, idempotency_key)
);

create table if not exists public.service_job_parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  service_job_id uuid not null references public.service_jobs(id) on delete cascade,
  product_id uuid not null references public.products(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  unit_cost numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  stock_consumed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Warranty claims (linked to original sale warranty)
create table if not exists public.warranty_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  claim_number text not null,
  sale_warranty_id uuid not null references public.sale_warranties(id),
  sale_id uuid not null references public.sales(id),
  customer_id uuid references public.customers(id),
  product_id uuid references public.products(id),
  serial_number_id uuid references public.stock_serials(id),
  claim_type text not null check (claim_type in ('repair','replacement')),
  status text not null default 'open'
    check (status in ('open','approved','in_progress','resolved','rejected','cancelled')),
  description text not null,
  service_job_id uuid references public.service_jobs(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1,
  unique (organization_id, claim_number)
);

create table if not exists public.warranty_replacements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  warranty_claim_id uuid not null references public.warranty_claims(id) on delete cascade,
  sale_warranty_id uuid not null references public.sale_warranties(id),
  old_product_id uuid references public.products(id),
  old_serial_number_id uuid references public.stock_serials(id),
  new_product_id uuid not null references public.products(id),
  new_serial_number_id uuid references public.stock_serials(id),
  warehouse_id uuid not null references public.warehouses(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists quotations_customer_idx on public.quotations (customer_id, created_at desc);
create index if not exists sales_orders_customer_idx on public.sales_orders (customer_id, created_at desc);
create index if not exists service_jobs_status_idx on public.service_jobs (status, received_date desc);
create index if not exists warranty_claims_sale_idx on public.warranty_claims (sale_id);

-- RLS
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.service_jobs enable row level security;
alter table public.service_job_parts enable row level security;
alter table public.warranty_claims enable row level security;
alter table public.warranty_replacements enable row level security;

create policy quotations_org on public.quotations for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy quotation_items_org on public.quotation_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sales_orders_org on public.sales_orders for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sales_order_items_org on public.sales_order_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy service_jobs_org on public.service_jobs for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy service_job_parts_org on public.service_job_parts for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy warranty_claims_org on public.warranty_claims for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy warranty_replacements_org on public.warranty_replacements for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
