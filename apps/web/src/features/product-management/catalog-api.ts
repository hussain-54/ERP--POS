import type {
  CreateProductMasterInput,
  ImportResult,
  ProductListItem,
  ProductListQuery,
  ProductMaster,
  ProductSpecifications,
  ProductStats,
  ProductStockSummary,
} from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { authStorage } from "@/features/auth/auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

/** Fired after product create/update so open POS / product lists can refetch without a full reload. */
export const CATALOG_CHANGED_EVENT = "erp:catalog-changed";

export function notifyCatalogChanged(detail?: { productId?: string }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CATALOG_CHANGED_EVENT, { detail }));
}

export const catalogApi = {
  listProducts(query: Partial<ProductListQuery> = {}) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
    return apiFetch<{ items: ProductListItem[]; total: number; page: number; pageSize: number }>(
      `/api/v1/catalog/products?${params.toString()}`,
      { token: token() },
    );
  },
  getProductStats() {
    return apiFetch<ProductStats>("/api/v1/catalog/products/stats", { token: token() });
  },
  getProductStock(productId: string) {
    return apiFetch<ProductStockSummary>(`/api/v1/catalog/products/${productId}/stock`, {
      token: token(),
    });
  },
  getProductSpecifications(productId: string) {
    return apiFetch<ProductSpecifications | null>(`/api/v1/catalog/products/${productId}/specifications`, {
      token: token(),
    });
  },
  getProduct(id: string) {
    return apiFetch<ProductMaster>(`/api/v1/catalog/products/${id}`, { token: token() });
  },
  /** Canonical product writer. POS search/add does not create products. */
  createProduct(input: Omit<CreateProductMasterInput, "organizationId">) {
    return apiFetch<ProductMaster>("/api/v1/catalog/products", {
      method: "POST",
      token: token(),
      body: JSON.stringify(input),
    });
  },
  updateProduct(id: string, input: Record<string, unknown>) {
    return apiFetch<ProductMaster>(`/api/v1/catalog/products/${id}`, {
      method: "PATCH",
      token: token(),
      body: JSON.stringify(input),
    });
  },
  deactivateProduct(id: string) {
    return apiFetch<ProductMaster>(`/api/v1/catalog/products/${id}/deactivate`, {
      method: "POST",
      token: token(),
    });
  },
  restoreProduct(id: string) {
    return apiFetch<ProductMaster>(`/api/v1/catalog/products/${id}/restore`, {
      method: "POST",
      token: token(),
    });
  },
  bulk(ids: string[], action: "deactivate" | "activate" | "restore") {
    return apiFetch<{ affected: number }>("/api/v1/catalog/products/bulk", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ ids, action }),
    });
  },
  listTaxonomy(entity: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/catalog/${entity}`, {
      token: token(),
    });
  },
  createTaxonomy(entity: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/catalog/${entity}`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  updateTaxonomy(entity: string, id: string, body: Record<string, unknown>) {
    return apiFetch(`/api/v1/catalog/${entity}/${id}`, {
      method: "PATCH",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  deactivateTaxonomy(entity: string, id: string) {
    return apiFetch(`/api/v1/catalog/${entity}/${id}/deactivate`, {
      method: "POST",
      token: token(),
    });
  },
  restoreTaxonomy(entity: string, id: string) {
    return apiFetch(`/api/v1/catalog/${entity}/${id}/restore`, {
      method: "POST",
      token: token(),
    });
  },
  seedUnits() {
    return apiFetch("/api/v1/catalog/units/seed-system", { method: "POST", token: token() });
  },
  createUnit(body: Record<string, unknown>) {
    return apiFetch("/api/v1/catalog/units", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  createConversion(body: Record<string, unknown>) {
    return apiFetch("/api/v1/catalog/unit-conversions", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listConversions(productId?: string) {
    const q = productId ? `?productId=${productId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/catalog/unit-conversions${q}`, {
      token: token(),
    });
  },
  createAttribute(body: Record<string, unknown>) {
    return apiFetch("/api/v1/catalog/attribute-definitions", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listAttributes() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/catalog/attribute-definitions", {
      token: token(),
    });
  },
  generateBarcode(productId: string, codeType: "ean13" | "code128" | "sku" | "custom" = "code128") {
    return apiFetch("/api/v1/catalog/barcodes/generate", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ productId, codeType, isPrimary: true }),
    });
  },
  bulkGenerateBarcodes(productIds: string[]) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/catalog/barcodes/bulk-generate", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ productIds }),
    });
  },
  listBarcodes(productId?: string) {
    const q = productId ? `?productId=${productId}` : "";
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/catalog/barcodes${q}`, {
      token: token(),
    });
  },
  generateQr(productId: string) {
    return apiFetch("/api/v1/catalog/qr/generate", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ productId }),
    });
  },
  listPriceLevels() {
    return apiFetch<{ items: Array<Record<string, unknown>> }>("/api/v1/catalog/price-levels", {
      token: token(),
    });
  },
  createPriceLevel(body: { code: string; name: string }) {
    return apiFetch("/api/v1/catalog/price-levels", {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listProductPrices(productId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/catalog/products/${productId}/prices`, {
      token: token(),
    });
  },
  setProductPrice(
    productId: string,
    body: { unitId: string; amount: number; priceLevelId?: string; customerId?: string },
  ) {
    return apiFetch(`/api/v1/catalog/products/${productId}/prices`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  listMedia(productId: string) {
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/api/v1/catalog/products/${productId}/media`, {
      token: token(),
    });
  },
  registerMedia(
    productId: string,
    body: {
      mediaType: string;
      storagePath: string;
      fileName: string;
      mimeType?: string;
      fileSize?: number;
      isPrimary?: boolean;
    },
  ) {
    return apiFetch(`/api/v1/catalog/products/${productId}/media`, {
      method: "POST",
      token: token(),
      body: JSON.stringify(body),
    });
  },
  importProductsCsv(csv: string) {
    return apiFetch<ImportResult>("/api/v1/catalog/import/products", {
      method: "POST",
      token: token(),
      body: JSON.stringify({ csv }),
    });
  },
  async exportProductsCsv(): Promise<string> {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/v1/catalog/export/products`,
      { headers: { Authorization: `Bearer ${token()}` } },
    );
    if (!res.ok) throw new Error("Export failed");
    return res.text();
  },
  templateUrl(entity: string) {
    return `${import.meta.env.VITE_API_URL ?? "http://localhost:4000"}/api/v1/catalog/import/templates/${entity}`;
  },
};
