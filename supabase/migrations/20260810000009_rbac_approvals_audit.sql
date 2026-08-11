-- Phase 9: RBAC + Multi-branch + Approvals + Audit

-- Standard module actions
do $$
declare
  mods text[] := array[
    'products','inventory','customers','suppliers','pos','purchases','expenses',
    'accounts','banking','deliveries','quotations','orders','service','warranty',
    'reports','users','roles','branches','approvals','audit','payments','credit',
    'transfers','warehouses','installments'
  ];
  acts text[] := array[
    'view','add','edit','delete','approve','reject','print','export','import','cancel','refund'
  ];
  m text;
  a text;
begin
  foreach m in array mods loop
    foreach a in array acts loop
      insert into public.permissions (key, module, action, description)
      values (m || '.' || a, m, a, initcap(a) || ' ' || m)
      on conflict (key) do nothing;
    end loop;
  end loop;
end $$;

insert into public.permissions (key, module, action, description) values
  ('approvals.act', 'approvals', 'act', 'Act on approval inbox'),
  ('approvals.manage', 'approvals', 'manage', 'Manage approval workflows'),
  ('dashboard.group_view', 'dashboard', 'group_view', 'Owner centralized multi-branch dashboard'),
  ('audit.export', 'audit', 'export', 'Export audit logs')
on conflict (key) do nothing;

-- User-level permission overrides (grant/deny), optional branch scope
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  branch_id uuid references public.branches(id),
  effect text not null check (effect in ('grant','deny')),
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (user_id, permission_id, branch_id, effect)
);

-- Unified approval workflow
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  workflow_type text not null check (workflow_type in (
    'discount','purchase','expense','return','credit'
  )),
  status text not null default 'pending' check (status in (
    'pending','approved','rejected','cancelled'
  )),
  current_step integer not null default 0,
  requester_user_id uuid references public.user_profiles(id),
  requester_role text,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  amount numeric(18,2),
  remarks text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  step_index integer not null,
  required_role text not null,
  actor_user_id uuid references public.user_profiles(id),
  action text not null check (action in ('submit','approve','reject','escalate','cancel')),
  status text not null check (status in ('pending','approved','rejected','cancelled')),
  remarks text,
  acted_at timestamptz not null default now(),
  audit_log_id uuid references public.audit_logs(id),
  created_at timestamptz not null default now()
);

create index if not exists approval_requests_org_status_idx
  on public.approval_requests (organization_id, status, created_at desc);
create index if not exists approval_actions_request_idx
  on public.approval_actions (approval_request_id, step_index);
create index if not exists user_permissions_user_idx
  on public.user_permissions (user_id);

-- Harden audit: append-only for ordinary clients
alter table public.audit_logs
  add column if not exists actor_role text,
  add column if not exists actor_kind text
    check (actor_kind is null or actor_kind in (
      'creator','editor','deleter','approver','canceller',
      'discount_giver','payment_receiver','stock_adjuster','other'
    ));

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function public.prevent_audit_mutation();

drop trigger if exists audit_logs_no_delete on public.audit_logs;
create trigger audit_logs_no_delete
  before delete on public.audit_logs
  for each row execute function public.prevent_audit_mutation();

-- Effective permissions: role grants + user grants − user denies
create or replace function public.get_user_permission_keys(p_user_id uuid)
returns text[]
language sql
stable
as $$
  with role_keys as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = p_user_id
  ),
  grants as (
    select distinct p.key
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and up.effect = 'grant'
  ),
  denies as (
    select distinct p.key
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id and up.effect = 'deny'
  )
  select coalesce(
    array(
      select key from (
        select key from role_keys
        union
        select key from grants
      ) u
      where key not in (select key from denies)
      order by 1
    ),
    '{}'::text[]
  );
$$;

-- Branch-aware permission helper (role @ branch or org-wide role + membership)
create or replace function public.get_user_permission_keys_for_branch(
  p_user_id uuid,
  p_branch_id uuid
)
returns text[]
language sql
stable
as $$
  with role_keys as (
    select distinct p.key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = p_user_id
      and (ur.branch_id is null or ur.branch_id = p_branch_id)
  ),
  grants as (
    select distinct p.key
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id
      and up.effect = 'grant'
      and (up.branch_id is null or up.branch_id = p_branch_id)
  ),
  denies as (
    select distinct p.key
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = p_user_id
      and up.effect = 'deny'
      and (up.branch_id is null or up.branch_id = p_branch_id)
  )
  select coalesce(
    array(
      select key from (
        select key from role_keys
        union
        select key from grants
      ) u
      where key not in (select key from denies)
      order by 1
    ),
    '{}'::text[]
  );
$$;

alter table public.user_permissions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_actions enable row level security;

create policy user_permissions_org on public.user_permissions
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy approval_requests_org on public.approval_requests
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy approval_actions_org on public.approval_actions
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- Allow org-scoped RBAC administration (select-only policies existed in foundation)
drop policy if exists roles_select_org on public.roles;
create policy roles_org on public.roles
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists user_roles_select_org on public.user_roles;
create policy user_roles_org on public.user_roles
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_org on public.role_permissions
  for all using (
    exists (
      select 1 from public.roles r
      where r.id = role_id and r.organization_id = public.current_organization_id()
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_id and r.organization_id = public.current_organization_id()
    )
  );

drop policy if exists branch_memberships_select_org on public.branch_memberships;
create policy branch_memberships_org on public.branch_memberships
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists branches_select_org on public.branches;
create policy branches_org on public.branches
  for all using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- Audit remains insert+select only (no update/delete policies); triggers enforce append-only
