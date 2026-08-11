-- Optional seed for local/staging after all migrations are applied.
-- Does NOT create auth.users (use Supabase Auth dashboard / Admin API).
-- Safe to re-run: fixed UUIDs + ON CONFLICT DO NOTHING.

insert into public.organizations (id, name, settings)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Demo Electrical Store',
  '{}'::jsonb
)
on conflict (id) do nothing;

insert into public.branches (id, organization_id, name, code, is_active)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Main Branch',
  'MAIN',
  true
)
on conflict (id) do nothing;

-- Owner role template for the demo org (full permission catalog)
insert into public.roles (organization_id, code, name, description, is_system)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'owner',
  'Owner',
  'Organization owner — full access',
  true
)
on conflict (organization_id, code) do update
  set name = excluded.name, is_system = true, deleted_at = null;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and r.code = 'owner'
on conflict (role_id, permission_id) do nothing;

-- After creating an Auth user, link profile + grant owner (replace AUTH_USER_UUID):
--
-- insert into public.user_profiles (
--   id, auth_user_id, organization_id, full_name, email, is_active, default_branch_id
-- ) values (
--   gen_random_uuid(),
--   'AUTH_USER_UUID',
--   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
--   'Owner',
--   'owner@example.com',
--   true,
--   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
-- )
-- on conflict (auth_user_id) do update set
--   organization_id = excluded.organization_id,
--   is_active = true,
--   deleted_at = null,
--   default_branch_id = excluded.default_branch_id;
--
-- insert into public.user_roles (organization_id, user_id, role_id, branch_id)
-- select up.organization_id, up.id, r.id, null
-- from public.user_profiles up
-- join public.roles r on r.organization_id = up.organization_id and r.code = 'owner'
-- where up.auth_user_id = 'AUTH_USER_UUID'
--   and not exists (
--     select 1 from public.user_roles ur
--     where ur.user_id = up.id and ur.role_id = r.id and ur.branch_id is null
--   );
--
-- insert into public.branch_memberships (organization_id, user_id, branch_id)
-- select up.organization_id, up.id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
-- from public.user_profiles up
-- where up.auth_user_id = 'AUTH_USER_UUID'
-- on conflict (user_id, branch_id) do nothing;
