export const APP_ID = "com.electronicerp.pos";
export const APP_NAME = "Electronic ERP POS";
export const APP_VERSION = "0.1.0";

/** Typed IPC channel names — keep in sync with preload allowlist. */
export const IpcChannels = {
  getStatus: "desktop:getStatus",
  getPaths: "desktop:getPaths",
  getFirstRunState: "desktop:getFirstRunState",
  provisionDevice: "desktop:provisionDevice",
  hardwareStatus: "desktop:hardwareStatus",
  printReceipt: "desktop:printReceipt",
  openCashDrawer: "desktop:openCashDrawer",
  secureSet: "desktop:secureSet",
  secureGet: "desktop:secureGet",
  secureDelete: "desktop:secureDelete",
  checkForUpdates: "desktop:checkForUpdates",
  downloadUpdate: "desktop:downloadUpdate",
  quitAndInstall: "desktop:quitAndInstall",
  openExternal: "desktop:openExternal",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export const ALLOWED_IPC_CHANNELS: readonly string[] = Object.values(IpcChannels);
