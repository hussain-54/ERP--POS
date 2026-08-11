-- Phase 1 foundation schema
create extension if not exists "pgcrypto";

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  ntn text,
  strn text,
  phone text,
  email text,
  address text,
  default_currency char(3) not null default 'PKR',
  timezone text not null default 'Asia/Karachi',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create index if not exists branches_org_idx on public.branches (organization_id) where deleted_at is null;

-- User profiles (linked to auth.users)
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  email text not null,
  full_name text not null,
  phone text,
  is_active boolean not null default true,
  default_branch_id uuid references public.branches(id),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1
);

create index if not exists user_profiles_org_idx on public.user_profiles (organization_id) where deleted_at is null;

create table if not exists public.branch_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, branch_id)
);

create index if not exists branch_memberships_user_idx on public.branch_memberships (user_id);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  module text not null,
  action text not null,
  description text
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  branch_id uuid references public.branches(id),
  created_at timestamptz not null default now(),
  unique (user_id, role_id, branch_id)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  unique (role_id, permission_id)
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  device_key text not null,
  name text not null,
  platform text not null check (platform in ('electron', 'web', 'mobile')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, device_key)
);

create index if not exists devices_org_branch_idx on public.devices (organization_id, branch_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  actor_user_id uuid references public.user_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address text,
  device_id uuid references public.devices(id),
  correlation_id text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

create table if not exists public.sync_metadata (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  device_id uuid not null references public.devices(id) on delete cascade,
  table_name text not null,
  last_pulled_at timestamptz,
  last_pushed_at timestamptz,
  server_cursor text,
  client_cursor text,
  unique (device_id, table_name)
);

create index if not exists sync_metadata_device_idx on public.sync_metadata (device_id);

-- Seed foundation permissions
insert into public.permissions (key, module, action, description) values
  ('dashboard.view', 'dashboard', 'view', 'View dashboard'),
  ('settings.manage', 'settings', 'manage', 'Manage settings'),
  ('users.manage', 'users', 'manage', 'Manage users'),
  ('roles.manage', 'roles', 'manage', 'Manage roles'),
  ('permissions.manage', 'permissions', 'manage', 'Manage permissions'),
  ('branches.manage', 'branches', 'manage', 'Manage branches'),
  ('branches.view_all', 'branches', 'view_all', 'View all branches'),
  ('devices.manage', 'devices', 'manage', 'Manage devices'),
  ('audit.view', 'audit', 'view', 'View audit trail'),
  ('sync.manage', 'sync', 'manage', 'Manage sync'),
  ('sync.resolve', 'sync', 'resolve', 'Resolve sync conflicts'),
  ('security.manage', 'security', 'manage', 'Manage security')
on conflict (key) do nothing;

-- Helper: current user's profile id
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.user_profiles where auth_user_id = auth.uid() and deleted_at is null limit 1;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
as $$
  select organization_id from public.user_profiles where auth_user_id = auth.uid() and deleted_at is null limit 1;
$$;

create or replace function public.get_user_permission_keys(p_user_id uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(distinct p.key), '{}')
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = p_user_id;
$$;

-- RLS
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.user_profiles enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.devices enable row level security;
alter table public.audit_logs enable row level security;
alter table public.sync_metadata enable row level security;

create policy organizations_select_own on public.organizations
  for select using (id = public.current_organization_id());

create policy branches_select_org on public.branches
  for select using (organization_id = public.current_organization_id());

create policy user_profiles_select_org on public.user_profiles
  for select using (organization_id = public.current_organization_id());

create policy user_profiles_update_self on public.user_profiles
  for update using (auth_user_id = auth.uid());

create policy branch_memberships_select_org on public.branch_memberships
  for select using (organization_id = public.current_organization_id());

create policy roles_select_org on public.roles
  for select using (organization_id = public.current_organization_id());

create policy permissions_select_all on public.permissions
  for select using (auth.uid() is not null);

create policy user_roles_select_org on public.user_roles
  for select using (organization_id = public.current_organization_id());

create policy role_permissions_select on public.role_permissions
  for select using (
    exists (
      select 1 from public.roles r
      where r.id = role_id and r.organization_id = public.current_organization_id()
    )
  );

create policy devices_select_org on public.devices
  for select using (organization_id = public.current_organization_id());

create policy audit_logs_select_org on public.audit_logs
  for select using (organization_id = public.current_organization_id());

create policy audit_logs_insert_org on public.audit_logs
  for insert with check (organization_id = public.current_organization_id());

create policy sync_metadata_select_org on public.sync_metadata
  for select using (organization_id = public.current_organization_id());
