/** POS module information architecture — Command Center, sidebar, and routes. */

export type PosLinkStatus = "live" | "soon";

export interface PosNavChild {
  title: string;
  path: string;
  description: string;
  status: PosLinkStatus;
}

export interface PosModuleDef {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  description: string;
  path: string;
  icon: string;
  /** Optional KPI label shown on Command Center cards when shell data exists. */
  kpiKey?: "holds" | "shift" | "none";
  children: PosNavChild[];
}

function child(
  title: string,
  path: string,
  description: string,
  status: PosLinkStatus = "soon",
): PosNavChild {
  return { title, path, description, status };
}

/**
 * Exact 15-module POS hierarchy (order locked).
 * All paths stay under /pos so navigation never leaves the POS workspace.
 */
export const POS_MODULES: PosModuleDef[] = [
  {
    id: "overview",
    number: "01",
    title: "Overview",
    shortTitle: "Overview",
    description: "Shift pulse, quick actions, and POS health at a glance.",
    path: "/pos/overview",
    icon: "fa-gauge-high",
    kpiKey: "shift",
    children: [
      child("Command Center", "/pos", "Return to the POS Command Center.", "live"),
      child("Overview", "/pos/overview", "Operational overview for this terminal.", "live"),
      child("New Sale", "/pos/sales/new", "Jump into the sales terminal.", "live"),
    ],
  },
  {
    id: "sales",
    number: "02",
    title: "Sales",
    shortTitle: "Sales",
    description: "New sales, holds, drafts, completed, and voided transactions.",
    path: "/pos/sales",
    icon: "fa-cart-shopping",
    kpiKey: "holds",
    children: [
      child("New Sale", "/pos/sales/new", "Full terminal checkout.", "live"),
      child("Quick Sale", "/pos/sales/quick", "Streamlined easy-mode terminal.", "live"),
      child("Hold / Suspend Sale", "/pos/sales/hold", "Park the current cart.", "live"),
      child("Resume Sale", "/pos/sales/resume", "Resume a held cart.", "live"),
      child("Held Sales", "/pos/sales/held", "All parked carts.", "live"),
      child("Draft Sales", "/pos/sales/drafts", "Unfinished draft sales.", "live"),
      child("Completed Sales", "/pos/sales/completed", "Posted sales register.", "live"),
      child("Void / Cancelled Sales", "/pos/sales/void", "Voided and cancelled sales.", "live"),
    ],
  },
  {
    id: "customers",
    number: "03",
    title: "Customers",
    shortTitle: "Customers",
    description: "Walk-in, profiles, credit, loyalty, and purchase history.",
    path: "/pos/customers",
    icon: "fa-user-group",
    children: [
      child("Customer Selection", "/pos/customers", "Search and attach a customer.", "live"),
      child("Walk-in Customer", "/pos/customers/walk-in", "Default walk-in shopper.", "live"),
      child("New Customer", "/pos/customers/new", "Create a customer from POS.", "live"),
      child("Customer Profile", "/pos/customers/profile", "View customer profile.", "live"),
      child("Purchase History", "/pos/customers/history", "Past purchases for the customer.", "live"),
      child("Customer Ledger", "/pos/customers/ledger", "Balances and ledger entries.", "live"),
      child("Credit / Udhar", "/pos/customers/credit", "Credit and udhar balance.", "live"),
      child("Loyalty / Points", "/pos/customers/loyalty", "Loyalty points and rewards.", "live"),
    ],
  },
  {
    id: "products",
    number: "04",
    title: "Products",
    shortTitle: "Products",
    description: "Search, scan, favorites, categories, and stock availability.",
    path: "/pos/products",
    icon: "fa-box-open",
    children: [
      child("Product Search", "/pos/products", "Find products for the cart.", "live"),
      child("Barcode Scan", "/pos/products/barcode", "Scan product barcodes.", "live"),
      child("QR Scan", "/pos/products/qr", "Scan product QR codes.", "soon"),
      child("Camera Scan", "/pos/products/camera", "Camera-assisted product capture.", "soon"),
      child("Manual SKU Entry", "/pos/products/sku", "Enter SKU manually.", "live"),
      child("Favorites", "/pos/products/favorites", "Favorite / quick-pick products.", "live"),
      child("Recent Products", "/pos/products/recent", "Recently sold products.", "live"),
      child("Categories", "/pos/products/categories", "Browse by category.", "live"),
      child("Stock Availability", "/pos/products/stock", "On-hand stock for POS.", "live"),
    ],
  },
  {
    id: "pricing",
    number: "05",
    title: "Pricing & Discounts",
    shortTitle: "Pricing",
    description: "Price checks, overrides, promotions, coupons, and approvals.",
    path: "/pos/pricing",
    icon: "fa-tags",
    children: [
      child("Price Check", "/pos/pricing", "Look up selling price.", "live"),
      child("Price Override", "/pos/pricing/override", "Override line price.", "live"),
      child("Item Discount", "/pos/pricing/discount", "Discount a single line.", "live"),
      child("Invoice Discount", "/pos/pricing/discount", "Discount the whole bill.", "live"),
      child("Promotions", "/pos/pricing/promotions", "Active promotions.", "live"),
      child("Coupons", "/pos/pricing/coupons", "Apply coupon codes.", "live"),
      child("Customer Pricing", "/pos/pricing/customer", "Customer-specific prices.", "live"),
      child("Discount Approval", "/pos/pricing/approval", "Discount authority ladder.", "live"),
    ],
  },
  {
    id: "payments",
    number: "06",
    title: "Payments",
    shortTitle: "Payments",
    description: "Cash, card, wallets, split, credit, installments, and refunds.",
    path: "/pos/payments",
    icon: "fa-credit-card",
    children: [
      child("Cash", "/pos/payments/cash", "Cash tender.", "live"),
      child("Card", "/pos/payments/card", "Card tender.", "live"),
      child("Bank Transfer", "/pos/payments/bank", "Bank transfer tender.", "live"),
      child("QR Payment", "/pos/payments/qr", "QR / bank QR payment.", "live"),
      child("JazzCash", "/pos/payments/jazzcash", "JazzCash wallet.", "live"),
      child("Easypaisa", "/pos/payments/easypaisa", "Easypaisa wallet.", "live"),
      child("SadaPay", "/pos/payments/sadapay", "SadaPay wallet.", "live"),
      child("Other Wallet", "/pos/payments/wallet", "Other digital wallets.", "live"),
      child("Split Payment", "/pos/payments", "Multi-tender checkout.", "live"),
      child("Partial Payment", "/pos/payments/partial", "Partial settlement.", "live"),
      child("Credit Sale", "/pos/payments/credit", "Credit / udhar sale.", "live"),
      child("Installment", "/pos/payments/installment", "Installment plan sale.", "live"),
      child("Refund", "/pos/payments/refund", "Payment refund.", "live"),
    ],
  },
  {
    id: "invoices",
    number: "07",
    title: "Invoices & Receipts",
    shortTitle: "Invoices",
    description: "Invoices, receipts, tax invoices, quotations, and reprints.",
    path: "/pos/invoices",
    icon: "fa-file-invoice",
    children: [
      child("Invoices", "/pos/invoices", "Sales invoices register.", "live"),
      child("POS Receipts", "/pos/invoices/receipts", "Thermal / POS receipts.", "live"),
      child("Tax Invoices", "/pos/invoices/tax", "Tax invoices.", "live"),
      child("Quotations", "/pos/invoices/quotations", "Quotations from POS.", "live"),
      child("Sales Orders", "/pos/invoices/orders", "Sales orders.", "live"),
      child("Credit Notes", "/pos/invoices/credit-notes", "Credit notes.", "live"),
      child("Debit Notes", "/pos/invoices/debit-notes", "Debit notes.", "live"),
      child("Reprint", "/pos/invoices/reprint", "Reprint invoice or receipt.", "live"),
      child("Digital Receipt", "/pos/invoices/digital", "SMS / email / digital receipt.", "live"),
    ],
  },
  {
    id: "returns",
    number: "08",
    title: "Returns & Exchange",
    shortTitle: "Returns",
    description: "Returns, exchanges, refunds, store credit, and reasons.",
    path: "/pos/returns",
    icon: "fa-rotate-left",
    children: [
      child("Sales Return", "/pos/returns", "Start a sales return.", "live"),
      child("Return by Invoice", "/pos/returns/by-invoice", "Return against an invoice.", "live"),
      child("Return by Barcode", "/pos/returns/by-barcode", "Return by scanning items.", "live"),
      child("Partial Return", "/pos/returns/partial", "Return part of a sale.", "live"),
      child("Full Return", "/pos/returns/full", "Return the full sale.", "live"),
      child("Exchange", "/pos/returns/exchange", "Exchange for another item.", "live"),
      child("Cash Refund", "/pos/returns/cash-refund", "Refund in cash.", "live"),
      child("Store Credit", "/pos/returns/store-credit", "Issue store credit.", "live"),
      child("Return Reasons", "/pos/returns/reasons", "Configured return reasons.", "live"),
    ],
  },
  {
    id: "shift",
    number: "09",
    title: "Shift & Cash",
    shortTitle: "Shift",
    description: "Open/close shift, cash drawer, transfers, and reconciliation.",
    path: "/pos/shifts",
    icon: "fa-cash-register",
    kpiKey: "shift",
    children: [
      child("Open Shift", "/pos/shifts/open", "Open a cashier shift.", "live"),
      child("Current Shift", "/pos/shifts", "Active shift summary.", "live"),
      child("Opening Cash", "/pos/shifts/opening-cash", "Set opening float.", "live"),
      child("Cash In", "/pos/shifts/cash-in", "Record cash in.", "live"),
      child("Cash Out", "/pos/shifts/cash-out", "Record cash out.", "live"),
      child("Cash Drawer", "/pos/shifts/drawer", "Drawer status and open.", "live"),
      child("Cash Transfer", "/pos/shifts/transfer", "Transfer cash between drawers.", "live"),
      child("Expenses", "/pos/shifts/expenses", "Shift expenses.", "live"),
      child("Shift Closing", "/pos/shifts/close", "Close the current shift.", "live"),
      child("Cash Reconciliation", "/pos/shifts/reconcile", "Reconcile expected vs counted.", "live"),
    ],
  },
  {
    id: "approvals",
    number: "10",
    title: "Approvals",
    shortTitle: "Approvals",
    description: "Discount, void, refund, return, credit, and cash approvals.",
    path: "/pos/approvals",
    icon: "fa-clipboard-check",
    children: [
      child("Discount Approval", "/pos/approvals/discount", "Approve discounts.", "live"),
      child("Price Override", "/pos/approvals/price-override", "Approve price overrides.", "live"),
      child("Void Approval", "/pos/approvals/void", "Approve voids.", "live"),
      child("Refund Approval", "/pos/approvals/refund", "Approve refunds.", "live"),
      child("Return Approval", "/pos/approvals/return", "Approve returns.", "live"),
      child("Exchange Approval", "/pos/approvals/exchange", "Approve exchanges.", "live"),
      child("Credit Approval", "/pos/approvals/credit", "Approve credit sales.", "live"),
      child("Cash Adjustment", "/pos/approvals/cash", "Approve cash adjustments.", "live"),
    ],
  },
  {
    id: "reports",
    number: "11",
    title: "Reports",
    shortTitle: "Reports",
    description: "Sales, cashier, payment, tax, and margin reports.",
    path: "/pos/reports",
    icon: "fa-chart-column",
    children: [
      child("Sales Report", "/pos/reports", "Sales summary report.", "live"),
      child("Cashier Report", "/pos/reports/cashier", "Per-cashier performance.", "live"),
      child("Branch Report", "/pos/reports/branch", "Branch sales summary.", "live"),
      child("Terminal Report", "/pos/reports/terminal", "Per-terminal sales.", "live"),
      child("Product Sales", "/pos/reports/products", "Product sales mix.", "live"),
      child("Category Sales", "/pos/reports/categories", "Category sales mix.", "live"),
      child("Payment Report", "/pos/reports/payments", "Tender mix report.", "live"),
      child("Discount Report", "/pos/reports/discounts", "Discounts issued.", "live"),
      child("Return Report", "/pos/reports/returns", "Returns summary.", "live"),
      child("Refund Report", "/pos/reports/refunds", "Refunds summary.", "live"),
      child("Void Report", "/pos/reports/voids", "Voids summary.", "live"),
      child("Shift Report", "/pos/reports/shifts", "Shift closing reports.", "live"),
      child("Cash Report", "/pos/reports/cash", "Cash movement report.", "live"),
      child("Tax Report", "/pos/reports/tax", "Tax collected report.", "live"),
      child("Profit / Margin", "/pos/reports/margin", "Profit and margin.", "live"),
    ],
  },
  {
    id: "tax",
    number: "12",
    title: "Tax & Compliance",
    shortTitle: "Tax",
    description: "Tax rules, FBR invoices, and compliance status.",
    path: "/pos/tax",
    icon: "fa-scale-balanced",
    children: [
      child("Tax Rules", "/pos/tax", "POS tax rules overview.", "live"),
      child("Tax Rates", "/pos/tax/rates", "Configured tax rates.", "live"),
      child("Tax Inclusive / Exclusive", "/pos/tax/inclusive", "Inclusive vs exclusive pricing.", "live"),
      child("Tax Exemptions", "/pos/tax/exemptions", "Exemption handling.", "live"),
      child("NTN / STRN", "/pos/tax/ntn", "NTN and STRN details.", "live"),
      child("FBR Invoice", "/pos/tax/fbr-invoice", "FBR invoice generation.", "live"),
      child("FBR Submission", "/pos/tax/fbr-submit", "Submit invoices to FBR.", "live"),
      child("Submission Status", "/pos/tax/fbr-status", "FBR submission status.", "live"),
      child("Compliance Reports", "/pos/tax/compliance", "Compliance reporting.", "live"),
    ],
  },
  {
    id: "offline",
    number: "13",
    title: "Offline & Sync",
    shortTitle: "Offline",
    description: "Offline queue, pending sync, retries, and history (UI only).",
    path: "/pos/offline",
    icon: "fa-cloud-arrow-up",
    children: [
      child("Offline POS", "/pos/offline", "Offline POS status.", "soon"),
      child("Offline Transactions", "/pos/offline/transactions", "Sales taken offline.", "soon"),
      child("Pending Sync", "/pos/offline/pending", "Items waiting to sync.", "soon"),
      child("Sync Queue", "/pos/offline/queue", "Sync queue viewer.", "soon"),
      child("Failed Sync", "/pos/offline/failed", "Failed sync items.", "soon"),
      child("Retry Sync", "/pos/offline/retry", "Retry failed sync.", "soon"),
      child("Sync History", "/pos/offline/history", "Historical sync runs.", "soon"),
    ],
  },
  {
    id: "devices",
    number: "14",
    title: "Devices & Terminal",
    shortTitle: "Devices",
    description: "Terminals, scanners, printers, drawer, and device status.",
    path: "/pos/devices",
    icon: "fa-desktop",
    children: [
      child("POS Terminals", "/pos/devices", "Registered POS terminals.", "live"),
      child("Barcode Scanner", "/pos/devices/barcode", "Barcode scanner setup.", "live"),
      child("QR Scanner", "/pos/devices/qr", "QR scanner setup.", "live"),
      child("Receipt Printer", "/pos/devices/receipt-printer", "Receipt printer setup.", "live"),
      child("A4 Printer", "/pos/devices/a4-printer", "A4 printer setup.", "live"),
      child("Cash Drawer", "/pos/devices/drawer", "Cash drawer device.", "live"),
      child("Customer Display", "/pos/devices/customer-display", "Customer-facing display.", "live"),
      child("Payment Terminal", "/pos/devices/payment-terminal", "Card / payment terminal.", "live"),
      child("Device Status", "/pos/devices/status", "Live device health.", "live"),
    ],
  },
  {
    id: "settings",
    number: "15",
    title: "POS Settings",
    shortTitle: "Settings",
    description: "General, terminal, receipt, tax, hardware, and offline settings.",
    path: "/pos/settings",
    icon: "fa-gear",
    children: [
      child("General", "/pos/settings", "General POS preferences.", "live"),
      child("Terminal", "/pos/settings/terminal", "Terminal configuration.", "live"),
      child("Receipt", "/pos/settings/receipt", "Receipt template settings.", "live"),
      child("Invoice", "/pos/settings/invoice", "Invoice template settings.", "live"),
      child("Payment Methods", "/pos/settings/payments", "Enabled tenders.", "live"),
      child("Tax", "/pos/settings/tax", "POS tax defaults.", "live"),
      child("Discount Rules", "/pos/settings/discounts", "Discount rule limits.", "live"),
      child("Return Rules", "/pos/settings/returns", "Return policy rules.", "live"),
      child("Credit Rules", "/pos/settings/credit", "Credit / udhar rules.", "live"),
      child("Shift Rules", "/pos/settings/shifts", "Shift open/close rules.", "live"),
      child("Numbering", "/pos/settings/numbering", "Document numbering.", "live"),
      child("Hardware", "/pos/settings/hardware", "Hardware defaults.", "live"),
      child("Offline Settings", "/pos/settings/offline", "Offline behaviour.", "live"),
    ],
  },
];

