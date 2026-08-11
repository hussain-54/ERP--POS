import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

const base = "/api/v1/sync";

export const syncApi = {
  registerDevice(body: Record<string, unknown>) {
    return apiFetch(`${base}/devices/register`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  push(body: Record<string, unknown>) {
    return apiFetch(`${base}/push`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  pull(body: Record<string, unknown>) {
    return apiFetch(`${base}/pull`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listConflicts() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/conflicts`, {
      token: token(),
    });
  },
  resolveConflict(id: string, body: Record<string, unknown>) {
    return apiFetch(`${base}/conflicts/${id}/resolve`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  status(deviceId?: string) {
    const qs = deviceId ? `?deviceId=${deviceId}` : "";
    return apiFetch<Record<string, unknown>>(`${base}/status${qs}`, { token: token() });
  },
};
