/**
 * 39 product modules → grouped API routers.
 *
 * The ERP UI has 39 modules. The API stays grouped (catalog, parties, pos, …).
 * Do not split this table into 39 Express routers. Do not rename URLs.
 *
 * Delivery stays on purchasesRouter. Parties/after-sales/accounting/admin stay shared.
 */
export type ModuleApiOwnership = {
  id: string;
  module: string;
  apiGroup: string;
  mount: string;
  repository: string;
  domain: string;
  note?: string;
};

export const MODULE_API_OWNERSHIP: readonly ModuleApiOwnership[] = [
  {
    id: "01",
    module: "COMMAND CENTER",
    apiGroup: "reports, admin",
    mount: "/api/v1/reports, /api/v1/admin/dashboard",
    repository: "ReportingRepository, AdminRepository",
    domain: "reporting.ts",
  },
  {
    id: "02",
    module: "POS / SALES",
    apiGroup: "pos",
    mount: "/api/v1/pos",
    repository: "PosRepository",
    domain: "pos-transaction.ts, pos-validation.ts, pos-payment.ts",
  },
  {
    id: "03",
    module: "PRODUCT & CATALOG",
    apiGroup: "catalog",
    mount: "/api/v1/catalog, /api/v1/catalog/barcodes, /api/v1/catalog/qr",
    repository: "CatalogRepository",
    domain: "pricing.ts, unit-conversion.ts, barcode.ts",
  },
  {
    id: "04",
    module: "PURCHASING",
    apiGroup: "purchases, parties",
    mount: "/api/v1/purchases/invoices, /api/v1/purchases/returns, /api/v1/parties/suppliers, /api/v1/purchases/supplier-prices",
    repository: "PurchasesRepository, PartiesRepository",
    domain: "purchase-transaction.ts, supplier-pricing.ts, party-ledger.ts",
  },
  {
    id: "05",
    module: "INVENTORY",
    apiGroup: "inventory",
    mount: "/api/v1/inventory",
    repository: "InventoryRepository",
    domain: "stock-balances.ts, stock-ledger.ts, inventory-valuation.ts",
  },
  {
    id: "06",
    module: "WAREHOUSE / WMS",
    apiGroup: "inventory, purchases",
    mount: "/api/v1/inventory/warehouses, /api/v1/purchases/locations, /api/v1/purchases/transfers",
    repository: "InventoryRepository, PurchasesRepository",
    domain: "transfer-lifecycle.ts",
  },
  {
    id: "07",
    module: "DELIVERY / LOGISTICS",
    apiGroup: "purchases",
    mount: "/api/v1/purchases/deliveries",
    repository: "PurchasesRepository",
    domain: "delivery-lifecycle.ts, delivery-tracking.ts",
    note: "Lives in purchases.ts on purpose. Do not split in this step.",
  },
  {
    id: "08",
    module: "CUSTOMERS / CRM",
    apiGroup: "parties, commerce",
    mount: "/api/v1/parties/customers, /api/v1/parties/credit, /api/v1/parties/installments, /api/v1/crm",
    repository: "PartiesRepository, CommerceRepository",
    domain: "party-ledger.ts, credit.ts, installments.ts, commerce.ts",
  },
  {
    id: "09",
    module: "SERVICE MANAGEMENT",
    apiGroup: "after-sales",
    mount: "/api/v1/after-sales/service-jobs",
    repository: "AfterSalesRepository",
    domain: "service-lifecycle.ts",
  },
  {
    id: "10",
    module: "WARRANTY",
    apiGroup: "after-sales",
    mount: "/api/v1/after-sales/warranties, /api/v1/after-sales/warranty-claims",
    repository: "AfterSalesRepository",
    domain: "warranty-service.ts",
  },
  {
    id: "11",
    module: "ACCOUNTS & FINANCE",
    apiGroup: "accounting",
    mount: "/api/v1/accounting/accounts, /api/v1/accounting/journals, /api/v1/accounting/vouchers, /api/v1/accounting/reports, /api/v1/accounting/expenses",
    repository: "AccountingRepository",
    domain: "accounting-posting.ts, finance-reports.ts",
  },
  {
    id: "12",
    module: "BANKING & PAYMENTS",
    apiGroup: "accounting",
    mount: "/api/v1/accounting/bank-accounts, /api/v1/accounting/bank-statements, /api/v1/accounting/reconciliations",
    repository: "AccountingRepository",
    domain: "accounting-posting.ts",
  },
  {
    id: "13",
    module: "REPORTS & BUSINESS INTELLIGENCE",
    apiGroup: "reports, accounting",
    mount: "/api/v1/reports, /api/v1/accounting/reports",
    repository: "ReportingRepository, AccountingRepository",
    domain: "reporting.ts, finance-reports.ts",
  },
  {
    id: "14",
    module: "AI & AUTOMATION",
    apiGroup: "ai",
    mount: "/api/v1/ai/recognize-product, /api/v1/ai/insights",
    repository: "AiRepository",
    domain: "packages/ai (no domain engine)",
  },
  {
    id: "15",
    module: "MARKETING & LOYALTY",
    apiGroup: "commerce",
    mount: "/api/v1/loyalty, /api/v1/crm",
    repository: "CommerceRepository",
    domain: "commerce.ts",
  },
  {
    id: "16",
    module: "B2B / WHOLESALE",
    apiGroup: "after-sales, commerce",
    mount: "/api/v1/after-sales/quotations, /api/v1/after-sales/orders, /api/v1/b2b",
    repository: "AfterSalesRepository, CommerceRepository",
    domain: "quotation-lifecycle.ts, commerce.ts",
  },
  {
    id: "17",
    module: "ONLINE STORE",
    apiGroup: "commerce",
    mount: "/api/v1/store",
    repository: "CommerceRepository",
    domain: "commerce.ts",
  },
  {
    id: "18",
    module: "MOBILE",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "19",
    module: "ORGANIZATION / BRANCHES",
    apiGroup: "admin",
    mount: "/api/v1/admin/branches",
    repository: "AdminRepository",
    domain: "DB only (no branch domain engine)",
  },
  {
    id: "20",
    module: "HR & PAYROLL",
    apiGroup: "enterprise",
    mount: "/api/v1/hr, /api/v1/references, /api/v1/commissions",
    repository: "EnterpriseRepository",
    domain: "pos-commission.ts, enterprise.ts",
  },
  {
    id: "21",
    module: "TAX / FBR",
    apiGroup: "enterprise",
    mount: "/api/v1/tax",
    repository: "EnterpriseRepository",
    domain: "pos-tax.ts, enterprise.ts",
  },
  {
    id: "22",
    module: "DOCUMENT MANAGEMENT",
    apiGroup: "enterprise",
    mount: "/api/v1/documents",
    repository: "EnterpriseRepository",
    domain: "enterprise.ts",
  },
  {
    id: "23",
    module: "WORKFLOW / APPROVALS",
    apiGroup: "admin",
    mount: "/api/v1/admin/approvals",
    repository: "AdminRepository",
    domain: "approval-workflow.ts",
  },
  {
    id: "24",
    module: "NOTIFICATIONS",
    apiGroup: "enterprise",
    mount: "/api/v1/notifications",
    repository: "EnterpriseRepository",
    domain: "enterprise.ts",
  },
  {
    id: "25",
    module: "USERS / ROLES / PERMISSIONS",
    apiGroup: "admin",
    mount: "/api/v1/admin/users, /api/v1/admin/roles, /api/v1/admin/permissions, /api/v1/admin/users/:id/permissions",
    repository: "AdminRepository, UserRepository",
    domain: "rbac-catalog.ts, authz-service.ts",
  },
  {
    id: "26",
    module: "SECURITY / AUDIT",
    apiGroup: "admin, infrastructure",
    mount: "/api/v1/admin/audit, /api/v1/security",
    repository: "AdminRepository, InfrastructureRepository",
    domain: "audit-trail.ts, infrastructure.ts",
  },
  {
    id: "27",
    module: "OFFLINE / LOCAL OPERATIONS",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "28",
    module: "SYNC CENTER",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "29",
    module: "BACKUP / DISASTER RECOVERY",
    apiGroup: "infrastructure",
    mount: "/api/v1/backup",
    repository: "InfrastructureRepository",
    domain: "infrastructure.ts",
  },
  {
    id: "30",
    module: "INTEGRATION HUB",
    apiGroup: "infrastructure",
    mount: "/api/v1/integrations",
    repository: "InfrastructureRepository",
    domain: "infrastructure.ts",
  },
  {
    id: "31",
    module: "DEVICES / PRINTING",
    apiGroup: "hardware",
    mount: "/api/v1/hardware/events, /api/v1/hardware/cash-drawer, /api/v1/hardware/capabilities, /api/v1/hardware/print, /api/v1/hardware/print-jobs",
    repository: "HardwareRepository",
    domain: "packages/hardware (no domain engine)",
  },
  {
    id: "32",
    module: "INDUSTRY ENGINE",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "33",
    module: "CUSTOMIZATION ENGINE",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "34",
    module: "RULES / AUTOMATION ENGINE",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "35",
    module: "CLIENT / TENANT MANAGEMENT",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "36",
    module: "SUBSCRIPTION / BILLING",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "37",
    module: "USAGE / METERING",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "38",
    module: "DEVELOPER PLATFORM",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "39",
    module: "SYSTEM ADMINISTRATION",
    apiGroup: "infrastructure, catalog",
    mount: "/api/v1/data/import, /api/v1/data/export, /api/v1/catalog/import",
    repository: "InfrastructureRepository, CatalogRepository",
    domain: "apps/api import-service.ts",
  },
];

