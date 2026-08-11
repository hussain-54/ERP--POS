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

-- After creating an Auth user, link profile (auth_user_id must match auth.users.id):
-- insert into public.user_profiles (id, auth_user_id, organization_id, full_name, email, is_active, default_branch_id)
-- values (
--   gen_random_uuid(),
--   '<auth-user-uuid>',
--   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
--   'Owner',
--   'owner@example.com',
--   true,
--   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
-- );
