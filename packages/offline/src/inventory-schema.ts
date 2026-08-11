/** Offline SQLite mirror for inventory operations required by offline POS. */
export const OFFLINE_INVENTORY_SCHEMA = `
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  allow_negative_stock INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stock_balances (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  qty_on_hand TEXT NOT NULL DEFAULT '0',
  qty_reserved TEXT NOT NULL DEFAULT '0',
  qty_damaged TEXT NOT NULL DEFAULT '0',
  qty_in_transit TEXT NOT NULL DEFAULT '0',
  reorder_level TEXT NOT NULL DEFAULT '0',
  overstock_level TEXT,
  average_unit_cost TEXT NOT NULL DEFAULT '0',
  last_movement_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_balances_slot_uidx
  ON stock_balances(warehouse_id, product_id, IFNULL(variant_id, ''));

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  batch_id TEXT,
  serial_number_id TEXT,
  unit_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  qty_delta TEXT NOT NULL,
  qty_before TEXT NOT NULL,
  qty_after TEXT NOT NULL,
  unit_cost TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  reason TEXT,
  occurred_at TEXT NOT NULL,
  device_id TEXT,
  offline_transaction_id TEXT,
  operation_id TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  created_by TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_operation_uidx
  ON stock_movements(organization_id, operation_id);

CREATE TABLE IF NOT EXISTS stock_batches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  batch_number TEXT NOT NULL,
  manufacturing_date TEXT,
  expiry_date TEXT,
  warranty_start TEXT,
  warranty_end TEXT,
  qty_on_hand TEXT NOT NULL DEFAULT '0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS stock_serials (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  batch_id TEXT,
  serial_number TEXT NOT NULL,
  status TEXT NOT NULL,
  warehouse_id TEXT,
  manufacturing_date TEXT,
  expiry_date TEXT,
  warranty_start TEXT,
  warranty_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_serials_org_uidx
  ON stock_serials(organization_id, serial_number) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS stock_reservations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  unit_id TEXT NOT NULL,
  qty TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  reserved_at TEXT NOT NULL,
  released_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS offline_stock_mutations (
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

CREATE UNIQUE INDEX IF NOT EXISTS offline_stock_mutations_op_uidx
  ON offline_stock_mutations(organization_id, operation_id);
`;
