-- Phase 15: HR + Tax (architecture-ready) + Documents + Notifications

insert into public.permissions (key, module, action, description) values
  ('hr.manage', 'hr', 'manage', 'Manage employees, attendance, incentives'),
  ('hr.view', 'hr', 'view', 'View HR data'),
  ('hr.payroll', 'hr', 'payroll', 'Run salary and view payroll'),
  ('tax.manage', 'tax', 'manage', 'Manage tax rates and profiles'),
  ('tax.view', 'tax', 'view', 'View tax documents and rates'),
  ('tax.export', 'tax', 'export', 'Export tax packs (not live FBR)'),
  ('documents.manage', 'documents', 'manage', 'Upload and manage documents'),
  ('documents.view', 'documents', 'view', 'View non-sensitive documents'),
  ('notifications.view', 'notifications', 'view', 'View in-app notifications'),
  ('notifications.broadcast', 'notifications', 'broadcast', 'Broadcast notifications'),
  ('notifications.manage', 'notifications', 'manage', 'Manage notification settings and scans')
on conflict (key) do nothing;

-- ─── HR ───────────────────────────────────────────────────
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  full_name text not null,
  mobile text,
  email text,
  designation text,
  department text,
  branch_id uuid references public.branches(id),
  user_id uuid,
  is_salesman boolean not null default false,
  base_salary numeric(18,2) not null default 0,
  commission_percent numeric(8,4) not null default 0,
  join_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, code)
);

create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('present','absent','leave','half_day')),
  check_in timestamptz,
  check_out timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create table if not exists public.salary_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.employees(id),
  period_ym text not null,
  base_salary numeric(18,2) not null default 0,
  commission_amount numeric(18,2) not null default 0,
  incentive_amount numeric(18,2) not null default 0,
  deductions numeric(18,2) not null default 0,
  gross_amount numeric(18,2) not null default 0,
  net_amount numeric(18,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','posted','paid')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, employee_id, period_ym)
);

create table if not exists public.employee_incentives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  amount numeric(18,2) not null,
  period_ym text,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.employee_performance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_ym text not null,
  score numeric(8,2) not null default 0,
  sales_amount numeric(18,2) not null default 0,
  target_amount numeric(18,2) not null default 0,
  achievement_pct numeric(8,2) not null default 0,
  rating text not null default 'average',
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, employee_id, period_ym)
);

alter table public.sale_commissions
  add column if not exists employee_id uuid references public.employees(id);

-- ─── Tax (architecture-ready; fbr_integration_enabled default false) ──
create table if not exists public.tax_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  ntn text,
  strn text,
  legal_name text,
  tax_province text,
  fbr_integration_enabled boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  rate_percent numeric(8,4) not null default 0,
  is_exempt boolean not null default false,
  is_default boolean not null default false,
  pricing_mode text not null default 'exclusive' check (pricing_mode in ('inclusive','exclusive')),
  effective_from date,
  effective_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.tax_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  document_number text not null,
  document_type text not null check (document_type in ('tax_invoice','credit_note','debit_note','export_pack')),
  source_type text not null check (source_type in ('sale','purchase','manual')),
  source_id uuid,
  tax_rate_id uuid references public.tax_rates(id),
  taxable_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  pricing_mode text not null default 'exclusive',
  buyer_ntn text,
  buyer_strn text,
  fbr_status text not null default 'not_integrated'
    check (fbr_status in ('not_integrated','queued','submitted','failed')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, document_number)
);

create table if not exists public.tax_exemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

-- ─── Documents ────────────────────────────────────────────
create table if not exists public.managed_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  entity_type text not null,
  entity_id uuid not null,
  kind text not null,
  title text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0,
  storage_path text not null,
  checksum_sha256 text,
  is_sensitive boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  deleted_at timestamptz
);

create index if not exists managed_documents_entity_idx
  on public.managed_documents (organization_id, entity_type, entity_id)
  where deleted_at is null;

-- ─── Notifications ────────────────────────────────────────
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid,
  branch_id uuid references public.branches(id),
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  channels text[] not null default array['in_app']::text[],
  metadata_json jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_user_idx
  on public.app_notifications (organization_id, user_id, created_at desc);

create table if not exists public.notification_channel_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  channel text not null check (channel in ('email','sms','push')),
  status text not null check (status in ('skipped','queued','sent','failed')),
  detail text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.employees enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.salary_runs enable row level security;
alter table public.employee_incentives enable row level security;
alter table public.employee_performance enable row level security;
alter table public.tax_profiles enable row level security;
alter table public.tax_rates enable row level security;
alter table public.tax_documents enable row level security;
alter table public.tax_exemptions enable row level security;
alter table public.managed_documents enable row level security;
alter table public.app_notifications enable row level security;
alter table public.notification_channel_logs enable row level security;

create policy employees_org on public.employees for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy employee_attendance_org on public.employee_attendance for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy salary_runs_org on public.salary_runs for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy employee_incentives_org on public.employee_incentives for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy employee_performance_org on public.employee_performance for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy tax_profiles_org on public.tax_profiles for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy tax_rates_org on public.tax_rates for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy tax_documents_org on public.tax_documents for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy tax_exemptions_org on public.tax_exemptions for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy managed_documents_org on public.managed_documents for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy app_notifications_org on public.app_notifications for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
create policy notification_channel_logs_org on public.notification_channel_logs for all
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());
