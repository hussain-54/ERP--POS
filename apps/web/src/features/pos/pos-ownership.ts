/**
 * POS information architecture — module 02 POS / SALES ownership.
 *
 * Names and order are locked to the product-owner canonical list (26 children).
 * Do not rename or reorder POS_IA_TITLES.
 * Canonical POS terminal entry is `/pos`. Legacy aliases stay registered.
 *
 * Financial math source of truth: packages/domain (pos-canonical.ts / sale-totals /
 * sale-transaction). UI must not invent grand totals, tax, paid, or stock decisions.
 */

export const POS_IA_TITLES = [
  "POS Terminal",
  "Quick Sale",
  "Product Search",
  "Customer Selection",
  "Invoices",
  "Payments",
  "Credit / Udhaar",
  "Barcode Scanner",
  "Salesman / Reference",
  "Hold Sale",
  "Resume Sale",
  "Quotations",
  "Sales Orders",
  "Split Payment",
  "Installments",
  "Discounts",
  "Coupons",
  "Returns",
  "Exchange",
  "Refund",
  "Delivery Order",
  "Cash Drawer",
  "POS Shift",
  "Cash In / Cash Out",
  "Day Closing",
  "Offline POS",
] as const;

export type PosIaTitle = (typeof POS_IA_TITLES)[number];

export type PosOwnershipStatus = "live" | "partial" | "placeholder" | "shared-live";

export interface PosOwnershipItem {
  title: PosIaTitle;
  /** Canonical URL for this POS child. */
  canonical: string;
  /** Working aliases — keep registered; do not delete. */
  aliases: readonly string[];
  /** Web page that currently owns the screen. */
  page: string;
  status: PosOwnershipStatus;
  /** APIs / domain the screen must keep using. */
  backend: string;
  note: string;
  /** When placeholder/partial: where related live work already exists. */
  availableOn?: string;
}

export const POS_CANONICAL_ENTRY = "/pos";

