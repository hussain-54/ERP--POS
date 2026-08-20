import type { CreateSaleInput, ProductSearchResult, Sale } from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { env } from "@/lib/env";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const posApi = {
  /** Low-level HTTP. UI callers should use `searchPosProducts`. */
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
  searchSalesManagement(params: Record<string, string | number | undefined>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    return apiFetch<{
      summary: Record<string, unknown>;
      items: Array<Record<string, unknown>>;
      total: number;
      limit: number;
      offset: number;
    }>(`/api/v1/pos/sales/management?${qs}`, { token: token() });
  },
  exportSalesManagement(params: Record<string, string | number | undefined>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    return fetch(`${env.apiUrl}/api/v1/pos/sales/management/export?${qs}`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(async (res) => {
      if (!res.ok) throw new Error(await res.text());
      return res.text();
    });
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
  listHolds(branchId: string, filter?: string, opts?: { applyExpiry?: boolean }) {
    const qs = new URLSearchParams({ branchId });
    if (filter) qs.set("filter", filter);
    if (opts?.applyExpiry === false) qs.set("applyExpiry", "false");
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
  searchReturnInvoices(params: {
    branchId?: string;
    invoiceNumber?: string;
    customerQuery?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set("branchId", params.branchId);
    if (params.invoiceNumber) qs.set("invoiceNumber", params.invoiceNumber);
    if (params.customerQuery) qs.set("customerQuery", params.customerQuery);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/returns/search?${qs}`,
      { token: token() },
    );
  },
  getReturnableSale(saleId: string) {
    return apiFetch<Record<string, unknown>>(`/api/v1/pos/returns/sale/${saleId}`, {
      token: token(),
    });
  },
  listReturns(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/pos/returns${qs}`, {
      token: token(),
    });
  },
  returnReport(params: { branchId?: string; dateFrom?: string; dateTo?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.branchId) qs.set("branchId", params.branchId);
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    return apiFetch<{ summary: Record<string, unknown>; items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/returns/report?${qs}`,
      { token: token() },
    );
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
  listCoupons() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/pos/coupons", {
      token: token(),
    });
  },
  createCoupon(body: Record<string, unknown>) {
    return apiFetch("/api/v1/pos/coupons", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  validateCoupon(body: { code: string; purchaseBase: number; customerId?: string | null }) {
    return apiFetch<{
      couponId: string;
      code: string;
      amount: number;
      percent: number;
      mode: string;
      capped: boolean;
    }>("/api/v1/pos/coupons/validate", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listCashMovements(shiftId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/cash-movements?shiftId=${shiftId}`,
      { token: token() },
    );
  },
  postCashMovement(body: {
    branchId: string;
    kind: "cash_in" | "cash_out";
    amount: number;
    reason: string;
    reference?: string;
  }) {
    return apiFetch("/api/v1/pos/cash-movements", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  previewDayClose(params: { branchId: string; businessDate: string }) {
    const qs = new URLSearchParams(params);
    return apiFetch<{ totals: Record<string, unknown> }>(`/api/v1/pos/day-close/preview?${qs}`, {
      token: token(),
    });
  },
  closeDay(body: {
    branchId: string;
    businessDate: string;
    actualCash: number;
    notes?: string;
  }) {
    return apiFetch("/api/v1/pos/day-close", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
