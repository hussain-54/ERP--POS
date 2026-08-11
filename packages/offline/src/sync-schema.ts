/**
 * SQLite DDL for production offline engine — mirrors canonical ERP identity (UUID)
 * plus local sync helpers (outbox/inbox/conflicts). Not a separate business model.
 */
export const OFFLINE_SYNC_ENGINE_SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices_local (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  device_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  registered_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Syncable entity envelope columns: id, device_id, version, timestamps, sync_state, last_synced_at
CREATE TABLE IF NOT EXISTS local_entities (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS local_entities_type_sync_idx
  ON local_entities (entity_type, sync_state);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  device_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  timestamp TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  next_retry_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sync_outbox_status_idx
  ON sync_outbox (status, next_retry_at);

CREATE TABLE IF NOT EXISTS sync_inbox (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  server_cursor TEXT,
  received_at TEXT NOT NULL,
  applied_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sync_conflicts_local (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  server_version INTEGER NOT NULL,
  client_version INTEGER NOT NULL,
  server_payload TEXT NOT NULL,
  client_payload TEXT NOT NULL,
  conflict_type TEXT NOT NULL DEFAULT 'version',
  resolution TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  remarks TEXT
);

CREATE TABLE IF NOT EXISTS sync_metadata (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  last_pulled_at TEXT,
  last_pushed_at TEXT,
  server_cursor TEXT,
  client_cursor TEXT,
  UNIQUE (device_id, table_name)
);

CREATE TABLE IF NOT EXISTS stock_movements_local (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty_delta TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  device_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_local (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  offline_transaction_id TEXT NOT NULL UNIQUE,
  operation_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  payload TEXT NOT NULL,
  grand_total REAL NOT NULL DEFAULT 0
);
`;

export const SYNC_SCHEMA_MIGRATION_ID = "20260810000010_offline_sync_engine";
