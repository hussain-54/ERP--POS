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
    module: "Dashboard",
    apiGroup: "reports, admin",
    mount: "/api/v1/reports, /api/v1/admin/dashboard",
    repository: "ReportingRepository, AdminRepository",
    domain: "reporting.ts",
  },
  {
    id: "02",
    module: "Product Management",
    apiGroup: "catalog",
    mount: "/api/v1/catalog",
    repository: "CatalogRepository",
    domain: "pricing.ts, unit-conversion.ts",
  },
  {
    id: "03",
    module: "Barcode & QR",
    apiGroup: "catalog",
    mount: "/api/v1/catalog/barcodes, /api/v1/catalog/qr",
    repository: "CatalogRepository",
    domain: "barcode.ts",
  },
  {
    id: "04",
    module: "AI Camera Product Recognition",
    apiGroup: "ai",
    mount: "/api/v1/ai/recognize-product",
    repository: "AiRepository",
    domain: "packages/ai (no domain engine)",
  },
  {
    id: "05",
    module: "POS / Sales",
    apiGroup: "pos, parties",
    mount: "/api/v1/pos, /api/v1/parties/payments",
    repository: "PosRepository, PartiesRepository",
    domain: "sale-transaction.ts, pos-hold.ts, pos-return.ts, pos-exchange.ts, pos-payment.ts, pos-cart.ts, split-payment.ts",
  },
  {
    id: "06",
    module: "Quotations",
    apiGroup: "after-sales",
    mount: "/api/v1/after-sales/quotations",
    repository: "AfterSalesRepository",
    domain: "quotation-lifecycle.ts",
  },
  {
    id: "07",
    module: "Orders",
    apiGroup: "after-sales, commerce",
    mount: "/api/v1/after-sales/orders, /api/v1/b2b",
    repository: "AfterSalesRepository, CommerceRepository",
    domain: "quotation-lifecycle.ts, commerce.ts",
  },
  {
    id: "08",
    module: "Delivery",
    apiGroup: "purchases",
    mount: "/api/v1/purchases/deliveries",
    repository: "PurchasesRepository",
    domain: "delivery-lifecycle.ts, delivery-tracking.ts",
    note: "Lives in purchases.ts on purpose. Do not split in this step.",
  },
  {
    id: "09",
    module: "Purchases",
    apiGroup: "purchases",
    mount: "/api/v1/purchases/invoices, /api/v1/purchases/returns",
    repository: "PurchasesRepository",
    domain: "purchase-transaction.ts, supplier-pricing.ts",
  },
  {
    id: "10",
    module: "Inventory",
    apiGroup: "inventory",
    mount: "/api/v1/inventory",
    repository: "InventoryRepository",
    domain: "stock-balances.ts, stock-ledger.ts, inventory-valuation.ts",
  },
  {
    id: "11",
    module: "Warehouses",
    apiGroup: "inventory, purchases",
    mount: "/api/v1/inventory/warehouses, /api/v1/purchases/locations, /api/v1/purchases/transfers",
    repository: "InventoryRepository, PurchasesRepository",
    domain: "transfer-lifecycle.ts",
  },
  {
    id: "12",
    module: "Customers",
    apiGroup: "parties",
    mount: "/api/v1/parties/customers, /api/v1/parties/credit",
    repository: "PartiesRepository",
    domain: "party-ledger.ts, credit.ts",
  },
  {
    id: "13",
    module: "Suppliers",
    apiGroup: "parties, purchases",
    mount: "/api/v1/parties/suppliers, /api/v1/purchases/supplier-prices",
    repository: "PartiesRepository, PurchasesRepository",
    domain: "party-ledger.ts, supplier-pricing.ts",
  },
  {
    id: "14",
    module: "Service & Repair",
    apiGroup: "after-sales",
    mount: "/api/v1/after-sales/service-jobs",
    repository: "AfterSalesRepository",
    domain: "service-lifecycle.ts",
  },
  {
    id: "15",
    module: "Warranty",
    apiGroup: "after-sales",
    mount: "/api/v1/after-sales/warranties, /api/v1/after-sales/warranty-claims",
    repository: "AfterSalesRepository",
    domain: "warranty-service.ts",
  },
  {
    id: "16",
    module: "Accounts",
    apiGroup: "accounting",
    mount: "/api/v1/accounting/accounts, /api/v1/accounting/journals, /api/v1/accounting/vouchers, /api/v1/accounting/reports",
    repository: "AccountingRepository",
    domain: "accounting-posting.ts, finance-reports.ts",
  },
  {
    id: "17",
    module: "Banking",
    apiGroup: "accounting",
    mount: "/api/v1/accounting/bank-accounts, /api/v1/accounting/bank-statements, /api/v1/accounting/reconciliations",
    repository: "AccountingRepository",
    domain: "accounting-posting.ts",
  },
  {
    id: "18",
    module: "CRM & Marketing",
    apiGroup: "commerce",
    mount: "/api/v1/crm",
    repository: "CommerceRepository",
    domain: "commerce.ts",
  },
  {
    id: "19",
    module: "Reports & Analytics",
    apiGroup: "reports, ai, accounting",
    mount: "/api/v1/reports, /api/v1/ai/insights, /api/v1/accounting/reports",
    repository: "ReportingRepository, AiRepository, AccountingRepository",
    domain: "reporting.ts, finance-reports.ts",
  },
  {
    id: "20",
    module: "Salesman / Field Sales",
    apiGroup: "enterprise",
    mount: "/api/v1/hr, /api/v1/references, /api/v1/commissions",
    repository: "EnterpriseRepository",
    domain: "pos-commission.ts, enterprise.ts",
  },
  {
    id: "21",
    module: "Expenses",
    apiGroup: "accounting",
    mount: "/api/v1/accounting/expenses",
    repository: "AccountingRepository",
    domain: "accounting-posting.ts",
  },
  {
    id: "22",
    module: "Installments",
    apiGroup: "parties",
    mount: "/api/v1/parties/installments",
    repository: "PartiesRepository",
    domain: "installments.ts",
  },
  {
    id: "23",
    module: "Loyalty",
    apiGroup: "commerce",
    mount: "/api/v1/loyalty",
    repository: "CommerceRepository",
    domain: "commerce.ts",
  },
  {
    id: "24",
    module: "Documents",
    apiGroup: "enterprise",
    mount: "/api/v1/documents",
    repository: "EnterpriseRepository",
    domain: "enterprise.ts",
  },
  {
    id: "25",
    module: "Approval Workflow",
    apiGroup: "admin",
    mount: "/api/v1/admin/approvals",
    repository: "AdminRepository",
    domain: "approval-workflow.ts",
  },
  {
    id: "26",
    module: "Users & Role Management",
    apiGroup: "admin",
    mount: "/api/v1/admin/users, /api/v1/admin/roles",
    repository: "AdminRepository, UserRepository",
    domain: "rbac-catalog.ts, authz-service.ts",
  },
  {
    id: "27",
    module: "Permissions",
    apiGroup: "admin",
    mount: "/api/v1/admin/permissions, /api/v1/admin/users/:id/permissions",
    repository: "AdminRepository",
    domain: "authz-service.ts",
  },
  {
    id: "28",
    module: "Audit Trail",
    apiGroup: "admin",
    mount: "/api/v1/admin/audit",
    repository: "AdminRepository",
    domain: "audit-trail.ts",
  },
  {
    id: "29",
    module: "Notification Center",
    apiGroup: "enterprise",
    mount: "/api/v1/notifications",
    repository: "EnterpriseRepository",
    domain: "enterprise.ts",
  },
  {
    id: "30",
    module: "Multi-Branch",
    apiGroup: "admin",
    mount: "/api/v1/admin/branches",
    repository: "AdminRepository",
    domain: "DB only (no branch domain engine)",
  },
  {
    id: "31",
    module: "Tax & Pakistan Compliance",
    apiGroup: "enterprise",
    mount: "/api/v1/tax",
    repository: "EnterpriseRepository",
    domain: "pos-tax.ts, enterprise.ts",
  },
  {
    id: "32",
    module: "Import / Export",
    apiGroup: "infrastructure, catalog",
    mount: "/api/v1/data/import, /api/v1/data/export, /api/v1/catalog/import",
    repository: "InfrastructureRepository, CatalogRepository",
    domain: "apps/api import-service.ts",
  },
  {
    id: "33",
    module: "Printing",
    apiGroup: "hardware",
    mount: "/api/v1/hardware/print, /api/v1/hardware/print-jobs",
    repository: "HardwareRepository",
    domain: "packages/hardware (no domain engine)",
  },
  {
    id: "34",
    module: "Backup & Disaster Recovery",
    apiGroup: "infrastructure",
    mount: "/api/v1/backup",
    repository: "InfrastructureRepository",
    domain: "infrastructure.ts",
  },
  {
    id: "35",
    module: "Devices / Printing",
    apiGroup: "hardware",
    mount: "/api/v1/hardware/events, /api/v1/hardware/cash-drawer, /api/v1/hardware/capabilities",
    repository: "HardwareRepository",
    domain: "packages/hardware (no domain engine)",
  },
  {
    id: "36",
    module: "Industry Engine",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "37",
    module: "Customization Engine",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "38",
    module: "Rules / Automation Engine",
    apiGroup: "none",
    mount: "none (Coming Soon)",
    repository: "none",
    domain: "none",
  },
  {
    id: "39",
    module: "System Administration",
    apiGroup: "infrastructure, commerce, enterprise",
    mount: "/api/v1/security, /api/v1/integrations, /api/v1/store, /api/v1/hr",
    repository: "InfrastructureRepository, CommerceRepository, EnterpriseRepository",
    domain: "infrastructure.ts, commerce.ts, enterprise.ts",
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
  { client: "parties-api", folder: "features/customers", modules: "05 payments, 12 customers, 13 suppliers, 22 installments" },
  { client: "after-sales-api", folder: "features/quotations", modules: "06 quotations, 07 orders, 14 service, 15 warranty" },
  { client: "admin-api", folder: "features/users", modules: "01 dashboard group, 25 approvals, 26 users, 27 permissions, 28 audit, 30 branches" },
  { client: "commerce-api", folder: "features/crm", modules: "07 B2B, 18 CRM, 23 loyalty, 39 store" },
  { client: "enterprise-api", folder: "features/system", modules: "20 salesmen, 24 documents, 29 notifications, 31 tax, 39 HR" },
  { client: "infrastructure-api", folder: "features/system", modules: "32 import/export, 34 backup, 39 security/integrations" },
] as const;

