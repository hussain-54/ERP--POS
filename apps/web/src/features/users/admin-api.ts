/** Shared client: 25 Approvals, 26 Users, 27 Permissions, 28 Audit, 30 Branches. Do not split into 39 clients. */
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

const base = "/api/v1/admin";

export const adminApi = {
  seedRoles() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/roles/seed`, {
      method: "POST",
      token: token(),
    });
  },
  listRoles() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/roles`, { token: token() });
  },
  listPermissions() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/permissions`, {
      token: token(),
    });
  },
  listRolePermissions(roleId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `${base}/roles/${roleId}/permissions`,
      { token: token() },
    );
  },
  setRolePermissions(roleId: string, permissionKeys: string[]) {
    return apiFetch(`${base}/roles/${roleId}/permissions`, {
      method: "PUT",
      token: token(),
      body: JSON.stringify({ permissionKeys }),
    });
  },
  listUsers() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/users`, { token: token() });
  },
  assignRole(body: Record<string, unknown>) {
    return apiFetch(`${base}/users/roles`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  setUserPermission(body: Record<string, unknown>) {
    return apiFetch(`${base}/users/permissions`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listBranches() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/branches`, {
      token: token(),
    });
  },
  createBranch(body: Record<string, unknown>) {
    return apiFetch(`${base}/branches`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  setMembership(body: Record<string, unknown>) {
    return apiFetch(`${base}/branches/memberships`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  groupDashboard() {
    return apiFetch<{ branches: Array<Record<string, unknown>> }>(`${base}/dashboard/group`, {
      token: token(),
    });
  },
  listApprovals(status?: string) {
    const qs = status ? `?status=${status}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/approvals${qs}`, {
      token: token(),
    });
  },
  createApproval(body: Record<string, unknown>) {
    return apiFetch(`${base}/approvals`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  decideApproval(id: string, body: Record<string, unknown>) {
    return apiFetch(`${base}/approvals/${id}/decide`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listApprovalActions(id: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/approvals/${id}/actions`, {
      token: token(),
    });
  },
  listAudit(limit = 100) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`${base}/audit?limit=${limit}`, {
      token: token(),
    });
  },
};