export const POS_OWNERSHIP: readonly PosOwnershipItem[] = [
  {
    title: "POS Terminal",
    canonical: "/pos",
    aliases: ["/pos/new"],
    page: "features/pos/PosPage.tsx",
    status: "live",
    backend:
      "POST /api/v1/pos/sales · SaleTransactionService · pos-cart / sale-totals / pos-payment / pos-validation",
    note: "Primary retail terminal. Same canonical posting path as Quick Sale.",
  },
  {
    title: "Quick Sale",
    canonical: "/pos/quick-sale",
    aliases: [],
    page: "features/pos/PosTerminalFocusPage.tsx → PosPage mode=easy",
    status: "partial",
    backend: "Same SaleTransactionService as POS Terminal — no second cart engine",
    note: "Easy-mode terminal focus. Does not duplicate calculations.",
    availableOn: "/pos",
  },
  {
    title: "Product Search",
    canonical: "/pos/product-search",
    aliases: ["/pos/products"],
    page: "features/pos/PosTerminalFocusPage.tsx → PosPage focus=search",
    status: "partial",
    backend: "searchPosProducts · pos-product-search · PosRepository.searchProducts",
    note: "Opens terminal product discovery. Catalog master remains /products.",
    availableOn: "/pos",
  },
  {
    title: "Customer Selection",
    canonical: "/pos/customer-selection",
    aliases: ["/pos/customers"],
    page: "features/pos/PosTerminalFocusPage.tsx → PosPage focus=customer",
    status: "partial",
    backend: "pos-customer-repository · parties customers · pos-customer.ts",
    note: "Opens terminal customer panel (exits walk-in for search). ERP Customers module unchanged.",
    availableOn: "/pos",
  },
  {
    title: "Invoices",
    canonical: "/invoices",
    aliases: [],
    page: "features/pos/InvoicesPage.tsx",
    status: "live",
    backend: "GET /api/v1/pos/sales/management · getInvoice",
    note: "Invoice register. Do not add a second sales list.",
  },
  {
    title: "Payments",
    canonical: "/payments",
    aliases: [],
    page: "features/pos/PaymentsPage.tsx",
    status: "live",
    backend: "parties payments APIs — not a second POS sale writer",
    note: "Payment center. Checkout posting stays on the terminal.",
  },
  {
    title: "Credit / Udhaar",
    canonical: "/pos/credit",
    aliases: ["/credit"],
    page: "features/installments/CreditInstallmentsPage.tsx",
    status: "shared-live",
    backend: "credit.ts · parties ledgers / installments · POS tender uses evaluatePosCustomerCredit",
    note: "POS-owned nav entry to the credit workspace. Sale credit rules enforced at checkout.",
  },
  {
    title: "Barcode Scanner",
    canonical: "/pos/barcode-scanner",
    aliases: [],
    page: "features/pos/PosTerminalFocusPage.tsx → PosPage focus=scan",
    status: "partial",
    backend: "hardware scanner subscribe · pickExactProductMatch · searchPosProducts",
    note: "Exact barcode/SKU match only — never fuzzy first-hit add.",
    availableOn: "/pos",
  },
  {
    title: "Salesman / Reference",
    canonical: "/pos/salesman-reference",
    aliases: ["/pos/salesmen", "/pos/references"],
    page: "features/pos/SalesmenPage.tsx",
    status: "live",
    backend: "enterprise employees/commissions · sale_references · pos-commission.ts",
    note: "Salesman roster (references register remains aliased). Module 20 /salesman stays HR master.",
  },
  {
    title: "Hold Sale",
    canonical: "/pos/hold-sale",
    aliases: [],
    page: "features/pos/HeldSalesPage.tsx",
    status: "live",
    backend: "POST /api/v1/pos/holds · pos-hold.ts — no stock movement",
    note: "Hold list + park workflow. Terminal Hold button still parks from POS Terminal.",
  },
  {
    title: "Resume Sale",
    canonical: "/pos/resume-sale",
    aliases: ["/held-sales"],
    page: "features/pos/HeldSalesPage.tsx",
    status: "live",
    backend: "POST /api/v1/pos/holds/:id/resume · CAS held→resumed",
    note: "Same holds workspace; legacy /held-sales alias preserved.",
  },
  {
    title: "Quotations",
    canonical: "/pos/quotations",
    aliases: ["/quotations"],
    page: "features/quotations/QuotationsPage.tsx",
    status: "shared-live",
    backend: "quotation-lifecycle → calculateSaleTotals · after-sales quotations API",
    note: "POS nav entry to quotations. Create-from-cart remains on the terminal.",
  },
  {
    title: "Sales Orders",
    canonical: "/pos/sales-orders",
    aliases: ["/orders"],
    page: "features/quotations/QuotationsPage.tsx",
    status: "shared-live",
    backend: "sales_orders tables · quotation-lifecycle (SO conversion not a second cart)",
    note: "POS nav entry to orders workspace (same live page as /orders today).",
  },
  {
    title: "Split Payment",
    canonical: "/pos/split-payment",
    aliases: [],
    page: "features/pos/PosTerminalFocusPage.tsx → PosPage focus=payment",
    status: "partial",
    backend: "preparePosPayments · PaySplit lines — same checkout path",
    note: "Opens terminal payment panel for multi-tender. No separate posting engine.",
    availableOn: "/pos",
  },
  {
    title: "Installments",
    canonical: "/pos/installments",
    aliases: [],
    page: "features/pos/InstallmentsPage.tsx",
    status: "live",
    backend: "parties installments · installments.ts · post-commit create on sale",
    note: "POS installment register. Plan create after post is a known integrity follow-up.",
  },
  {
    title: "Discounts",
    canonical: "/discounts",
    aliases: [],
    page: "features/pos/DiscountsPage.tsx",
    status: "live",
    backend: "discount-policy.ts + pos-discount.ts · approvals",
    note: "Policy + approvals. Line/invoice discounts on terminal use the same domain.",
  },
  {
    title: "Coupons",
    canonical: "/pos/coupons",
    aliases: [],
    page: "features/pos/CouponsPage.tsx",
    status: "live",
    backend: "pos_coupons · pos-coupon.ts → invoice discount via SaleTransactionService",
    note: "Server re-validates coupon codes on sale post. Do not invent a second totals engine.",
  },
  {
    title: "Returns",
    canonical: "/returns",
    aliases: [],
    page: "features/pos/ReturnsPage.tsx",
    status: "live",
    backend: "pos-return.ts · PosRepository.postReturn",
    note: "Canonical returns screen.",
  },
  {
    title: "Exchange",
    canonical: "/exchange",
    aliases: [],
    page: "features/pos/ExchangePage.tsx",
    status: "live",
    backend: "pos-exchange.ts · postReturn + postSale",
    note: "Return leg + replacement sale — not delete+fake sale.",
  },
  {
    title: "Refund",
    canonical: "/pos/refund",
    aliases: [],
    page: "features/pos/ReturnsPage.tsx",
    status: "partial",
    backend: "refundSettlementPlan in pos-return.ts",
    note: "Refund disposition lives on Returns until a dedicated refund desk is built.",
    availableOn: "/returns",
  },
  {
    title: "Delivery Order",
    canonical: "/pos/delivery-order",
    aliases: ["/deliveries", "/delivery"],
    page: "features/delivery/DeliveriesPage.tsx",
    status: "shared-live",
    backend: "delivery-lifecycle · purchasesApi.createDelivery from terminal (best-effort)",
    note: "POS nav entry to deliveries. Terminal may flag delivery on sale.",
  },
  {
    title: "Cash Drawer",
    canonical: "/pos/cash-drawer",
    aliases: ["/devices/drawer"],
    page: "features/devices/DevicesPage.tsx",
    status: "partial",
    backend: "cash_drawer.open · hardware routes — not a shift ledger",
    note: "Hardware drawer kick / device screen. Full drawer ledger is later phase.",
    availableOn: "/sales-management",
  },
  {
    title: "POS Shift",
    canonical: "/pos/shift",
    aliases: ["/sales-management"],
    page: "features/pos/SalesManagementPage.tsx",
    status: "live",
    backend: "pos_cash_shifts · open/close shift APIs",
    note: "Shift open/close. Legacy /sales-management alias preserved.",
  },
  {
    title: "Cash In / Cash Out",
    canonical: "/pos/cash-in-out",
    aliases: [],
    page: "features/pos/CashInOutPage.tsx",
    status: "live",
    backend: "pos_cash_movements · pos-cash-movement.ts · open shift required",
    note: "Posts cash_in/cash_out against the open shift and refreshes expected cash.",
  },
  {
    title: "Day Closing",
    canonical: "/pos/day-closing",
    aliases: [],
    page: "features/pos/DayClosingPage.tsx",
    status: "live",
    backend: "pos_day_closings · pos-day-close.ts",
    note: "Requires open shift closed first. Produces an auditable day record.",
  },
  {
    title: "Offline POS",
    canonical: "/pos/offline",
    aliases: [],
    page: "features/pos/PosStagedCapabilityPage.tsx",
    status: "placeholder",
    backend: "Online-only — offline sale queue removed; no localStorage posting",
    note: "Staged. Do not implement fake offline sales.",
    availableOn: "/pos",
  },
] as const;

