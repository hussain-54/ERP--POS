import { createRequire } from "node:module";
import { app } from "electron";
import { APP_VERSION } from "./constants.js";

const require = createRequire(import.meta.url);

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "disabled";

export interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion?: string;
  percent?: number;
  message: string;
  canInstall: boolean;
}

type AutoUpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  setFeedURL: (opts: { provider: string; url: string }) => void;
  checkForUpdates: () => Promise<unknown>;
  downloadUpdate: () => Promise<unknown>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

/**
 * Auto-update architecture (electron-updater).
 * Safe defaults: no silent install; user must confirm quitAndInstall.
 * Disabled until ELECTRON_UPDATE_URL is set on a packaged build.
 */
export class DesktopUpdater {
  private phase: UpdatePhase = "idle";
  private availableVersion?: string;
  private percent?: number;
  private message = "Update checks not configured";
  private autoUpdater: AutoUpdaterLike | null = null;

  constructor() {
    const feed = process.env.ELECTRON_UPDATE_URL?.trim();
    if (!app.isPackaged || !feed) {
      this.phase = "disabled";
      this.message = feed
        ? "Updates enabled only in packaged builds"
        : "Set ELECTRON_UPDATE_URL to enable update checks";
      return;
    }

    try {
      const mod = require("electron-updater") as { autoUpdater: AutoUpdaterLike };
      const autoUpdater = mod.autoUpdater;
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;
      autoUpdater.setFeedURL({ provider: "generic", url: feed });
      this.autoUpdater = autoUpdater;
      this.message = "Ready to check for updates";
      this.wire(autoUpdater);
    } catch (err) {
      this.phase = "error";
      this.message =
        err instanceof Error ? err.message : "Failed to initialize updater";
    }
  }

  private wire(updater: AutoUpdaterLike): void {
    updater.on("checking-for-update", () => {
      this.phase = "checking";
      this.message = "Checking for updates…";
    });
    updater.on("update-available", (...args: unknown[]) => {
      const info = args[0] as { version?: string } | undefined;
      this.phase = "available";
      this.availableVersion = info?.version;
      this.message = `Update available: ${info?.version ?? "unknown"}`;
    });
    updater.on("update-not-available", () => {
      this.phase = "not-available";
      this.message = "You are on the latest version";
    });
    updater.on("download-progress", (...args: unknown[]) => {
      const progress = args[0] as { percent?: number } | undefined;
      this.phase = "downloading";
      this.percent = progress?.percent;
      this.message = `Downloading… ${Math.round(progress?.percent ?? 0)}%`;
    });
    updater.on("update-downloaded", (...args: unknown[]) => {
      const info = args[0] as { version?: string } | undefined;
      this.phase = "downloaded";
      this.availableVersion = info?.version ?? this.availableVersion;
      this.message =
        "Update downloaded. Restart to install. Previous version is kept until install succeeds.";
    });
    updater.on("error", (...args: unknown[]) => {
      const err = args[0];
      this.phase = "error";
      this.message = err instanceof Error ? err.message : String(err);
    });
  }

  status(): UpdateStatus {
    return {
      phase: this.phase,
      currentVersion: APP_VERSION,
      availableVersion: this.availableVersion,
      percent: this.percent,
      message: this.message,
      canInstall: this.phase === "downloaded",
    };
  }

  async check(): Promise<UpdateStatus> {
    if (!this.autoUpdater || this.phase === "disabled") return this.status();
    try {
      await this.autoUpdater.checkForUpdates();
    } catch (err) {
      this.phase = "error";
      this.message = err instanceof Error ? err.message : String(err);
    }
    return this.status();
  }

  async download(): Promise<UpdateStatus> {
    if (!this.autoUpdater) return this.status();
    if (this.phase !== "available" && this.phase !== "downloading") {
      this.message = "No update available to download";
      return this.status();
    }
    try {
      await this.autoUpdater.downloadUpdate();
    } catch (err) {
      this.phase = "error";
      this.message = err instanceof Error ? err.message : String(err);
    }
    return this.status();
  }

  quitAndInstall(): UpdateStatus {
    if (!this.autoUpdater || this.phase !== "downloaded") {
      this.message =
        "Cannot install — download an update first (no silent force)";
      return this.status();
    }
    this.autoUpdater.quitAndInstall(false, true);
    return this.status();
  }
}
