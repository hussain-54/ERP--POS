-- Fix login: RLS helpers must be SECURITY DEFINER so profile lookup does not recurse.
-- Also allow users to select their own profile row.

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and deleted_at is null
  limit 1;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and deleted_at is null
  limit 1;
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_organization_id() from public;
grant execute on function public.current_profile_id() to authenticated, anon, service_role;
grant execute on function public.current_organization_id() to authenticated, anon, service_role;

drop policy if exists user_profiles_select_self on public.user_profiles;
create policy user_profiles_select_self on public.user_profiles
  for select
  using (auth_user_id = auth.uid() and deleted_at is null);

-- Permission resolution must also bypass RLS (reads role_permissions / user_permissions).
create or replace function public.get_user_permission_keys(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
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

create or replace function public.get_user_permission_keys_for_branch(
  p_user_id uuid,
  p_branch_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = public
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
