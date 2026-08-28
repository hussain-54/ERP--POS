-- Grant SUPER ADMIN / full access to hussaindurrani92@gmail.com
-- Idempotent. Does not change other users' role assignments.
-- Uses existing system roles: super_admin + owner (full catalog).

-- 1) Platform wildcard permission (AuthorizationService / permissionSatisfied already honor "*")
insert into public.permissions (key, module, action, description)
values ('*', '*', '*', 'Wildcard — full ERP access for Super Admin / Owner')
on conflict (key) do nothing;

-- 2) Ensure target user has Super Admin + Owner roles with every permission key
do $$
declare
  v_email text := 'hussaindurrani92@gmail.com';
  v_profile_id uuid;
  v_org_id uuid;
  v_super_id uuid;
  v_owner_id uuid;
  r record;
begin
  select id, organization_id
    into v_profile_id, v_org_id
  from public.user_profiles
  where lower(email) = lower(v_email)
    and deleted_at is null
  limit 1;

  if v_profile_id is null then
    raise notice 'Profile not found for % — run bootstrap_first_owner.sql first, then re-apply this migration.', v_email;
    return;
  end if;

  -- Ensure Super Admin role
  insert into public.roles (organization_id, code, name, description, is_system)
  values (v_org_id, 'super_admin', 'Super Admin', 'Platform-level full access', true)
  on conflict (organization_id, code) do update
    set name = excluded.name,
        description = excluded.description,
        is_system = true,
        deleted_at = null;

  select id into v_super_id
  from public.roles
  where organization_id = v_org_id and code = 'super_admin';

  -- Ensure Owner role (existing bootstrap role)
  insert into public.roles (organization_id, code, name, description, is_system)
  values (v_org_id, 'owner', 'Owner', 'Organization owner — full access', true)
  on conflict (organization_id, code) do update
    set name = excluded.name,
        description = excluded.description,
        is_system = true,
        deleted_at = null;

  select id into v_owner_id
  from public.roles
  where organization_id = v_org_id and code = 'owner';

  -- Attach ALL permission keys (including wildcard) to Super Admin and Owner only
  for r in
    select unnest(array[v_super_id, v_owner_id]) as role_id
  loop
    insert into public.role_permissions (role_id, permission_id)
    select r.role_id, p.id
    from public.permissions p
    on conflict (role_id, permission_id) do nothing;
  end loop;

  -- Assign Super Admin (org-wide) — do not remove other roles for this user
  insert into public.user_roles (organization_id, user_id, role_id, branch_id)
  select v_org_id, v_profile_id, v_super_id, null
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_profile_id
      and ur.role_id = v_super_id
      and ur.branch_id is null
  );

  -- Assign Owner (org-wide) if not already assigned
  insert into public.user_roles (organization_id, user_id, role_id, branch_id)
  select v_org_id, v_profile_id, v_owner_id, null
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_profile_id
      and ur.role_id = v_owner_id
      and ur.branch_id is null
  );

  -- Clear deny overrides for this user only (so full access is not blocked)
  delete from public.user_permissions
  where user_id = v_profile_id
    and effect = 'deny';

  raise notice 'Granted Super Admin + Owner full access to % (profile=%)', v_email, v_profile_id;
end $$;

-- 3) Permission RPC: Super Admin / Owner always receive full catalog + wildcard
--    Other users keep normal role ∪ grants − denies behavior.
create or replace function public.get_user_permission_keys(p_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_full_access boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and r.code in ('super_admin', 'owner')
      and r.deleted_at is null
  ) into v_is_full_access;

  if v_is_full_access then
    return coalesce(
      array(
        select key from (
          select p.key from public.permissions p
          union
          select '*'::text
        ) k
        order by 1
      ),
      array['*']::text[]
    );
  end if;

  return coalesce(
    array(
      select key from (
        select distinct p.key
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = p_user_id
        union
        select distinct p.key
        from public.user_permissions up
        join public.permissions p on p.id = up.permission_id
        where up.user_id = p_user_id and up.effect = 'grant'
      ) u
      where key not in (
        select p.key
        from public.user_permissions up
        join public.permissions p on p.id = up.permission_id
        where up.user_id = p_user_id and up.effect = 'deny'
      )
      order by 1
    ),
    '{}'::text[]
  );
end;
$$;

create or replace function public.get_user_permission_keys_for_branch(
  p_user_id uuid,
  p_branch_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_full_access boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and r.code in ('super_admin', 'owner')
      and r.deleted_at is null
      and (ur.branch_id is null or ur.branch_id = p_branch_id)
  ) into v_is_full_access;

  if v_is_full_access then
    return coalesce(
      array(
        select key from (
          select p.key from public.permissions p
          union
          select '*'::text
        ) k
        order by 1
      ),
      array['*']::text[]
    );
  end if;

  return coalesce(
    array(
      select key from (
        select distinct p.key
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = p_user_id
          and (ur.branch_id is null or ur.branch_id = p_branch_id)
        union
        select distinct p.key
        from public.user_permissions up
        join public.permissions p on p.id = up.permission_id
        where up.user_id = p_user_id
          and up.effect = 'grant'
          and (up.branch_id is null or up.branch_id = p_branch_id)
      ) u
      where key not in (
        select p.key
        from public.user_permissions up
        join public.permissions p on p.id = up.permission_id
        where up.user_id = p_user_id
          and up.effect = 'deny'
          and (up.branch_id is null or up.branch_id = p_branch_id)
      )
      order by 1
    ),
    '{}'::text[]
  );
end;
$$;

revoke all on function public.get_user_permission_keys(uuid) from public;
revoke all on function public.get_user_permission_keys_for_branch(uuid, uuid) from public;
grant execute on function public.get_user_permission_keys(uuid) to authenticated, anon, service_role;
grant execute on function public.get_user_permission_keys_for_branch(uuid, uuid) to authenticated, anon, service_role;

comment on function public.get_user_permission_keys(uuid) is
  'Effective permission keys. Super Admin / Owner receive full catalog + wildcard *.';
