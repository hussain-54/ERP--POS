/**
 * POS information architecture — module 05 ownership.
 *
 * Names and order are locked. Do not rename or reorder.
 * Canonical POS entry is `/pos`. Aliases stay registered; do not delete them.
 *
 * This file is a map only. It does not move pages, change APIs, or alter sale math.
 * Master modules stay in salesman/ and installments/. POS children are dedicated pages.
 */

export const POS_IA_TITLES = [
  "New Sale",
  "Hold / Resume",
  "Invoices",
  "Register",
  "Returns",
  "Exchange",
  "Payments",
  "Discounts",
  "References",
  "Salesmen",
  "Installments",
  "Settings",
] as const;

export type PosIaTitle = (typeof POS_IA_TITLES)[number];

export type PosOwnershipStatus = "live" | "placeholder" | "shared-live";

export interface PosOwnershipItem {
  title: PosIaTitle;
  /** Canonical URL for this POS child. */
  canonical: string;
  /** Working aliases — keep registered, do not delete. */
  aliases: readonly string[];
  /** Web page that currently owns the screen. */
  page: string;
  status: PosOwnershipStatus;
  /** APIs / domain the screen must keep using. */
  backend: string;
  note: string;
}

export const POS_CANONICAL_ENTRY = "/pos";

/**
 * Dedicated POS terminal sidebar (not the 39-module ERP tree, not the 12 ERP Sales children).
 * Existing POS routes stay registered; Reports stays active on those operational screens.
 */
export const POS_SHELL_NAV_TITLES = [
  "POS",
  "Hold / Resume",
  "Customers",
  "Products",
  "Price & Discount",
  "Reports",
  "Settings",
] as const;

export type PosShellNavTitle = (typeof POS_SHELL_NAV_TITLES)[number];

export type PosShellNavIcon =
  | "pos"
  | "hold"
  | "customers"
  | "products"
  | "discount"
  | "reports"
  | "settings";

export interface PosShellNavItem {
  title: PosShellNavTitle;
  path: string;
  aliases: readonly string[];
  permission: string;
  icon: PosShellNavIcon;
}

export const POS_SHELL_NAV: readonly PosShellNavItem[] = [
  { title: "POS", path: "/pos", aliases: ["/pos/new"], permission: "pos.sell", icon: "pos" },
  { title: "Hold / Resume", path: "/held-sales", aliases: [], permission: "pos.hold", icon: "hold" },
  { title: "Customers", path: "/pos/customers", aliases: [], permission: "pos.sell", icon: "customers" },
  { title: "Products", path: "/pos/products", aliases: [], permission: "pos.sell", icon: "products" },
  { title: "Price & Discount", path: "/discounts", aliases: [], permission: "pos.sell", icon: "discount" },
  {
    title: "Reports",
    path: "/pos/reports",
    aliases: [
      "/invoices",
      "/sales-management",
      "/returns",
      "/exchange",
      "/payments",
      "/pos/references",
      "/pos/salesmen",
      "/pos/installments",
    ],
    permission: "pos.view_invoices",
    icon: "reports",
  },
  { title: "Settings", path: "/pos/settings", aliases: [], permission: "pos.configure", icon: "settings" },
] as const;

export function isPosShellNavActive(item: PosShellNavItem, pathname: string): boolean {
  if (item.path === pathname) return true;
  return item.aliases.includes(pathname);
}

export function posShellNavItemForPath(pathname: string): PosShellNavItem | undefined {
  const exact = POS_SHELL_NAV.find((item) => item.path === pathname);
  if (exact) return exact;
  return POS_SHELL_NAV.find((item) => item.aliases.includes(pathname));
}

