import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { APP_NAME } from "./constants.js";

export interface DesktopPaths {
  userData: string;
  databaseDir: string;
  databaseFile: string;
  logsDir: string;
  configDir: string;
  cacheDir: string;
  installRoot: string;
}

/** All mutable business data lives under userData — never under the install dir. */
export function resolveDesktopPaths(): DesktopPaths {
  const userData = app.getPath("userData");
  const databaseDir = path.join(userData, "database");
  const logsDir = path.join(userData, "logs");
  const configDir = path.join(userData, "config");
  const cacheDir = path.join(userData, "cache");
  return {
    userData,
    databaseDir,
    databaseFile: path.join(databaseDir, "offline.db"),
    logsDir,
    configDir,
    cacheDir,
    installRoot: path.dirname(app.getPath("exe")),
  };
}

export function ensureDesktopDirectories(paths: DesktopPaths): void {
  for (const dir of [
    paths.userData,
    paths.databaseDir,
    paths.logsDir,
    paths.configDir,
    paths.cacheDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const readme = path.join(paths.userData, "README.txt");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      [
        `${APP_NAME} application data`,
        "",
        "This folder stores SQLite, logs, and local configuration.",
        "Uninstalling the application does NOT delete this folder by default.",
        "Back up this directory before wiping a POS terminal.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}
