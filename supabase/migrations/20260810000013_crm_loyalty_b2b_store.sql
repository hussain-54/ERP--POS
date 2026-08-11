-- Phase 13: CRM + Loyalty + B2B Portal + Online Store

insert into public.permissions (key, module, action, description) values
  ('crm.manage', 'crm', 'manage', 'Manage CRM segments and campaigns'),
  ('crm.view', 'crm', 'view', 'View CRM data'),
  ('loyalty.manage', 'loyalty', 'manage', 'Configure loyalty tiers and offers'),
  ('loyalty.redeem', 'loyalty', 'redeem', 'Redeem loyalty points'),
  ('loyalty.view', 'loyalty', 'view', 'View loyalty accounts'),
  ('b2b.manage', 'b2b', 'manage', 'Administer B2B portal'),
  ('b2b.order', 'b2b', 'order', 'Place B2B wholesale orders'),
  ('b2b.approve', 'b2b', 'approve', 'Approve B2B orders'),
  ('store.manage', 'store', 'manage', 'Configure online store'),
  ('store.order', 'store', 'order', 'Create online store orders')
on conflict (key) do nothing;

-- Customer CRM enrichment
alter table public.customers
  add column if not exists location_city text,
  add column if not exists location_area text,
  add column if not exists price_level_id uuid references public.price_levels(id),
  add column if not exists loyalty_tier text
    check (loyalty_tier is null or loyalty_tier in ('silver','gold','platinum'));

-- Segments
create table if not exists public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  description text,
  rule_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.customer_segment_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  segment_id uuid not null references public.customer_segments(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (segment_id, customer_id)
);

-- Campaigns
create table if not exists public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  channel text not null check (channel in (
    'sms','whatsapp','festival','discount','new_product','customer_specific'
  )),
  status text not null default 'draft'
    check (status in ('draft','scheduled','running','completed','cancelled')),
  segment_id uuid references public.customer_segments(id),
  customer_id uuid references public.customers(id),
  message_template text not null,
  offer_percent numeric(8,4),
  offer_amount numeric(18,2),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, code)
);

create table if not exists public.crm_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  campaign_id uuid not null references public.crm_campaigns(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  channel text not null,
  status text not null default 'queued'
    check (status in ('queued','sent','failed','skipped')),
  provider_ref text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Loyalty
create table if not exists public.loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null check (code in ('silver','gold','platinum')),
  name text not null,
  min_points integer not null default 0,
  earn_rate numeric(8,4) not null default 1,
  redeem_rate numeric(8,4) not null default 1,
  is_active boolean not null default true,
  unique (organization_id, code)
);

create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  customer_id uuid not null references public.customers(id) on delete cascade,
  tier_code text not null default 'silver'
    check (tier_code in ('silver','gold','platinum')),
  points_balance integer not null default 0,
  lifetime_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id)
);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  entry_type text not null check (entry_type in ('earn','redeem','expire','adjust','reward')),
  points integer not null,
  balance_after integer not null,
  source_type text,
  source_id uuid,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.loyalty_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  tier_code text check (tier_code is null or tier_code in ('silver','gold','platinum')),
  points_cost integer not null check (points_cost > 0),
  discount_percent numeric(8,4),
  discount_amount numeric(18,2),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  unique (organization_id, code)
);

-- B2B portal users (linked to wholesale/dealer customers)
create table if not exists public.b2b_portal_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  customer_id uuid not null references public.customers(id) on delete cascade,
  email text not null,
  auth_user_id uuid,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, email),
  unique (organization_id, customer_id)
);

-- Channel on sales orders (same ERP inventory / order pipeline)
alter table public.sales_orders
  add column if not exists channel text not null default 'erp'
    check (channel in ('erp','b2b','online')),
  add column if not exists approval_status text not null default 'none'
    check (approval_status in ('none','pending','approved','rejected')),
  add column if not exists price_book text
    check (price_book is null or price_book in ('retail','wholesale','dealer'));

create index if not exists sales_orders_channel_idx
  on public.sales_orders (organization_id, channel, created_at desc);

-- Online store settings (config only — catalog/stock from ERP)
create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  warehouse_id uuid not null references public.warehouses(id),
  store_name text not null default 'Online Store',
  is_published boolean not null default false,
  currency text not null default 'PKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

-- Extend approval workflow for B2B orders
alter table public.approval_requests drop constraint if exists approval_requests_workflow_type_check;
alter table public.approval_requests
  add constraint approval_requests_workflow_type_check
  check (workflow_type in ('discount','purchase','expense','return','credit','b2b_order'));

-- Allow online/store reservations on shared inventory (same stock system)
alter table public.stock_reservations drop constraint if exists stock_reservations_source_type_check;
alter table public.stock_reservations
  add constraint stock_reservations_source_type_check
  check (source_type in ('sale','order','quotation','delivery','b2b_order','online_order'));

-- RLS
alter table public.customer_segments enable row level security;
alter table public.customer_segment_members enable row level security;
alter table public.crm_campaigns enable row level security;
alter table public.crm_campaign_sends enable row level security;
alter table public.loyalty_tiers enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.loyalty_offers enable row level security;
alter table public.b2b_portal_users enable row level security;
alter table public.store_settings enable row level security;

create policy customer_segments_org on public.customer_segments for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy customer_segment_members_org on public.customer_segment_members for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy crm_campaigns_org on public.crm_campaigns for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy crm_campaign_sends_org on public.crm_campaign_sends for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy loyalty_tiers_org on public.loyalty_tiers for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy loyalty_accounts_org on public.loyalty_accounts for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy loyalty_ledger_org on public.loyalty_ledger for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy loyalty_offers_org on public.loyalty_offers for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy b2b_portal_users_org on public.b2b_portal_users for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy store_settings_org on public.store_settings for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
