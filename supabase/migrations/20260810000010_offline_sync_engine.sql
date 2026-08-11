-- Phase 10: Offline sync server support (devices, conflicts, operation acks)

insert into public.permissions (key, module, action, description) values
  ('sync.push', 'sync', 'push', 'Push offline operations'),
  ('sync.pull', 'sync', 'pull', 'Pull server changes'),
  ('devices.register', 'devices', 'register', 'Register POS devices')
on conflict (key) do nothing;

-- Idempotent ack of processed client operations (inbox on server side)
create table if not exists public.sync_operation_acks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  device_id uuid not null references public.devices(id),
  operation_id uuid not null,
  idempotency_key uuid not null,
  entity_type text not null,
  entity_id uuid,
  status text not null default 'accepted'
    check (status in ('accepted','conflict','rejected')),
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (organization_id, operation_id)
);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  device_id uuid references public.devices(id),
  entity_type text not null,
  entity_id uuid not null,
  server_version integer not null default 1,
  client_version integer not null default 1,
  server_payload jsonb not null default '{}'::jsonb,
  client_payload jsonb not null default '{}'::jsonb,
  conflict_type text not null default 'version'
    check (conflict_type in ('version','stock','financial','manual')),
  resolution text not null default 'pending'
    check (resolution in (
      'pending','server_wins','client_wins','latest_version','merged','manual','transaction_reconcile'
    )),
  resolved_by uuid,
  resolved_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_change_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('upsert','delete')),
  version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  device_id uuid references public.devices(id),
  occurred_at timestamptz not null default now()
);

create index if not exists sync_operation_acks_device_idx
  on public.sync_operation_acks (device_id, created_at desc);
create index if not exists sync_conflicts_org_status_idx
  on public.sync_conflicts (organization_id, resolution, created_at desc);
create index if not exists sync_change_log_cursor_idx
  on public.sync_change_log (organization_id, entity_type, occurred_at);

alter table public.devices
  add column if not exists registered_at timestamptz default now(),
  add column if not exists app_version text;

alter table public.sync_operation_acks enable row level security;
alter table public.sync_conflicts enable row level security;
alter table public.sync_change_log enable row level security;

create policy sync_operation_acks_org on public.sync_operation_acks
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy sync_conflicts_org on public.sync_conflicts
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy sync_change_log_org on public.sync_change_log
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists devices_select_org on public.devices;
create policy devices_org on public.devices
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
