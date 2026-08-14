/**
 * Desktop local config — JSON file under AppData.
 * Replaces SQLite LocalDatabase for device identity + secure settings only.
 * Business data lives in Supabase via the online API.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DesktopPaths } from "./paths.js";

export type DesktopDeviceRecord = {
  id: string;
  organizationId: string;
  branchId: string;
  deviceKey: string;
  name: string;
  platform: "electron";
  status: "active" | "pending" | "revoked";
  registeredAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

type DesktopConfigFile = {
  deviceId: string;
  deviceKey: string;
  device: DesktopDeviceRecord | null;
  settings: Record<string, string>;
};

export class DesktopConfigStore {
  private readonly filePath: string;
  private data: DesktopConfigFile;

  constructor(paths: DesktopPaths) {
    this.filePath = path.join(paths.configDir, "desktop-config.json");
    this.data = this.load();
  }

  private load(): DesktopConfigFile {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<DesktopConfigFile>;
        return {
          deviceId: typeof raw.deviceId === "string" && raw.deviceId ? raw.deviceId : randomUUID(),
          deviceKey:
            typeof raw.deviceKey === "string" && raw.deviceKey.length >= 8
              ? raw.deviceKey
              : randomUUID().replace(/-/g, ""),
          device: raw.device ?? null,
          settings: raw.settings && typeof raw.settings === "object" ? { ...raw.settings } : {},
        };
      }
    } catch {
      /* corrupt — recreate */
    }
    return {
      deviceId: randomUUID(),
      deviceKey: randomUUID().replace(/-/g, ""),
      device: null,
      settings: {},
    };
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
  }

  get deviceId(): string {
    return this.data.deviceId;
  }

  get deviceKey(): string {
    return this.data.deviceKey;
  }

  getDevice(): DesktopDeviceRecord | null {
    return this.data.device ? { ...this.data.device } : null;
  }

  saveDevice(device: DesktopDeviceRecord): void {
    this.data.device = { ...device };
    this.data.deviceId = device.id;
    this.data.deviceKey = device.deviceKey;
    this.persist();
  }

  getSetting(key: string): string | null {
    const v = this.data.settings[key];
    return v == null || v === "" ? null : v;
  }

  setSetting(key: string, value: string): void {
    if (!value) delete this.data.settings[key];
    else this.data.settings[key] = value;
    this.persist();
  }
}
