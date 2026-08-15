import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

const base = "/api/v1/hardware";

export const hardwareApi = {
  print(body: Record<string, unknown>) {
    return apiFetch<Record<string, unknown>>(`${base}/print`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listPrintJobs() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/print-jobs`, {
      token: token(),
    });
  },
  openDrawer(body: Record<string, unknown>) {
    return apiFetch(`${base}/cash-drawer/open`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listEvents() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/events`, {
      token: token(),
    });
  },
  capabilities() {
    return apiFetch<Record<string, unknown>>(`${base}/capabilities`, { token: token() });
  },
};
