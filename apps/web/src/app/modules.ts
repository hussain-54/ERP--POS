export type NavStatus = "implemented" | "placeholder" | "legacy";

export type NavIconName =
  | "dashboard"
  | "products"
  | "barcode"
  | "camera"
  | "pos"
  | "quote"
  | "orders"
  | "delivery"
  | "purchases"
  | "inventory"
  | "warehouse"
  | "customers"
  | "suppliers"
  | "service"
  | "warranty"
  | "accounts"
  | "banking"
  | "crm"
  | "reports"
  | "salesman"
  | "expenses"
  | "installments"
  | "loyalty"
  | "documents"
  | "approvals"
  | "users"
  | "permissions"
  | "audit"
  | "notifications"
  | "branches"
  | "tax"
  | "import"
  | "printing"
  | "backup"
  | "devices"
  | "industry"
  | "customize"
  | "rules"
  | "admin";

export interface NavItemOptions {
  permission?: string;
  /** Hide from sidebar but keep the route. Default true. */
  sidebar?: boolean;
  availableOn?: string;
}

export interface ErpModuleRoute {
  path: string;
  title: string;
  group: string;
  description: string;
  status?: NavStatus;
  /** Existing screen that already covers this function (placeholder only). */
  availableOn?: string;
  sidebar?: boolean;
  permission?: string;
}

export interface ErpNavChild {
  path: string;
  title: string;
  description: string;
  status: NavStatus;
  availableOn?: string;
  sidebar?: boolean;
  permission?: string;
}

export interface ErpNavSection {
  id: string;
  /** Official 39-module name. Sidebar shows `title` (short label). */
  masterTitle: string;
  title: string;
  icon: NavIconName;
  path: string;
  description: string;
  permission?: string;
  children: ErpNavChild[];
}

function live(path: string, title: string, description: string, opts?: NavItemOptions): ErpNavChild {
  return {
    path,
    title,
    description,
    status: "implemented",
    permission: opts?.permission,
    sidebar: opts?.sidebar,
    availableOn: opts?.availableOn,
  };
}

function soon(path: string, title: string, description: string, opts?: NavItemOptions): ErpNavChild {
  return {
    path,
    title,
    description,
    status: "placeholder",
    availableOn: opts?.availableOn,
    permission: opts?.permission,
    sidebar: opts?.sidebar,
  };
}

/**
 * Show a nav item when it has no permission mapping, when the session has not
 * loaded any keys yet (fail open), or when the user has the mapped key.
 */
export function canShowNavItem(
  permission: string | undefined,
  grantedCount: number,
  hasPermission: (key: string) => boolean,
): boolean {
  if (!permission) return true;
  if (grantedCount === 0) return true;
  return hasPermission(permission);
}

/**
 * Locked 39-module ERP navigation (FINAL 39-MODULE ALIGNMENT REPORT).
 * `title` is the short sidebar label — do not expand it to `masterTitle`.
 * Keep all children, duplicate routes, and Coming Soon status for 36–38.
 * Do not add or remove top-level parents.
 */