if (MODULE_API_OWNERSHIP.length !== 39) {
  throw new Error("MODULE_API_OWNERSHIP must list exactly 39 product modules");
}

/** Reverse index: grouped router → product module ids. Not 39 routers. */
export const API_GROUP_TO_MODULES: Readonly<Record<string, readonly string[]>> = (() => {
  const out: Record<string, string[]> = {};
  for (const row of MODULE_API_OWNERSHIP) {
    for (const group of row.apiGroup.split(",").map((s) => s.trim())) {
      if (group === "none") continue;
      (out[group] ??= []).push(row.id);
    }
  }
  return out;
})();

/** Auth and health sit outside the 39 product modules. */
export const NON_MODULE_API_GROUPS = [
  { apiGroup: "auth", mount: "/api/v1/auth", note: "Login / session. Not a product module." },
  { apiGroup: "health", mount: "/health", note: "Probes. Not a product module." },
] as const;

/**
 * Shared web clients. Do not copy these into 39 feature-folder clients.
 */
export const SHARED_WEB_API_CLIENTS = [
  { client: "parties-api", folder: "features/customers", modules: "02 payments, 08 customers/credit/installments, 04 suppliers" },
  { client: "after-sales-api", folder: "features/quotations", modules: "16 quotations/orders, 09 service, 10 warranty" },
  { client: "admin-api", folder: "features/users", modules: "01 dashboard group, 19 branches, 23 approvals, 25 users/permissions, 26 audit" },
  { client: "commerce-api", folder: "features/crm", modules: "08 CRM, 15 loyalty/marketing, 16 B2B, 17 store" },
  { client: "enterprise-api", folder: "features/system", modules: "20 HR/salesmen, 21 tax, 22 documents, 24 notifications" },
  { client: "infrastructure-api", folder: "features/system", modules: "26 security, 29 backup, 30 integrations, 39 import/export" },
] as const;

