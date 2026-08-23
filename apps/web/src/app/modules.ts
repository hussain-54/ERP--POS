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
  /** Child is a shortcut into another master module — not a second parent. */
  shortcutToModuleId?: string;
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
  shortcutToModuleId?: string;
}

/**
 * One 39-module registry row. Global ERP navigation renders these parents only.
 * `name` / `masterTitle` / `title` are the exact approved module name.
 */
export interface ErpNavSection {
  id: string;
  number: string;
  name: string;
  masterTitle: string;
  title: string;
  icon: NavIconName;
  path: string;
  description: string;
  permission: string;
  permissions: string;
  status: NavStatus;
  folder: string | null;
  featureOwnership: string | null;
  aliases: readonly string[];
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
    shortcutToModuleId: opts?.shortcutToModuleId,
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

function parent(opts: {
  id: string;
  name: string;
  icon: NavIconName;
  path: string;
  description: string;
  permission: string;
  folder: string | null;
  status?: NavStatus;
  aliases?: readonly string[];
  children: ErpNavChild[];
}): ErpNavSection {
  return {
    id: opts.id,
    number: opts.id,
    name: opts.name,
    masterTitle: opts.name,
    title: opts.name,
    icon: opts.icon,
    path: opts.path,
    description: opts.description,
    permission: opts.permission,
    permissions: opts.permission,
    status: opts.status ?? "implemented",
    folder: opts.folder,
    featureOwnership: opts.folder,
    aliases: opts.aliases ?? [],
    children: opts.children,
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

const COMING_SOON_PARENT_IDS = new Set([
  "18",
  "27",
  "28",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
]);

/** Placeholder-only top-level modules. Live parents (including 39) are not in this set. */
export function isComingSoonEngineSection(section: Pick<ErpNavSection, "id">): boolean {
  return COMING_SOON_PARENT_IDS.has(section.id);
}

/**
 * Single source of truth for the approved 39-module ERP IA.
 * Global sidebar shows these 39 parents only. Children stay registered for
 * workspaces, command palette, and existing URLs — they are not global modules.
 * Do not add, remove, rename, or reorder parents.
 */
export const ERP_NAV_SECTIONS: ErpNavSection[] = [
  parent({
    id: "01",
    name: "COMMAND CENTER",
    icon: "dashboard",
    path: "/command-center",
    description: "Central business control, KPIs, alerts and activity.",
    permission: "dashboard.view",
    folder: "dashboard",
    aliases: ["/"],
    children: [
      live("/", "Modules", "Central business control, KPIs, alerts and activity.", { permission: "dashboard.view" }),
    ],
  }),
  parent({
    id: "02",
    name: "POS / SALES",
    icon: "pos",
    path: "/pos",
    description: "Point of sale, billing, payments and sales operations.",
    permission: "pos.sell",
    folder: "pos",
    children: [
      live("/pos", "Command Center", "POS Command Center — enter the POS workspace.", { permission: "pos.sell" }),
      live("/pos/overview", "POS Overview", "POS module overview and quick actions.", { permission: "pos.sell" }),
      live("/pos/sales", "Sales", "Sales workspace: new, hold, resume, and registers.", { permission: "pos.sell" }),
      live("/pos/sales/new", "New Sale", "Full terminal checkout.", { permission: "pos.sell", sidebar: false }),
      live("/pos/sales/quick", "Quick Sale", "Streamlined easy-mode terminal.", { permission: "pos.sell", sidebar: false }),
      live("/pos/sales/hold", "Hold / Suspend Sale", "Park the current cart.", { permission: "pos.hold", sidebar: false }),
      live("/pos/sales/resume", "Resume Sale", "Held sales register.", { permission: "pos.hold", sidebar: false }),
      live("/pos/sales/held", "Held Sales", "All parked carts.", { permission: "pos.hold", sidebar: false }),
      live("/pos/sales/drafts", "Draft Sales", "Local and server draft sales.", { permission: "pos.sell", sidebar: false }),
      live("/pos/sales/completed", "Completed Sales", "Posted sales register.", { permission: "pos.view_invoices", sidebar: false }),
      live("/pos/sales/void", "Void / Cancelled Sales", "Voided sales register.", { permission: "pos.view_invoices", sidebar: false }),
      live("/pos/customers", "Customers", "Customer selection and POS customer tools.", { permission: "pos.sell" }),
      live("/pos/customers/walk-in", "Walk-in Customer", "Checkout as walk-in.", { permission: "pos.sell", sidebar: false }),
      live("/pos/customers/new", "New Customer", "Quick-create customer from POS.", { permission: "customers.write", sidebar: false }),
      live("/pos/customers/profile", "Customer Profile", "Cashier customer profile.", { permission: "customers.read", sidebar: false }),
      live("/pos/customers/history", "Purchase History", "Customer purchase history.", { permission: "pos.view_invoices", sidebar: false }),
      live("/pos/customers/ledger", "Customer Ledger", "Customer ledger entries.", { permission: "ledgers.view", sidebar: false }),
      live("/pos/customers/credit", "Credit / Udhar", "Credit limit and outstanding.", { permission: "customers.read", sidebar: false }),
      live("/pos/customers/loyalty", "Loyalty / Points", "Loyalty points balance.", { permission: "loyalty.view", sidebar: false }),
      live("/pos/products", "Products", "Product discovery on the terminal.", { permission: "pos.sell" }),
      live("/pos/products/barcode", "Barcode Scan", "HID barcode into cart.", { permission: "pos.sell", sidebar: false }),
      live("/pos/products/sku", "Manual SKU Entry", "SKU entry for POS.", { permission: "pos.sell", sidebar: false }),
      live("/pos/products/favorites", "Favorites", "Favorite products.", { permission: "pos.sell", sidebar: false }),
      live("/pos/products/recent", "Recent Products", "Recently sold products.", { permission: "pos.sell", sidebar: false }),
      live("/pos/products/categories", "Categories", "Browse by category.", { permission: "pos.sell", sidebar: false }),
      live("/pos/products/stock", "Stock Availability", "On-hand stock for POS.", { permission: "pos.sell", sidebar: false }),
      live("/pos/products/qr", "QR Scan", "Camera QR (coming soon).", { permission: "pos.sell", sidebar: false }),
      live("/pos/products/camera", "Camera Scan", "Camera scan (coming soon).", { permission: "pos.sell", sidebar: false }),
      live("/pos/pricing", "Pricing & Discounts", "Discounts, overrides, coupons, and price check.", { permission: "pos.sell" }),
      live("/pos/pricing/override", "Price Override", "Override line price on terminal.", { permission: "pos.discount_manager", sidebar: false }),
      live("/pos/pricing/discount", "Apply Discount", "Item and invoice discounts.", { permission: "pos.discount_cashier", sidebar: false }),
      live("/pos/pricing/promotions", "Promotions", "Promotional discounts.", { permission: "pos.discount_cashier", sidebar: false }),
      live("/pos/pricing/coupons", "Coupons", "Validate and apply coupons.", { permission: "pos.sell", sidebar: false }),
      live("/pos/pricing/customer", "Customer Pricing", "Customer tier pricing.", { permission: "pos.sell", sidebar: false }),
      live("/pos/pricing/approval", "Discount Approval", "Discount authority ladder.", { permission: "pos.discount_cashier", sidebar: false }),
      live("/pos/payments", "Payments", "Cash, card, wallets, split, and credit.", { permission: "payments.receive" }),
      live("/pos/payments/cash", "Cash", "Cash tender.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/card", "Card", "Card tender (record-only).", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/bank", "Bank Transfer", "Bank transfer tender.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/qr", "QR Payment", "QR payment (record-only).", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/jazzcash", "JazzCash", "JazzCash wallet.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/easypaisa", "Easypaisa", "Easypaisa wallet.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/sadapay", "SadaPay", "SadaPay wallet.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/wallet", "Other Wallet", "Other digital wallets.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/partial", "Partial Payment", "Partial settlement.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/credit", "Credit Sale", "Credit / udhar sale.", { permission: "payments.receive", sidebar: false }),
      live("/pos/payments/installment", "Installment", "Installment plan sale.", { permission: "installments.manage", sidebar: false }),
      live("/pos/payments/refund", "Refund", "Payment refunds via returns.", { permission: "payments.receive", sidebar: false }),
      live("/pos/invoices", "Invoices", "POS invoices and receipts workspace.", { permission: "pos.view_invoices" }),
      live("/pos/invoices/receipts", "POS Receipts", "Thermal receipts register.", { permission: "pos.view_invoices", sidebar: false }),
      live("/pos/invoices/tax", "Tax Invoices", "Tax invoice documents.", { permission: "pos.view_invoices", sidebar: false }),
      live("/pos/invoices/quotations", "Quotations", "After-sales quotations.", { permission: "quotations.read", sidebar: false }),
      live("/pos/invoices/orders", "Sales Orders", "Open sales orders.", { permission: "quotations.read", sidebar: false }),
      live("/pos/invoices/credit-notes", "Credit Notes", "Tax credit notes.", { permission: "tax.view", sidebar: false }),
      live("/pos/invoices/debit-notes", "Debit Notes", "Tax debit notes.", { permission: "tax.view", sidebar: false }),
      live("/pos/invoices/reprint", "Reprint", "Reprint invoice or receipt.", { permission: "pos.view_invoices", sidebar: false }),
      live("/pos/invoices/digital", "Digital Receipt", "SMS/email receipts (planned).", { permission: "pos.view_invoices", sidebar: false }),
      live("/pos/returns", "Returns & Exchange", "Sales returns, exchanges, and refunds.", { permission: "pos.return" }),
      live("/pos/returns/by-invoice", "Return by Invoice", "Return against an invoice.", { permission: "pos.return", sidebar: false }),
      live("/pos/returns/by-barcode", "Return by Barcode", "Return by scanning items.", { permission: "pos.return", sidebar: false }),
      live("/pos/returns/partial", "Partial Return", "Return part of a sale.", { permission: "pos.return", sidebar: false }),
      live("/pos/returns/full", "Full Return", "Return the full sale.", { permission: "pos.return", sidebar: false }),
      live("/pos/returns/exchange", "Exchange", "Exchange for another item.", { permission: "pos.return", sidebar: false }),
      live("/pos/returns/cash-refund", "Cash Refund", "Refund in cash.", { permission: "pos.return", sidebar: false }),
      live("/pos/returns/store-credit", "Store Credit", "Issue store credit.", { permission: "pos.return", sidebar: false }),
      live("/pos/returns/reasons", "Return Reasons", "Standard return reason codes.", { permission: "pos.return", sidebar: false }),
      live("/pos/shifts", "Shift & Cash", "Open shift, cash drawer, and reconciliation.", { permission: "pos.shift" }),
      live("/pos/shifts/open", "Open Shift", "Open a cashier shift.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/opening-cash", "Opening Cash", "Set opening float.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/cash-in", "Cash In", "Record cash in.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/cash-out", "Cash Out", "Record cash out.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/drawer", "Cash Drawer", "Drawer status.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/transfer", "Cash Transfer", "Transfer between drawers.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/expenses", "Expenses", "Shift expenses.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/close", "Shift Closing", "Close shift.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shifts/reconcile", "Cash Reconciliation", "Reconcile cash.", { permission: "pos.shift", sidebar: false }),
      live("/pos/shift", "Shift & Cash (legacy)", "Alias of /pos/shifts.", { permission: "pos.shift", sidebar: false }),
      live("/pos/approvals", "Approvals", "Discount, void, and refund approvals.", { permission: "approvals.view" }),
      live("/pos/approvals/discount", "Discount Approval", "Approve discounts.", { permission: "approvals.act", sidebar: false }),
      live("/pos/approvals/price-override", "Price Override Approval", "Approve overrides.", { permission: "approvals.act", sidebar: false }),
      live("/pos/approvals/void", "Void Approval", "Approve voids.", { permission: "approvals.act", sidebar: false }),
      live("/pos/approvals/refund", "Refund Approval", "Approve refunds.", { permission: "approvals.act", sidebar: false }),
      live("/pos/approvals/return", "Return Approval", "Approve returns.", { permission: "approvals.act", sidebar: false }),
      live("/pos/approvals/exchange", "Exchange Approval", "Approve exchanges.", { permission: "approvals.act", sidebar: false }),
      live("/pos/approvals/credit", "Credit Approval", "Approve credit.", { permission: "approvals.act", sidebar: false }),
      live("/pos/approvals/cash", "Cash Adjustment", "Approve cash adjustments.", { permission: "approvals.act", sidebar: false }),
      live("/pos/reports", "Reports", "Sales, cashier, and payment reports.", { permission: "reports.view" }),
      live("/pos/reports/cashier", "Cashier Report", "Sales by cashier.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/branch", "Branch Report", "Sales by branch.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/terminal", "Terminal Report", "Per-terminal sales.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/products", "Product Sales", "Product mix report.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/categories", "Category Sales", "Category mix report.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/payments", "Payment Report", "Tender mix report.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/discounts", "Discount Report", "Discount summary.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/returns", "Return Report", "Returns summary.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/refunds", "Refund Report", "Refunds summary.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/voids", "Void Report", "Voided sales.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/shifts", "Shift Report", "Day-close preview.", { permission: "pos.shift", sidebar: false }),
      live("/pos/reports/cash", "Cash Report", "Cash sales report.", { permission: "reports.view", sidebar: false }),
      live("/pos/reports/tax", "Tax Report", "Tax collected.", { permission: "tax.view", sidebar: false }),
      live("/pos/reports/margin", "Profit / Margin", "Margin report.", { permission: "reports.profit", sidebar: false }),
      live("/pos/tax", "Tax & Compliance", "Tax rules and FBR compliance.", { permission: "tax.view" }),
      live("/pos/tax/rates", "Tax Rates", "Configured tax rates.", { permission: "tax.view", sidebar: false }),
      live("/pos/tax/inclusive", "Tax Inclusive / Exclusive", "Pricing mode.", { permission: "tax.view", sidebar: false }),
      live("/pos/tax/exemptions", "Tax Exemptions", "Exemption handling.", { permission: "tax.view", sidebar: false }),
      live("/pos/tax/ntn", "NTN / STRN", "Taxpayer identifiers.", { permission: "tax.view", sidebar: false }),
      live("/pos/tax/fbr-invoice", "FBR Invoice", "FBR e-invoicing (not live).", { permission: "tax.view", sidebar: false }),
      live("/pos/tax/fbr-submit", "FBR Submission", "FBR submit (not live).", { permission: "tax.view", sidebar: false }),
      live("/pos/tax/fbr-status", "FBR Status", "Submission status (not live).", { permission: "tax.view", sidebar: false }),
      live("/pos/tax/compliance", "Compliance Reports", "Tax compliance summary.", { permission: "tax.view", sidebar: false }),
      soon("/pos/offline", "Offline & Sync", "Offline queue and sync status.", { permission: "pos.sell", availableOn: "/pos" }),
      live("/pos/devices", "Devices & Terminal", "Scanners, printers, and terminals.", { permission: "devices.view" }),
      live("/pos/devices/barcode", "Barcode Scanner", "Barcode scanner status.", { permission: "devices.view", sidebar: false }),
      live("/pos/devices/qr", "QR Scanner", "QR scanner status.", { permission: "devices.view", sidebar: false }),
      live("/pos/devices/receipt-printer", "Receipt Printer", "Thermal printer status.", { permission: "devices.view", sidebar: false }),
      live("/pos/devices/a4-printer", "A4 Printer", "A4 printer status.", { permission: "devices.view", sidebar: false }),
      live("/pos/devices/drawer", "Cash Drawer", "Drawer status.", { permission: "devices.view", sidebar: false }),
      live("/pos/devices/customer-display", "Customer Display", "Pole display status.", { permission: "devices.view", sidebar: false }),
      live("/pos/devices/payment-terminal", "Payment Terminal", "PSP terminal (not live).", { permission: "devices.view", sidebar: false }),
      live("/pos/devices/status", "Device Status", "Hardware health.", { permission: "devices.view", sidebar: false }),
      live("/pos/settings", "POS Settings", "Terminal, receipt, and payment configuration.", { permission: "pos.settings" }),
      live("/pos/settings/terminal", "Terminal Settings", "Terminal defaults.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/receipt", "Receipt Settings", "Receipt templates.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/invoice", "Invoice Settings", "Invoice templates.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/payments", "Payment Methods", "Enabled tenders.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/tax", "Tax Settings", "POS tax defaults.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/discounts", "Discount Rules", "Discount limits.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/returns", "Return Rules", "Return policy.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/credit", "Credit Rules", "Credit / udhar rules.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/shifts", "Shift Rules", "Shift rules.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/numbering", "Numbering", "Document numbering.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/hardware", "Hardware Settings", "Hardware defaults.", { permission: "pos.settings", sidebar: false }),
      live("/pos/settings/offline", "Offline Settings", "Offline behaviour (not live).", { permission: "pos.settings", sidebar: false }),
    ],
  }),
  parent({
    id: "03",
    name: "PRODUCT & CATALOG",
    icon: "products",
    path: "/product-catalog",
    description: "Product master, taxonomy, units, pricing, barcodes, and QR.",
    permission: "products.read",
    folder: "product-management",
    aliases: ["/products"],
    children: [
      live("/products", "Products", "Product master list.", { permission: "products.read" }),
      live("/products/new", "New Product", "Create a product on the existing product form.", {
        permission: "products.read",
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
      live("/barcodes", "Barcodes", "Generate and list barcodes.", { permission: "barcodes.manage" }),
      live("/qr", "QR", "QR generation (same barcode tools).", { permission: "barcodes.manage" }),
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
  }),
  parent({
    id: "04",
    name: "PURCHASING",
    icon: "purchases",
    path: "/purchasing",
    description: "Purchase invoices, returns, suppliers, and reorder.",
    permission: "purchases.read",
    folder: "purchases",
    aliases: ["/purchases"],
    children: [
      live("/purchases", "Purchases", "Purchases and supplier prices.", { permission: "purchases.read" }),
      live("/purchase-returns", "Returns", "Purchase return posting.", { permission: "purchases.return" }),
      live("/suppliers", "Suppliers", "Supplier master.", { permission: "suppliers.read" }),
      live("/suppliers/ledger", "Ledger", "Supplier ledger on the supplier screen.", {
        permission: "ledgers.view",
      }),
      live("/suppliers/price-lists", "Price Lists", "Supplier prices on Purchases.", {
        permission: "purchases.prices",
      }),
      soon("/suppliers/payables", "Payables", "Payables reports live under Reports.", {
        availableOn: "/reports",
        permission: "reports.view",
      }),
      soon("/suppliers/performance", "Performance", "Supplier performance analytics are not implemented yet.", {
        permission: "suppliers.read",
      }),
      soon("/purchase-automation", "Automation", "Reorder suggestions are not implemented yet.", {
        permission: "purchases.read",
      }),
    ],
  }),
  parent({
    id: "05",
    name: "INVENTORY",
    icon: "inventory",
    path: "/inventory",
    description: "Stock on hand, movements, and traceability.",
    permission: "inventory.view",
    folder: "inventory",
    children: [
      live("/inventory", "Inventory", "Stock balances and movement ledger.", { permission: "inventory.view" }),
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
      live("/inventory/audit", "Counts", "Stock counts (stock operations).", { permission: "inventory.count" }),
    ],
  }),
  parent({
    id: "06",
    name: "WAREHOUSE / WMS",
    icon: "warehouse",
    path: "/warehouse",
    description: "Warehouses, locations, and transfers.",
    permission: "warehouses.manage",
    folder: "warehouses",
    aliases: ["/warehouses"],
    children: [
      live("/warehouses", "Warehouses", "Warehouse master.", { permission: "warehouses.manage" }),
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
  }),
  parent({
    id: "07",
    name: "DELIVERY / LOGISTICS",
    icon: "delivery",
    path: "/delivery",
    description: "Delivery notes and tracking.",
    permission: "deliveries.view",
    folder: "delivery",
    aliases: ["/deliveries"],
    children: [
      live("/deliveries", "Delivery", "Delivery notes and tracking.", { permission: "deliveries.view" }),
    ],
  }),
  parent({
    id: "08",
    name: "CUSTOMERS / CRM",
    icon: "customers",
    path: "/customers",
    description: "Customer master, ledger, credit, and CRM.",
    permission: "customers.read",
    folder: "customers",
    children: [
      live("/customers", "Customers", "Customer master.", { permission: "customers.read" }),
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
      live("/installments", "Installments", "Installment plans and dues.", {
        permission: "installments.manage",
      }),
      live("/crm", "CRM", "CRM segments.", { permission: "crm.view" }),
      live("/crm/campaigns", "Campaigns", "Campaigns including SMS and WhatsApp.", { permission: "crm.manage" }),
      live("/crm/engagement", "Engagement", "Profiles and campaign activity.", { permission: "crm.view" }),
    ],
  }),
  parent({
    id: "09",
    name: "SERVICE MANAGEMENT",
    icon: "service",
    path: "/service",
    description: "Job cards, technicians, and repairs.",
    permission: "service.manage",
    folder: "service-repair",
    children: [
      live("/service", "Service", "Service jobs.", { permission: "service.manage" }),
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
  }),
  parent({
    id: "10",
    name: "WARRANTY",
    icon: "warranty",
    path: "/warranty",
    description: "Warranty claims and replacements.",
    permission: "warranty.manage",
    folder: "warranty",
    children: [
      live("/warranty", "Warranty", "Warranty claims.", { permission: "warranty.manage" }),
      live("/warranty/replacements", "Replacements", "Warranty replacements.", {
        permission: "warranty.manage",
      }),
      live("/warranty/history", "History", "Lookup and claim history.", { permission: "warranty.manage" }),
    ],
  }),
  parent({
    id: "11",
    name: "ACCOUNTS & FINANCE",
    icon: "accounts",
    path: "/accounts",
    description: "Chart of accounts, journals, expenses, and financial statements.",
    permission: "accounts.read",
    folder: "accounts",
    children: [
      live("/accounts", "Accounts", "Chart of accounts, journals, and vouchers.", {
        permission: "accounts.read",
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
      live("/expenses", "Expenses", "Expense entry.", { permission: "expenses.manage" }),
      live("/expenses/period", "Period Reports", "Expense period totals on the expenses screen.", {
        permission: "expenses.manage",
      }),
    ],
  }),
  parent({
    id: "12",
    name: "BANKING & PAYMENTS",
    icon: "banking",
    path: "/banking",
    description: "Bank books and reconciliation. POS tender posting stays in the POS workspace.",
    permission: "banking.manage",
    folder: "banking",
    children: [
      live("/banking", "Banking", "Bank books and reconciliation.", { permission: "banking.manage" }),
    ],
  }),
  parent({
    id: "13",
    name: "REPORTS & BUSINESS INTELLIGENCE",
    icon: "reports",
    path: "/reports",
    description: "Operational reports and BI dashboards.",
    permission: "reports.view",
    folder: "reports",
    children: [
      live("/reports", "Reports", "Operational report hub.", { permission: "reports.view" }),
      live("/bi", "BI", "KPI dashboards.", { permission: "bi.view" }),
    ],
  }),
  parent({
    id: "14",
    name: "AI & AUTOMATION",
    icon: "camera",
    path: "/ai",
    description: "Camera recognition and AI business insights.",
    permission: "ai.recognize",
    folder: "ai-camera",
    aliases: ["/ai-camera"],
    children: [
      live("/ai-camera", "AI Camera", "Camera-assisted product match.", { permission: "ai.recognize" }),
      live("/ai-insights", "AI Insights", "AI business insights.", { permission: "ai.insights" }),
    ],
  }),
  parent({
    id: "15",
    name: "MARKETING & LOYALTY",
    icon: "loyalty",
    path: "/marketing",
    description: "Loyalty programs and marketing campaigns.",
    permission: "loyalty.view",
    folder: "loyalty",
    aliases: ["/loyalty"],
    children: [
      live("/loyalty", "Loyalty", "Points, tiers, and rewards.", { permission: "loyalty.view" }),
      live("/loyalty/offers", "Offers", "Loyalty offers on the loyalty screen.", { permission: "loyalty.view" }),
      live("/loyalty/redeem", "Redeem", "Point redemption on the loyalty screen.", { permission: "loyalty.view" }),
      live("/crm/sms", "SMS", "SMS channel campaigns.", { permission: "crm.manage" }),
      live("/crm/whatsapp", "WhatsApp", "WhatsApp channel campaigns.", { permission: "crm.manage" }),
      live("/crm/marketing", "Marketing", "Marketing campaigns on the CRM screen.", {
        permission: "crm.manage",
      }),
    ],
  }),
  parent({
    id: "16",
    name: "B2B / WHOLESALE",
    icon: "orders",
    path: "/b2b",
    description: "Wholesale portal, quotations, and orders.",
    permission: "b2b.manage",
    folder: "orders",
    children: [
      live("/b2b", "B2B", "Wholesale portal orders.", { permission: "b2b.manage" }),
      live("/quotations", "Quotations", "Quotes and conversion.", { permission: "quotations.read" }),
      live("/orders", "Orders", "Order list (shared with quotations screen).", { permission: "orders.read" }),
    ],
  }),
  parent({
    id: "17",
    name: "ONLINE STORE",
    icon: "orders",
    path: "/online-store",
    description: "Storefront configuration.",
    permission: "store.manage",
    folder: "system",
    children: [
      live("/online-store", "Store", "Storefront configuration.", { permission: "store.manage" }),
    ],
  }),
  parent({
    id: "18",
    name: "MOBILE",
    icon: "devices",
    path: "/mobile",
    description: "Mobile channel settings.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    children: [
      soon("/mobile", "Coming Soon", "Mobile channel settings are not implemented yet.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "19",
    name: "ORGANIZATION / BRANCHES",
    icon: "branches",
    path: "/organization",
    description: "Branch administration.",
    permission: "branches.manage",
    folder: "branches",
    aliases: ["/branches"],
    children: [
      live("/branches", "Branches", "Branch administration.", { permission: "branches.manage" }),
      live("/branches/membership", "Membership", "Branch membership on the branches screen.", {
        permission: "branches.manage",
      }),
    ],
  }),
  parent({
    id: "20",
    name: "HR & PAYROLL",
    icon: "salesman",
    path: "/hr",
    description: "Employees, attendance, payroll, and field salesmen.",
    permission: "hr.view",
    folder: "system",
    children: [
      live("/hr", "HR", "Employees, attendance, and payroll.", { permission: "hr.view" }),
      live("/salesman", "Salesmen", "Salesmen, references, and commissions.", { permission: "hr.view" }),
      live("/salesman/references", "References", "Outside references (same salesman screen).", {
        permission: "hr.view",
      }),
      live("/salesman/commissions", "Commissions", "Commission rates and payouts (same salesman screen).", {
        permission: "hr.view",
      }),
    ],
  }),
  parent({
    id: "21",
    name: "TAX / FBR",
    icon: "tax",
    path: "/tax",
    description: "Tax profile, rates, and FBR readiness.",
    permission: "tax.view",
    folder: "tax",
    children: [
      live("/tax", "Tax", "NTN, STRN, and legal name.", { permission: "tax.view" }),
      live("/tax/rates", "Rates", "Sales tax rates (same tax screen).", { permission: "tax.view" }),
      live("/tax/reports", "Tax Reports", "Tax report on the tax screen.", { permission: "tax.view" }),
    ],
  }),
  parent({
    id: "22",
    name: "DOCUMENT MANAGEMENT",
    icon: "documents",
    path: "/documents",
    description: "Attachments and files.",
    permission: "documents.view",
    folder: "documents",
    children: [live("/documents", "Documents", "Attachments and files.", { permission: "documents.view" })],
  }),
  parent({
    id: "23",
    name: "WORKFLOW / APPROVALS",
    icon: "approvals",
    path: "/workflows",
    description: "Approval inbox.",
    permission: "approvals.act",
    folder: "approvals",
    aliases: ["/approvals"],
    children: [live("/approvals", "Approvals", "Approval inbox.", { permission: "approvals.act" })],
  }),
  parent({
    id: "24",
    name: "NOTIFICATIONS",
    icon: "notifications",
    path: "/notifications",
    description: "Notification center.",
    permission: "notifications.view",
    folder: "notifications",
    children: [
      live("/notifications", "Notifications", "Notification center.", { permission: "notifications.view" }),
    ],
  }),
  parent({
    id: "25",
    name: "USERS / ROLES / PERMISSIONS",
    icon: "users",
    path: "/users",
    description: "User, role, and permission administration.",
    permission: "users.manage",
    folder: "users",
    children: [
      live("/users", "Users", "User administration.", { permission: "users.manage" }),
      live("/users/roles", "Roles", "Role assignment on the users screen.", { permission: "users.manage" }),
      live("/permissions", "Permissions", "Permission matrix.", { permission: "permissions.manage" }),
      live("/permissions/overrides", "User Overrides", "User permission overrides on the permissions screen.", {
        permission: "permissions.manage",
      }),
    ],
  }),
  parent({
    id: "26",
    name: "SECURITY / AUDIT",
    icon: "audit",
    path: "/security",
    description: "Audit log, sessions, and security controls.",
    permission: "audit.view",
    folder: "audit",
    aliases: ["/audit"],
    children: [
      live("/audit", "Audit", "Immutable audit log.", { permission: "audit.view" }),
      live("/security", "Security", "Sessions, 2FA, and login history.", { permission: "security.view" }),
    ],
  }),
  parent({
    id: "27",
    name: "OFFLINE / LOCAL OPERATIONS",
    icon: "warehouse",
    path: "/offline",
    description: "Local operations. Online-only runtime — not implemented.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    children: [
      soon("/offline", "Coming Soon", "Offline / local operations are not implemented. Runtime stays online-only.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "28",
    name: "SYNC CENTER",
    icon: "import",
    path: "/sync",
    description: "Sync center. Online-only runtime — not implemented.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    children: [
      soon("/sync", "Coming Soon", "Sync center is not implemented. Runtime stays online-only.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "29",
    name: "BACKUP / DISASTER RECOVERY",
    icon: "backup",
    path: "/backup",
    description: "Backup jobs and restore points.",
    permission: "backup.view",
    folder: "backup",
    children: [
      live("/backup", "Backup", "Backup jobs.", { permission: "backup.view" }),
      live("/backup/restore-points", "Restore Points", "Restore points (same backup screen).", {
        permission: "backup.view",
      }),
    ],
  }),
  parent({
    id: "30",
    name: "INTEGRATION HUB",
    icon: "admin",
    path: "/integrations",
    description: "API keys and webhooks.",
    permission: "integrations.view",
    folder: "system",
    children: [
      live("/integrations", "Integrations", "API keys and webhooks.", { permission: "integrations.view" }),
    ],
  }),
  parent({
    id: "31",
    name: "DEVICES / PRINTING",
    icon: "devices",
    path: "/devices",
    description: "Registered devices, hardware events, and print jobs.",
    permission: "devices.manage",
    folder: "devices",
    children: [
      live("/devices", "Devices", "Registered devices and hardware events.", { permission: "devices.manage" }),
      live("/devices/drawer", "Cash Drawer", "Cash drawer open (same devices screen).", {
        permission: "devices.manage",
      }),
      live("/devices/events", "Device Events", "Hardware events (same devices screen).", {
        permission: "devices.manage",
      }),
      live("/printing", "Printing", "Print jobs and templates.", { permission: "printing.manage" }),
      live("/printing/queue", "Print Queue", "Queued print jobs (same printing screen).", {
        permission: "printing.manage",
        sidebar: false,
      }),
      live("/printing/preview", "Preview", "Local print preview (same printing screen).", {
        permission: "printing.manage",
        sidebar: false,
      }),
    ],
  }),
  parent({
    id: "32",
    name: "INDUSTRY ENGINE",
    icon: "industry",
    path: "/industry",
    description: "Industry-specific configuration.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    aliases: ["/industry-engine"],
    children: [
      soon("/industry-engine", "Coming Soon", "Industry-specific configuration is not implemented yet.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "33",
    name: "CUSTOMIZATION ENGINE",
    icon: "customize",
    path: "/customization",
    description: "UI and field customization.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    aliases: ["/customization-engine"],
    children: [
      soon("/customization-engine", "Coming Soon", "UI and field customization is not implemented yet.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "34",
    name: "RULES / AUTOMATION ENGINE",
    icon: "rules",
    path: "/automation",
    description: "Automation rules and linked documents.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    aliases: ["/rules-engine"],
    children: [
      soon("/rules-engine", "Automation", "Automation engine is not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/transaction-linking", "Transaction Linking", "Automatic document linking is not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/rules-engine/rules", "Rules", "Automation engine is not implemented yet.", {
        permission: "settings.manage",
        sidebar: false,
      }),
    ],
  }),
  parent({
    id: "35",
    name: "CLIENT / TENANT MANAGEMENT",
    icon: "users",
    path: "/tenants",
    description: "Tenant administration.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    children: [
      soon("/tenants", "Coming Soon", "Client / tenant management is not implemented yet.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "36",
    name: "SUBSCRIPTION / BILLING",
    icon: "accounts",
    path: "/subscription",
    description: "Subscription and billing.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    aliases: ["/billing"],
    children: [
      soon("/billing", "Coming Soon", "Subscription / billing is not implemented yet.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "37",
    name: "USAGE / METERING",
    icon: "reports",
    path: "/usage",
    description: "Usage metering.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    children: [
      soon("/usage", "Coming Soon", "Usage / metering is not implemented yet.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "38",
    name: "DEVELOPER PLATFORM",
    icon: "customize",
    path: "/developer",
    description: "Developer platform.",
    permission: "settings.manage",
    folder: null,
    status: "placeholder",
    children: [
      soon("/developer", "Coming Soon", "Developer platform is not implemented yet.", {
        permission: "settings.manage",
      }),
    ],
  }),
  parent({
    id: "39",
    name: "SYSTEM ADMINISTRATION",
    icon: "admin",
    path: "/settings",
    description: "System administration control center.",
    permission: "settings.manage",
    folder: "system",
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
      soon("/settings/datetime", "Date & Numbering", "Date, time, and document numbering are not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/numbering", "Numbering", "Document numbering is not implemented yet.", {
        permission: "settings.manage",
        sidebar: false,
      }),
      soon("/settings/invoice-templates", "Templates", "Invoice template designer is not implemented yet.", {
        permission: "settings.manage",
      }),
      soon("/settings/barcode", "Barcode", "Barcode defaults live under Product & Catalog.", {
        availableOn: "/barcodes",
        permission: "barcodes.manage",
      }),
      soon("/settings/pos", "POS", "POS / Sales module is not implemented yet.", {
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
      soon("/settings/logs", "Logs", "System logs live under Security / Audit.", {
        availableOn: "/audit",
        permission: "audit.view",
      }),
      soon("/settings/maintenance", "Maintenance", "Maintenance tools are not implemented yet.", {
        permission: "settings.manage",
      }),
      live("/import-export", "Import", "CSV/Excel import.", { permission: "import.execute" }),
      live("/import-export/export", "Export", "Product export (same import/export screen).", {
        permission: "import.execute",
      }),
      live("/import-export/templates", "Import Templates", "Download import templates (same screen).", {
        permission: "import.execute",
      }),
    ],
  }),
];

/** Alias of the 39-parent registry — do not create a second module list. */
export const ERP_MODULE_REGISTRY = ERP_NAV_SECTIONS;

/** Stable parent routes shown in the global sidebar. Old URLs stay as aliases/children. */
export const ERP_STABLE_PARENT_PATHS = [
  "/command-center",
  "/pos",
  "/product-catalog",
  "/purchasing",
  "/inventory",
  "/warehouse",
  "/delivery",
  "/customers",
  "/service",
  "/warranty",
  "/accounts",
  "/banking",
  "/reports",
  "/ai",
  "/marketing",
  "/b2b",
  "/online-store",
  "/mobile",
  "/organization",
  "/hr",
  "/tax",
  "/documents",
  "/workflows",
  "/notifications",
  "/users",
  "/security",
  "/offline",
  "/sync",
  "/backup",
  "/integrations",
  "/devices",
  "/industry",
  "/customization",
  "/automation",
  "/tenants",
  "/subscription",
  "/usage",
  "/developer",
  "/settings",
] as const;

/**
 * Intentional duplicate URLs. Do not delete, merge pages, or redirect.
 * Canonical path owns the screen; aliases reuse that component unless
 * `sameComponent` is false (related inventory screens that stay distinct).
 */
export const DUPLICATE_ROUTE_PAIRS: Array<{
  canonical: string;
  duplicate: string;
  note: string;
  sameComponent?: boolean;
}> = [
  { canonical: "/command-center", duplicate: "/", note: "Command Center landing; / stays registered" },
  { canonical: "/product-catalog", duplicate: "/products", note: "Product catalog landing; /products stays registered" },
  { canonical: "/purchasing", duplicate: "/purchases", note: "Purchasing landing; /purchases stays registered" },
  { canonical: "/warehouse", duplicate: "/warehouses", note: "Warehouse landing; /warehouses stays registered" },
  { canonical: "/delivery", duplicate: "/deliveries", note: "Delivery landing; /deliveries stays registered" },
  { canonical: "/ai", duplicate: "/ai-camera", note: "AI landing; /ai-camera stays registered" },
  { canonical: "/marketing", duplicate: "/loyalty", note: "Marketing landing; /loyalty stays registered" },
  { canonical: "/organization", duplicate: "/branches", note: "Organization landing; /branches stays registered" },
  { canonical: "/workflows", duplicate: "/approvals", note: "Workflow landing; /approvals stays registered" },
  { canonical: "/security", duplicate: "/audit", note: "Related security screens; Security vs Audit stay distinct", sameComponent: false },
  { canonical: "/quotations", duplicate: "/orders", note: "Same QuotationsPage (orders section)" },
  { canonical: "/barcodes", duplicate: "/qr", note: "Same BarcodesPage" },
  { canonical: "/installments", duplicate: "/credit", note: "Same CreditInstallmentsPage; credit stays under Customers" },
  { canonical: "/salesman", duplicate: "/salesman/references", note: "Same SalesmanPage; HR References child" },
  { canonical: "/salesman", duplicate: "/salesman/commissions", note: "Same SalesmanPage; HR Commissions child" },
  {
    canonical: "/inventory",
    duplicate: "/stock-ops",
    note: "Related inventory screens; InventoryPage vs StockOpsPage — do not merge",
    sameComponent: false,
  },
  { canonical: "/stock-ops", duplicate: "/inventory/adjustments", note: "Same StockOpsPage; Adjustments child" },
  { canonical: "/stock-ops", duplicate: "/inventory/damaged", note: "Same StockOpsPage; Damaged child" },
  { canonical: "/stock-ops", duplicate: "/inventory/audit", note: "Same StockOpsPage; Counts child" },
  { canonical: "/categories", duplicate: "/subcategories", note: "Same TaxonomyPage, tab from pathname" },
  { canonical: "/categories", duplicate: "/brands", note: "Same TaxonomyPage, tab from pathname" },
  { canonical: "/categories", duplicate: "/companies", note: "Same TaxonomyPage, tab from pathname" },
  { canonical: "/tax", duplicate: "/tax/rates", note: "Same TaxPage; rates section alias" },
  { canonical: "/tax", duplicate: "/tax/reports", note: "Same TaxPage; reports section alias" },
  { canonical: "/import-export", duplicate: "/import-export/export", note: "Same ImportExportPage; export alias" },
  { canonical: "/import-export", duplicate: "/import-export/templates", note: "Same ImportExportPage; templates alias" },
  { canonical: "/printing", duplicate: "/printing/queue", note: "Same PrintingPage; queue alias" },
  { canonical: "/printing", duplicate: "/printing/preview", note: "Same PrintingPage; preview alias" },
  { canonical: "/backup", duplicate: "/backup/restore-points", note: "Same BackupPage; restore-points alias" },
  { canonical: "/devices", duplicate: "/devices/drawer", note: "Same DevicesPage; drawer alias" },
  { canonical: "/devices", duplicate: "/devices/events", note: "Same DevicesPage; events alias" },
  { canonical: "/expenses", duplicate: "/expenses/period", note: "Same ExpensesPage; period report section" },
  { canonical: "/loyalty", duplicate: "/loyalty/offers", note: "Same LoyaltyPage; offers section" },
  { canonical: "/loyalty", duplicate: "/loyalty/redeem", note: "Same LoyaltyPage; redeem section" },
  { canonical: "/users", duplicate: "/users/roles", note: "Same UsersRolesPage; roles section" },
  { canonical: "/permissions", duplicate: "/permissions/overrides", note: "Same PermissionsPage; overrides section" },
  { canonical: "/branches", duplicate: "/branches/membership", note: "Same BranchesPage; membership section" },
  { canonical: "/products", duplicate: "/products/new", note: "Product form; New Product child", sameComponent: false },
];

/** POS workspace paths — PosShell Command Center chrome inside the ERP shell. */
export const POS_ENVIRONMENT_PATHS = new Set<string>([
  "/pos",
  "/pos/overview",
  "/pos/sales",
  "/pos/sales/new",
  "/pos/sales/quick",
  "/pos/sales/hold",
  "/pos/sales/resume",
  "/pos/sales/held",
  "/pos/sales/drafts",
  "/pos/sales/completed",
  "/pos/sales/void",
  "/pos/customers",
  "/pos/products",
  "/pos/pricing",
  "/pos/payments",
  "/pos/invoices",
  "/pos/returns",
  "/pos/shifts",
  "/pos/shift",
  "/pos/approvals",
  "/pos/reports",
  "/pos/tax",
  "/pos/offline",
  "/pos/devices",
  "/pos/settings",
]);

export function isPosEnvironmentPath(pathname: string): boolean {
  if (POS_ENVIRONMENT_PATHS.has(pathname)) return true;
  return pathname.startsWith("/pos/");
}

export function isPosTerminalPath(pathname: string): boolean {
  return (
    pathname === "/pos/sales/new" ||
    pathname === "/pos/sales/quick" ||
    pathname === "/pos/sales/hold"
  );
}

/** Module 39 workspace only — promoted modules use normal ERP chrome. */
export function isSystemAdminPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

/** Compat URLs kept registered outside module children. */
const LEGACY_ROUTES: ErpModuleRoute[] = [];

function flattenSections(): ErpModuleRoute[] {
  const rows: ErpModuleRoute[] = [];
  for (const section of ERP_NAV_SECTIONS) {
    rows.push({
      path: section.path,
      title: section.name,
      group: section.name,
      description: section.description,
      permission: section.permission,
      status: section.status,
      sidebar: true,
    });
    for (const child of section.children) {
      rows.push({
        path: child.path,
        title: child.title,
        group: section.name,
        description: child.description,
        status: child.status,
        availableOn: child.availableOn,
        sidebar: false,
        permission: child.permission ?? section.permission,
      });
    }
    for (const alias of section.aliases) {
      rows.push({
        path: alias,
        title: section.name,
        group: section.name,
        description: section.description,
        permission: section.permission,
        status: section.status,
        sidebar: false,
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
 * Derived from ERP_NAV_SECTIONS — not a second module definition.
 */
export const ERP_MODULES: ErpModuleRoute[] = uniqueByPath([...flattenSections(), ...LEGACY_ROUTES]);

/**
 * Compatibility URLs that stay registered. They are never global sidebar rows.
 */
export const COMPAT_ALIAS_PATHS = new Set(["/qr", "/credit", "/settings/numbering"]);

export function isCommandPaletteChild(section: ErpNavSection, child: ErpNavChild): boolean {
  if (child.path === section.path) return false;
  if (child.shortcutToModuleId) return false;
  if (COMPAT_ALIAS_PATHS.has(child.path)) return false;
  if (child.sidebar === false && section.id !== "39") return false;
  return true;
}

/** Contextual workspace tabs. Distinct child screens stay; naming-only aliases do not. */
export function isWorkspaceNavChild(section: ErpNavSection, child: ErpNavChild): boolean {
  if (child.path === section.path) return false;
  if (child.shortcutToModuleId) return false;
  if (child.path === "/qr" || child.path === "/settings/numbering") return false;
  // POS deep sale routes stay in PosShell nav; keep ERP workspace rail to module hubs.
  if (section.id === "02" && child.sidebar === false) return false;
  if (section.id === "02" && child.title.includes("(legacy)")) return false;
  return true;
}

/** Global ERP nav never lists children. Workspace rails own contextual screens. */
export const ERP_SIDEBAR_SECTIONS: ErpNavSection[] = ERP_NAV_SECTIONS.map((section) => ({
  ...section,
  children: [],
}));

export const EXTRA_APP_PATHS = ["/products/new"] as const;

/**
 * Feature-folder ownership derived from the 39-module registry.
 * Child screens may live in other existing folders; do not rename folders.
 */
export const ERP_FEATURE_FOLDERS: ReadonlyArray<{ id: string; folder: string | null }> = ERP_NAV_SECTIONS.map(
  (section) => ({ id: section.id, folder: section.folder }),
);

export function findModuleByPath(pathname: string): ErpModuleRoute | undefined {
  return ERP_MODULES.find((m) => m.path === pathname);
}

export function findSectionForPath(pathname: string): ErpNavSection | undefined {
  const exactChild = ERP_NAV_SECTIONS.find((section) => section.children.some((child) => child.path === pathname));
  if (exactChild) return exactChild;
  return ERP_NAV_SECTIONS.find(
    (section) =>
      section.path === pathname ||
      section.aliases.includes(pathname) ||
      (section.path !== "/" && pathname.startsWith(`${section.path}/`)),
  );
}

export function requiredPermissionForPath(pathname: string): string | undefined {
  const item = findModuleByPath(pathname);
  if (item?.permission) return item.permission;
  return findSectionForPath(pathname)?.permission;
}

/** Subtle sidebar spacing only — not extra top-level modules. */
export const NAV_VISUAL_BREAK_BEFORE = new Set(["12", "27", "32"]);

export function masterTitleById(id: string): string | undefined {
  return ERP_NAV_SECTIONS.find((section) => section.id === id)?.name;
}

export function isNavChildActive(child: Pick<ErpNavChild, "path">, pathname: string): boolean {
  if (child.path === pathname) return true;
  if (child.path === "/settings/datetime" && pathname === "/settings/numbering") return true;
  return false;
}

/** Header labels for the single ERP chrome. */
export function resolveShellHeader(pathname: string): { moduleTitle: string; pageTitle: string | null } {
  if (pathname === "/products/new") {
    return { moduleTitle: "PRODUCT & CATALOG", pageTitle: "New Product" };
  }
  if (pathname.startsWith("/products/") && pathname !== "/products") {
    return { moduleTitle: "PRODUCT & CATALOG", pageTitle: "Product" };
  }
  const section = findSectionForPath(pathname);
  if (!section) return { moduleTitle: "Electronic ERP", pageTitle: null };
  if (pathname === "/settings") {
    return { moduleTitle: section.name, pageTitle: "Overview" };
  }
  if (pathname === "/settings/numbering") {
    return { moduleTitle: section.name, pageTitle: "Date & Numbering" };
  }
  const child = section.children.find((item) => item.path === pathname);
  if (child) {
    return { moduleTitle: section.name, pageTitle: child.title };
  }
  if (pathname === section.path || section.aliases.includes(pathname)) {
    const landing =
      section.children.find((item) => item.path === pathname || section.aliases.includes(item.path)) ??
      section.children[0];
    return { moduleTitle: section.name, pageTitle: landing?.title ?? "Overview" };
  }
  return { moduleTitle: section.name, pageTitle: null };
}
