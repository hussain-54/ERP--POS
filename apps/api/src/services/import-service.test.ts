import { describe, expect, it, vi } from "vitest";
import { ImportService, parseCsv } from "./import-service.js";

describe("import service", () => {
  it("parses csv rows", () => {
    const rows = parseCsv(`sku,name,product_code,base_unit_id
SKU-1,Cable,P-1,11111111-1111-4111-8111-111111111111`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sku).toBe("SKU-1");
  });

  it("returns row-by-row validation errors and does not import invalid data", async () => {
    const createProduct = vi.fn();
    const service = new ImportService({ createProduct } as never);
    const rows = parseCsv(`product_code,sku,name,base_unit_id,cost_price,retail_price,wholesale_price,dealer_price,minimum_sale_price
,SKU-1,,not-a-uuid,100,150,140,130,120`);
    const result = await service.importProducts("22222222-2222-4222-8222-222222222222", rows);
    expect(createProduct).not.toHaveBeenCalled();
    expect(result.imported).toBe(0);
    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors.every((e: { row: number }) => e.row === 2)).toBe(true);
  });
});
