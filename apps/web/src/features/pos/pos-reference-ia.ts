/**
 * Reference POS information architecture (15 sections).
 * Maps product-owner outline → live ERP routes. Does not invent screens.
 * Module 02 still keeps the locked 26 ERP children (POS_IA_TITLES).
 */

export type PosReferenceLink = {
  label: string;
  path: string;
  status: "live" | "terminal" | "shared" | "placeholder";
  note?: string;
};

export type PosReferenceSection = {
  id: string;
  title: string;
  links: readonly PosReferenceLink[];
};

/** Terminal focus helpers stay on `/pos` with query/focus — not separate carts. */
export const POS_REFERENCE_IA: readonly PosReferenceSection[] = [
  {
    id: "01",
    title: "Overview",
    links: [{ label: "POS Terminal", path: "/pos", status: "live", note: "Canonical register" }],
  },
  {
    id: "02",
    title: "Sales",
    links: [
      { label: "New Sale", path: "/pos", status: "live" },
      { label: "Quick Sale", path: "/pos/quick-sale", status: "terminal" },
      { label: "Hold / Suspend Sale", path: "/pos", status: "terminal", note: "F2 / Hold on terminal" },
      { label: "Resume Sale", path: "/pos/resume-sale", status: "live" },
      { label: "Held Sales", path: "/held-sales", status: "live" },
      { label: "Completed Sales", path: "/invoices", status: "live" },
      { label: "Draft Sales", path: "/pos", status: "placeholder", note: "Use Hold until posted" },
      { label: "Void / Cancelled", path: "/pos", status: "terminal", note: "F8 cancel + void policy" },
    ],
  },
  {
    id: "03",
    title: "Customers",
    links: [
      { label: "Customer Selection", path: "/pos/customer-selection", status: "terminal" },
      { label: "Walk-in Customer", path: "/pos", status: "terminal" },
      { label: "New Customer", path: "/pos", status: "terminal" },
      { label: "Customer Profile", path: "/customers", status: "shared" },
      { label: "Purchase History", path: "/pos", status: "terminal" },
      { label: "Customer Ledger", path: "/customers", status: "shared" },
      { label: "Credit / Udhaar", path: "/pos", status: "terminal" },
      { label: "Loyalty / Points", path: "/pos", status: "placeholder", note: "Stats shown when available" },
    ],
  },
  {
    id: "04",
    title: "Products",
    links: [
      { label: "Product Search", path: "/pos/product-search", status: "terminal" },
      { label: "Barcode Scan", path: "/pos/barcode-scanner", status: "terminal" },
      { label: "QR / Camera / Manual", path: "/pos", status: "terminal" },
      { label: "Favorites / Recent / Categories", path: "/pos", status: "terminal" },
      { label: "Stock Availability", path: "/pos", status: "terminal" },
      { label: "Catalog master", path: "/products", status: "shared" },
    ],
  },
  {
    id: "05",
    title: "Pricing & Discounts",
    links: [
      { label: "Price Override", path: "/pos", status: "terminal", note: "F4" },
      { label: "Item / Invoice Discount", path: "/pos", status: "terminal", note: "F5" },
      { label: "Discounts policy", path: "/discounts", status: "live" },
      { label: "Coupons", path: "/pos/coupons", status: "live" },
      { label: "Customer Pricing", path: "/pos", status: "terminal", note: "Price tier from customer" },
    ],
  },
  {
    id: "06",
    title: "Payments",
    links: [
      { label: "Tenders & split / credit / installment", path: "/pos", status: "terminal" },
      { label: "Payments register", path: "/payments", status: "live" },
      { label: "Refund", path: "/returns", status: "live" },
    ],
  },
  {
    id: "07",
    title: "Invoices & Receipts",
    links: [
      { label: "Invoices", path: "/invoices", status: "live" },
      { label: "Quotations", path: "/quotations", status: "shared" },
      { label: "Sales Orders", path: "/sales-orders", status: "shared" },
    ],
  },
  {
    id: "08",
    title: "Returns & Exchange",
    links: [
      { label: "Sales Return", path: "/returns", status: "live" },
      { label: "Exchange", path: "/exchange", status: "live" },
    ],
  },
  {
    id: "09",
    title: "Shift & Cash",
    links: [
      { label: "POS Shift", path: "/pos/shift", status: "live" },
      { label: "Cash In / Cash Out", path: "/pos/cash-in-out", status: "live" },
      { label: "Day Closing", path: "/pos/day-closing", status: "live" },
      { label: "Cash Drawer", path: "/pos", status: "terminal" },
    ],
  },
  {
    id: "10",
    title: "Approvals",
    links: [
      { label: "Discount / price / void approvals", path: "/discounts", status: "live", note: "Policy + POS dialogs" },
    ],
  },
  {
    id: "11",
    title: "Reports",
    links: [
      { label: "POS operational registers", path: "/pos/reports", status: "live" },
      { label: "Sales dashboard", path: "/invoices", status: "live" },
    ],
  },
  {
    id: "12",
    title: "Tax & Compliance",
    links: [
      { label: "Tax rules / rates", path: "/settings/tax", status: "shared" },
      { label: "FBR / compliance", path: "/pos/settings", status: "placeholder", note: "Hosted on ERP tax settings" },
    ],
  },
  {
    id: "13",
    title: "Offline & Sync",
    links: [{ label: "Offline POS", path: "/pos/offline", status: "placeholder" }],
  },
  {
    id: "14",
    title: "Devices & Terminal",
    links: [
      { label: "Devices", path: "/devices", status: "shared" },
      { label: "POS Settings · Hardware", path: "/pos/settings", status: "live" },
    ],
  },
  {
    id: "15",
    title: "POS Settings",
    links: [{ label: "General / Terminal / Receipt / Payments", path: "/pos/settings", status: "live" }],
  },
] as const;
