import { OFFLINE_FOUNDATION_SCHEMA } from "./sqlite-schema.js";
import { OFFLINE_SYNC_ENGINE_SCHEMA, SYNC_SCHEMA_MIGRATION_ID } from "./sync-schema.js";
import { OFFLINE_POS_SCHEMA } from "./pos-schema.js";
import { OFFLINE_CATALOG_SCHEMA } from "./catalog-schema.js";
import { OFFLINE_INVENTORY_SCHEMA } from "./inventory-schema.js";
import { OFFLINE_PARTIES_SCHEMA } from "./parties-schema.js";
import { OFFLINE_WAREHOUSE_OPS_SCHEMA } from "./warehouse-ops-schema.js";

/**
 * Minimal SQLite surface used by offline migrations + KV durable storage.
 * Satisfied by better-sqlite3 Database (main process only).
 */
export interface SqliteDatabaseLike {
  exec(sql: string): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prepare(sql: string): any;
  pragma?(source: string, options?: { simple?: boolean }): unknown;
}

/** Ordered SQLite migrations applied on first launch / upgrade. */
export const OFFLINE_MIGRATION_PLAN: Array<{ id: string; sql: string }> = [
  { id: "20260810000001_offline_foundation", sql: OFFLINE_FOUNDATION_SCHEMA },
  { id: SYNC_SCHEMA_MIGRATION_ID, sql: OFFLINE_SYNC_ENGINE_SCHEMA },
  { id: "20260810000011_offline_pos", sql: OFFLINE_POS_SCHEMA },
  { id: "20260810000012_offline_catalog", sql: OFFLINE_CATALOG_SCHEMA },
  { id: "20260810000013_offline_inventory", sql: OFFLINE_INVENTORY_SCHEMA },
  { id: "20260810000014_offline_parties", sql: OFFLINE_PARTIES_SCHEMA },
  { id: "20260810000015_offline_warehouse_ops", sql: OFFLINE_WAREHOUSE_OPS_SCHEMA },
  {
    id: "20260811000020_offline_app_kv",
    sql: `
CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`,
  },
  {
    id: "20260812000003_offline_customer_email",
    sql: `
ALTER TABLE customers ADD COLUMN email TEXT;
`,
  },
];
export function applyOfflineMigrations(db: SqliteDatabaseLike): string[] {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied: string[] = [];
  const has = db.prepare("SELECT 1 AS ok FROM schema_migrations WHERE id = ?");
  const insert = db.prepare(
    "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
  );

  for (const migration of OFFLINE_MIGRATION_PLAN) {
    const row = has.get(migration.id) as { ok?: number } | undefined;
    if (row?.ok) continue;
    db.exec(migration.sql);
    insert.run(migration.id, new Date().toISOString());
    applied.push(migration.id);
  }
  return applied;
}

export function verifySqliteIntegrity(db: SqliteDatabaseLike): {
  ok: boolean;
  detail: string;
} {
  try {
    if (typeof db.pragma === "function") {
      const result = db.pragma("integrity_check", { simple: true });
      const detail = String(result ?? "unknown");
      return { ok: detail.toLowerCase() === "ok", detail };
    }
    const row = db.prepare("PRAGMA integrity_check").get() as
      | { integrity_check?: string }
      | string
      | undefined;
    const detail =
      typeof row === "string"
        ? row
        : String(
            (row as { integrity_check?: string } | undefined)?.integrity_check ??
              "unknown",
          );
    return { ok: detail.toLowerCase() === "ok", detail };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
