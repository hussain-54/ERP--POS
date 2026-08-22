import type { CreateSaleInput, ProductSearchQuery, ProductSearchResult } from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

/** Module 02 POS / SALES — terminal, checkout, holds, shift. */
export const posApi = {
  searchProducts(query: Partial<ProductSearchQuery>) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
    return apiFetch<{ items: ProductSearchResult[] }>(`/api/v1/pos/products/search?${params}`, {
      token: token(),
    });
  },

  postSale(input: Omit<CreateSaleInput, "organizationId">) {
    return apiFetch<Record<string, unknown>>("/api/v1/pos/sales", {
      method: "POST",
      token: token(),
      body: JSON.stringify(input),
    });
  },

  holdSale(body: Record<string, unknown>) {
    return apiFetch("/api/v1/pos/holds", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  listHolds(branchId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/holds?branchId=${encodeURIComponent(branchId)}&filter=all_pending`,
      { token: token() },
    );
  },

  currentShift(branchId: string) {
    return apiFetch<{ item: Record<string, unknown> | null }>(
      `/api/v1/pos/shifts/current?branchId=${encodeURIComponent(branchId)}`,
      { token: token() },
    );
  },
};
