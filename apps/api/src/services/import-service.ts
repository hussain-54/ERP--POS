import {
  CreateCustomerSchema,
  CreateProductMasterSchema,
  CreateSupplierSchema,
  type ImportResult,
} from "@electronic-erp/contracts";
import type { CatalogRepository, InfrastructureRepository, PartiesRepository } from "@electronic-erp/db";
import {
  assertBulkPricePermission,
  rowsToCsv,
  rowsToExcelTsv,
  rowsToSimplePdf,
} from "@electronic-erp/domain";

export type CsvRow = Record<string, string>;

type InventoryLike = {
  adjustStock?(input: Record<string, unknown>): Promise<unknown>;
};

export class ImportService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly parties?: PartiesRepository,
    private readonly inventory?: InventoryLike,
    private readonly infra?: InfrastructureRepository,
  ) {}

  async importProducts(organizationId: string, rows: CsvRow[]): Promise<ImportResult> {
    const errors: ImportResult["errors"] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      const rowNum = i + 2;
      try {
        const parsed = CreateProductMasterSchema.safeParse({
          organizationId,
          productCode: row.product_code || row.productCode,
          sku: row.sku,
          name: row.name,
          nameUr: row.name_ur || row.nameUr || undefined,
          baseUnitId: row.base_unit_id || row.baseUnitId,
          costPrice: Number(row.cost_price ?? row.costPrice ?? 0),
          retailPrice: Number(row.retail_price ?? row.retailPrice ?? 0),
          wholesalePrice: Number(row.wholesale_price ?? row.wholesalePrice ?? 0),
          dealerPrice: Number(row.dealer_price ?? row.dealerPrice ?? 0),
          minimumSalePrice: Number(row.minimum_sale_price ?? row.minimumSalePrice ?? 0),
          warrantyDays: Number(row.warranty_days ?? row.warrantyDays ?? 0),
          primaryBarcode: row.barcode || undefined,
        });
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            errors.push({ row: rowNum, field: issue.path.join("."), message: issue.message });
          }
          continue;
        }
        await this.catalog.createProduct(parsed.data);
        imported += 1;
      } catch (err) {
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }

    return { imported, failed: errors.length, errors };
  }

  async importCustomers(organizationId: string, rows: CsvRow[]): Promise<ImportResult> {
    if (!this.parties) throw new Error("Parties repository required for customer import");
    const errors: ImportResult["errors"] = [];
    let imported = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;
      const parsed = CreateCustomerSchema.safeParse({
        organizationId,
        code: row.code,
        name: row.name,
        mobile: row.phone || row.mobile || undefined,
        customerType: row.customer_type || row.customerType || "retail",
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({ row: rowNum, field: issue.path.join("."), message: issue.message });
        }
        continue;
      }
      try {
        await this.parties.createCustomer(parsed.data);
        imported += 1;
      } catch (err) {
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }
    return { imported, failed: errors.length, errors };
  }

  async importSuppliers(organizationId: string, rows: CsvRow[]): Promise<ImportResult> {
    if (!this.parties) throw new Error("Parties repository required for supplier import");
    const errors: ImportResult["errors"] = [];
    let imported = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;
      const parsed = CreateSupplierSchema.safeParse({
        organizationId,
        code: row.code,
        companyName: row.name || row.company_name || row.companyName,
        mobile: row.phone || row.mobile || undefined,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({ row: rowNum, field: issue.path.join("."), message: issue.message });
        }
        continue;
      }
      try {
        await this.parties.createSupplier(parsed.data);
        imported += 1;
      } catch (err) {
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Import failed",
        });
      }
    }
    return { imported, failed: errors.length, errors };
  }

  async importStock(organizationId: string, rows: CsvRow[]): Promise<ImportResult> {
    const errors: ImportResult["errors"] = [];
    let imported = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;
      const sku = row.sku;
      const warehouseId = row.warehouse_id || row.warehouseId;
      const qty = Number(row.qty ?? 0);
      if (!sku || !warehouseId || !(qty > 0)) {
        errors.push({ row: rowNum, message: "sku, warehouse_id and positive qty required" });
        continue;
      }
      try {
        const products = await this.catalog.exportProducts(organizationId);
        const hit = products.find((p) => p.sku === sku);
        if (!hit) {
          errors.push({ row: rowNum, message: `Unknown sku ${sku}` });
          continue;
        }
        if (this.inventory?.adjustStock) {
          await this.inventory.adjustStock({
            organizationId,
            warehouseId,
            productId: hit.id,
            sku,
            qty,
            reason: "csv_import",
          });
        }
        imported += 1;
      } catch (err) {
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Stock import failed",
        });
      }
    }
    return { imported, failed: errors.length, errors };
  }

  async importPrices(
    organizationId: string,
    rows: CsvRow[],
    opts: { canWritePricing: boolean; userId?: string | null; reason?: string },
  ): Promise<ImportResult> {
    assertBulkPricePermission(opts.canWritePricing);
    const errors: ImportResult["errors"] = [];
    let imported = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNum = i + 2;
      const sku = row.sku;
      if (!sku) {
        errors.push({ row: rowNum, message: "sku required" });
        continue;
      }
      try {
        const products = await this.catalog.exportProducts(organizationId);
        const current = products.find((p) => p.sku === sku);
        if (!current) {
          errors.push({ row: rowNum, message: `Unknown sku ${sku}` });
          continue;
        }
        const after = {
          retailPrice: Number(row.retail_price ?? row.retailPrice ?? current.retailPrice),
          wholesalePrice: Number(row.wholesale_price ?? row.wholesalePrice ?? current.wholesalePrice),
          dealerPrice: Number(row.dealer_price ?? row.dealerPrice ?? current.dealerPrice),
          minimumSalePrice: Number(
            row.minimum_sale_price ?? row.minimumSalePrice ?? current.minimumSalePrice,
          ),
        };
        await this.catalog.updateProductPricesBySku?.(organizationId, sku, after);
        if (this.infra) {
          await this.infra.auditPriceChange({
            organizationId,
            sku,
            before: {
              retailPrice: current.retailPrice,
              wholesalePrice: current.wholesalePrice,
              dealerPrice: current.dealerPrice,
              minimumSalePrice: current.minimumSalePrice,
            },
            after,
            reason: opts.reason ?? "bulk_price_import",
            userId: opts.userId,
          });
        }
        imported += 1;
      } catch (err) {
        errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "Price import failed",
        });
      }
    }
    return { imported, failed: errors.length, errors };
  }
}

