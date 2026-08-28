-- ONE-SHOT: create/find auth user + fix RLS + bootstrap first owner
-- Run in Supabase SQL Editor (Role: postgres). Safe to re-run.
-- Email: hussaindurrani92@gmail.com
--
-- If the Auth user does not exist yet, this creates it with password erp@1234
-- (change password after first login).

do $$
declare
  v_email text := 'hussaindurrani92@gmail.com';
  v_password text := 'erp@1234';
  v_full_name text := 'Hussain';
  v_org_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_branch_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_auth_id uuid;
  v_profile_id uuid;
  v_role_id uuid;
begin
  -- ========== A) Find or create auth.users row ==========
  select id into v_auth_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_auth_id is null then
    v_auth_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      coalesce(
        (select id from auth.instances limit 1),
        '00000000-0000-0000-0000-000000000000'
      ),
      v_auth_id,
      'authenticated',
      'authenticated',
      lower(v_email),
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_full_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Required on newer Supabase for email login
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_auth_id,
      v_auth_id,
      jsonb_build_object(
        'sub', v_auth_id::text,
        'email', lower(v_email),
        'email_verified', true
      ),
      'email',
      v_auth_id::text,
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do nothing;
  else
    -- Ensure email is confirmed + password usable
    update auth.users
    set
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      encrypted_password = crypt(v_password, gen_salt('bf')),
      updated_at = now()
    where id = v_auth_id;

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    select
      v_auth_id,
      v_auth_id,
      jsonb_build_object(
        'sub', v_auth_id::text,
        'email', lower(v_email),
        'email_verified', true
      ),
      'email',
      v_auth_id::text,
      now(),
      now(),
      now()
    where not exists (
      select 1 from auth.identities i
      where i.user_id = v_auth_id and i.provider = 'email'
    );
  end if;

  raise notice 'auth_user_id=%', v_auth_id;

  -- ========== B) Fix RLS helpers ==========
  execute $fn$
    create or replace function public.current_profile_id()
    returns uuid
    language sql
    stable
    security definer
    set search_path = public
    as $body$
      select id
      from public.user_profiles
      where auth_user_id = auth.uid()
        and deleted_at is null
      limit 1;
    $body$;
  $fn$;

  execute $fn$
    create or replace function public.current_organization_id()
    returns uuid
    language sql
    stable
    security definer
    set search_path = public
    as $body$
      select organization_id
      from public.user_profiles
      where auth_user_id = auth.uid()
        and deleted_at is null
      limit 1;
    $body$;
  $fn$;

  revoke all on function public.current_profile_id() from public;
  revoke all on function public.current_organization_id() from public;
  grant execute on function public.current_profile_id() to authenticated, anon, service_role;
  grant execute on function public.current_organization_id() to authenticated, anon, service_role;

  drop policy if exists user_profiles_select_self on public.user_profiles;
  create policy user_profiles_select_self on public.user_profiles
    for select
    using (auth_user_id = auth.uid() and deleted_at is null);

  execute $fn$
    create or replace function public.get_user_permission_keys(p_user_id uuid)
    returns text[]
    language plpgsql
    stable
    security definer
    set search_path = public
    as $body$
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
    $body$;
  $fn$;

  -- ========== C) Org + branch ==========
  insert into public.organizations (id, name, settings)
  values (v_org_id, 'Demo Electrical Store', '{}'::jsonb)
  on conflict (id) do nothing;

  insert into public.branches (id, organization_id, name, code, is_active)
  values (v_branch_id, v_org_id, 'Main Branch', 'MAIN', true)
  on conflict (id) do nothing;

  -- ========== D) Profile ==========
  insert into public.user_profiles (
    id, auth_user_id, organization_id, full_name, email, is_active, default_branch_id
  )
  values (
    gen_random_uuid(),
    v_auth_id,
    v_org_id,
    v_full_name,
    lower(v_email),
    true,
    v_branch_id
  )
  on conflict (auth_user_id) do update set
    organization_id = excluded.organization_id,
    full_name = excluded.full_name,
    email = excluded.email,
    is_active = true,
    default_branch_id = excluded.default_branch_id,
    deleted_at = null
  returning id into v_profile_id;

  if v_profile_id is null then
    select id into v_profile_id
    from public.user_profiles
    where auth_user_id = v_auth_id;
  end if;

  -- ========== E) Super Admin + Owner roles + ALL permissions ==========
  insert into public.permissions (key, module, action, description)
  values ('*', '*', '*', 'Wildcard — full ERP access for Super Admin / Owner')
  on conflict (key) do nothing;

  insert into public.roles (organization_id, code, name, description, is_system)
  values
    (v_org_id, 'super_admin', 'Super Admin', 'Platform-level full access', true),
    (v_org_id, 'owner', 'Owner', 'Organization owner — full access', true)
  on conflict (organization_id, code) do update
    set name = excluded.name,
        description = excluded.description,
        is_system = true,
        deleted_at = null;

  -- Attach every permission to Super Admin and Owner
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.organization_id = v_org_id
    and r.code in ('super_admin', 'owner')
  on conflict (role_id, permission_id) do nothing;

  -- Assign Super Admin (preferred full-access role)
  select id into v_role_id
  from public.roles
  where organization_id = v_org_id and code = 'super_admin';

  insert into public.user_roles (organization_id, user_id, role_id, branch_id)
  select v_org_id, v_profile_id, v_role_id, null
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_profile_id
      and ur.role_id = v_role_id
      and ur.branch_id is null
  );

  -- Also assign Owner (legacy bootstrap role; does not remove other users' roles)
  select id into v_role_id
  from public.roles
  where organization_id = v_org_id and code = 'owner';

  insert into public.user_roles (organization_id, user_id, role_id, branch_id)
  select v_org_id, v_profile_id, v_role_id, null
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_profile_id
      and ur.role_id = v_role_id
      and ur.branch_id is null
  );

  delete from public.user_permissions
  where user_id = v_profile_id
    and effect = 'deny';

  insert into public.branch_memberships (organization_id, user_id, branch_id)
  values (v_org_id, v_profile_id, v_branch_id)
  on conflict (user_id, branch_id) do nothing;

  raise notice 'DONE profile_id=% super_admin+owner granted', v_profile_id;
end $$;

-- Verify
select
  u.id as auth_user_id,
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  up.id as profile_id,
  up.full_name,
  r.code as role_code,
  (select count(*) from public.role_permissions rp where rp.role_id = r.id) as permission_count,
  (select count(*) from public.branch_memberships bm where bm.user_id = up.id) as branch_count
from auth.users u
join public.user_profiles up on up.auth_user_id = u.id
left join public.user_roles ur on ur.user_id = up.id
left join public.roles r on r.id = ur.role_id
where lower(u.email) = 'hussaindurrani92@gmail.com';
