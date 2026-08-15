import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const afterSalesApi = {
  createQuotation(body: Record<string, unknown>) {
    return apiFetch("/api/v1/after-sales/quotations", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listQuotations(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/after-sales/quotations${qs}`,
      { token: token() },
    );
  },
  advanceQuotation(id: string, status: string) {
    return apiFetch(`/api/v1/after-sales/quotations/${id}/advance`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ status }),
    });
  },
  convertQuotationToOrder(id: string) {
    return apiFetch(`/api/v1/after-sales/quotations/${id}/convert-order`, {
      method: "POST",
      token: token(),
    });
  },
  createOrder(body: Record<string, unknown>) {
    return apiFetch("/api/v1/after-sales/orders", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listOrders(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/after-sales/orders${qs}`, {
      token: token(),
    });
  },
  convertOrderToInvoice(id: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/after-sales/orders/${id}/convert-invoice`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createServiceJob(body: Record<string, unknown>) {
    return apiFetch("/api/v1/after-sales/service-jobs", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listServiceJobs(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/after-sales/service-jobs${qs}`,
      { token: token() },
    );
  },
  advanceServiceJob(id: string, status: string) {
    return apiFetch(`/api/v1/after-sales/service-jobs/${id}/advance`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ status }),
    });
  },
  addServicePart(jobId: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/after-sales/service-jobs/${jobId}/parts`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  getServiceBill(jobId: string) {
    return apiFetch(`/api/v1/after-sales/service-jobs/${jobId}/bill`, { token: token() });
  },
  lookupWarranty(params: Record<string, string>) {
    const qs = new URLSearchParams(params);
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/after-sales/warranties/lookup?${qs}`,
      { token: token() },
    );
  },
  createWarrantyClaim(body: Record<string, unknown>) {
    return apiFetch("/api/v1/after-sales/warranty-claims", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listWarrantyClaims(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/after-sales/warranty-claims${qs}`,
      { token: token() },
    );
  },
  postReplacement(body: Record<string, unknown>) {
    return apiFetch("/api/v1/after-sales/warranty-replacements", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
