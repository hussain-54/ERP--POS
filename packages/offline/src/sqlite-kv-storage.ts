import type { DurableStorage } from "./durable-storage.js";
import type { SqliteDatabaseLike } from "./sqlite-migrations.js";

const DOCUMENT_KEY = "local_database_document";

/**
 * DurableStorage backed by SQLite `app_kv` — used by LocalDatabase while
 * relational offline DDL coexists in the same .db file.
 */
export class SqliteKvDurableStorage implements DurableStorage {
  constructor(private readonly db: SqliteDatabaseLike) {}

  async read(): Promise<Record<string, unknown>> {
    try {
      const row = this.db
        .prepare("SELECT value FROM app_kv WHERE key = ?")
        .get(DOCUMENT_KEY) as { value?: string } | undefined;
      if (!row?.value) return {};
      return JSON.parse(row.value) as Record<string, unknown>;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLite/durable storage read failed: ${message}`);
    }
  }

  async write(data: Record<string, unknown>): Promise<void> {
    try {
      const now = new Date().toISOString();
      this.db
        .prepare(
          `INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .run(DOCUMENT_KEY, JSON.stringify(data), now);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`SQLite/durable storage write failed: ${message}`);
    }
  }
}