/**
 * Genuine shared ownership. Keep grouped routers. Do not split.
 */
export const OWNERSHIP_AMBIGUITIES = [
  {
    topic: "Delivery",
    modules: "08",
    livesIn: "purchases.ts → /api/v1/purchases/deliveries",
    action: "Keep. Domain is delivery-lifecycle.ts; router stays purchases.",
  },
  {
    topic: "Warehouse locations and transfers",
    modules: "11",
    livesIn: "inventory.ts warehouses + purchases.ts locations/transfers",
    action: "Keep split as implemented. Masters vs bin/transfer ops.",
  },
  {
    topic: "Supplier price lists",
    modules: "13",
    livesIn: "parties.ts suppliers + purchases.ts supplier-prices",
    action: "Keep. UI reuses PurchasesPage.",
  },
  {
    topic: "Sales payments",
    modules: "05",
    livesIn: "parties.ts /payments (not pos.ts)",
    action: "Keep. POS sales stay on pos.ts; tender posting is parties.",
  },
  {
    topic: "Orders vs B2B",
    modules: "07",
    livesIn: "after-sales.ts /orders + commerce.ts /b2b",
    action: "Keep. Wholesale portal is commerce; sales orders are after-sales.",
  },
  {
    topic: "HR employees",
    modules: "20, 39",
    livesIn: "enterprise.ts /hr",
    action: "Keep one HR API. Salesmen and System HR share it.",
  },
  {
    topic: "Finance reports",
    modules: "16, 19, 12, 13",
    livesIn: "accounting.ts /reports + reports.ts + AI insights",
    action: "Keep. P&L UI may use ReportsHubPage; accounting report APIs stay.",
  },
  {
    topic: "Import / export",
    modules: "32",
    livesIn: "catalog.ts /import|/export + infrastructure.ts /data/import|/data/export",
    action: "Keep both mounts. Catalog templates vs generic data import.",
  },
] as const;
