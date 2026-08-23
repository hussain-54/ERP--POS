import type {
  CreateSaleReturnInput,
  InvoiceView,
  SaleListFilterInput,
  SaleListResponse,
  SaleListRow,
  SearchReturnInvoicesInput,
} from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";
import type {
  CreateSaleInput,
  ProductSearchQuery,
  ProductSearchResult,
} from "@electronic-erp/contracts";
import type { ReturnableLineView } from "./returns/return-utils";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

/** Module 02 POS / SALES — terminal, checkout, holds, shift, sales register. */
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

  searchSalesManagement(query: Omit<Partial<SaleListFilterInput>, "organizationId">) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
    return apiFetch<SaleListResponse>(`/api/v1/pos/sales/management?${params}`, {
      token: token(),
    });
  },

  listSales(branchId?: string) {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    return apiFetch<{ items: SaleListRow[] }>(`/api/v1/pos/sales${qs}`, { token: token() });
  },

  getInvoice(saleId: string) {
    return apiFetch<InvoiceView>(`/api/v1/pos/sales/${encodeURIComponent(saleId)}/invoice`, {
      token: token(),
    });
  },

  holdSale(body: Record<string, unknown>) {
    return apiFetch<{ sale: Record<string, unknown>; held: Record<string, unknown> }>(
      "/api/v1/pos/holds",
      {
        method: "POST",
        token: token(),
        body: JSON.stringify(body),
      },
    );
  },

  listHolds(branchId: string, filter = "all_pending") {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/holds?branchId=${encodeURIComponent(branchId)}&filter=${encodeURIComponent(filter)}`,
      { token: token() },
    );
  },

  resumeHold(holdId: string, checkout = false) {
    return apiFetch<{
      cartLines: unknown[];
      cartSnapshot?: Record<string, unknown>;
      checkout: boolean;
      id: string;
      saleId?: string;
      customerId?: string | null;
      notes?: string | null;
      holdLabel?: string | null;
      heldBy?: string | null;
      heldAt?: string;
    }>(`/api/v1/pos/holds/${encodeURIComponent(holdId)}/resume`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({ checkout }),
    });
  },

  discardHold(holdId: string) {
    return apiFetch(`/api/v1/pos/holds/${encodeURIComponent(holdId)}/discard`, {
      method: "POST",
      token: token(),
      body: JSON.stringify({}),
    });
  },

  validateCoupon(body: Record<string, unknown>) {
    return apiFetch<Record<string, unknown>>("/api/v1/pos/coupons/validate", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  currentShift(branchId: string) {
    return apiFetch<{ item: Record<string, unknown> | null }>(
      `/api/v1/pos/shifts/current?branchId=${encodeURIComponent(branchId)}`,
      { token: token() },
    );
  },

  searchSalesForReturn(query: Omit<Partial<SearchReturnInvoicesInput>, "organizationId">) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
    return apiFetch<{ items: Array<SaleListRow & { customerName?: string | null; customerMobile?: string | null }> }>(
      `/api/v1/pos/returns/search?${params}`,
      { token: token() },
    );
  },

  getReturnableSale(saleId: string) {
    return apiFetch<
      InvoiceView & {
        returnableLines: ReturnableLineView[];
      }
    >(`/api/v1/pos/returns/sale/${encodeURIComponent(saleId)}`, { token: token() });
  },

  listReturns(query?: { branchId?: string; originalSaleId?: string }) {
    const params = new URLSearchParams();
    if (query?.branchId) params.set("branchId", query.branchId);
    if (query?.originalSaleId) params.set("originalSaleId", query.originalSaleId);
    const qs = params.toString();
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/returns${qs ? `?${qs}` : ""}`,
      { token: token() },
    );
  },

  postReturn(body: Omit<CreateSaleReturnInput, "organizationId">) {
    return apiFetch<Record<string, unknown>>("/api/v1/pos/returns", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  openShift(body: { branchId: string; openingFloat?: number; notes?: string }) {
    return apiFetch<Record<string, unknown>>("/api/v1/pos/shifts/open", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  closeShift(shiftId: string, body: { closingCounted: number; notes?: string }) {
    return apiFetch<Record<string, unknown>>(`/api/v1/pos/shifts/${encodeURIComponent(shiftId)}/close`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  listCashMovements(shiftId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/cash-movements?shiftId=${encodeURIComponent(shiftId)}`,
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
    return apiFetch<Record<string, unknown>>("/api/v1/pos/cash-movements", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  previewDayClose(branchId: string, businessDate?: string) {
    const params = new URLSearchParams({ branchId });
    if (businessDate) params.set("businessDate", businessDate);
    return apiFetch<{ totals: Record<string, unknown> }>(
      `/api/v1/pos/day-close/preview?${params}`,
      { token: token() },
    );
  },

  closeDay(body: { branchId: string; businessDate?: string; actualCash: number; notes?: string }) {
    return apiFetch<Record<string, unknown>>("/api/v1/pos/day-close", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },

  returnReport(query?: { branchId?: string; dateFrom?: string; dateTo?: string }) {
    const params = new URLSearchParams();
    if (query?.branchId) params.set("branchId", query.branchId);
    if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
    if (query?.dateTo) params.set("dateTo", query.dateTo);
    const qs = params.toString();
    return apiFetch<{ summary: Record<string, unknown>; items: Array<Record<string, unknown>> }>(
      `/api/v1/pos/returns/report${qs ? `?${qs}` : ""}`,
      { token: token() },
    );
  },
};

export function snapshotFromHoldResume(res: {
  cartLines: unknown[];
  cartSnapshot?: Record<string, unknown>;
  customerId?: string | null;
  notes?: string | null;
}): Record<string, unknown> {
  if (res.cartSnapshot && Object.keys(res.cartSnapshot).length > 0) {
    return res.cartSnapshot;
  }
  return {
    cart: res.cartLines,
    customerId: res.customerId ?? "",
    customerName: null,
    walkIn: !res.customerId,
    invoiceDiscount: "0",
    notes: res.notes ?? "",
  };
}
