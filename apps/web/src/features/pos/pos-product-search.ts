/**
 * Canonical POS product search client.
 * New Sale, scanner, and Exchange replacement search all use this.
 * Catalog admin listing stays on catalogApi.listProducts — different job.
 */
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { posApi } from "./pos-api";
import { POS_PRODUCT_SEARCH_LIMIT, POS_PRODUCT_SEARCH_LIMIT_MAX } from "./pos-catalog-load";

export type PosProductSearchInput = {
  q: string;
  warehouseId?: string;
  customerId?: string;
  limit?: number;
};

export function clampPosSearchLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit < 1) return POS_PRODUCT_SEARCH_LIMIT;
  return Math.min(POS_PRODUCT_SEARCH_LIMIT_MAX, Math.floor(limit));
}

export async function searchPosProducts(input: PosProductSearchInput): Promise<ProductSearchResult[]> {
  const res = await posApi.searchProducts({
    q: input.q,
    warehouseId: input.warehouseId,
    customerId: input.customerId,
    limit: clampPosSearchLimit(input.limit),
  });
  return res.items;
}