/** @deprecated Prefer POS_MODULES — kept for hub page typing. */
export type PosSection = PosModuleDef;
export type PosSectionLink = PosNavChild;
export const POS_SECTIONS = POS_MODULES;

/** Flat list of every POS path used by the workspace shell. */
export const POS_ROUTE_PATHS: string[] = (() => {
  const paths = new Set<string>(["/pos"]);
  for (const mod of POS_MODULES) {
    paths.add(mod.path);
    for (const c of mod.children) paths.add(c.path);
  }
  // Legacy aliases kept registered for backward compatibility
  paths.add("/pos/shift");
  return [...paths];
})();

export const POS_TERMINAL_PATHS = new Set<string>([
  "/pos/sales/new",
  "/pos/sales/quick",
  "/pos/sales/hold",
]);

export function findPosModule(pathname: string): PosModuleDef | undefined {
  if (pathname === "/pos") return undefined;
  const normalized = pathname === "/pos/shift" ? "/pos/shifts" : pathname;
  const exact = POS_MODULES.find((m) => m.path === normalized);
  if (exact) return exact;
  return POS_MODULES.find(
    (m) =>
      normalized.startsWith(`${m.path}/`) ||
      m.children.some((c) => c.path === normalized || normalized.startsWith(`${c.path}/`)),
  );
}

export function findPosChild(pathname: string): { module: PosModuleDef; child: PosNavChild } | undefined {
  const normalized = pathname === "/pos/shift" ? "/pos/shifts" : pathname;
  for (const mod of POS_MODULES) {
    const hit = mod.children.find((c) => c.path === normalized);
    if (hit) return { module: mod, child: hit };
  }
  return undefined;
}

export function isPosCommandCenterPath(pathname: string): boolean {
  return pathname === "/pos";
}
