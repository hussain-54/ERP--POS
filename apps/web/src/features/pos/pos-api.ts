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
  listHolds(branchId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/holds?branchId=${branchId}`,
      { token: token() },
    );
  },
  resumeHold(id: string) {
    return apiFetch(`/api/v1/pos/holds/${id}/resume`, { method: "POST", token: token() });
  },
  postReturn(body: Record<string, unknown>) {
    return apiFetch("/api/v1/pos/returns", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
