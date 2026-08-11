import { ipcMain, shell } from "electron";
import type { HardwareService } from "@electronic-erp/hardware";
import { IpcChannels } from "./constants.js";
import type { OfflineRuntime } from "./db/bootstrap.js";
import {
  getFirstRunState,
  provisionDeviceLocally,
  registerDeviceWithApi,
} from "./first-run.js";
import type { DesktopPaths } from "./paths.js";
import type { SecureTokenStore } from "./secure-store.js";
import { createDesktopSync, type DesktopSyncRuntime } from "./sync-runtime.js";
import type { DesktopUpdater } from "./updater.js";
import { desktopReadiness } from "./readiness.js";

export interface DesktopServices {
  runtime: OfflineRuntime;
  paths: DesktopPaths;
  hardware: HardwareService;
  secure: SecureTokenStore;
  updater: DesktopUpdater;
  getOnline: () => boolean;
  setOnline: (online: boolean) => void;
  getSync: () => DesktopSyncRuntime | null;
  setSync: (sync: DesktopSyncRuntime | null) => void;
}

function cloudDeviceId(runtime: OfflineRuntime): string {
  return runtime.localDb.getDevice()?.id ?? runtime.deviceId;
}

export function registerIpcHandlers(services: DesktopServices): void {
  const {
    runtime,
    paths,
    hardware,
    secure,
    updater,
    getOnline,
    setOnline,
    getSync,
    setSync,
  } = services;

  function ensureSync(): DesktopSyncRuntime | null {
    let sync = getSync();
    if (!sync) {
      sync = createDesktopSync(runtime, secure, getOnline);
      if (sync) {
        setSync(sync);
        sync.start();
      }
    }
    return sync;
  }

  ipcMain.handle(IpcChannels.getStatus, async () => {
    const ready = desktopReadiness();
    const sync = getSync();
    return {
      ...ready,
      deviceId: cloudDeviceId(runtime),
      migrationsApplied: runtime.migrationsApplied,
      integrity: runtime.integrity,
      online: getOnline(),
      sync: sync?.getProgress() ?? null,
    };
  });

  ipcMain.handle(IpcChannels.getPaths, async () => ({
    userData: paths.userData,
    databaseDir: paths.databaseDir,
    databaseFile: paths.databaseFile,
    logsDir: paths.logsDir,
    configDir: paths.configDir,
    cacheDir: paths.cacheDir,
    installRoot: paths.installRoot,
  }));

  ipcMain.handle(IpcChannels.getFirstRunState, async () =>
    getFirstRunState(runtime, getOnline()),
  );

  ipcMain.handle(
    IpcChannels.provisionDevice,
    async (
      _evt,
      raw: {
        organizationId?: string;
        branchId?: string;
        name?: string;
        apiUrl?: string;
        accessToken?: string;
      },
    ) => {
      if (!getOnline()) {
        throw new Error(
          "Cannot provision offline: initial cloud registration requires connectivity.",
        );
      }
      const organizationId = String(raw?.organizationId ?? "").trim();
      const branchId = String(raw?.branchId ?? "").trim();
      const name = String(raw?.name ?? "Windows POS").trim();
      const apiUrl = String(raw?.apiUrl ?? "").trim();
      const accessToken = String(raw?.accessToken ?? "").trim();
      if (!organizationId || !branchId || !apiUrl || !accessToken) {
        throw new Error(
          "organizationId, branchId, apiUrl, and accessToken are required",
        );
      }

      const registered = await registerDeviceWithApi({
        apiUrl,
        accessToken,
        organizationId,
        branchId,
        deviceKey: runtime.deviceKey,
        name,
      });

      const device = await provisionDeviceLocally(runtime.localDb, {
        organizationId,
        branchId,
        name,
        registeredDeviceId: registered.deviceId,
      });

      await runtime.localDb.setSetting(
        "secure.accessToken",
        secure.encryptString(accessToken),
      );
      await runtime.localDb.setSetting("sync.apiUrl", apiUrl);

      getSync()?.stop();
      const sync = createDesktopSync(runtime, secure, getOnline);
      setSync(sync);
      sync?.start();

      return { ok: true, device };
    },
  );

  ipcMain.handle(IpcChannels.setConnectivity, async (_evt, online: boolean) => {
    setOnline(Boolean(online));
    ensureSync()?.setOnline(Boolean(online));
    return getFirstRunState(runtime, getOnline());
  });

  ipcMain.handle(
    IpcChannels.postOfflineSale,
    async (
      _evt,
      payload: {
        sale: Parameters<OfflineRuntime["pos"]["postSale"]>[0]["sale"];
      },
    ) => {
      const state = getFirstRunState(runtime, getOnline());
      if (!state.provisioned) {
        throw new Error("Device is not provisioned — cannot post offline sales");
      }
      const sale = await runtime.pos.postSale({
        sale: payload.sale,
        deviceId: cloudDeviceId(runtime),
      });
      if (getOnline()) void ensureSync()?.syncNow().catch(() => undefined);
      return sale;
    },
  );

  ipcMain.handle(IpcChannels.listPendingSales, async () =>
    runtime.pos.listPendingSales(),
  );

  ipcMain.handle(IpcChannels.syncNow, async () => {
    const sync = ensureSync();
    if (!sync) throw new Error("Sync not available — provision device with apiUrl + token first");
    return sync.syncNow();
  });

  ipcMain.handle(IpcChannels.syncStatus, async () => ensureSync()?.getProgress() ?? null);

  ipcMain.handle(IpcChannels.hardwareStatus, async () => hardware.listStatuses());

  ipcMain.handle(
    IpcChannels.printReceipt,
    async (_evt, job: { payload?: string; copies?: number }) => {
      try {
        return await hardware.print({
          type: "receipt_80",
          payload: String(job?.payload ?? ""),
          copies: job?.copies ?? 1,
          documentType: "sales_invoice",
        });
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(IpcChannels.openCashDrawer, async () => {
    try {
      return await hardware.openDrawer();
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(
    IpcChannels.secureSet,
    async (_evt, input: { key?: string; value?: string }) => {
      const key = String(input?.key ?? "").trim();
      if (!key || !/^[a-zA-Z0-9._-]{1,64}$/.test(key)) {
        throw new Error("Invalid secure key");
      }
      const enc = secure.encryptString(String(input?.value ?? ""));
      await runtime.localDb.setSetting(`secure.${key}`, enc);
      return { ok: true };
    },
  );

  ipcMain.handle(IpcChannels.secureGet, async (_evt, keyRaw: string) => {
    const key = String(keyRaw ?? "").trim();
    if (!key || !/^[a-zA-Z0-9._-]{1,64}$/.test(key)) {
      throw new Error("Invalid secure key");
    }
    const enc = runtime.localDb.getSetting(`secure.${key}`);
    if (!enc) return { value: null };
    return { value: secure.decryptString(enc) };
  });

  ipcMain.handle(IpcChannels.secureDelete, async (_evt, keyRaw: string) => {
    const key = String(keyRaw ?? "").trim();
    await runtime.localDb.setSetting(`secure.${key}`, "");
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.checkForUpdates, async () => updater.check());
  ipcMain.handle(IpcChannels.downloadUpdate, async () => updater.download());
  ipcMain.handle(IpcChannels.quitAndInstall, async () =>
    updater.quitAndInstall(),
  );

  ipcMain.handle(IpcChannels.openExternal, async (_evt, url: string) => {
    const value = String(url ?? "");
    if (!/^https?:\/\//i.test(value)) {
      throw new Error("Only http(s) URLs allowed");
    }
    await shell.openExternal(value);
    return { ok: true };
  });
}
