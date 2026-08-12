-- Phase 14: Delivery management — in_transit, instructions, history, tracking integration points

alter table public.deliveries
  add column if not exists instructions text,
  add column if not exists in_transit_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists tracking_provider text,
  add column if not exists tracking_reference text,
  add column if not exists tracking_configured boolean not null default false;

do $$
begin
  alter table public.deliveries drop constraint if exists deliveries_status_check;
exception when undefined_object then null;
end $$;

alter table public.deliveries
  add constraint deliveries_status_check
  check (status in ('pending','packed','dispatched','in_transit','delivered','cancelled','returned'));

create table if not exists public.delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_status_history_delivery_idx
  on public.delivery_status_history (delivery_id, created_at desc);

alter table public.delivery_status_history enable row level security;

drop policy if exists delivery_status_history_org on public.delivery_status_history;
create policy delivery_status_history_org on public.delivery_status_history
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

insert into public.permissions (key, module, action, description) values
  ('deliveries.view', 'deliveries', 'view', 'View delivery orders and tracking status')
on conflict (key) do nothing;
