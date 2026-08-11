/**
 * Preload (CommonJS) — copied to dist/preload.cjs on build.
 * Exposes a narrow API; Node is not available in the renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED = new Set([
  "desktop:getStatus",
  "desktop:getPaths",
  "desktop:getFirstRunState",
  "desktop:provisionDevice",
  "desktop:setConnectivity",
  "desktop:postOfflineSale",
  "desktop:listPendingSales",
  "desktop:hardwareStatus",
  "desktop:printReceipt",
  "desktop:openCashDrawer",
  "desktop:secureSet",
  "desktop:secureGet",
  "desktop:secureDelete",
  "desktop:checkForUpdates",
  "desktop:downloadUpdate",
  "desktop:quitAndInstall",
  "desktop:openExternal",
  "desktop:syncNow",
  "desktop:syncStatus",
]);

function invoke(channel, ...args) {
  if (!ALLOWED.has(channel)) {
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld("electronicErpDesktop", {
  getStatus: () => invoke("desktop:getStatus"),
  getPaths: () => invoke("desktop:getPaths"),
  getFirstRunState: () => invoke("desktop:getFirstRunState"),
  provisionDevice: (input) => invoke("desktop:provisionDevice", input),
  setConnectivity: (online) => invoke("desktop:setConnectivity", online),
  postOfflineSale: (payload) => invoke("desktop:postOfflineSale", payload),
  listPendingSales: () => invoke("desktop:listPendingSales"),
  syncNow: () => invoke("desktop:syncNow"),
  syncStatus: () => invoke("desktop:syncStatus"),
  hardwareStatus: () => invoke("desktop:hardwareStatus"),
  printReceipt: (job) => invoke("desktop:printReceipt", job),
  openCashDrawer: () => invoke("desktop:openCashDrawer"),
  secureSet: (input) => invoke("desktop:secureSet", input),
  secureGet: (key) => invoke("desktop:secureGet", key),
  secureDelete: (key) => invoke("desktop:secureDelete", key),
  checkForUpdates: () => invoke("desktop:checkForUpdates"),
  downloadUpdate: () => invoke("desktop:downloadUpdate"),
  quitAndInstall: () => invoke("desktop:quitAndInstall"),
  openExternal: (url) => invoke("desktop:openExternal", url),
});
