/** Offline SQLite for POS: sales, holds, returns — survives refresh/restart. */
export const OFFLINE_POS_SCHEMA = `
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL,
  customer_id TEXT,
  subtotal TEXT NOT NULL,
  discount_total TEXT NOT NULL,
  tax_total TEXT NOT NULL,
  grand_total TEXT NOT NULL,
  paid_total TEXT NOT NULL,
  remaining_total TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  operation_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  cart_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_idempotency_uidx
  ON sales(organization_id, idempotency_key);

CREATE TABLE IF NOT EXISTS held_sales (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  hold_label TEXT,
  cart_snapshot TEXT NOT NULL,
  held_at TEXT NOT NULL,
  status TEXT NOT NULL,
  device_id TEXT
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  original_sale_id TEXT NOT NULL,
  return_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  refund_amount TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  operation_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_sale_mutations (
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

CREATE UNIQUE INDEX IF NOT EXISTS offline_sale_mutations_op_uidx
  ON offline_sale_mutations(organization_id, operation_id);
`;
