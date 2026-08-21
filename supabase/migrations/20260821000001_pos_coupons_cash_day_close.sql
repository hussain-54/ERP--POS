-- POS coupons, cash drawer movements, and day closing (real ledgers — not fake UI)

-- Allow coupon (+ bulk already in contracts) on sale discount audits
alter table public.sale_discount_audits
  drop constraint if exists sale_discount_audits_discount_kind_check;

alter table public.sale_discount_audits
  add constraint sale_discount_audits_discount_kind_check
  check (discount_kind in (
    'percentage','fixed','customer','wholesale','promotion','special','bulk','coupon'
  ));

create table if not exists public.pos_coupons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text,
  discount_mode text not null check (discount_mode in ('percentage','fixed')),
  discount_value numeric(18,4) not null check (discount_value >= 0),
  min_purchase numeric(18,2) not null default 0 check (min_purchase >= 0),
  max_discount numeric(18,2),
  usage_limit integer,
  usage_count integer not null default 0 check (usage_count >= 0),
  per_customer_limit integer,
  valid_from timestamptz,
  valid_to timestamptz,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists pos_coupons_org_active_idx
  on public.pos_coupons (organization_id, is_active);

create table if not exists public.pos_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  coupon_id uuid not null references public.pos_coupons(id),
  sale_id uuid not null references public.sales(id) on delete cascade,
  customer_id uuid,
  discount_amount numeric(18,2) not null,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, sale_id)
);

create index if not exists pos_coupon_redemptions_org_coupon_idx
  on public.pos_coupon_redemptions (organization_id, coupon_id);

alter table public.sales
  add column if not exists coupon_id uuid references public.pos_coupons(id);

create table if not exists public.pos_cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  shift_id uuid not null references public.pos_cash_shifts(id),
  kind text not null check (kind in ('cash_in','cash_out')),
  amount numeric(18,2) not null check (amount > 0),
  reason text not null,
  reference text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists pos_cash_movements_shift_idx
  on public.pos_cash_movements (shift_id, kind);

create table if not exists public.pos_day_closings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  business_date date not null,
  status text not null default 'closed' check (status in ('closed')),
  total_sales numeric(18,2) not null default 0,
  cash_sales numeric(18,2) not null default 0,
  card_sales numeric(18,2) not null default 0,
  bank_sales numeric(18,2) not null default 0,
  wallet_sales numeric(18,2) not null default 0,
  credit_sales numeric(18,2) not null default 0,
  refunds numeric(18,2) not null default 0,
  cash_in numeric(18,2) not null default 0,
  cash_out numeric(18,2) not null default 0,
  opening_cash numeric(18,2) not null default 0,
  expected_cash numeric(18,2) not null default 0,
  actual_cash numeric(18,2) not null,
  variance numeric(18,2) not null,
  notes text,
  closed_by uuid,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, branch_id, business_date)
);

alter table public.pos_coupons enable row level security;
alter table public.pos_coupon_redemptions enable row level security;
alter table public.pos_cash_movements enable row level security;
alter table public.pos_day_closings enable row level security;

create policy pos_coupons_org on public.pos_coupons for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy pos_coupon_redemptions_org on public.pos_coupon_redemptions for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy pos_cash_movements_org on public.pos_cash_movements for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy pos_day_closings_org on public.pos_day_closings for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
