import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { APP_NAME } from "./constants.js";

export interface DesktopPaths {
  userData: string;
  /** @deprecated No SQLite — kept as alias of configDir for older IPC callers */
  databaseDir: string;
  logsDir: string;
  configDir: string;
  cacheDir: string;
  installRoot: string;
}

/** Mutable shell data (config/logs) under userData — business data is in Supabase. */
export function resolveDesktopPaths(): DesktopPaths {
  const userData = app.getPath("userData");
  const logsDir = path.join(userData, "logs");
  const configDir = path.join(userData, "config");
  const cacheDir = path.join(userData, "cache");
  return {
    userData,
    databaseDir: configDir,
    logsDir,
    configDir,
    cacheDir,
    installRoot: path.dirname(app.getPath("exe")),
  };
}

export function ensureDesktopDirectories(paths: DesktopPaths): void {
  for (const dir of [paths.userData, paths.configDir, paths.logsDir, paths.cacheDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const readme = path.join(paths.userData, "README.txt");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      [
        `${APP_NAME} application data`,
        "",
        "This folder stores terminal config, logs, and cache.",
        "POS business data is stored in Supabase (online). There is no local SQLite database.",
        "Uninstalling the application does NOT delete this folder by default.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}
