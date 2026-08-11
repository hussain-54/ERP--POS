import { describe, expect, it } from "vitest";
import {
  OFFLINE_MIGRATION_PLAN,
  applyOfflineMigrations,
  verifySqliteIntegrity,
  type SqliteDatabaseLike,
} from "./sqlite-migrations.js";
import { SqliteKvDurableStorage } from "./sqlite-kv-storage.js";
import { LocalDatabase } from "./local-database.js";

/** Tiny in-memory SQL stub sufficient for migration + KV tests (no native dep). */
class MemorySqlDb implements SqliteDatabaseLike {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();

  exec(sql: string): void {
    const creates = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)];
    for (const m of creates) {
      const name = m[1]!;
      if (!this.tables.has(name)) this.tables.set(name, new Map());
    }
  }

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    return {
      get: (...params: unknown[]) => {
        if (/FROM schema_migrations WHERE id/i.test(normalized)) {
          const id = String(params[0]);
          const table = this.tables.get("schema_migrations");
          return table?.has(id) ? { ok: 1 } : undefined;
        }
        if (/FROM app_kv WHERE key/i.test(normalized)) {
          const key = String(params[0]);
          const row = this.tables.get("app_kv")?.get(key);
          return row ? { value: row.value } : undefined;
        }
        if (/PRAGMA integrity_check/i.test(normalized)) {
          return { integrity_check: "ok" };
        }
        return undefined;
      },
      run: (...params: unknown[]) => {
        if (/INSERT INTO schema_migrations/i.test(normalized)) {
          const [id, appliedAt] = params as [string, string];
          const table = this.tables.get("schema_migrations") ?? new Map();
          table.set(id, { id, applied_at: appliedAt });
          this.tables.set("schema_migrations", table);
          return { changes: 1 };
        }
        if (/INSERT INTO app_kv/i.test(normalized)) {
          const [key, value, updatedAt] = params as [string, string, string];
          const table = this.tables.get("app_kv") ?? new Map();
          table.set(key, { key, value, updated_at: updatedAt });
          this.tables.set("app_kv", table);
          return { changes: 1 };
        }
        return { changes: 0 };
      },
      all: () => [],
    };
  }

  pragma(): string {
    return "ok";
  }
}

describe("sqlite migrations + kv storage", () => {
  it("applies migration plan idempotently", () => {
    const db = new MemorySqlDb();
    const first = applyOfflineMigrations(db);
    expect(first.length).toBe(OFFLINE_MIGRATION_PLAN.length);
    const second = applyOfflineMigrations(db);
    expect(second).toEqual([]);
    expect(verifySqliteIntegrity(db).ok).toBe(true);
  });

  it("persists LocalDatabase document through SqliteKvDurableStorage", async () => {
    const db = new MemorySqlDb();
    applyOfflineMigrations(db);
    const storage = new SqliteKvDurableStorage(db);
    const local = new LocalDatabase(storage);
    await local.open();
    const deviceId = await local.ensureDeviceId();
    expect(deviceId).toBeTruthy();

    const again = new LocalDatabase(new SqliteKvDurableStorage(db));
    await again.open();
    expect(await again.ensureDeviceId()).toBe(deviceId);
  });
});
