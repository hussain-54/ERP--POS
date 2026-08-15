import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export type ReportFilterInput = {
  period?: string;
  from?: string;
  to?: string;
  branchId?: string;
  warehouseId?: string;
  salesmanUserId?: string;
  categoryId?: string;
  brandId?: string;
  partyId?: string;
};

function qs(filter: ReportFilterInput): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

const base = "/api/v1/reports";

export const reportingApi = {
  catalog() {
    return apiFetch<{
      sales: string[];
      purchases: string[];
      stock: string[];
      profit: string[];
      accounting: string[];
      bi: string[];
      periods: string[];
    }>(`${base}/catalog`, { token: token() });
  },
  executive(filter: ReportFilterInput) {
    return apiFetch<{ dashboard: Record<string, unknown>; filters: unknown }>(
      `${base}/dashboard/executive${qs(filter)}`,
      { token: token() },
    );
  },
  sales(dimension: string, filter: ReportFilterInput) {
    return apiFetch(`${base}/sales/${dimension}${qs(filter)}`, { token: token() });
  },
  purchases(dimension: string, filter: ReportFilterInput) {
    return apiFetch(`${base}/purchases/${dimension}${qs(filter)}`, { token: token() });
  },
  stock(kind: string, filter: ReportFilterInput) {
    return apiFetch(`${base}/stock/${kind}${qs(filter)}`, { token: token() });
  },
  profit(kind: string, filter: ReportFilterInput) {
    return apiFetch(`${base}/profit/${kind}${qs(filter)}`, { token: token() });
  },
  accounting(kind: string, filter: ReportFilterInput) {
    return apiFetch(`${base}/accounting/${kind}${qs(filter)}`, { token: token() });
  },
  bi(metric: string, filter: ReportFilterInput) {
    return apiFetch(`${base}/bi/${metric}${qs(filter)}`, { token: token() });
  },
};