export const POS_TERMINAL_CANONICAL = POS_CANONICAL_ENTRY;

/**
 * URLs that use POS workspace chrome inside the ERP AppShell.
 */
export const POS_ENVIRONMENT_PATHS = [
  "/pos",
  "/pos/new",
  "/pos/quick-sale",
  "/pos/product-search",
  "/pos/customer-selection",
  "/pos/customers",
  "/pos/products",
  "/pos/barcode-scanner",
  "/pos/salesman-reference",
  "/pos/salesmen",
  "/pos/references",
  "/pos/hold-sale",
  "/pos/resume-sale",
  "/held-sales",
  "/pos/quotations",
  "/pos/sales-orders",
  "/pos/split-payment",
  "/pos/installments",
  "/pos/coupons",
  "/pos/refund",
  "/pos/delivery-order",
  "/pos/cash-drawer",
  "/pos/shift",
  "/pos/cash-in-out",
  "/pos/day-closing",
  "/pos/offline",
  "/pos/credit",
  "/pos/reports",
  "/pos/settings",
  "/invoices",
  "/sales-management",
  "/returns",
  "/exchange",
  "/payments",
  "/discounts",
] as const;

export type PosEnvironmentPath = (typeof POS_ENVIRONMENT_PATHS)[number];

export function isPosEnvironmentPath(pathname: string): boolean {
  return (POS_ENVIRONMENT_PATHS as readonly string[]).includes(pathname);
}

