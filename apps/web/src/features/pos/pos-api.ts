import type { CreateSaleInput, ProductSearchResult, Sale } from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const posApi = {
  searchProducts(params: {
    q: string;
    warehouseId?: string;
    customerId?: string;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    qs.set("q", params.q);
    if (params.warehouseId) qs.set("warehouseId", params.warehouseId);
    if (params.customerId) qs.set("customerId", params.customerId);
    if (params.limit) qs.set("limit", String(params.limit));
    return apiFetch<{ items: ProductSearchResult[] }>(`/api/v1/pos/products/search?${qs}`, {
      token: token(),
    });
  },
  postSale(body: Omit<CreateSaleInput, "organizationId">) {
    return apiFetch<{
      id: string;
      invoiceNumber: string;
      totals: { grandTotal: number; subtotal: number; discountTotal: number; taxTotal: number };
      paidTotal: number;
      remainingTotal: number;
    }>("/api/v1/pos/sales", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listSales(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Sale[] }>(`/api/v1/pos/sales${qs}`, { token: token() });
  },
  getInvoice(id: string) {
    return apiFetch(`/api/v1/pos/sales/${id}/invoice`, { token: token() });
  },
  hold(body: Record<string, unknown>) {
    return apiFetch("/api/v1/pos/holds", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listHolds(branchId: string, filter?: string) {
    const qs = new URLSearchParams({ branchId });
    if (filter) qs.set("filter", filter);
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/pos/holds?${qs}`, {
      token: token(),
    });
  },
  resumeHold(id: string, checkout = false) {
    return apiFetch(`/api/v1/pos/holds/${id}/resume`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ checkout }),
    });
  },
  editHold(id: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/pos/holds/${id}`, {
      method: "PATCH",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  duplicateHold(id: string, body: { warehouseId: string; deviceId?: string }) {
    return apiFetch(`/api/v1/pos/holds/${id}/duplicate`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  transferHold(id: string, body: { toUserId: string; branchId?: string }) {
    return apiFetch(`/api/v1/pos/holds/${id}/transfer`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  cancelHold(id: string, reason?: string) {
    return apiFetch(`/api/v1/pos/holds/${id}/cancel`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ reason }),
    });
  },
  discardHold(id: string) {
    return apiFetch(`/api/v1/pos/holds/${id}/discard`, {
      method: "POST",
      token: token(),
    });
  },
  expireHolds(branchId?: string) {
    return apiFetch<{ expired: number }>("/api/v1/pos/holds/expire", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ branchId }),
    });
  },
  postReturn(body: Record<string, unknown>) {
    return apiFetch("/api/v1/pos/returns", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  currentShift(branchId: string) {
    return apiFetch<{ item: Record<string, unknown> | null }>(
      `/api/v1/pos/shifts/current?branchId=${branchId}`,
      { token: token() },
    );
  },
  openShift(body: { branchId: string; openingFloat: number; notes?: string }) {
    return apiFetch("/api/v1/pos/shifts/open", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  closeShift(id: string, body: { closingCounted: number; notes?: string }) {
    return apiFetch(`/api/v1/pos/shifts/${id}/close`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
