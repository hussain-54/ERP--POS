/** Offline SQLite mirror for customers, suppliers, payments, credit, installments. */
export const OFFLINE_PARTIES_SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_ur TEXT,
  mobile TEXT,
  alternate_mobile TEXT,
  address TEXT,
  cnic TEXT,
  reference_name TEXT,
  customer_type TEXT NOT NULL,
  credit_limit TEXT NOT NULL DEFAULT '0',
  credit_days INTEGER NOT NULL DEFAULT 0,
  total_purchases TEXT NOT NULL DEFAULT '0',
  total_paid TEXT NOT NULL DEFAULT '0',
  outstanding TEXT NOT NULL DEFAULT '0',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  mobile TEXT,
  address TEXT,
  ntn TEXT,
  strn TEXT,
  bank_name TEXT,
  bank_account_title TEXT,
  bank_account_number TEXT,
  bank_iban TEXT,
  payable_balance TEXT NOT NULL DEFAULT '0',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  party_type TEXT NOT NULL,
  customer_id TEXT,
  supplier_id TEXT,
  total_amount TEXT NOT NULL,
  receipt_number TEXT,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  operation_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_uidx
  ON payments(organization_id, idempotency_key);

CREATE TABLE IF NOT EXISTS payment_splits (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  payment_method_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  reference TEXT
);

CREATE TABLE IF NOT EXISTS party_ledger_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  party_type TEXT NOT NULL,
  customer_id TEXT,
  supplier_id TEXT,
  entry_type TEXT NOT NULL,
  debit TEXT NOT NULL,
  credit TEXT NOT NULL,
  balance_after TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  operation_id TEXT
);

CREATE TABLE IF NOT EXISTS installment_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  down_payment TEXT NOT NULL,
  remaining_amount TEXT NOT NULL,
  installment_count INTEGER NOT NULL,
  monthly_amount TEXT NOT NULL,
  start_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS installment_schedule (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount TEXT NOT NULL,
  paid_amount TEXT NOT NULL DEFAULT '0',
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_payment_mutations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  offline_transaction_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending'
);

CREATE UNIQUE INDEX IF NOT EXISTS offline_payment_mutations_op_uidx
  ON offline_payment_mutations(organization_id, operation_id);
`;
