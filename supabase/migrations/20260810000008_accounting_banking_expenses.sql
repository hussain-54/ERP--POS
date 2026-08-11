-- Phase 8: Accounting + Banking + Expense Engine

insert into public.permissions (key, module, action, description) values
  ('accounts.read', 'accounts', 'read', 'View chart of accounts and journals'),
  ('accounts.write', 'accounts', 'write', 'Manage accounts and post vouchers'),
  ('banking.manage', 'banking', 'manage', 'Bank accounts, statements, reconciliation'),
  ('expenses.manage', 'expenses', 'manage', 'Expense vouchers and categories'),
  ('reports.finance', 'reports', 'finance', 'Financial reports')
on conflict (key) do nothing;

-- Extend COA
alter table public.accounts
  add column if not exists parent_id uuid references public.accounts(id),
  add column if not exists system_role text
    check (system_role is null or system_role in (
      'cash','bank','customer_receivable','supplier_payable','sales','purchases',
      'expenses','income','discounts','sales_returns','purchase_returns','tax_input','tax_output',
      'inventory','cogs','equity'
    )),
  add column if not exists is_postable boolean not null default true;

-- Seed standard chart (idempotent per org via unique code — done in app seed)

-- Vouchers
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  voucher_number text not null,
  voucher_type text not null check (voucher_type in (
    'receipt','payment','expense','journal','transfer'
  )),
  voucher_date date not null default (current_date),
  memo text,
  party_type text check (party_type is null or party_type in ('customer','supplier','other')),
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  journal_entry_id uuid references public.journal_entries(id),
  status text not null default 'posted' check (status in ('draft','posted','void')),
  total_amount numeric(18,2) not null default 0,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  version integer not null default 1,
  unique (organization_id, voucher_number),
  unique (organization_id, idempotency_key)
);

create table if not exists public.voucher_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  line_no integer not null,
  account_id uuid not null references public.accounts(id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  memo text,
  unique (voucher_id, line_no)
);

-- Banking
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  gl_account_id uuid not null references public.accounts(id),
  account_kind text not null check (account_kind in ('cash','bank','online')),
  name text not null,
  bank_name text,
  account_number text,
  iban text,
  currency text not null default 'PKR',
  opening_balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  unique (organization_id, name)
);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  import_label text not null,
  imported_at timestamptz not null default now(),
  row_count integer not null default 0,
  created_by uuid
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  import_id uuid references public.bank_statement_imports(id) on delete set null,
  statement_date date not null,
  description text,
  reference text,
  amount numeric(18,2) not null,
  balance_after numeric(18,2),
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched','matched','ignored')),
  matched_journal_entry_id uuid references public.journal_entries(id),
  matched_voucher_id uuid references public.vouchers(id),
  created_at timestamptz not null default now()
);

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  period_start date not null,
  period_end date not null,
  statement_balance numeric(18,2) not null,
  book_balance numeric(18,2) not null,
  difference numeric(18,2) not null default 0,
  status text not null default 'open' check (status in ('open','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Expenses
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  system_key text check (system_key is null or system_key in (
    'rent','electricity','salary','internet','transport','petrol','repair',
    'marketing','office','miscellaneous','custom'
  )),
  gl_account_id uuid references public.accounts(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid references public.branches(id),
  expense_number text not null,
  category_id uuid not null references public.expense_categories(id),
  expense_date date not null default (current_date),
  amount numeric(18,2) not null check (amount > 0),
  tax_amount numeric(18,2) not null default 0,
  payment_account_id uuid references public.bank_accounts(id),
  payee text,
  notes text,
  voucher_id uuid references public.vouchers(id),
  journal_entry_id uuid references public.journal_entries(id),
  status text not null default 'posted' check (status in ('draft','posted','void')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (organization_id, expense_number),
  unique (organization_id, idempotency_key)
);

create index if not exists vouchers_date_idx on public.vouchers (organization_id, voucher_date desc);
create index if not exists bank_statement_lines_account_idx on public.bank_statement_lines (bank_account_id, statement_date);
create index if not exists expenses_date_idx on public.expenses (organization_id, expense_date desc);
create index if not exists journal_entry_lines_account_idx on public.journal_entry_lines (account_id);

-- RLS
alter table public.vouchers enable row level security;
alter table public.voucher_lines enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliations enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy vouchers_org on public.vouchers for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy voucher_lines_org on public.voucher_lines for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy bank_accounts_org on public.bank_accounts for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy bank_statement_imports_org on public.bank_statement_imports for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy bank_statement_lines_org on public.bank_statement_lines for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy bank_reconciliations_org on public.bank_reconciliations for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy expense_categories_org on public.expense_categories for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
create policy expenses_org on public.expenses for all using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());