export function posNavItemForPath(pathname: string): PosOwnershipItem | undefined {
  if (pathname === "/pos/new") return POS_OWNERSHIP[0];
  const byCanonical = POS_OWNERSHIP.find((item) => item.canonical === pathname);
  if (byCanonical) return byCanonical;
  return POS_OWNERSHIP.find((item) => item.aliases.includes(pathname));
}

export type PosTerminalNavItem = {
  label: string;
  path: string;
  badge?: "hold";
};

/**
 * Dense terminal strip — operational shortcuts (not the full 26 ERP children).
 */
/** Operational rail — labels match the POS reference shell (7 links). */
export const POS_TERMINAL_NAV: readonly PosTerminalNavItem[] = [
  { label: "POS", path: "/pos" },
  { label: "Hold / Resume", path: "/pos/resume-sale", badge: "hold" },
  { label: "Customers", path: "/pos/customer-selection" },
  { label: "Products", path: "/pos/product-search" },
  { label: "Price & Discount", path: "/discounts" },
  { label: "Invoices", path: "/invoices" },
  { label: "Shift", path: "/pos/shift" },
] as const;

export const POS_COMPONENT_OWNERS = {
  shell: [
    "features/pos/design-system/POSShell.tsx",
    "features/pos/design-system/POSHeader.tsx",
    "features/pos/design-system/POSTerminalNav.tsx",
    "features/pos/design-system/POSWorkspace.tsx",
    "features/pos/design-system/POSShortcutBar.tsx",
    "features/pos/design-system/POSActionBar.tsx",
  ],
  terminal: [
    "features/pos/PosPage.tsx",
    "features/pos/PosTerminalFocusPage.tsx",
    "features/pos/session/usePosSession.ts",
    "features/pos/pos-api.ts",
  ],
  staged: ["features/pos/PosStagedCapabilityPage.tsx"],
  invoices: ["features/pos/InvoicesPage.tsx", "features/pos/SalesWorkspace.tsx"],
  holds: ["features/pos/HeldSalesPage.tsx", "features/pos/held-sales.ts"],
  shift: ["features/pos/RegisterPage.tsx", "features/pos/register-shift.ts"],
  returns: ["features/pos/ReturnsPage.tsx", "features/pos/returns-workspace.ts"],
  exchange: ["features/pos/ExchangePage.tsx"],
  payments: ["features/pos/PaymentsPage.tsx", "features/pos/payment-center.ts"],
  discounts: ["features/pos/DiscountsPage.tsx", "features/pos/discounts-workspace.ts"],
  salesmen: ["features/pos/SalesmenPage.tsx", "features/pos/salesman-workspace.ts"],
  installments: ["features/pos/InstallmentsPage.tsx", "features/pos/installments-workspace.ts"],
  settings: ["features/pos/SettingsPage.tsx", "features/pos/pos-settings.ts"],
  sharedOutsidePosFolder: [
    "features/quotations/QuotationsPage.tsx",
    "features/installments/CreditInstallmentsPage.tsx",
    "features/delivery/DeliveriesPage.tsx",
    "features/devices/DevicesPage.tsx",
  ],
} as const;

export const POS_API_DOMAIN_OWNERS = {
  router: "apps/api/src/routes/pos.ts",
  repository: "packages/db/src/repositories/pos-repository.ts",
  canonical: "packages/domain/src/pos-canonical.ts",
  sale: "packages/domain/src/sale-transaction.ts",
  totals: "packages/domain/src/sale-totals.ts",
  cart: "packages/domain/src/pos-cart.ts",
  hold: "packages/domain/src/pos-hold.ts",
  payment: "packages/domain/src/pos-payment.ts",
  rbac: "packages/domain/src/pos-security.ts + rbac-catalog.ts",
} as const;
