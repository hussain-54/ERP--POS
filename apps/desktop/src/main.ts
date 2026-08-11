/**
 * Electron main-process stub — build preparation only.
 * Does not ship POS features. Wire better-sqlite3 + IPC before production.
 */
export function desktopReadiness(): {
  ready: false;
  blockers: string[];
} {
  return {
    ready: false,
    blockers: [
      "Electron runtime and electron-builder not installed for production packaging",
      "Native SQLite (better-sqlite3) not wired to packages/offline",
      "Hardware IPC (printer/scanner/cash drawer) not bridged from main process",
      "Secure token storage (safeStorage) not implemented",
    ],
  };
}

const status = desktopReadiness();
console.log(JSON.stringify({ app: "electronic-erp-desktop", ...status }));
