import { z } from "zod";
import { UuidSchema } from "./common.js";

export const ReportPeriodPresetSchema = z.enum([
  "today",
  "yesterday",
  "week",
  "month",
  "year",
  "custom",
]);
export type ReportPeriodPreset = z.infer<typeof ReportPeriodPresetSchema>;

export const ReportFilterSchema = z.object({
  organizationId: UuidSchema.optional(),
  period: ReportPeriodPresetSchema.default("month"),
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: UuidSchema.optional().nullable(),
  warehouseId: UuidSchema.optional().nullable(),
  salesmanUserId: UuidSchema.optional().nullable(),
  categoryId: UuidSchema.optional().nullable(),
  brandId: UuidSchema.optional().nullable(),
  partyId: UuidSchema.optional().nullable(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});
export type ReportFilter = z.infer<typeof ReportFilterSchema>;

export const SalesReportDimensionSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "product",
  "brand",
  "category",
  "customer",
  "salesman",
  "branch",
  "warehouse",
  "cash",
  "credit",
  "installment",
]);
export type SalesReportDimension = z.infer<typeof SalesReportDimensionSchema>;

export const PurchaseReportDimensionSchema = z.enum([
  "supplier",
  "product",
  "brand",
  "category",
  "branch",
]);
export type PurchaseReportDimension = z.infer<typeof PurchaseReportDimensionSchema>;

export const StockReportKindSchema = z.enum([
  "current",
  "low",
  "out",
  "valuation",
  "movement",
  "damaged",
  "reserved",
  "in_transit",
]);
export type StockReportKind = z.infer<typeof StockReportKindSchema>;

export const ProfitReportKindSchema = z.enum([
  "product",
  "invoice",
  "brand",
  "category",
  "daily",
  "monthly",
  "gross",
  "net",
  "margin",
]);
export type ProfitReportKind = z.infer<typeof ProfitReportKindSchema>;

export const AccountingReportKindSchema = z.enum([
  "customer_ledger",
  "supplier_ledger",
  "cash_book",
  "bank_book",
  "receivables",
  "payables",
  "expenses",
  "profit_loss",
  "trial_balance",
]);
export type AccountingReportKind = z.infer<typeof AccountingReportKindSchema>;

export const BiMetricSchema = z.enum([
  "best_selling",
  "worst_selling",
  "highest_profit",
  "lowest_profit",
  "customer_lifetime_value",
  "supplier_performance",
  "sales_growth",
  "purchase_growth",
  "monthly_comparison",
  "branch_comparison",
  "warehouse_comparison",
  "salesman_performance",
  "product_margin",
  "inventory_turnover",
]);
export type BiMetric = z.infer<typeof BiMetricSchema>;

/** Phase 12 reporting / dashboard / BI permissions. */
export const REPORTING_PERMISSIONS = [
  "dashboard.view",
  "dashboard.view_finance",
  "dashboard.view_all_branches",
  "reports.view",
  "reports.export",
  "reports.sales",
  "reports.purchases",
  "reports.stock",
  "reports.profit",
  "reports.finance",
  "bi.view",
  "bi.view_all_branches",
] as const;

export type ReportingPermission = (typeof REPORTING_PERMISSIONS)[number];
