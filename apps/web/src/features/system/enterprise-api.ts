/** Shared client: 20 Salesmen, 24 Documents, 29 Notifications, 31 Tax, 39 HR. Do not split into 39 clients. */
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const enterpriseApi = {
  listEmployees() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/hr/employees", {
      token: token(),
    });
  },
  createEmployee(body: Record<string, unknown>) {
    return apiFetch("/api/v1/hr/employees", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  updateEmployee(id: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/hr/employees/${id}`, {
      method: "PATCH",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listReferences(activeOnly = false) {
    const qs = activeOnly ? "?activeOnly=1" : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/references${qs}`, {
      token: token(),
    });
  },
  createReference(body: Record<string, unknown>) {
    return apiFetch("/api/v1/references", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  updateReference(id: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/references/${id}`, {
      method: "PATCH",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  payCommission(body: Record<string, unknown>) {
    return apiFetch("/api/v1/commissions/pay", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  voidCommissionForSale(saleId: string) {
    return apiFetch("/api/v1/commissions/void-for-sale", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ saleId }),
    });
  },
  commissionReports() {
    return apiFetch<Record<string, unknown>>("/api/v1/commissions/reports", { token: token() });
  },
  upsertAttendance(body: Record<string, unknown>) {
    return apiFetch("/api/v1/hr/attendance", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listAttendance(employeeId?: string) {
    const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/hr/attendance${qs}`, {
      token: token(),
    });
  },
  createSalary(body: Record<string, unknown>) {
    return apiFetch("/api/v1/hr/salaries", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listSalaries() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/hr/salaries", {
      token: token(),
    });
  },
  createIncentive(body: Record<string, unknown>) {
    return apiFetch("/api/v1/hr/incentives", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  upsertPerformance(body: Record<string, unknown>) {
    return apiFetch("/api/v1/hr/performance", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  commissions(qs = "") {
    return apiFetch<Record<string, unknown>>(`/api/v1/hr/commissions${qs}`, { token: token() });
  },

  getTaxProfile() {
    return apiFetch<{ item: Record<string, unknown> }>("/api/v1/tax/profile", { token: token() });
  },
  saveTaxProfile(body: Record<string, unknown>) {
    return apiFetch("/api/v1/tax/profile", {
      method: "PUT",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listTaxRates() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/tax/rates", {
      token: token(),
    });
  },
  createTaxRate(body: Record<string, unknown>) {
    return apiFetch("/api/v1/tax/rates", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createTaxDocument(body: Record<string, unknown>) {
    return apiFetch("/api/v1/tax/documents", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  taxReport() {
    return apiFetch<Record<string, unknown>>("/api/v1/tax/reports", { token: token() });
  },

  listDocuments(qs = "") {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/documents${qs}`, {
      token: token(),
    });
  },
  createDocument(body: Record<string, unknown>) {
    return apiFetch("/api/v1/documents", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  listNotifications() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/notifications", {
      token: token(),
    });
  },
  createNotification(body: Record<string, unknown>) {
    return apiFetch("/api/v1/notifications", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  markRead(id: string) {
    return apiFetch(`/api/v1/notifications/${id}/read`, { method: "POST", token: token() });
  },
  scanNotifications(body: Record<string, unknown> = {}) {
    return apiFetch("/api/v1/notifications/scan", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
