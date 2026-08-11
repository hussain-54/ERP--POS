-- Phase 5: Complete POS / Sales Engine

insert into public.permissions (key, module, action, description) values
  ('pos.sell', 'pos', 'sell', 'Operate POS and post sales'),
  ('pos.hold', 'pos', 'hold', 'Hold and resume bills'),
  ('pos.return', 'pos', 'return', 'Process returns and exchanges'),
  ('pos.discount_cashier', 'pos', 'discount_cashier', 'Apply cashier discounts up to 5%'),
  ('pos.discount_manager', 'pos', 'discount_manager', 'Apply manager discounts up to 15%'),
  ('pos.discount_owner', 'pos', 'discount_owner', 'Apply unlimited discounts'),
  ('pos.view_invoices', 'pos', 'view_invoices', 'View and reprint invoices'),
  ('pos.configure', 'pos', 'configure', 'Configure POS settings')
on conflict (key) do nothing;

-- Sales / invoices
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  invoice_number text not null,
  status text not null default 'draft'
    check (status in ('draft','held','posted','void','returned','exchanged')),
  pos_mode text not null default 'advanced' check (pos_mode in ('easy','advanced')),
  locale_mode text not null default 'en' check (locale_mode in ('en','ur','en_ur')),
  customer_id uuid references public.customers(id),
  salesman_user_id uuid,
  reference_name text,
  price_level_id uuid references public.price_levels(id),
  subtotal numeric(18,2) not null default 0,
  discount_total numeric(18,2) not null default 0,
  tax_total numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  paid_total numeric(18,2) not null default 0,
  remaining_total numeric(18,2) not null default 0,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','partial','paid','refunded')),
  due_date date,
  notes text,
  warranty_notes text,
  idempotency_key uuid not null,
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  held_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  version integer not null default 1,
  unique (organization_id, invoice_number),
  unique (organization_id, idempotency_key)
);

create index if not exists sales_branch_status_idx on public.sales (branch_id, status);
create index if not exists sales_customer_idx on public.sales (customer_id) where customer_id is not null;

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sale_id uuid not null references public.sales(id) on delete cascade,
  line_no integer not null,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  is_manual boolean not null default false,
  manual_name text,
  manual_item_code text,
  manual_description text,
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  discount_amount numeric(18,2) not null default 0,
  discount_percent numeric(8,4) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null,
  batch_id uuid references public.stock_batches(id),
  serial_number_id uuid references public.stock_serials(id),
  warranty_days integer not null default 0,
  cost_price numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (sale_id, line_no)
);

-- Discount audit (every discount creates a record)
create table if not exists public.sale_discount_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sale_id uuid not null references public.sales(id) on delete cascade,
  sale_item_id uuid references public.sale_items(id),
  discount_scope text not null check (discount_scope in ('item','invoice')),
  discount_kind text not null check (discount_kind in (
    'percentage','fixed','customer','wholesale','promotion','special'
  )),
  percent numeric(8,4),
  amount numeric(18,2) not null,
  approver_role text not null check (approver_role in ('cashier','manager','owner')),
  max_allowed_percent numeric(8,4),
  approved_by uuid,
  reason text,
  created_at timestamptz not null default now()
);

-- Held bills (survive refresh / offline restart via DB + offline mirror)
create table if not exists public.held_sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  sale_id uuid not null references public.sales(id) on delete cascade,
  hold_label text,
  held_by uuid,
  cart_snapshot jsonb not null default '{}'::jsonb,
  held_at timestamptz not null default now(),
  resumed_at timestamptz,
  status text not null default 'held' check (status in ('held','resumed','expired')),
  device_id text,
  unique (sale_id)
);

-- Returns / exchanges
create table if not exists public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  original_sale_id uuid not null references public.sales(id),
  return_sale_id uuid references public.sales(id),
  return_type text not null check (return_type in ('refund','credit','exchange')),
  reason text not null,
  refund_amount numeric(18,2) not null default 0,
  status text not null default 'posted' check (status in ('draft','posted','void')),
  idempotency_key uuid not null,
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, idempotency_key)
);

create table if not exists public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sale_return_id uuid not null references public.sale_returns(id) on delete cascade,
  original_sale_item_id uuid references public.sale_items(id),
  product_id uuid references public.products(id),
  unit_id uuid not null references public.units(id),
  qty numeric(18,4) not null check (qty > 0),
  unit_price numeric(18,2) not null,
  line_total numeric(18,2) not null,
  exchange_product_id uuid references public.products(id)
);

-- Commissions
create table if not exists public.sale_commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sale_id uuid not null references public.sales(id) on delete cascade,
  salesman_user_id uuid not null,
  base_amount numeric(18,2) not null,
  commission_percent numeric(8,4) not null default 0,
  commission_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Warranty records from sales
create table if not exists public.sale_warranties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  sale_id uuid not null references public.sales(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id),
  product_id uuid references public.products(id),
  serial_number_id uuid references public.stock_serials(id),
  warranty_start date not null,
  warranty_end date not null,
  created_at timestamptz not null default now()
);

-- Minimal accounting postings for sale (transaction service writes these)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','income','expense')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  entry_number text not null,
  entry_date date not null,
  memo text,
  source_type text not null,
  source_id uuid not null,
  status text not null default 'posted' check (status in ('posted','void')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, entry_number),
  unique (organization_id, idempotency_key)
);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  memo text
);

-- Analytics event stream (lightweight)
create table if not exists public.sales_analytics_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  sale_id uuid not null references public.sales(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- RLS
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_discount_audits enable row level security;
alter table public.held_sales enable row level security;
alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;
alter table public.sale_commissions enable row level security;
alter table public.sale_warranties enable row level security;
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.sales_analytics_events enable row level security;

create policy sales_org on public.sales for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sale_items_org on public.sale_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sale_discount_audits_org on public.sale_discount_audits for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy held_sales_org on public.held_sales for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sale_returns_org on public.sale_returns for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sale_return_items_org on public.sale_return_items for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sale_commissions_org on public.sale_commissions for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sale_warranties_org on public.sale_warranties for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy accounts_org on public.accounts for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy journal_entries_org on public.journal_entries for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy journal_entry_lines_org on public.journal_entry_lines for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy sales_analytics_events_org on public.sales_analytics_events for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
