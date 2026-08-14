import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "./constants.js";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface DesktopReadiness {
  ready: boolean;
  blockers: string[];
  version: string;
}

/** Runtime readiness for prepare:check and IPC status. */
export function desktopReadiness(): DesktopReadiness {
  const blockers: string[] = [];

  if (process.env.DESKTOP_REQUIRE_DIST === "1") {
    if (!fs.existsSync(path.join(desktopRoot, "dist", "main.js"))) {
      blockers.push("Desktop main process not built (dist/main.js)");
    }
    if (!fs.existsSync(path.join(desktopRoot, "dist", "preload.cjs"))) {
      blockers.push("Preload script not built (dist/preload.cjs)");
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    version: APP_VERSION,
  };
}
