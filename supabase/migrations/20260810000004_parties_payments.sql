-- Phase 4: Customers, Suppliers, Payments, Credit, Installments, Ledgers

insert into public.permissions (key, module, action, description) values
  ('customers.read', 'customers', 'read', 'View customers'),
  ('customers.write', 'customers', 'write', 'Manage customers'),
  ('suppliers.read', 'suppliers', 'read', 'View suppliers'),
  ('suppliers.write', 'suppliers', 'write', 'Manage suppliers'),
  ('payments.receive', 'payments', 'receive', 'Receive customer payments'),
  ('payments.pay', 'payments', 'pay', 'Make supplier payments'),
  ('payments.configure', 'payments', 'configure', 'Configure payment methods'),
  ('credit.manage', 'credit', 'manage', 'Manage credit limits'),
  ('credit.approve', 'credit', 'approve', 'Approve credit over-limit'),
  ('installments.manage', 'installments', 'manage', 'Manage installment plans'),
  ('ledgers.view', 'ledgers', 'view', 'View party ledgers')
on conflict (key) do nothing;

-- Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  name_ur text,
  mobile text,
  alternate_mobile text,
  address text,
  cnic text,
  reference_name text,
  customer_type text not null default 'retail'
    check (customer_type in ('retail','wholesale','dealer')),
  credit_limit numeric(18,2) not null default 0,
  credit_days integer not null default 0,
  total_purchases numeric(18,2) not null default 0,
  total_paid numeric(18,2) not null default 0,
  outstanding numeric(18,2) not null default 0,
  is_blocked boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

create index if not exists customers_org_mobile_idx on public.customers (organization_id, mobile) where deleted_at is null;

-- Suppliers
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  company_name text not null,
  contact_person text,
  mobile text,
  address text,
  ntn text,
  strn text,
  bank_name text,
  bank_account_title text,
  bank_account_number text,
  bank_iban text,
  payable_balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

-- Configurable payment methods
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  kind text not null check (kind in (
    'cash','bank','card','jazzcash','easypaisa','sadapay','online','credit','installment','other'
  )),
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, code)
);

-- Payment headers (customer receive / supplier pay)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  direction text not null check (direction in ('receive','pay')),
  party_type text not null check (party_type in ('customer','supplier')),
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  total_amount numeric(18,2) not null check (total_amount > 0),
  reference text,
  notes text,
  receipt_number text,
  status text not null default 'posted' check (status in ('draft','posted','void')),
  source_type text,
  source_id uuid,
  idempotency_key uuid not null,
  device_id text,
  offline_transaction_id uuid,
  operation_id uuid,
  sync_state text not null default 'synced'
    check (sync_state in ('pending','synced','conflict','rejected')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1,
  unique (organization_id, idempotency_key),
  check (
    (party_type = 'customer' and customer_id is not null and supplier_id is null)
    or (party_type = 'supplier' and supplier_id is not null and customer_id is null)
  )
);

create unique index if not exists payments_operation_uidx
  on public.payments (organization_id, operation_id)
  where operation_id is not null;

create table if not exists public.payment_splits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  payment_id uuid not null references public.payments(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id),
  amount numeric(18,2) not null check (amount > 0),
  reference text,
  created_at timestamptz not null default now()
);

-- Immutable party ledger
create table if not exists public.party_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  party_type text not null check (party_type in ('customer','supplier')),
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  entry_type text not null check (entry_type in (
    'sale','payment','return','discount','adjustment','purchase','credit_note','debit_note'
  )),
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  balance_after numeric(18,2) not null,
  source_type text not null,
  source_id uuid not null,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  operation_id uuid,
  check (debit > 0 or credit > 0),
  check (
    (party_type = 'customer' and customer_id is not null)
    or (party_type = 'supplier' and supplier_id is not null)
  )
);

create index if not exists party_ledger_customer_idx
  on public.party_ledger_entries (customer_id, occurred_at)
  where customer_id is not null;
create index if not exists party_ledger_supplier_idx
  on public.party_ledger_entries (supplier_id, occurred_at)
  where supplier_id is not null;

-- Credit approvals / reminders
create table if not exists public.credit_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  customer_id uuid not null references public.customers(id),
  requested_amount numeric(18,2) not null,
  credit_limit numeric(18,2) not null,
  outstanding_before numeric(18,2) not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  requested_by uuid,
  approved_by uuid,
  decided_at timestamptz,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create table if not exists public.credit_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  customer_id uuid not null references public.customers(id),
  due_date date not null,
  outstanding numeric(18,2) not null,
  reminder_type text not null default 'overdue'
    check (reminder_type in ('due_soon','overdue','final')),
  status text not null default 'pending'
    check (status in ('pending','sent','cancelled')),
  message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Installments
create table if not exists public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  customer_id uuid not null references public.customers(id),
  source_type text not null,
  source_id uuid not null,
  total_amount numeric(18,2) not null check (total_amount > 0),
  down_payment numeric(18,2) not null default 0 check (down_payment >= 0),
  remaining_amount numeric(18,2) not null check (remaining_amount >= 0),
  installment_count integer not null check (installment_count > 0),
  monthly_amount numeric(18,2) not null check (monthly_amount > 0),
  start_date date not null,
  status text not null default 'active'
    check (status in ('draft','active','completed','defaulted','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1
);

create table if not exists public.installment_schedule (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  sequence_no integer not null,
  due_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  paid_amount numeric(18,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending','partial','paid','overdue','waived')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, sequence_no)
);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  payment_id uuid not null references public.payments(id),
  receipt_number text not null,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, receipt_number)
);

-- RLS
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.payment_splits enable row level security;
alter table public.party_ledger_entries enable row level security;
alter table public.credit_approvals enable row level security;
alter table public.credit_reminders enable row level security;
alter table public.installment_plans enable row level security;
alter table public.installment_schedule enable row level security;
alter table public.payment_receipts enable row level security;

create policy customers_org on public.customers for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy suppliers_org on public.suppliers for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy payment_methods_org on public.payment_methods for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy payments_org on public.payments for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy payment_splits_org on public.payment_splits for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy party_ledger_entries_org on public.party_ledger_entries for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy credit_approvals_org on public.credit_approvals for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy credit_reminders_org on public.credit_reminders for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy installment_plans_org on public.installment_plans for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy installment_schedule_org on public.installment_schedule for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy payment_receipts_org on public.payment_receipts for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
