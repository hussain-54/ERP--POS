-- Phase 12: Salesman references + commission status / payment

create table if not exists public.sale_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  mobile text,
  reference_code text not null,
  reference_type text not null default 'outside'
    check (reference_type in ('outside','dealer','influencer','employee','other')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, reference_code)
);

create index if not exists sale_references_org_active_idx
  on public.sale_references (organization_id, is_active);

alter table public.sales
  add column if not exists reference_id uuid references public.sale_references(id);

alter table public.sale_commissions
  add column if not exists status text not null default 'accrued',
  add column if not exists paid_amount numeric(18,2) not null default 0,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists original_amount numeric(18,2),
  add column if not exists adjusted_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.sale_commissions drop constraint if exists sale_commissions_status_check;
exception when undefined_object then null;
end $$;

alter table public.sale_commissions
  add constraint sale_commissions_status_check
  check (status in ('accrued','adjusted','partially_paid','paid','void'));

update public.sale_commissions
set original_amount = coalesce(original_amount, commission_amount)
where original_amount is null;

create unique index if not exists sale_commissions_org_sale_uidx
  on public.sale_commissions (organization_id, sale_id);

create index if not exists sale_commissions_status_idx
  on public.sale_commissions (organization_id, status);

alter table public.sale_references enable row level security;

drop policy if exists sale_references_org on public.sale_references;
create policy sale_references_org on public.sale_references
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

insert into public.permissions (key, module, action, description) values
  ('salesman.manage', 'salesman', 'manage', 'Manage salesman profiles and rates'),
  ('commissions.view', 'commissions', 'view', 'View commissions and reports'),
  ('commissions.manage', 'commissions', 'manage', 'Pay and adjust commissions')
on conflict (key) do nothing;
