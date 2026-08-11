-- POS cash shift / drawer sessions (honest shift panel — not hardware GPS)
create table if not exists public.pos_cash_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  opened_by uuid,
  closed_by uuid,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_float numeric(18,2) not null default 0,
  closing_counted numeric(18,2),
  expected_cash numeric(18,2),
  variance numeric(18,2),
  sales_total numeric(18,2) not null default 0,
  cash_sales_total numeric(18,2) not null default 0,
  expense_total numeric(18,2) not null default 0,
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_cash_shifts_org_branch_status_idx
  on public.pos_cash_shifts (organization_id, branch_id, status);

alter table public.pos_cash_shifts enable row level security;

create policy pos_cash_shifts_org on public.pos_cash_shifts for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

insert into public.permissions (key, module, action, description) values
  ('pos.shift', 'pos', 'shift', 'Open/close POS cash shifts')
on conflict (key) do nothing;

-- Grant to roles that already can sell on POS
insert into public.role_permissions (role_id, permission_id)
select rp.role_id, p_new.id
from public.permissions p_sell
join public.role_permissions rp on rp.permission_id = p_sell.id
join public.permissions p_new on p_new.key = 'pos.shift'
where p_sell.key = 'pos.sell'
on conflict (role_id, permission_id) do nothing;
