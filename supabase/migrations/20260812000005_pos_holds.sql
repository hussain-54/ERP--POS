-- Phase 10: Hold / resume enrichment — reason, notes, expiry, lifecycle statuses
-- Held sales park cart snapshots only; they must never post stock movements.

alter table public.held_sales
  add column if not exists hold_reason text,
  add column if not exists notes text,
  add column if not exists expires_at timestamptz,
  add column if not exists customer_id uuid references public.customers(id),
  add column if not exists cancelled_at timestamptz,
  add column if not exists discarded_at timestamptz,
  add column if not exists transferred_to uuid,
  add column if not exists updated_at timestamptz not null default now();

-- Expand status check: held | resumed | expired | cancelled | discarded
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'held_sales'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if cname is not null then
    execute format('alter table public.held_sales drop constraint %I', cname);
  end if;
end $$;

alter table public.held_sales
  add constraint held_sales_status_check
  check (status in ('held','resumed','expired','cancelled','discarded'));

-- Backfill expiry for existing open holds (24h from held_at)
update public.held_sales
set expires_at = held_at + interval '24 hours'
where status = 'held'
  and expires_at is null;

create index if not exists held_sales_branch_status_idx
  on public.held_sales (branch_id, status, held_at desc);

create index if not exists held_sales_expires_idx
  on public.held_sales (expires_at)
  where status = 'held' and expires_at is not null;

create index if not exists held_sales_held_by_idx
  on public.held_sales (held_by)
  where held_by is not null;

insert into public.permissions (key, module, action, description) values
  ('pos.resume_any', 'pos', 'resume_any', 'Resume or transfer holds owned by other cashiers')
on conflict (key) do nothing;