export const ERP_NAV_SECTIONS: ErpNavSection[] = [
  {
    id: "01",
    masterTitle: "Dashboard",
    title: "Dashboard",
    icon: "dashboard",
    path: "/",
    description: "Operational overview and alerts.",
    permission: "dashboard.view",
    children: [
      live("/", "Dashboard", "Operational overview and alerts.", {
        permission: "dashboard.view",
        sidebar: false,
      }),
    ],
  },
  {
    id: "02",
    masterTitle: "Product Management",
    title: "Products",
    icon: "products",
    path: "/products",
    description: "Product master, taxonomy, units, and pricing.",
    permission: "products.read",
    children: [
      live("/products", "Product Management", "Product master list.", {
        permission: "products.read",
        sidebar: false,
      }),
      live("/categories", "Categories", "Category taxonomy.", { permission: "catalog_taxonomy.manage" }),
      live("/subcategories", "Subcategories", "Subcategory taxonomy.", {
        permission: "catalog_taxonomy.manage",
      }),
      live("/brands", "Brands", "Brand master.", { permission: "catalog_taxonomy.manage" }),
      live("/companies", "Companies", "Company / manufacturer master.", {
        permission: "catalog_taxonomy.manage",
      }),
      live("/units", "Units", "Units and conversions.", { permission: "units.manage" }),
      live("/pricing", "Pricing", "Price levels and lists.", { permission: "pricing.read" }),
      soon("/products/variants", "Variants", "Variant editor on the product form.", {
        availableOn: "/products",
        permission: "products.read",
      }),
      soon("/products/attributes", "Attributes", "Attribute fields on the product form.", {
        availableOn: "/products",
        permission: "products.read",
      }),
      soon("/products/media", "Media", "Media upload on the product form.", {
        availableOn: "/products",
        permission: "products.manage_media",
      }),
      soon("/products/specifications", "Specifications", "Specifications on the product form.", {
        availableOn: "/products",
        permission: "products.read",
      }),
    ],
  },
  {
    id: "03",
    masterTitle: "Barcode & QR",
    title: "Barcodes",
    icon: "barcode",
    path: "/barcodes",
    description: "Barcode and QR assignment and labels.",
    permission: "barcodes.manage",
    children: [
      live("/barcodes", "Barcodes", "Generate and list barcodes.", {
        permission: "barcodes.manage",
        sidebar: false,
      }),
      live("/qr", "QR", "QR generation (same barcode tools).", { permission: "barcodes.manage" }),
    ],
  },
  {
    id: "04",
    masterTitle: "AI Camera Product Recognition",
    title: "AI Camera",
    icon: "camera",
    path: "/ai-camera",
    description: "Camera-assisted product match.",
    permission: "ai.recognize",
    children: [
      live("/ai-camera", "AI Camera", "Camera-assisted product match.", {
        permission: "ai.recognize",
        sidebar: false,
      }),
    ],
  },
  {
    id: "05",
    masterTitle: "POS / Sales",
    title: "Sales",
    icon: "pos",
    path: "/pos",
    description: "Point of sale terminal and sales documents.",
    permission: "pos.sell",
    children: [
      live("/pos", "POS", "POS terminal.", { permission: "pos.sell", sidebar: false }),
      live("/held-sales", "Hold / Resume", "Parked POS carts (same terminal; opens the holds drawer).", {
        permission: "pos.hold",
      }),
      live("/invoices", "Invoices", "Invoice register and reprints.", { permission: "pos.view_invoices" }),
      live("/sales-management", "Sales Register", "Sales register, filters, and KPIs.", {
        permission: "pos.view_invoices",
      }),
      live("/returns", "Returns", "Sales returns.", { permission: "pos.return" }),
      live("/exchange", "Exchange", "Exchanges (same returns screen).", { permission: "pos.return" }),
      live("/payments", "Payments", "Tender and receipts.", { permission: "payments.receive" }),
      soon("/discounts", "Discounts", "Discount policies. POS already enforces discount caps.", {
        permission: "pos.sell",
      }),
      live("/pos/references", "References", "Outside references (same salesman screen).", {
        permission: "hr.view",
      }),
      live("/pos/salesmen", "Salesmen", "Salesman profiles and commissions (same module 20 screen).", {
        permission: "hr.view",
      }),
      live("/pos/installments", "Installments", "Installment plans (same module 22 /credit screen).", {
        permission: "installments.manage",
      }),
    ],
  },
  {
    id: "06",
    masterTitle: "Quotations",
    title: "Quotations",
    icon: "quote",
    path: "/quotations",
    description: "Quotes and conversion.",
    permission: "quotations.read",
    children: [
      live("/quotations", "Quotations", "Quotes and conversion.", {
        permission: "quotations.read",
        sidebar: false,
      }),
    ],
  },
  {
    id: "07",
    masterTitle: "Orders",
    title: "Orders",
    icon: "orders",
    path: "/orders",
    description: "Sales orders and wholesale order intake.",
    permission: "orders.read",
    children: [
      live("/orders", "Orders", "Order list (shared with quotations screen).", {
        permission: "orders.read",
        sidebar: false,
      }),
      live("/b2b", "B2B", "Wholesale portal orders.", { permission: "b2b.manage" }),
    ],
  },
  {
    id: "08",
    masterTitle: "Delivery",
    title: "Delivery",
    icon: "delivery",
    path: "/deliveries",
    description: "Delivery notes and tracking.",
    permission: "deliveries.view",
    children: [
      live("/deliveries", "Delivery", "Delivery notes and tracking.", {
        permission: "deliveries.view",
        sidebar: false,
      }),
    ],
  },
  {
    id: "09",
    masterTitle: "Purchases",
    title: "Purchases",
    icon: "purchases",
    path: "/purchases",
    description: "Purchase invoices, returns, and reorder.",
    permission: "purchases.read",
    children: [
      live("/purchases", "Purchases", "Purchases and supplier prices.", {
        permission: "purchases.read",
        sidebar: false,
      }),
      live("/purchase-returns", "Purchase Returns", "Purchase return posting.", {
        permission: "purchases.return",
      }),
      soon("/purchase-automation", "Automation", "Reorder suggestions are not implemented yet.", {
        permission: "purchases.read",
      }),
    ],
  },
  {
    id: "10",
    masterTitle: "Inventory",
    title: "Inventory",
    icon: "inventory",
    path: "/inventory",
    description: "Stock on hand, movements, and traceability.",
    permission: "inventory.view",
    children: [
      live("/inventory", "Inventory", "Stock balances and movement ledger.", {
        permission: "inventory.view",
        sidebar: false,
      }),
      live("/stock-ops", "Movements", "Manual movements, adjustments, counts.", {
        permission: "inventory.adjust",
      }),
      live("/batches-serials", "Batches", "Batch records.", { permission: "inventory.batch" }),
      live("/inventory/serials", "Serials", "Serial records (same traceability screen).", {
        permission: "inventory.serial",
      }),
      live("/inventory/expiry", "Expiry", "Expiry tracking (same traceability screen).", {
        permission: "inventory.batch",
      }),
      live("/inventory/adjustments", "Adjustments", "Stock adjustments (stock operations).", {
        permission: "inventory.adjust",
      }),
      live("/inventory/damaged", "Damaged", "Damage movements (stock operations).", {
        permission: "inventory.adjust",
      }),
      live("/inventory/audit", "Counts / Audit", "Stock counts (stock operations).", {
        permission: "inventory.count",
      }),
    ],
  },
  {
    id: "11",
    masterTitle: "Warehouses",
    title: "Warehouses",
    icon: "warehouse",
    path: "/warehouses",
    description: "Warehouses, locations, and transfers.",
    permission: "warehouses.manage",
    children: [
      live("/warehouses", "Warehouses", "Warehouse master.", {
        permission: "warehouses.manage",
        sidebar: false,
      }),
      live("/warehouses/racks", "Racks", "Racks on the warehouses screen.", { permission: "warehouses.manage" }),
      live("/warehouses/shelves", "Shelves", "Shelves on the warehouses screen.", {
        permission: "warehouses.manage",
      }),
      live("/warehouses/bins", "Bins", "Bins on the warehouses screen.", { permission: "warehouses.manage" }),
      soon("/warehouses/receiving", "Receiving", "Dedicated receiving desk is not implemented yet.", {
        availableOn: "/purchases",
        permission: "purchases.read",
      }),
      soon("/warehouses/dispatch", "Dispatch", "Dedicated dispatch desk is not implemented yet.", {
        availableOn: "/deliveries",
        permission: "deliveries.view",
      }),
      live("/stock-transfers", "Transfers", "Inter-warehouse transfers.", { permission: "inventory.transfer" }),
    ],
  },
  {
    id: "12",
    masterTitle: "Customers",
    title: "Customers",
    icon: "customers",
    path: "/customers",
    description: "Customer master, ledger, and credit.",
    permission: "customers.read",
    children: [
      live("/customers", "Customers", "Customer master.", { permission: "customers.read", sidebar: false }),
      live("/customers/ledger", "Ledger", "Customer ledger on the customer screen.", {
        permission: "ledgers.view",
      }),
      soon("/customers/receivables", "Receivables", "Receivables reports live under Reports.", {
        availableOn: "/reports",
        permission: "reports.view",
      }),
      live("/credit", "Credit", "Credit / udhaar approvals.", { permission: "credit.manage" }),
      live("/customers/payment-history", "History", "Payment history on the customer screen.", {
        permission: "customers.read",
      }),
    ],
  },
  {
    id: "13",
    masterTitle: "Suppliers",
    title: "Suppliers",
    icon: "suppliers",
    path: "/suppliers",
    description: "Supplier master, ledger, and prices.",
    permission: "suppliers.read",
    children: [
      live("/suppliers", "Suppliers", "Supplier master.", { permission: "suppliers.read", sidebar: false }),
      live("/suppliers/ledger", "Ledger", "Supplier ledger on the supplier screen.", {
        permission: "ledgers.view",
      }),
      soon("/suppliers/payables", "Payables", "Payables reports live under Reports.", {
        availableOn: "/reports",
        permission: "reports.view",
      }),
      live("/suppliers/price-lists", "Price Lists", "Supplier prices on Purchases.", {
        permission: "purchases.prices",
      }),
      soon("/suppliers/performance", "Performance", "Supplier performance analytics are not implemented yet.", {
        permission: "suppliers.read",
      }),
    ],
  },
  {
    id: "14",
    masterTitle: "Service & Repair",
    title: "Service",
    icon: "service",
    path: "/service",
    description: "Job cards, technicians, and repairs.",
    permission: "service.manage",
    children: [
      live("/service", "Service", "Service jobs.", { permission: "service.manage", sidebar: false }),
      live("/service/complaints", "Complaints", "Complaint capture on the service screen.", {
        permission: "service.manage",
      }),
      live("/service/technicians", "Technicians", "Technician assignment on the service screen.", {
        permission: "service.manage",
      }),
      live("/service/repairs", "Repairs", "Repair workflow on the service screen.", {
        permission: "service.manage",
      }),
      live("/service/charges", "Charges", "Service billing on the service screen.", {
        permission: "service.manage",
      }),
    ],
  },
  {
    id: "15",
    masterTitle: "Warranty",
    title: "Warranty",
    icon: "warranty",
    path: "/warranty",
    description: "Warranty claims and replacements.",
    permission: "warranty.manage",
    children: [
      live("/warranty", "Warranty", "Warranty claims.", { permission: "warranty.manage", sidebar: false }),
      live("/warranty/replacements", "Replacements", "Warranty replacements.", {
        permission: "warranty.manage",
      }),
      live("/warranty/history", "History", "Lookup and claim history.", { permission: "warranty.manage" }),
    ],
  },
  {
    id: "16",
    masterTitle: "Accounts",
    title: "Accounts",
    icon: "accounts",
    path: "/accounts",
    description: "Chart of accounts, journals, and vouchers.",
    permission: "accounts.read",
    children: [
      live("/accounts", "Accounts", "Chart of accounts, journals, and vouchers.", {
        permission: "accounts.read",
        sidebar: false,
      }),
      soon("/accounts/cash", "Cash", "Cash book reports live under Reports.", {
        availableOn: "/reports",
        permission: "reports.finance",
      }),
      live("/accounts/journals", "Journals", "Journals and vouchers.", { permission: "accounts.write" }),
      soon("/accounts/receipts", "Receipts", "Receipt posting uses Payments.", {
        availableOn: "/payments",
        permission: "payments.receive",
      }),
      live("/accounts/profit-loss", "P&L", "P&L from the reports hub.", { permission: "reports.finance" }),
    ],
  },
  {
    id: "17",
    masterTitle: "Banking",
    title: "Banking",
    icon: "banking",
    path: "/banking",
    description: "Bank books and reconciliation.",
    permission: "banking.manage",
    children: [
      live("/banking", "Banking", "Bank books and reconciliation.", {
        permission: "banking.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "18",
    masterTitle: "CRM & Marketing",
    title: "CRM",
    icon: "crm",
    path: "/crm",
    description: "Segments, campaigns, and engagement.",
    permission: "crm.view",
    children: [
      live("/crm", "CRM", "CRM segments.", { permission: "crm.view", sidebar: false }),
      live("/crm/campaigns", "Campaigns", "Campaigns including SMS and WhatsApp.", { permission: "crm.manage" }),
      live("/crm/sms", "SMS", "SMS channel campaigns.", { permission: "crm.manage" }),
      live("/crm/whatsapp", "WhatsApp", "WhatsApp channel campaigns.", { permission: "crm.manage" }),
      live("/crm/marketing", "Marketing", "Marketing campaigns on the CRM screen.", {
        permission: "crm.manage",
      }),
      live("/crm/engagement", "Engagement", "Profiles and campaign activity.", { permission: "crm.view" }),
    ],
  },
  {
    id: "19",
    masterTitle: "Reports & Analytics",
    title: "Reports",
    icon: "reports",
    path: "/reports",
    description: "Operational reports, BI, and AI insights.",
    permission: "reports.view",
    children: [
      live("/reports", "Reports", "Operational report hub.", { permission: "reports.view", sidebar: false }),
      live("/bi", "BI", "KPI dashboards.", { permission: "bi.view" }),
      live("/ai-insights", "AI Insights", "AI business insights.", { permission: "ai.insights" }),
    ],
  },
  {
    id: "20",
    masterTitle: "Salesman / Field Sales",
    title: "Salesmen",
    icon: "salesman",
    path: "/salesman",
    description: "Salesmen, references, and commissions.",
    permission: "hr.view",
    children: [
      live("/salesman", "Salesmen", "Salesmen, references, and commissions.", {
        permission: "hr.view",
        sidebar: false,
      }),
      live("/salesman/references", "References", "Outside references (same salesman screen).", {
        permission: "hr.view",
      }),
      live("/salesman/commissions", "Commissions", "Commission rates and payouts (same salesman screen).", {
        permission: "hr.view",
      }),
    ],
  },
  {
    id: "21",
    masterTitle: "Expenses",
    title: "Expenses",
    icon: "expenses",
    path: "/expenses",
    description: "Expense entry.",
    permission: "expenses.manage",
    children: [
      live("/expenses", "Expenses", "Expense entry.", {
        permission: "expenses.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "22",
    masterTitle: "Installments",
    title: "Installments",
    icon: "installments",
    path: "/installments",
    description: "Installment plans and dues.",
    permission: "installments.manage",
    children: [
      live("/installments", "Installments", "Installment plans and dues.", {
        permission: "installments.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "23",
    masterTitle: "Loyalty",
    title: "Loyalty",
    icon: "loyalty",
    path: "/loyalty",
    description: "Points, tiers, and rewards.",
    permission: "loyalty.view",
    children: [
      live("/loyalty", "Loyalty", "Points, tiers, and rewards.", {
        permission: "loyalty.view",
        sidebar: false,
      }),
    ],
  },
  {
    id: "24",
    masterTitle: "Documents",
    title: "Documents",
    icon: "documents",
    path: "/documents",
    description: "Attachments and files.",
    permission: "documents.view",
    children: [
      live("/documents", "Documents", "Attachments and files.", {
        permission: "documents.view",
        sidebar: false,
      }),
    ],
  },
  {
    id: "25",
    masterTitle: "Approval Workflow",
    title: "Approvals",
    icon: "approvals",
    path: "/approvals",
    description: "Approval inbox.",
    permission: "approvals.act",
    children: [
      live("/approvals", "Approvals", "Approval inbox.", {
        permission: "approvals.act",
        sidebar: false,
      }),
    ],
  },
  {
    id: "26",
    masterTitle: "Users & Role Management",
    title: "Users",
    icon: "users",
    path: "/users",
    description: "User and role administration.",
    permission: "users.manage",
    children: [
      live("/users", "Users / Roles", "User and role administration.", {
        permission: "users.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "27",
    masterTitle: "Permissions",
    title: "Permissions",
    icon: "permissions",
    path: "/permissions",
    description: "Permission matrix.",
    permission: "permissions.manage",
    children: [
      live("/permissions", "Permissions", "Permission matrix.", {
        permission: "permissions.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "28",
    masterTitle: "Audit Trail",
    title: "Audit",
    icon: "audit",
    path: "/audit",
    description: "Immutable audit log.",
    permission: "audit.view",
    children: [
      live("/audit", "Audit Trail", "Immutable audit log.", {
        permission: "audit.view",
        sidebar: false,
      }),
    ],
  },
  {
    id: "29",
    masterTitle: "Notification Center",
    title: "Notifications",
    icon: "notifications",
    path: "/notifications",
    description: "Notification center.",
    permission: "notifications.view",
    children: [
      live("/notifications", "Notifications", "Notification center.", {
        permission: "notifications.view",
        sidebar: false,
      }),
    ],
  },
  {
    id: "30",
    masterTitle: "Multi-Branch",
    title: "Branches",
    icon: "branches",
    path: "/branches",
    description: "Branch administration.",
    permission: "branches.manage",
    children: [
      live("/branches", "Branches", "Branch administration.", {
        permission: "branches.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "31",
    masterTitle: "Tax & Pakistan Compliance",
    title: "Tax",
    icon: "tax",
    path: "/tax",
    description: "Tax profile, rates, and FBR readiness.",
    permission: "tax.view",
    children: [
      live("/tax", "Tax Profile", "NTN, STRN, and legal name.", {
        permission: "tax.view",
        sidebar: false,
      }),
      live("/tax/rates", "Tax Rates", "Sales tax rates (same tax screen).", { permission: "tax.view" }),
      live("/tax/reports", "Tax Reports", "Tax report on the tax screen.", { permission: "tax.view" }),
    ],
  },
  {
    id: "32",
    masterTitle: "Import / Export",
    title: "Import / Export",
    icon: "import",
    path: "/import-export",
    description: "Data import and export.",
    permission: "import.execute",
    children: [
      live("/import-export", "Import", "CSV/Excel import.", {
        permission: "import.execute",
        sidebar: false,
      }),
      live("/import-export/export", "Export", "Product export (same import/export screen).", {
        permission: "import.execute",
      }),
      live("/import-export/templates", "Templates", "Download import templates (same screen).", {
        permission: "import.execute",
      }),
    ],
  },
  {
    id: "33",
    masterTitle: "Printing",
    title: "Printing",
    icon: "printing",
    path: "/printing",
    description: "Print jobs and templates.",
    permission: "printing.manage",
    children: [
      live("/printing", "Printing", "Print jobs and templates.", {
        permission: "printing.manage",
        sidebar: false,
      }),
      live("/printing/queue", "Print Queue", "Queued print jobs (same printing screen).", {
        permission: "printing.manage",
      }),
      live("/printing/preview", "Preview", "Local print preview (same printing screen).", {
        permission: "printing.manage",
      }),
    ],
  },
  {
    id: "34",
    masterTitle: "Backup & Disaster Recovery",
    title: "Backup",
    icon: "backup",
    path: "/backup",
    description: "Backup jobs and restore points.",
    permission: "backup.view",
    children: [
      live("/backup", "Backup", "Backup jobs.", {
        permission: "backup.view",
        sidebar: false,
      }),
      live("/backup/restore-points", "Restore Points", "Restore points (same backup screen).", {
        permission: "backup.view",
      }),
    ],
  },
  {
    id: "35",
    masterTitle: "Devices / Printing",
    title: "Devices",
    icon: "devices",
    path: "/devices",
    description: "Registered devices and hardware events.",
    permission: "devices.manage",
    children: [
      live("/devices", "Devices", "Registered devices and hardware events.", {
        permission: "devices.manage",
        sidebar: false,
      }),
      live("/devices/drawer", "Drawer", "Cash drawer open (same devices screen).", {
        permission: "devices.manage",
      }),
      live("/devices/events", "Device Events", "Hardware events (same devices screen).", {
        permission: "devices.manage",
      }),
    ],
  },
  {
    id: "36",
    masterTitle: "Industry Engine",
    title: "Industry",
    icon: "industry",
    path: "/industry-engine",
    description: "Industry-specific configuration.",
    permission: "settings.manage",
    children: [
      soon("/industry-engine", "Coming Soon", "Industry-specific configuration is not implemented yet.", {
        permission: "settings.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "37",
    masterTitle: "Customization Engine",
    title: "Customization",
    icon: "customize",
    path: "/customization-engine",
    description: "UI and field customization.",
    permission: "settings.manage",
    children: [
      soon("/customization-engine", "Coming Soon", "UI and field customization is not implemented yet.", {
        permission: "settings.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "38",
    masterTitle: "Rules / Automation Engine",
    title: "Automation",
    icon: "rules",
    path: "/rules-engine",
    description: "Automation rules and linked documents.",
    permission: "settings.manage",
    children: [
      soon("/rules-engine/rules", "Rules", "Automation engine is not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/transaction-linking", "Transaction Linking", "Automatic document linking is not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/rules-engine", "Coming Soon", "Automation engine is not implemented yet.", {
        permission: "settings.manage",
        sidebar: false,
      }),
    ],
  },
  {
    id: "39",
    masterTitle: "System Administration",
    title: "System",
    icon: "admin",
    path: "/settings",
    description: "Organization settings, security, and channels.",
    permission: "settings.manage",
    children: [
      soon("/settings/company", "Company", "Dedicated company profile screen is not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/localization", "Localization", "Localization settings are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/currency", "Currency", "Currency settings are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/language", "Language", "Language settings are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/datetime", "Date / Numbering", "Date, time, and document numbering are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/numbering", "Numbering", "Document numbering is not implemented yet.", {
        permission: "settings.manage",
        sidebar: false,
      }),
      soon("/settings/invoice-templates", "Templates", "Invoice template designer is not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/barcode", "Barcode", "Barcode defaults live under Barcodes.", {
        availableOn: "/barcodes",
        permission: "barcodes.manage",
      }),
      soon("/settings/pos", "POS", "POS configuration is not a separate admin screen yet.", {
        availableOn: "/pos",
        permission: "pos.configure",
      }),
      soon("/settings/email", "Email", "Email gateway settings are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/sms", "SMS", "SMS gateway settings are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/storage", "Storage", "Storage settings are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/logs", "Logs", "System logs are not implemented yet.", {
        availableOn: "/audit",
        permission: "audit.view",
      }),
      soon("/settings/maintenance", "Maintenance", "Maintenance tools are not implemented yet.", {
        permission: "settings.manage",
      }),
      live("/security", "Security", "Sessions, 2FA, and login history.", { permission: "security.view" }),
      live("/integrations", "Integrations", "API keys and webhooks.", { permission: "integrations.view" }),
      live("/online-store", "Store", "Storefront configuration.", { permission: "store.manage" }),
      soon("/mobile", "Mobile", "Mobile channel settings are not implemented yet.", {
        permission: "settings.manage",
      }),
      live("/hr", "HR", "Employees, attendance, and payroll.", { permission: "hr.view" }),
    ],
  },
];

/**
 * Duplicate URLs kept on purpose (do not delete).
 * Same page component, two addresses.
 */
export const DUPLICATE_ROUTE_PAIRS: Array<{ canonical: string; duplicate: string; note: string }> = [
  { canonical: "/pos", duplicate: "/held-sales", note: "Same PosPage; /held-sales opens the holds drawer" },
  { canonical: "/pos", duplicate: "/pos/new", note: "Same PosPage; naming alias only" },
  { canonical: "/salesman", duplicate: "/pos/salesmen", note: "Same SalesmanPage; POS child alias (module 20 kept)" },
  { canonical: "/salesman", duplicate: "/salesman/references", note: "Same SalesmanPage; module 20 References child" },
  { canonical: "/salesman", duplicate: "/salesman/commissions", note: "Same SalesmanPage; module 20 Commissions child" },
  { canonical: "/tax", duplicate: "/tax/rates", note: "Same TaxPage; rates section alias" },
  { canonical: "/tax", duplicate: "/tax/reports", note: "Same TaxPage; reports section alias" },
  { canonical: "/import-export", duplicate: "/import-export/export", note: "Same ImportExportPage; export alias" },
  { canonical: "/import-export", duplicate: "/import-export/templates", note: "Same ImportExportPage; templates alias" },
  { canonical: "/printing", duplicate: "/printing/queue", note: "Same PrintingPage; queue alias" },
  { canonical: "/printing", duplicate: "/printing/preview", note: "Same PrintingPage; preview alias" },
  { canonical: "/backup", duplicate: "/backup/restore-points", note: "Same BackupPage; restore-points alias" },
  { canonical: "/devices", duplicate: "/devices/drawer", note: "Same DevicesPage; drawer alias" },
  { canonical: "/devices", duplicate: "/devices/events", note: "Same DevicesPage; events alias" },
  { canonical: "/salesman", duplicate: "/pos/references", note: "Same SalesmanPage; POS References child" },
  { canonical: "/installments", duplicate: "/credit", note: "Same CreditInstallmentsPage; credit stays under Customers" },
  {
    canonical: "/installments",
    duplicate: "/pos/installments",
    note: "Same CreditInstallmentsPage; POS child alias (module 22 kept)",
  },
  { canonical: "/quotations", duplicate: "/orders", note: "Same QuotationsPage (orders section)" },
  { canonical: "/returns", duplicate: "/exchange", note: "Same ReturnsPage" },
  { canonical: "/barcodes", duplicate: "/qr", note: "Same BarcodesPage" },
  { canonical: "/categories", duplicate: "/subcategories", note: "Same TaxonomyPage, different tab" },
  { canonical: "/categories", duplicate: "/brands", note: "Same TaxonomyPage, different tab" },
  { canonical: "/categories", duplicate: "/companies", note: "Same TaxonomyPage, different tab" },
  { canonical: "/inventory", duplicate: "/stock-ops", note: "StockOpsPage was unrouted; now under Inventory" },
];

/** Paths that render the POS terminal chrome (no ERP sidebar). Do not use startsWith("/pos/"). */
export const POS_TERMINAL_PATHS = new Set(["/pos", "/held-sales", "/pos/new"]);

export function isPosTerminalPath(pathname: string): boolean {
  return POS_TERMINAL_PATHS.has(pathname);
}

const LEGACY_ROUTES: ErpModuleRoute[] = [];

function flattenSections(): ErpModuleRoute[] {
  const rows: ErpModuleRoute[] = [];
  for (const section of ERP_NAV_SECTIONS) {
    rows.push({
      path: section.path,
      title: section.title,
      group: section.title,
      description: section.description,
      permission: section.permission,
      status: section.children.some((c) => c.path === section.path)
        ? section.children.find((c) => c.path === section.path)?.status
        : section.path === "/industry-engine" ||
            section.path === "/customization-engine" ||
            section.path === "/rules-engine" ||
            section.path === "/settings"
          ? "placeholder"
          : "implemented",
      sidebar: true,
    });
    for (const child of section.children) {
      rows.push({
        path: child.path,
        title: child.title,
        group: section.title,
        description: child.description,
        status: child.status,
        availableOn: child.availableOn,
        sidebar: child.sidebar !== false,
        permission: child.permission ?? section.permission,
      });
    }
  }
  return rows;
}

function uniqueByPath(items: ErpModuleRoute[]): ErpModuleRoute[] {
  const seen = new Set<string>();
  const out: ErpModuleRoute[] = [];
  for (const item of items) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    out.push(item);
  }
  return out;
}

/**
 * Flat route registry used by the router.
 * Every original URL is preserved; new placeholder/alias paths are appended.
 */
export const ERP_MODULES: ErpModuleRoute[] = uniqueByPath([...flattenSections(), ...LEGACY_ROUTES]);

export const ERP_SIDEBAR_SECTIONS: ErpNavSection[] = ERP_NAV_SECTIONS.map((section) => ({
  ...section,
  children: section.children.filter((child) => child.sidebar !== false),
}));

export const EXTRA_APP_PATHS = ["/products/new", "/pos/new"] as const;

/**
 * Frontend feature folders under apps/web/src/features.
 * Folders already match the 39-module names. Do not rename for churn.
 * 36–38 stay Coming Soon (no dedicated folders). auth/ and modules/ are shell, not product modules.
 * Shared API clients keep grouped names (catalog-api, parties-api, finance-api, …).
 */
export const ERP_FEATURE_FOLDERS: ReadonlyArray<{ id: string; folder: string | null }> = [
  { id: "01", folder: "dashboard" },
  { id: "02", folder: "product-management" },
  { id: "03", folder: "barcode-qr" },
  { id: "04", folder: "ai-camera" },
  { id: "05", folder: "pos" },
  { id: "06", folder: "quotations" },
  { id: "07", folder: "orders" },
  { id: "08", folder: "delivery" },
  { id: "09", folder: "purchases" },
  { id: "10", folder: "inventory" },
  { id: "11", folder: "warehouses" },
  { id: "12", folder: "customers" },
  { id: "13", folder: "suppliers" },
  { id: "14", folder: "service-repair" },
  { id: "15", folder: "warranty" },
  { id: "16", folder: "accounts" },
  { id: "17", folder: "banking" },
  { id: "18", folder: "crm" },
  { id: "19", folder: "reports" },
  { id: "20", folder: "salesman" },
  { id: "21", folder: "expenses" },
  { id: "22", folder: "installments" },
  { id: "23", folder: "loyalty" },
  { id: "24", folder: "documents" },
  { id: "25", folder: "approvals" },
  { id: "26", folder: "users" },
  { id: "27", folder: "permissions" },
  { id: "28", folder: "audit" },
  { id: "29", folder: "notifications" },
  { id: "30", folder: "branches" },
  { id: "31", folder: "tax" },
  { id: "32", folder: "import-export" },
  { id: "33", folder: "printing" },
  { id: "34", folder: "backup" },
  { id: "35", folder: "devices" },
  { id: "36", folder: null },
  { id: "37", folder: null },
  { id: "38", folder: null },
  { id: "39", folder: "system" },
];

export function findModuleByPath(pathname: string): ErpModuleRoute | undefined {
  return ERP_MODULES.find((m) => m.path === pathname);
}

export function findSectionForPath(pathname: string): ErpNavSection | undefined {
  return ERP_NAV_SECTIONS.find(
    (section) =>
      section.path === pathname ||
      section.children.some((child) => child.path === pathname) ||
      (section.path !== "/" && pathname.startsWith(`${section.path}/`)),
  );
}

export function requiredPermissionForPath(pathname: string): string | undefined {
  const item = findModuleByPath(pathname);
  if (item?.permission) return item.permission;
  return findSectionForPath(pathname)?.permission;
}
