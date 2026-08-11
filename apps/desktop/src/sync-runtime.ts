import { SyncCoordinator } from "@electronic-erp/offline";
import { HttpCloudTransport, SyncEngine } from "@electronic-erp/sync";
import type { OfflineRuntime } from "./db/bootstrap.js";
import type { SecureTokenStore } from "./secure-store.js";

export interface DesktopSyncRuntime {
  coordinator: SyncCoordinator;
  engine: SyncEngine;
  start: () => void;
  stop: () => void;
  setOnline: (online: boolean) => void;
  syncNow: () => Promise<ReturnType<SyncCoordinator["getProgress"]>>;
  getProgress: () => ReturnType<SyncCoordinator["getProgress"]>;
}

function readSetting(runtime: OfflineRuntime, key: string): string | null {
  const value = runtime.localDb.getSetting(key);
  return value && value.trim() ? value : null;
}

/**
 * Builds SyncCoordinator when device is provisioned and apiUrl + token exist.
 * Returns null until first-run provisioning stores credentials.
 */
export function createDesktopSync(
  runtime: OfflineRuntime,
  secure: SecureTokenStore,
  getOnline: () => boolean,
): DesktopSyncRuntime | null {
  const device = runtime.localDb.getDevice();
  if (!device?.organizationId || !device.registeredAt) return null;

  const apiUrl = readSetting(runtime, "sync.apiUrl");
  if (!apiUrl) return null;

  const transport = new HttpCloudTransport({
    apiUrl,
    getAccessToken: () => {
      const enc = readSetting(runtime, "secure.accessToken");
      if (!enc) return null;
      try {
        return secure.decryptString(enc);
      } catch {
        return null;
      }
    },
  });

  const engine = new SyncEngine(transport);
  engine.setOnline(getOnline());

  const coordinator = new SyncCoordinator(runtime.localDb, engine, {
    organizationId: device.organizationId,
  });
  coordinator.setOnline(getOnline());

  return {
    coordinator,
    engine,
    start: () => {
      coordinator.setOnline(getOnline());
      coordinator.startBackgroundSync(15_000);
      if (getOnline()) void coordinator.syncAll().catch(() => undefined);
    },
    stop: () => coordinator.stopBackgroundSync(),
    setOnline: (online) => {
      coordinator.setOnline(online);
      if (online) void coordinator.syncAll().catch(() => undefined);
    },
    syncNow: () => coordinator.syncAll(),
    getProgress: () => coordinator.getProgress(),
  };
}