export const POS_OWNERSHIP: readonly PosOwnershipItem[] = [
  {
    title: "New Sale",
    canonical: "/pos",
    aliases: ["/pos/new"],
    page: "features/pos/PosPage.tsx",
    status: "live",
    backend: "POST /api/v1/pos/sales · PosRepository.postSale · sale-transaction / pos-cart / pos-payment / pos-pricing / pos-tax / discount-policy",
    note: "Dense terminal. /pos is the only canonical POS entry.",
  },
  {
    title: "Hold / Resume",
    canonical: "/held-sales",
    aliases: [],
    page: "features/pos/HeldSalesPage.tsx",
    status: "live",
    backend: "/api/v1/pos/holds* · PosRepository hold/resume/edit · pos-hold.ts",
    note: "Dedicated Hold / Resume workspace in the POS shell. Nav title stays Hold / Resume.",
  },
  {
    title: "Invoices",
    canonical: "/invoices",
    aliases: [],
    page: "features/pos/InvoicesPage.tsx",
    status: "live",
    backend: "GET /api/v1/pos/sales/management · export CSV · GET /api/v1/pos/sales/:id/invoice · PosRepository.searchSalesManagement / getInvoice",
    note: "Invoice register. Reuses the canonical sales-management search — do not add a second sales list.",
  },
  {
    title: "Register",
    canonical: "/sales-management",
    aliases: [],
    page: "features/pos/RegisterPage.tsx",
    status: "live",
    backend: "GET /api/v1/pos/shifts/current · POST /api/v1/pos/shifts/open · POST /api/v1/pos/shifts/:id/close · PosRepository cash shifts",
    note: "Cashier/register control. Do not invent cash-in/out postings. Sales list lives on Invoices.",
  },
  {
    title: "Returns",
    canonical: "/returns",
    aliases: [],
    page: "features/pos/ReturnsPage.tsx",
    status: "live",
    backend: "/api/v1/pos/returns* · PosRepository.postReturn · pos-return.ts",
    note: "Canonical returns screen. Qty capped at sold minus previously returned.",
  },
  {
    title: "Exchange",
    canonical: "/exchange",
    aliases: [],
    page: "features/pos/ExchangePage.tsx",
    status: "live",
    backend: "POST /api/v1/pos/returns then POST /api/v1/pos/sales · PosRepository.postReturn / postSale · pos-return.ts + pos-exchange.ts + sale-transaction.ts",
    note: "Real exchange: return posting plus replacement sale. Difference is the net of those two legs. Keep /exchange.",
  },
  {
    title: "Payments",
    canonical: "/payments",
    aliases: [],
    page: "features/pos/PaymentsPage.tsx",
    status: "live",
    backend: "GET/POST /api/v1/parties/payments · GET /api/v1/parties/payment-methods · PartiesRepository.searchPayments / postSplitPayment (not a second POS sale writer)",
    note: "Payment center. Checkout posting stays on New Sale. No gateway. No void/reverse API.",
  },
  {
    title: "Discounts",
    canonical: "/discounts",
    aliases: [],
    page: "features/pos/DiscountsPage.tsx",
    status: "live",
    backend:
      "discount-policy.ts + pos-discount.ts · POST/GET /api/v1/admin/approvals · sale post still overwrites approverRole via discountRoleFromAuthz",
    note: "Policy and real discount approval inbox. Caps are never bypassed in the UI. Price override stays permission-gated on New Sale.",
  },
  {
    title: "References",
    canonical: "/pos/references",
    aliases: [],
    page: "features/pos/ReferencesPage.tsx",
    status: "live",
    backend: "GET/POST /api/v1/references · GET /api/v1/pos/sales/management · EnterpriseRepository.createSaleReference",
    note: "POS reference register of real sale_references plus sales that used them. Module 20 stays /salesman.",
  },
  {
    title: "Salesmen",
    canonical: "/pos/salesmen",
    aliases: [],
    page: "features/pos/SalesmenPage.tsx",
    status: "live",
    backend: "enterpriseApi employees/commissions · mapSalesmanEmployees · pos-commission.ts",
    note: "POS salesman roster. New Sale selection uses the same employee map. Module 20 stays /salesman.",
  },
  {
    title: "Installments",
    canonical: "/pos/installments",
    aliases: [],
    page: "features/pos/InstallmentsPage.tsx",
    status: "live",
    backend: "GET/POST /api/v1/parties/installments · PartiesRepository.searchInstallmentPlans / createInstallmentPlan · installments.ts",
    note: "POS installment register. Canonical master remains /installments. /credit stays CreditInstallmentsPage.",
  },
  {
    title: "Settings",
    canonical: "/pos/settings",
    aliases: [],
    page: "features/pos/SettingsPage.tsx",
    status: "live",
    backend:
      "Read-only: hardware statuses · payment-methods · tax rates · discount-policy.ts · pos-hold TTL · pos-return catalogs · POS_SHORTCUTS · defaultMediaForDocument. No POS settings writer. /settings/pos stays System Administration Coming Soon.",
    note: "POS-owned Settings. Does not duplicate Security, Users, Branches, Integrations, Backup, or company settings.",
  },
] as const;

export const POS_TERMINAL_CANONICAL = POS_CANONICAL_ENTRY;

/**
 * URLs that enter the POS environment shell.
 * Do not include master-module owners (/salesman, /installments) or /credit / /settings/pos.
 */
export const POS_ENVIRONMENT_PATHS = [
  "/pos",
  "/pos/new",
  "/pos/customers",
  "/pos/products",
  "/pos/reports",
  "/held-sales",
  "/invoices",
  "/sales-management",
  "/returns",
  "/exchange",
  "/payments",
  "/discounts",
  "/pos/references",
  "/pos/salesmen",
  "/pos/installments",
  "/pos/settings",
] as const;

export type PosEnvironmentPath = (typeof POS_ENVIRONMENT_PATHS)[number];

export function isPosEnvironmentPath(pathname: string): boolean {
  return (POS_ENVIRONMENT_PATHS as readonly string[]).includes(pathname);
}

