import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const purchasesApi = {
  postPurchase(body: Record<string, unknown>) {
    return apiFetch<{
      id: string;
      invoiceNumber: string;
      totals: { grandTotal: number; subtotal: number };
      paidTotal: number;
      remainingTotal: number;
    }>("/api/v1/purchases/invoices", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listPurchases(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/purchases/invoices${qs}`, {
      token: token(),
    });
  },
  postReturn(body: Record<string, unknown>) {
    return apiFetch("/api/v1/purchases/returns", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listSupplierPrices(productId?: string) {
    const qs = productId ? `?productId=${productId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/purchases/supplier-prices${qs}`,
      { token: token() },
    );
  },
  listLocations(warehouseId: string) {
    return apiFetch<{
      racks: Array<Record<string, unknown>>;
      shelves: Array<Record<string, unknown>>;
      bins: Array<Record<string, unknown>>;
    }>(`/api/v1/purchases/locations?warehouseId=${warehouseId}`, { token: token() });
  },
  createRack(body: Record<string, unknown>) {
    return apiFetch("/api/v1/purchases/locations/racks", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createShelf(body: Record<string, unknown>) {
    return apiFetch("/api/v1/purchases/locations/shelves", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createBin(body: Record<string, unknown>) {
    return apiFetch("/api/v1/purchases/locations/bins", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createTransfer(body: Record<string, unknown>) {
    return apiFetch("/api/v1/purchases/transfers", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listTransfers(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/purchases/transfers${qs}`, {
      token: token(),
    });
  },
  advanceTransfer(id: string, status: string) {
    return apiFetch(`/api/v1/purchases/transfers/${id}/advance`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ status }),
    });
  },
  createDelivery(body: Record<string, unknown>) {
    return apiFetch("/api/v1/purchases/deliveries", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listDeliveries(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/purchases/deliveries${qs}`, {
      token: token(),
    });
  },
  searchDeliveries(params: Record<string, string | number | undefined> = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    return apiFetch<{ items: Array<Record<string, unknown>>; total: number }>(
      `/api/v1/purchases/deliveries?${qs}`,
      { token: token() },
    );
  },
  getDelivery(id: string) {
    return apiFetch<{ item: Record<string, unknown> }>(`/api/v1/purchases/deliveries/${id}`, {
      token: token(),
    });
  },
  getDeliveryTracking(id: string) {
    return apiFetch<Record<string, unknown>>(`/api/v1/purchases/deliveries/${id}/tracking`, {
      token: token(),
    });
  },
  getDeliveryHistory(id: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/purchases/deliveries/${id}/history`,
      { token: token() },
    );
  },
  assignDeliveryBoy(id: string, deliveryBoyUserId: string) {
    return apiFetch(`/api/v1/purchases/deliveries/${id}/assign`, {
      method: "PATCH",
      token: token(),
      body: JSON.stringify({ deliveryBoyUserId }),
    });
  },
  advanceDelivery(id: string, status: string, reason?: string) {
    return apiFetch(`/api/v1/purchases/deliveries/${id}/advance`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ status, reason }),
    });
  },
  cancelDelivery(id: string, reason?: string) {
    return apiFetch(`/api/v1/purchases/deliveries/${id}/cancel`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ reason }),
    });
  },
  deliveryReports(branchId?: string) {
    const qs = branchId ? `?branchId=${branchId}` : "";
    return apiFetch<Record<string, unknown>>(`/api/v1/purchases/deliveries/reports${qs}`, {
      token: token(),
    });
  },
};
