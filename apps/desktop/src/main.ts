import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, net, session } from "electron";
import { APP_NAME, APP_VERSION } from "./constants.js";
import { DesktopConfigStore } from "./config-store.js";
import { createDesktopHardware } from "./hardware-bridge.js";
import { registerIpcHandlers } from "./ipc.js";
import {
  ensureDesktopDirectories,
  resolveDesktopPaths,
  type DesktopPaths,
} from "./paths.js";
import { desktopReadiness } from "./readiness.js";
import { SecureTokenStore } from "./secure-store.js";
import { DesktopUpdater } from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let paths: DesktopPaths | null = null;
let online = true;

function resolvePreloadPath(): string {
  const cjs = path.join(__dirname, "preload.cjs");
  const js = path.join(__dirname, "preload.js");
  if (fs.existsSync(cjs)) return cjs;
  if (fs.existsSync(js)) return js;
  return path.join(__dirname, "..", "preload.cjs");
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: `${APP_NAME} ${APP_VERSION}`,
    show: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  const renderer = path.join(__dirname, "..", "renderer", "index.html");
  await mainWindow.loadFile(renderer);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot(): Promise<void> {
  const readiness = desktopReadiness();
  console.log(JSON.stringify({ app: "electronic-erp-desktop", ...readiness }));

  paths = resolveDesktopPaths();
  ensureDesktopDirectories(paths);
  const config = new DesktopConfigStore(paths);

  online = net.isOnline();
  const hardware = createDesktopHardware();
  const secure = new SecureTokenStore();
  const updater = new DesktopUpdater();

  registerIpcHandlers({
    config,
    paths,
    hardware,
    secure,
    updater,
    getOnline: () => online,
  });

  session.defaultSession.setPermissionRequestHandler((_wc, _perm, callback) => {
    callback(false);
  });

  await createWindow();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    boot().catch((err) => {
      console.error("[desktop] boot failed", err);
      app.quit();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error);
    }
  });
}