export function posNavItemForPath(pathname: string): PosOwnershipItem | undefined {
  if (pathname === "/pos/new") return POS_OWNERSHIP[0];
  return POS_OWNERSHIP.find((item) => item.canonical === pathname);
}

export const POS_COMPONENT_OWNERS = {
  shell: [
    "features/pos/design-system/POSShell.tsx",
    "features/pos/design-system/POSHeader.tsx",
    "features/pos/design-system/POSTopbar.tsx",
    "features/pos/design-system/POSNav.tsx",
    "features/pos/design-system/POSSidebar.tsx",
    "features/pos/design-system/POSWorkspace.tsx",
    "features/pos/design-system/POSShortcutBar.tsx",
    "features/pos/design-system/POSActionBar.tsx",
  ],
  newSale: [
    "features/pos/PosPage.tsx",
    "features/pos/components/PosProductPanel.tsx",
    "features/pos/components/PosDiscoveryTools.tsx",
    "features/pos/components/PosCart.tsx",
    "features/pos/components/PosCartRow.tsx",
    "features/pos/components/PosTotals.tsx",
    "features/pos/components/PosCustomerPanel.tsx",
    "features/pos/components/PosPaymentPanel.tsx",
    "features/pos/components/PaymentMethodGrid.tsx",
    "features/pos/components/PaymentSummary.tsx",
    "features/pos/components/PayNowButton.tsx",
    "features/pos/components/HoldSaleButton.tsx",
    "features/pos/components/QuotationButton.tsx",
    "features/pos/components/PaymentConfirmModal.tsx",
    "features/pos/components/PosHoldsPanel.tsx",
    "features/pos/components/PosApprovalDialog.tsx",
    "features/pos/components/ReceiptPreview.tsx",
    "features/pos/session/usePosSession.ts",
    "features/pos/session/pos-customer-runtime.ts",
    "features/pos/session/pos-customer-repository.ts",
    "features/pos/session/pos-repository.ts",
    "features/pos/pos-api.ts",
    "features/pos/pos-quotation.ts",
    "features/pos/pos-catalog-load.ts",
    "features/pos/pos-transaction.ts",
    "features/pos/pos-payment-ux.ts",
    "features/pos/pos-ux.ts",
    "features/pos/pos-security.ts",
    "features/pos/hardware.ts",
  ],
  invoices: [
    "features/pos/InvoicesPage.tsx",
    "features/pos/SalesWorkspace.tsx",
    "features/pos/sales-workspace.ts",
  ],
  holds: ["features/pos/HeldSalesPage.tsx", "features/pos/held-sales.ts"],
  register: ["features/pos/RegisterPage.tsx", "features/pos/register-shift.ts", "features/pos/SalesManagementPage.tsx"],
  returns: [
    "features/pos/ReturnsPage.tsx",
    "features/pos/returns-workspace.ts",
    "features/pos/components/PosSaleReview.tsx",
  ],
  exchange: [
    "features/pos/ExchangePage.tsx",
    "features/pos/returns-workspace.ts",
    "features/pos/components/PosSaleReview.tsx",
  ],
  payments: ["features/pos/PaymentsPage.tsx", "features/pos/payment-center.ts"],
  discounts: ["features/pos/DiscountsPage.tsx", "features/pos/discounts-workspace.ts"],
  salesmen: ["features/pos/SalesmenPage.tsx", "features/pos/salesman-workspace.ts"],
  references: ["features/pos/ReferencesPage.tsx", "features/pos/references-workspace.ts"],
  installments: ["features/pos/InstallmentsPage.tsx", "features/pos/installments-workspace.ts"],
  settings: ["features/pos/SettingsPage.tsx", "features/pos/pos-settings.ts"],
  sharedOutsidePosFolder: [
    "features/salesman/SalesmanPage.tsx",
    "features/installments/CreditInstallmentsPage.tsx",
  ],
} as const;

export const POS_API_DOMAIN_OWNERS = {
  router: "apps/api/src/routes/pos.ts",
  repository: "packages/db/src/repositories/pos-repository.ts",
  sale: "packages/domain/src/sale-transaction.ts",
  cart: "packages/domain/src/pos-cart.ts",
  hold: "packages/domain/src/pos-hold.ts",
  payment: "packages/domain/src/pos-payment.ts",
  pricing: "packages/domain/src/pos-pricing.ts",
  discount: "packages/domain/src/pos-discount.ts + discount-policy.ts",
  tax: "packages/domain/src/pos-tax.ts",
  returns: "packages/domain/src/pos-return.ts + pos-exchange.ts",
  customer: "packages/domain/src/pos-customer.ts",
  commission: "packages/domain/src/pos-commission.ts",
  rbac: "packages/domain/src/pos-security.ts + rbac-catalog.ts (pos.sell, pos.hold, pos.resume_any, pos.return, pos.view_invoices, pos.discount_*, pos.configure, pos.shift, payments.receive, credit.approve, installments.manage)",
} as const;