/**
 * Genuine shared ownership. Keep grouped routers. Do not split.
 */
export const OWNERSHIP_AMBIGUITIES = [
  {
    topic: "Delivery",
    modules: "07",
    livesIn: "purchases.ts → /api/v1/purchases/deliveries",
    action: "Keep. Domain is delivery-lifecycle.ts; router stays purchases.",
  },
  {
    topic: "Warehouse locations and transfers",
    modules: "06",
    livesIn: "inventory.ts warehouses + purchases.ts locations/transfers",
    action: "Keep split as implemented. Masters vs bin/transfer ops.",
  },
  {
    topic: "Supplier price lists",
    modules: "04",
    livesIn: "parties.ts suppliers + purchases.ts supplier-prices",
    action: "Keep. UI reuses PurchasesPage.",
  },
  {
    topic: "Sales payments",
    modules: "02",
    livesIn: "pos.ts → /api/v1/pos/sales, /api/v1/pos/holds",
    action: "Keep. POS terminal posts sales and holds via PosRepository.",
  },
  {
    topic: "Orders vs B2B",
    modules: "16",
    livesIn: "after-sales.ts /orders + commerce.ts /b2b",
    action: "Keep. Wholesale portal is commerce; sales orders are after-sales.",
  },
  {
    topic: "HR employees",
    modules: "20",
    livesIn: "enterprise.ts /hr",
    action: "Keep one HR API. Field salesmen stay on the same HR mount.",
  },
  {
    topic: "Finance reports",
    modules: "11, 13, 08, 04",
    livesIn: "accounting.ts /reports + reports.ts + AI insights",
    action: "Keep. P&L UI may use ReportsHubPage; accounting report APIs stay.",
  },
  {
    topic: "Import / export",
    modules: "39",
    livesIn: "catalog.ts /import|/export + infrastructure.ts /data/import|/data/export",
    action: "Keep both mounts. Catalog templates vs generic data import.",
  },
] as const;
