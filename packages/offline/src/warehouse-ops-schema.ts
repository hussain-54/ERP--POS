/** Offline SQLite for purchases / transfers / deliveries needed by offline POS ops. */
export const OFFLINE_WAREHOUSE_OPS_SCHEMA = `
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  grand_total TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  operation_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS purchases_idempotency_uidx
  ON purchases(organization_id, idempotency_key);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  original_purchase_id TEXT NOT NULL,
  refund_amount TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  transfer_number TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  delivery_number TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_warehouse_mutations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  offline_transaction_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sync_state TEXT NOT NULL DEFAULT 'pending'
);

CREATE UNIQUE INDEX IF NOT EXISTS offline_warehouse_mutations_op_uidx
  ON offline_warehouse_mutations(organization_id, operation_id);
`;
