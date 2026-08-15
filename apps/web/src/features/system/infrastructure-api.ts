/** Shared client: 32 Import/Export, 34 Backup, 39 Security/Integrations. Do not split into 39 clients. */
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const infrastructureApi = {
  getSecuritySettings() {
    return apiFetch<{ item: Record<string, unknown> }>("/api/v1/security/settings", {
      token: token(),
    });
  },
  saveSecuritySettings(body: Record<string, unknown>) {
    return apiFetch("/api/v1/security/settings", {
      method: "PUT",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  loginHistory() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/security/login-history", {
      token: token(),
    });
  },
  sessions() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/security/sessions", {
      token: token(),
    });
  },
  revokeSession(id: string) {
    return apiFetch(`/api/v1/security/sessions/${id}/revoke`, { method: "POST", token: token() });
  },
  activity() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/security/activity", {
      token: token(),
    });
  },
  devices() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/security/devices", {
      token: token(),
    });
  },
  registerDevice(body: Record<string, unknown>) {
    return apiFetch("/api/v1/security/devices", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  setDeviceStatus(id: string, status: "approved" | "revoked") {
    return apiFetch(`/api/v1/security/devices/${id}/${status}`, {
      method: "POST",
      token: token(),
    });
  },
  setup2fa(body: Record<string, unknown>) {
    return apiFetch("/api/v1/security/2fa", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  listBackupJobs() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/backup/jobs", {
      token: token(),
    });
  },
  createBackupJob(body: Record<string, unknown>) {
    return apiFetch("/api/v1/backup/jobs", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listRestorePoints() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/backup/restore-points", {
      token: token(),
    });
  },
  createRestorePoint(body: Record<string, unknown>) {
    return apiFetch("/api/v1/backup/restore-points", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  requestRestore(body: Record<string, unknown>) {
    return apiFetch("/api/v1/backup/restore", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  listIntegrations() {
    return apiFetch<{
      items: Array<Record<string, unknown>>;
      apiBasePath: string;
      audiences: string[];
    }>("/api/v1/integrations/clients", { token: token() });
  },
  createIntegration(body: Record<string, unknown>) {
    return apiFetch<{
      item: Record<string, unknown>;
      apiKeyOnce: string;
      apiBasePath: string;
      note: string;
    }>("/api/v1/integrations/clients", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  revokeIntegration(id: string) {
    return apiFetch(`/api/v1/integrations/clients/${id}/revoke`, {
      method: "POST",
      token: token(),
    });
  },

  templateUrl(entity: string) {
    return `/api/v1/data/import/templates/${entity}`;
  },
  importEntity(entity: string, csv: string, reason?: string) {
    return apiFetch<{
      imported: number;
      failed: number;
      errors: Array<{ row: number; field?: string; message: string }>;
    }>(`/api/v1/data/import/${entity}`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ csv, reason }),
    });
  },
  exportProductsUrl(format: "csv" | "excel" | "pdf") {
    return `/api/v1/data/export/products?format=${format}`;
  },
};
