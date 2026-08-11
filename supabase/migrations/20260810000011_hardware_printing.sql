-- Phase 11: Hardware + printing permissions and print job audit helper table

insert into public.permissions (key, module, action, description) values
  ('printing.manage', 'printing', 'manage', 'Manage printers and print jobs'),
  ('printing.print', 'printing', 'print', 'Print documents and labels'),
  ('cash_drawer.open', 'cash_drawer', 'open', 'Open cash drawer'),
  ('hardware.manage', 'hardware', 'manage', 'Manage hardware devices')
on conflict (key) do nothing;

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  document_type text not null,
  media text not null,
  status text not null default 'queued'
    check (status in ('queued','printing','done','failed','retrying')),
  payload text not null,
  copies integer not null default 1,
  error_message text,
  retry_count integer not null default 0,
  requested_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.hardware_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  capability text not null,
  status text not null,
  message text,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists print_jobs_org_created_idx
  on public.print_jobs (organization_id, created_at desc);
create index if not exists hardware_events_org_created_idx
  on public.hardware_events (organization_id, created_at desc);

alter table public.print_jobs enable row level security;
alter table public.hardware_events enable row level security;

create policy print_jobs_org on public.print_jobs
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy hardware_events_org on public.hardware_events
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
