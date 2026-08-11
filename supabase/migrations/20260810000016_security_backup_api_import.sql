-- Phase 16: Security + Backup architecture + Integration API + Import/Export controls

insert into public.permissions (key, module, action, description) values
  ('security.view', 'security', 'view', 'View security settings and login history'),
  ('backup.manage', 'backup', 'manage', 'Manage backup jobs and schedules'),
  ('backup.view', 'backup', 'view', 'View backup jobs and restore points'),
  ('backup.restore', 'backup', 'restore', 'Request restore / verification'),
  ('integrations.manage', 'integrations', 'manage', 'Manage integration API clients and keys'),
  ('integrations.view', 'integrations', 'view', 'View integration clients'),
  ('import.execute', 'import', 'execute', 'Execute data imports'),
  ('export.execute', 'export', 'execute', 'Execute data exports')
on conflict (key) do nothing;

-- Security settings / password policy
create table if not exists public.security_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  password_policy_json jsonb not null default '{}'::jsonb,
  encryption_strategy text not null default 'supabase_at_rest',
  two_factor_optional boolean not null default true,
  two_factor_enforced boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  email text not null,
  user_id uuid,
  success boolean not null,
  ip_address text,
  user_agent text,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists login_history_org_created_idx
  on public.login_history (organization_id, created_at desc);

create table if not exists public.login_lockouts (
  organization_id uuid not null references public.organizations(id),
  email text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, email)
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null,
  session_jti text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  detail_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.security_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid,
  device_label text not null,
  device_fingerprint text not null,
  platform text,
  status text not null default 'pending'
    check (status in ('pending','approved','revoked')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  unique (organization_id, device_fingerprint)
);

create table if not exists public.user_two_factor (
  user_id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  method text not null default 'totp' check (method in ('totp','email_otp')),
  enabled boolean not null default false,
  secret_configured boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Backup architecture (no DR claim without verified restore)
create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  mode text not null check (mode in ('full','incremental','daily','automatic')),
  target text not null check (target in ('local','cloud')),
  encrypted boolean not null default true,
  status text not null default 'queued'
    check (status in ('queued','running','succeeded','failed','verify_pending')),
  label text,
  scheduled_for timestamptz not null default now(),
  completed_at timestamptz,
  byte_size bigint,
  storage_path text,
  notes text,
  disaster_recovery_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.backup_restore_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  backup_job_id uuid references public.backup_jobs(id),
  label text not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.backup_restore_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  restore_point_id uuid not null references public.backup_restore_points(id),
  verify_only boolean not null default true,
  status text not null default 'requested'
    check (status in ('requested','verified','failed','completed')),
  result_notes text,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Integration API clients (versioned /api/v1 consumers)
create table if not exists public.integration_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  audience text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default array['read']::text[],
  webhook_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  last_used_at timestamptz,
  unique (organization_id, key_prefix)
);

create table if not exists public.price_change_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid references public.products(id),
  sku text,
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- RLS
alter table public.security_settings enable row level security;
alter table public.login_history enable row level security;
alter table public.login_lockouts enable row level security;
alter table public.user_sessions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.security_devices enable row level security;
alter table public.user_two_factor enable row level security;
alter table public.backup_jobs enable row level security;
alter table public.backup_restore_points enable row level security;
alter table public.backup_restore_requests enable row level security;
alter table public.integration_clients enable row level security;
alter table public.price_change_audits enable row level security;

create policy security_settings_org on public.security_settings for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy login_history_org on public.login_history for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy login_lockouts_org on public.login_lockouts for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy user_sessions_org on public.user_sessions for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy activity_logs_org on public.activity_logs for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy security_devices_org on public.security_devices for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy user_two_factor_org on public.user_two_factor for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy backup_jobs_org on public.backup_jobs for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy backup_restore_points_org on public.backup_restore_points for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy backup_restore_requests_org on public.backup_restore_requests for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy integration_clients_org on public.integration_clients for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy price_change_audits_org on public.price_change_audits for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
