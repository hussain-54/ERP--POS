import type { StockBalance, StockMovement } from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const inventoryApi = {
  listWarehouses() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/inventory/warehouses", {
      token: token(),
    });
  },
  createWarehouse(body: Record<string, unknown>) {
    return apiFetch("/api/v1/inventory/warehouses", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listBalances(params: { warehouseId?: string; productId?: string } = {}) {
    const q = new URLSearchParams();
    if (params.warehouseId) q.set("warehouseId", params.warehouseId);
    if (params.productId) q.set("productId", params.productId);
    return apiFetch<{ items: StockBalance[] }>(`/api/v1/inventory/balances?${q}`, { token: token() });
  },
  listMovements(params: { productId?: string; warehouseId?: string } = {}) {
    const q = new URLSearchParams();
    if (params.productId) q.set("productId", params.productId);
    if (params.warehouseId) q.set("warehouseId", params.warehouseId);
    return apiFetch<{ items: StockMovement[] }>(`/api/v1/inventory/movements?${q}`, { token: token() });
  },
  postMovement(body: Record<string, unknown>) {
    return apiFetch<StockMovement>("/api/v1/inventory/movements", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createAdjustment(body: Record<string, unknown>) {
    return apiFetch("/api/v1/inventory/adjustments", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  approveAdjustment(id: string) {
    return apiFetch(`/api/v1/inventory/adjustments/${id}/approve`, {
      method: "POST",
      token: token(),
    });
  },
  createReservation(body: Record<string, unknown>) {
    return apiFetch("/api/v1/inventory/reservations", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  releaseReservation(id: string, operationId: string) {
    return apiFetch(`/api/v1/inventory/reservations/${id}/release`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ operationId }),
    });
  },
  createCount(body: Record<string, unknown>) {
    return apiFetch("/api/v1/inventory/counts", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  addCountLine(sessionId: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/inventory/counts/${sessionId}/lines`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  approveCount(sessionId: string) {
    return apiFetch(`/api/v1/inventory/counts/${sessionId}/approve`, {
      method: "POST",
      token: token(),
    });
  },
  createBatch(body: Record<string, unknown>) {
    return apiFetch("/api/v1/inventory/batches", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createSerial(body: Record<string, unknown>) {
    return apiFetch("/api/v1/inventory/serials", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