export function parseCsv(text: string): CsvRow[] {
  const normalized = text.includes("\t") && !text.includes(",") ? text.replace(/\t/g, ",") : text;
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function productsExportCsv(
  products: Array<{
    productCode: string;
    sku: string;
    name: string;
    costPrice: number;
    retailPrice: number;
    wholesalePrice: number;
    dealerPrice: number;
    minimumSalePrice: number;
  }>,
): string {
  return rowsToCsv(
    [
      "product_code",
      "sku",
      "name",
      "cost_price",
      "retail_price",
      "wholesale_price",
      "dealer_price",
      "minimum_sale_price",
    ],
    products.map((p) => [
      p.productCode,
      p.sku,
      p.name,
      p.costPrice,
      p.retailPrice,
      p.wholesalePrice,
      p.dealerPrice,
      p.minimumSalePrice,
    ]),
  );
}

export function productsExport(
  products: Array<{
    productCode: string;
    sku: string;
    name: string;
    costPrice: number;
    retailPrice: number;
    wholesalePrice: number;
    dealerPrice: number;
    minimumSalePrice: number;
  }>,
  format: "csv" | "excel" | "pdf",
): { body: string; contentType: string; filename: string } {
  const headers = [
    "product_code",
    "sku",
    "name",
    "cost_price",
    "retail_price",
    "wholesale_price",
    "dealer_price",
    "minimum_sale_price",
  ];
  const rows = products.map((p) => [
    p.productCode,
    p.sku,
    p.name,
    p.costPrice,
    p.retailPrice,
    p.wholesalePrice,
    p.dealerPrice,
    p.minimumSalePrice,
  ]);
  if (format === "excel") {
    return {
      body: rowsToExcelTsv(headers, rows),
      contentType: "application/vnd.ms-excel",
      filename: "products-export.xls",
    };
  }
  if (format === "pdf") {
    return {
      body: rowsToSimplePdf(
        "Products export",
        products.map((p) => `${p.sku} ${p.name} ${p.retailPrice}`),
      ),
      contentType: "application/pdf",
      filename: "products-export.pdf",
    };
  }
  return {
    body: rowsToCsv(headers, rows),
    contentType: "text/csv",
    filename: "products-export.csv",
  };
}

export const PRODUCT_IMPORT_TEMPLATE = `product_code,sku,name,base_unit_id,cost_price,retail_price,wholesale_price,dealer_price,minimum_sale_price,barcode
P-001,SKU-001,Sample Cable,<unit-uuid>,100,150,140,130,120,
`;

export const CUSTOMER_IMPORT_TEMPLATE = `code,name,phone,email,customer_type
C-001,Walk-in Customer,,,retail
`;

export const SUPPLIER_IMPORT_TEMPLATE = `code,name,phone,email
S-001,Main Supplier,,
`;

export const STOCK_IMPORT_TEMPLATE = `sku,warehouse_id,qty
SKU-001,<warehouse-uuid>,10
`;

export const PRICE_IMPORT_TEMPLATE = `sku,retail_price,wholesale_price,dealer_price,minimum_sale_price
SKU-001,150,140,130,120
`;
