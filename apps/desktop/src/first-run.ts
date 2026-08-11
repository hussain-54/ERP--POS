import type { LocalDatabase, LocalDevice } from "@electronic-erp/offline";
import type { OfflineRuntime } from "./db/bootstrap.js";

export interface FirstRunState {
  provisioned: boolean;
  requiresOnlineProvisioning: boolean;
  online: boolean;
  deviceId: string;
  deviceKey: string;
  device: LocalDevice | null;
  message: string;
}

export function getFirstRunState(
  runtime: OfflineRuntime,
  online: boolean,
): FirstRunState {
  const device = runtime.localDb.getDevice();
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
      deviceId: runtime.deviceId,
      deviceKey: runtime.deviceKey,
      device,
      message: "Device is provisioned. Offline POS is available.",
    };
  }

  return {
    provisioned: false,
    requiresOnlineProvisioning: true,
    online,
    deviceId: runtime.deviceId,
    deviceKey: runtime.deviceKey,
    device,
    message: online
      ? "This device has never been provisioned. Sign in online to register and download master data."
      : "Internet is required for the first cloud registration and master-data download. After provisioning, POS works offline. Cloud initialization is not faked while offline.",
  };
}

export async function provisionDeviceLocally(
  localDb: LocalDatabase,
  input: {
    organizationId: string;
    branchId: string;
    name: string;
    registeredDeviceId?: string;
  },
): Promise<LocalDevice> {
  const now = new Date().toISOString();
  const deviceId = await localDb.ensureDeviceId();
  const deviceKey = await localDb.ensureDeviceKey();
  const device: LocalDevice = {
    id: input.registeredDeviceId ?? deviceId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    deviceKey,
    name: input.name || "Windows POS",
    platform: "electron",
    status: "active",
    registeredAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await localDb.saveDevice(device);
  return device;
}

/** Register with cloud when online — never invent a fake cloud registration offline. */
export async function registerDeviceWithApi(input: {
  apiUrl: string;
  accessToken: string;
  organizationId: string;
  branchId: string;
  deviceKey: string;
  name: string;
}): Promise<{ deviceId: string }> {
  const base = input.apiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/sync/devices/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      organizationId: input.organizationId,
      branchId: input.branchId,
      deviceKey: input.deviceKey,
      name: input.name,
      platform: "electron",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Device registration failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { id?: string; deviceId?: string };
  const deviceId = body.id ?? body.deviceId;
  if (!deviceId) throw new Error("Device registration response missing id");
  return { deviceId };
}
