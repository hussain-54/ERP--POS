import type { DesktopConfigStore, DesktopDeviceRecord } from "./config-store.js";

export type { DesktopDeviceRecord };

export interface FirstRunState {
  provisioned: boolean;
  requiresOnlineProvisioning: boolean;
  online: boolean;
  deviceId: string;
  deviceKey: string;
  device: DesktopDeviceRecord | null;
  message: string;
}

export function getFirstRunState(store: DesktopConfigStore, online: boolean): FirstRunState {
  const device = store.getDevice();
  const provisioned = Boolean(
    device &&
      device.organizationId &&
      device.branchId &&
      device.status !== "revoked" &&
      device.registeredAt,
  );

  if (provisioned) {
    return {
      provisioned: true,
      requiresOnlineProvisioning: false,
      online,
      deviceId: store.deviceId,
      deviceKey: store.deviceKey,
      device,
      message:
        "Device is provisioned. POS data is stored in Supabase via the cloud API.",
    };
  }

  return {
    provisioned: false,
    requiresOnlineProvisioning: true,
    online,
    deviceId: store.deviceId,
    deviceKey: store.deviceKey,
    device,
    message: online
      ? "Register this terminal (organization + branch). Sales run through the online API / Supabase only."
      : "Internet is required. This application is online-only (Supabase).",
  };
}

/** Persist terminal identity locally (config JSON). */
export async function provisionDeviceLocally(
  store: DesktopConfigStore,
  input: {
    organizationId: string;
    branchId: string;
    name: string;
  },
): Promise<DesktopDeviceRecord> {
  const now = new Date().toISOString();
  const device: DesktopDeviceRecord = {
    id: store.deviceId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    deviceKey: store.deviceKey,
    name: input.name || "Windows POS",
    platform: "electron",
    status: "active",
    registeredAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
  store.saveDevice(device);
  return device;
}
