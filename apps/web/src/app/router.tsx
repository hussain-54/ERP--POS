import { createBrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { AppShell } from "@/app/shell/AppShell";
import { ERP_MODULES, isSystemAdminPath } from "@/app/modules";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import { NotFoundPage } from "@/features/modules/RouteFallbackPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ProductsPage } from "@/features/product-management/ProductsPage";
import { ProductFormPage } from "@/features/product-management/ProductFormPage";
import { TaxonomyPage } from "@/features/product-management/TaxonomyPage";
import { UnitsPage } from "@/features/product-management/UnitsPage";
import { PricingPage } from "@/features/product-management/PricingPage";
import { BarcodesPage } from "@/features/barcode-qr/BarcodesPage";
import { AiCameraPage } from "@/features/ai-camera/AiCameraPage";
import { QuotationsPage } from "@/features/quotations/QuotationsPage";
import { B2bPage } from "@/features/orders/B2bPage";
import { DeliveriesPage } from "@/features/delivery/DeliveriesPage";
import { PurchasesPage } from "@/features/purchases/PurchasesPage";
import { PurchaseReturnsPage } from "@/features/purchases/PurchaseReturnsPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { BatchSerialPage } from "@/features/inventory/BatchSerialPage";
import { StockOpsPage } from "@/features/inventory/StockOpsPage";
import { WarehousesPage } from "@/features/warehouses/WarehousesPage";
import { TransfersPage } from "@/features/warehouses/TransfersPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { ServicePage } from "@/features/service-repair/ServicePage";
import { WarrantyPage } from "@/features/warranty/WarrantyPage";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import { BankingPage } from "@/features/banking/BankingPage";
import { CrmPage } from "@/features/crm/CrmPage";
import { ReportsHubPage } from "@/features/reports/ReportsHubPage";
import { BiPage } from "@/features/reports/BiPage";
import { AiInsightsPage } from "@/features/reports/AiInsightsPage";
import { SalesmanPage } from "@/features/salesman/SalesmanPage";
import { ExpensesPage } from "@/features/expenses/ExpensesPage";
import { CreditInstallmentsPage } from "@/features/installments/CreditInstallmentsPage";
import { LoyaltyPage } from "@/features/loyalty/LoyaltyPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { ApprovalsPage } from "@/features/approvals/ApprovalsPage";
import { UsersRolesPage } from "@/features/users/UsersRolesPage";
import { PermissionsPage } from "@/features/permissions/PermissionsPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { BranchesPage } from "@/features/branches/BranchesPage";
import { TaxPage } from "@/features/tax/TaxPage";
import { ImportExportPage } from "@/features/import-export/ImportExportPage";
import { PrintingPage } from "@/features/printing/PrintingPage";
import { BackupPage } from "@/features/backup/BackupPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { HrPage } from "@/features/system/HrPage";
import { SecurityPage } from "@/features/system/SecurityPage";
import { IntegrationsPage } from "@/features/system/IntegrationsPage";
import { OnlineStorePage } from "@/features/system/OnlineStorePage";
import { SystemAdminHome } from "@/features/system/SystemAdminHome";
import { SystemComingSoonPage } from "@/features/system/SystemComingSoonPage";

/**
 * Live page bindings grouped by the 39-module tree.
 * Paths not listed here still register via ERP_MODULES and render ModulePlaceholderPage
 * (Coming Soon), including 18, 27–28, and 32–38. System Administration children use SystemComingSoonPage.
 * Duplicate URLs are route aliases of the same element (see DUPLICATE_ROUTE_PAIRS).
 * Do not delete aliases, merge page files, or introduce redirects.
 */
const implemented: Record<string, ReactNode> = {
  // 01 COMMAND CENTER — canonical /command-center · alias /
  "/command-center": <DashboardPage />,
  "/": <DashboardPage />,

  // 03 PRODUCT & CATALOG — canonical /product-catalog · alias /products
  "/product-catalog": <ProductsPage />,
  "/products": <ProductsPage />,
  "/products/new": <ProductFormPage />,
  "/categories": <TaxonomyPage />,
  "/subcategories": <TaxonomyPage />,
  "/brands": <TaxonomyPage />,
  "/companies": <TaxonomyPage />,
  "/units": <UnitsPage />,
  "/pricing": <PricingPage />,

  // barcodes / QR stay on the existing pages, owned by PRODUCT & CATALOG
  "/barcodes": <BarcodesPage />,
  "/qr": <BarcodesPage />,

  // 14 AI & AUTOMATION — canonical /ai · alias /ai-camera
  "/ai": <AiCameraPage />,
  "/ai-camera": <AiCameraPage />,

  // 06 Quotations — canonical /quotations
  "/quotations": <QuotationsPage />,

  // 07 Orders — canonical /orders (same page as quotations) · child /b2b
  "/orders": <QuotationsPage />,
  "/b2b": <B2bPage />,

  // 08 Delivery — canonical /deliveries
  "/delivery": <DeliveriesPage />,
  "/deliveries": <DeliveriesPage />,

  // 09 Purchases — canonical /purchases
  "/purchasing": <PurchasesPage />,
  "/purchases": <PurchasesPage />,
  "/purchase-returns": <PurchaseReturnsPage />,

  // 10 Inventory — canonical /inventory · alias /stock-ops
  "/inventory": <InventoryPage />,
  "/stock-ops": <StockOpsPage />,
  "/inventory/adjustments": <StockOpsPage />,
  "/inventory/damaged": <StockOpsPage />,
  "/inventory/audit": <StockOpsPage />,
  "/batches-serials": <BatchSerialPage />,
  "/inventory/serials": <BatchSerialPage />,
  "/inventory/expiry": <BatchSerialPage />,

  // 11 Warehouses — canonical /warehouses
  "/warehouse": <WarehousesPage />,
  "/warehouses": <WarehousesPage />,
  "/warehouses/racks": <WarehousesPage />,
  "/warehouses/shelves": <WarehousesPage />,
  "/warehouses/bins": <WarehousesPage />,
  "/stock-transfers": <TransfersPage />,

  // 12 Customers — canonical /customers · /credit shares installments page
  "/customers": <CustomersPage />,
  "/customers/ledger": <CustomersPage />,
  "/customers/payment-history": <CustomersPage />,
  "/credit": <CreditInstallmentsPage />,

  // 13 Suppliers — canonical /suppliers · price lists reuse PurchasesPage
  "/suppliers": <SuppliersPage />,
  "/suppliers/ledger": <SuppliersPage />,
  "/suppliers/price-lists": <PurchasesPage />,

  // 14 Service & Repair — canonical /service
  "/service": <ServicePage />,
  "/service/complaints": <ServicePage />,
  "/service/technicians": <ServicePage />,
  "/service/repairs": <ServicePage />,
  "/service/charges": <ServicePage />,

  // 15 Warranty — canonical /warranty
  "/warranty": <WarrantyPage />,
  "/warranty/replacements": <WarrantyPage />,
  "/warranty/history": <WarrantyPage />,

  // 16 Accounts — canonical /accounts · P&L reuses reports hub
  "/accounts": <AccountsPage />,
  "/accounts/journals": <AccountsPage />,
  "/accounts/profit-loss": <ReportsHubPage />,

  // 17 Banking — canonical /banking
  "/banking": <BankingPage />,

  // 18 CRM & Marketing — canonical /crm
  "/crm": <CrmPage />,
  "/crm/campaigns": <CrmPage />,
  "/crm/sms": <CrmPage />,
  "/crm/whatsapp": <CrmPage />,
  "/crm/marketing": <CrmPage />,
  "/crm/engagement": <CrmPage />,

  // 19 Reports & Analytics — canonical /reports
  "/reports": <ReportsHubPage />,
  "/bi": <BiPage />,
  "/ai-insights": <AiInsightsPage />,

  // 20 Salesman / Field Sales — canonical /salesman · Sales shortcuts under 05
  "/salesman": <SalesmanPage />,
  "/salesman/references": <SalesmanPage />,
  "/salesman/commissions": <SalesmanPage />,

  // 21 Expenses — canonical /expenses
  "/expenses": <ExpensesPage />,
  "/expenses/period": <ExpensesPage />,

  // 22 Installments — canonical /installments · alias /credit (12). POS /pos/installments is dedicated.
  "/installments": <CreditInstallmentsPage />,

  // 23 Loyalty — canonical /loyalty
  "/marketing": <LoyaltyPage />,
  "/loyalty": <LoyaltyPage />,
  "/loyalty/offers": <LoyaltyPage />,
  "/loyalty/redeem": <LoyaltyPage />,

  // 24 Documents — canonical /documents
  "/documents": <DocumentsPage />,

  // 25 Approval Workflow — canonical /approvals
  "/workflows": <ApprovalsPage />,
  "/approvals": <ApprovalsPage />,

  // 26 Users & Role Management — canonical /users
  "/users": <UsersRolesPage />,
  "/users/roles": <UsersRolesPage />,

  // 27 Permissions — canonical /permissions
  "/permissions": <PermissionsPage />,
  "/permissions/overrides": <PermissionsPage />,

  // 28 Audit Trail — canonical /audit
  "/audit": <AuditPage />,

  // 29 Notification Center — canonical /notifications
  "/notifications": <NotificationsPage />,

  // 30 Multi-Branch — canonical /branches
  "/organization": <BranchesPage />,
  "/branches": <BranchesPage />,
  "/branches/membership": <BranchesPage />,

  // 31 Tax & Pakistan Compliance — canonical /tax
  "/tax": <TaxPage />,
  "/tax/rates": <TaxPage />,
  "/tax/reports": <TaxPage />,

  // 32 Import / Export — canonical /import-export
  "/import-export": <ImportExportPage />,
  "/import-export/export": <ImportExportPage />,
  "/import-export/templates": <ImportExportPage />,

  // 33 Printing — canonical /printing
  "/printing": <PrintingPage />,
  "/printing/queue": <PrintingPage />,
  "/printing/preview": <PrintingPage />,

  // 34 Backup & Disaster Recovery — canonical /backup
  "/backup": <BackupPage />,
  "/backup/restore-points": <BackupPage />,

  // 35 Devices / Printing — canonical /devices
  "/devices": <DevicesPage />,
  "/devices/drawer": <DevicesPage />,
  "/devices/events": <DevicesPage />,

  "/hr": <HrPage />,
  "/security": <SecurityPage />,
  "/integrations": <IntegrationsPage />,
  "/online-store": <OnlineStorePage />,

  // 39 System Administration — canonical /settings
  "/settings": <SystemAdminHome />,
};

/** Canonical + alias path → existing page element. Used to lock duplicate ownership. */
export const IMPLEMENTED_ROUTES: Readonly<Record<string, ReactNode>> = implemented;

/** Same page binding the router uses. Coming Soon parents stay registered, never hidden. */
export function elementForModulePath(path: string): ReactNode {
  const implementedPage = implemented[path];
  if (implementedPage) return implementedPage;
  const module = ERP_MODULES.find((item) => item.path === path);
  if (!module) return <NotFoundPage />;
  if (isSystemAdminPath(path)) return <SystemComingSoonPage module={module} />;
  return <ModulePlaceholderPage module={module} />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/auth/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/auth/reset", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          ...ERP_MODULES.map((module) => ({
            path: module.path === "/" ? undefined : module.path.replace(/^\//, ""),
            index: module.path === "/",
            element: elementForModulePath(module.path),
          })),
          { path: "products/:id", element: <ProductFormPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
