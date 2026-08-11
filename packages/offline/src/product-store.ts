import type { ProductMaster } from "@electronic-erp/contracts";
import { applyProductRowToOfflineShape } from "@electronic-erp/sync";

/** Minimal in-memory offline product store used by sync abstraction tests. */
export class OfflineProductStore {
  private readonly products = new Map<string, Record<string, unknown>>();

  upsertFromSync(product: ProductMaster): void {
    this.products.set(product.id, applyProductRowToOfflineShape(product));
  }

  getBySku(organizationId: string, sku: string): Record<string, unknown> | null {
    for (const row of this.products.values()) {
      if (row.organization_id === organizationId && row.sku === sku && !row.deleted_at) {
        return row;
      }
    }
    return null;
  }

  list(organizationId: string): Record<string, unknown>[] {
    return [...this.products.values()].filter(
      (row) => row.organization_id === organizationId && !row.deleted_at,
    );
  }
}
