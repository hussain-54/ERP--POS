/** POS module information architecture — sidebar + workspace sections. */

export const POS_TERMINAL_NAV = [
  { path: "/pos", label: "POS", icon: "fa-cart-shopping" },
  { path: "/pos/sales/resume", label: "Hold / Resume", icon: "fa-clock", badge: "hold" as const },
  { path: "/pos/customers", label: "Customers", icon: "fa-user" },
  { path: "/pos/products", label: "Products", icon: "fa-box" },
  { path: "/pos/pricing", label: "Price & Discount", icon: "fa-tag" },
  { path: "/pos/reports", label: "Reports", icon: "fa-chart-simple" },
  { path: "/pos/settings", label: "Settings", icon: "fa-gear" },
] as const;

export const POS_ENVIRONMENT_PATHS = [
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
  "/pos/shift",
  "/pos/approvals",
  "/pos/reports",
  "/pos/tax",
  "/pos/offline",
  "/pos/devices",
  "/pos/settings",
] as const;

export const POS_TERMINAL_PATHS = new Set<string>([
  "/pos",
  "/pos/sales/new",
  "/pos/sales/quick",
  "/pos/sales/resume",
  "/pos/sales/hold",
]);

export interface PosSectionLink {
  title: string;
  path: string;
  description: string;
  status: "live" | "soon";
}

export interface PosSection {
  id: string;
  title: string;
  description: string;
  path: string;
  links: PosSectionLink[];
}

export const POS_SECTIONS: PosSection[] = [
  {
    id: "overview",
    title: "Overview",
    description: "POS dashboard and terminal entry points.",
    path: "/pos/overview",
    links: [{ title: "POS Terminal", path: "/pos", description: "Primary retail terminal.", status: "live" }],
  },
  {
    id: "sales",
    title: "Sales",
    description: "New sale, hold, resume, and sale registers.",
    path: "/pos/sales/new",
    links: [
      { title: "New Sale", path: "/pos", description: "Full terminal checkout.", status: "live" },
      { title: "Quick Sale", path: "/pos/sales/quick", description: "Streamlined easy mode.", status: "live" },
      { title: "Hold Sale", path: "/pos/sales/hold", description: "Park current cart.", status: "live" },
      { title: "Resume Sale", path: "/pos/sales/resume", description: "Held sales register.", status: "live" },
      { title: "Held Sales", path: "/pos/sales/held", description: "All parked carts.", status: "live" },
      { title: "Draft Sales", path: "/pos/sales/drafts", description: "Draft register.", status: "soon" },
      { title: "Completed Sales", path: "/pos/sales/completed", description: "Posted sales.", status: "soon" },
      { title: "Void / Cancelled", path: "/pos/sales/void", description: "Voided transactions.", status: "soon" },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    description: "Walk-in, credit, loyalty, and customer lookup.",
    path: "/pos/customers",
    links: [
      { title: "Customer Selection", path: "/pos/customers", description: "Search and attach customer.", status: "live" },
      { title: "New Customer", path: "/customers", description: "Create in Customers module.", status: "live" },
      { title: "Credit / Udhar", path: "/credit", description: "Credit workspace.", status: "live" },
      { title: "Loyalty / Points", path: "/loyalty", description: "Loyalty program.", status: "live" },
    ],
  },
  {
    id: "products",
    title: "Products",
    description: "Discovery, barcode, favorites, and stock.",
    path: "/pos/products",
    links: [
      { title: "Product Search", path: "/pos", description: "Terminal product grid.", status: "live" },
      { title: "Barcode Scan", path: "/pos", description: "Scan on terminal.", status: "live" },
      { title: "Categories", path: "/categories", description: "Catalog taxonomy.", status: "live" },
      { title: "Stock Availability", path: "/inventory", description: "Inventory balances.", status: "live" },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & Discounts",
    description: "Overrides, coupons, and approvals.",
    path: "/pos/pricing",
    links: [
      { title: "Price Override", path: "/pos/pricing", description: "Line rate override on terminal.", status: "live" },
      { title: "Coupons", path: "/pos/pricing/coupons", description: "Coupon codes.", status: "soon" },
      { title: "Discount Approval", path: "/approvals", description: "Approval queue.", status: "live" },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    description: "Cash, card, wallets, split, and credit.",
    path: "/pos/payments",
    links: [
      { title: "Split Payment", path: "/pos/payments", description: "Multi-tender checkout.", status: "live" },
      { title: "Payment Register", path: "/payments", description: "Receipt register.", status: "live" },
      { title: "Installments", path: "/installments", description: "Installment plans.", status: "live" },
    ],
  },
  {
    id: "invoices",
    title: "Invoices & Receipts",
    description: "Invoices, quotations, and reprints.",
    path: "/pos/invoices",
    links: [
      { title: "Invoices", path: "/invoices", description: "Invoice register.", status: "live" },
      { title: "Quotations", path: "/quotations", description: "Quotation workspace.", status: "live" },
      { title: "Reprint", path: "/printing", description: "Print queue.", status: "live" },
    ],
  },
  {
    id: "returns",
    title: "Returns & Exchange",
    description: "Sales returns and exchanges.",
    path: "/pos/returns",
    links: [
      { title: "Sales Return", path: "/pos/returns", description: "Return workflow.", status: "soon" },
      { title: "Exchange", path: "/pos/returns/exchange", description: "Exchange workflow.", status: "soon" },
    ],
  },
  {
    id: "shift",
    title: "Shift & Cash",
    description: "Open shift, cash in/out, and reconciliation.",
    path: "/pos/shift",
    links: [
      { title: "Current Shift", path: "/pos/shift", description: "Shift summary.", status: "live" },
      { title: "Cash Drawer", path: "/devices", description: "Hardware drawer.", status: "live" },
      { title: "Cash In / Out", path: "/pos/shift/cash", description: "Cash movements.", status: "soon" },
    ],
  },
  {
    id: "approvals",
    title: "Approvals",
    description: "Discount, void, refund, and credit approvals.",
    path: "/pos/approvals",
    links: [{ title: "Approval Queue", path: "/approvals", description: "Workflow approvals.", status: "live" }],
  },
  {
    id: "reports",
    title: "Reports",
    description: "Sales, cashier, and payment reports.",
    path: "/pos/reports",
    links: [
      { title: "Sales Report", path: "/reports", description: "Reports hub.", status: "live" },
      { title: "Shift Report", path: "/pos/reports/shift", description: "Shift closing report.", status: "soon" },
    ],
  },
  {
    id: "tax",
    title: "Tax & Compliance",
    description: "Tax rules and FBR compliance.",
    path: "/pos/tax",
    links: [{ title: "Tax Settings", path: "/tax", description: "Tax module.", status: "live" }],
  },
  {
    id: "offline",
    title: "Offline & Sync",
    description: "Offline queue and sync status.",
    path: "/pos/offline",
    links: [{ title: "Offline POS", path: "/pos/offline", description: "Coming soon.", status: "soon" }],
  },
  {
    id: "devices",
    title: "Devices & Terminal",
    description: "Scanners, printers, and terminals.",
    path: "/pos/devices",
    links: [{ title: "Devices", path: "/devices", description: "Device management.", status: "live" }],
  },
  {
    id: "settings",
    title: "POS Settings",
    description: "Terminal, receipt, and payment configuration.",
    path: "/pos/settings",
    links: [{ title: "General Settings", path: "/pos/settings", description: "POS preferences.", status: "live" }],
  },
];
