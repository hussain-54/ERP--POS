import Database from "better-sqlite3";
import {
  LocalDatabase,
  OfflinePosEngine,
  SqliteKvDurableStorage,
  applyOfflineMigrations,
  verifySqliteIntegrity,
} from "@electronic-erp/offline";
import type { DesktopPaths } from "../paths.js";

export interface OfflineRuntime {
  sqlite: Database.Database;
  localDb: LocalDatabase;
  pos: OfflinePosEngine;
  migrationsApplied: string[];
  integrity: { ok: boolean; detail: string };
  deviceId: string;
  deviceKey: string;
}

export async function bootstrapOfflineDatabase(
  paths: DesktopPaths,
): Promise<OfflineRuntime> {
  const sqlite = new Database(paths.databaseFile);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const migrationsApplied = applyOfflineMigrations(sqlite);
  const integrity = verifySqliteIntegrity(sqlite);
  if (!integrity.ok) {
    sqlite.close();
    throw new Error(`SQLite integrity check failed: ${integrity.detail}`);
  }

  const storage = new SqliteKvDurableStorage(sqlite);
  const localDb = new LocalDatabase(storage);
  await localDb.open();
  const deviceId = await localDb.ensureDeviceId();
  const deviceKey = await localDb.ensureDeviceKey();
  const pos = new OfflinePosEngine(localDb);

  return {
    sqlite,
    localDb,
    pos,
    migrationsApplied,
    integrity,
    deviceId,
    deviceKey,
  };
}
