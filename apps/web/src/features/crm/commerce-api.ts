/** Shared client: 18 CRM, 23 Loyalty, 07 B2B, 39 Store. Do not split into 39 clients. */
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export const commerceApi = {
  // CRM
  listSegments() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/crm/segments", {
      token: token(),
    });
  },
  createSegment(body: Record<string, unknown>) {
    return apiFetch("/api/v1/crm/segments", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  refreshSegment(id: string) {
    return apiFetch(`/api/v1/crm/segments/${id}/refresh`, { method: "POST", token: token() });
  },
  customerProfile(customerId: string) {
    return apiFetch(`/api/v1/crm/customers/${customerId}/profile`, { token: token() });
  },
  listCampaigns() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/crm/campaigns", {
      token: token(),
    });
  },
  createCampaign(body: Record<string, unknown>) {
    return apiFetch("/api/v1/crm/campaigns", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  runCampaign(id: string) {
    return apiFetch(`/api/v1/crm/campaigns/${id}/run`, { method: "POST", token: token() });
  },

  // Loyalty
  seedTiers() {
    return apiFetch("/api/v1/loyalty/tiers/seed", { method: "POST", token: token() });
  },
  account(customerId: string) {
    return apiFetch<{ item: Record<string, unknown> }>(`/api/v1/loyalty/accounts/${customerId}`, {
      token: token(),
    });
  },
  earn(body: Record<string, unknown>) {
    return apiFetch("/api/v1/loyalty/earn", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  redeem(body: Record<string, unknown>) {
    return apiFetch("/api/v1/loyalty/redeem", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  ledger(customerId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/loyalty/ledger/${customerId}`,
      { token: token() },
    );
  },
  listOffers() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/loyalty/offers", {
      token: token(),
    });
  },
  createOffer(body: Record<string, unknown>) {
    return apiFetch("/api/v1/loyalty/offers", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  // B2B
  listB2bUsers() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/b2b/users", {
      token: token(),
    });
  },
  createB2bUser(body: Record<string, unknown>) {
    return apiFetch("/api/v1/b2b/users", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  portal(customerId: string) {
    return apiFetch(`/api/v1/b2b/customers/${customerId}/portal`, { token: token() });
  },
  pricing(customerId: string, productIds: string[]) {
    return apiFetch("/api/v1/b2b/pricing", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ customerId, productIds }),
    });
  },
  createB2bOrder(body: Record<string, unknown>) {
    return apiFetch("/api/v1/b2b/orders", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  approveB2bOrder(id: string, approve = true) {
    return apiFetch(`/api/v1/b2b/orders/${id}/approve`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ approve }),
    });
  },

  // Store
  getStoreSettings() {
    return apiFetch<{ item: Record<string, unknown> | null }>("/api/v1/store/settings", {
      token: token(),
    });
  },
  saveStoreSettings(body: Record<string, unknown>) {
    return apiFetch("/api/v1/store/settings", {
      method: "PUT",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  catalog(qs = "") {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/store/catalog${qs}`, {
      token: token(),
    });
  },
  product(productId: string) {
    return apiFetch(`/api/v1/store/products/${productId}`, { token: token() });
  },
  checkout(body: Record<string, unknown>) {
    return apiFetch("/api/v1/store/checkout", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
};
