import { createBrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { AppShell } from "@/app/shell/AppShell";
import { ERP_MODULES } from "@/app/modules";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import { NotFoundPage } from "@/features/modules/RouteFallbackPage";
import { ProductsPage } from "@/features/product-management/ProductsPage";
import { ProductFormPage } from "@/features/product-management/ProductFormPage";
import { TaxonomyPage } from "@/features/product-management/TaxonomyPage";
import { UnitsPage } from "@/features/product-management/UnitsPage";
import { ImportExportPage } from "@/features/import-export/ImportExportPage";
import { BarcodesPage } from "@/features/barcode-qr/BarcodesPage";
import { PricingPage } from "@/features/product-management/PricingPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { WarehousesPage } from "@/features/warehouses/WarehousesPage";
import { BatchSerialPage } from "@/features/inventory/BatchSerialPage";
import { StockOpsPage } from "@/features/inventory/StockOpsPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { SuppliersPage } from "@/features/suppliers/SuppliersPage";
import { PaymentsPage } from "@/features/customers/PaymentsPage";
import { CreditInstallmentsPage } from "@/features/installments/CreditInstallmentsPage";
import { PosPage } from "@/features/pos/PosPage";
import { ReturnsPage } from "@/features/pos/ReturnsPage";
import { InvoicesPage } from "@/features/pos/InvoicesPage";
import { SalesmanPage } from "@/features/salesman/SalesmanPage";
import { SalesManagementPage } from "@/features/pos/SalesManagementPage";
import { PurchasesPage } from "@/features/purchases/PurchasesPage";
import { PurchaseReturnsPage } from "@/features/purchases/PurchaseReturnsPage";
import { TransfersPage } from "@/features/warehouses/TransfersPage";
import { DeliveriesPage } from "@/features/delivery/DeliveriesPage";
import { QuotationsPage } from "@/features/quotations/QuotationsPage";
import { ServicePage } from "@/features/service-repair/ServicePage";
import { WarrantyPage } from "@/features/warranty/WarrantyPage";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import { BankingPage } from "@/features/banking/BankingPage";
import { ExpensesPage } from "@/features/expenses/ExpensesPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ReportsHubPage } from "@/features/reports/ReportsHubPage";
import { BiPage } from "@/features/reports/BiPage";
import { UsersRolesPage } from "@/features/users/UsersRolesPage";
import { PermissionsPage } from "@/features/permissions/PermissionsPage";
import { ApprovalsPage } from "@/features/approvals/ApprovalsPage";
import { AuditPage } from "@/features/audit/AuditPage";
import { BranchesPage } from "@/features/branches/BranchesPage";
import { PrintingPage } from "@/features/printing/PrintingPage";
import { DevicesPage } from "@/features/devices/DevicesPage";
import { CrmPage } from "@/features/crm/CrmPage";
import { LoyaltyPage } from "@/features/loyalty/LoyaltyPage";
import { B2bPage } from "@/features/orders/B2bPage";
import { OnlineStorePage } from "@/features/system/OnlineStorePage";
import { AiCameraPage } from "@/features/ai-camera/AiCameraPage";
import { AiInsightsPage } from "@/features/reports/AiInsightsPage";
import { HrPage } from "@/features/system/HrPage";
import { TaxPage } from "@/features/tax/TaxPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { SecurityPage } from "@/features/system/SecurityPage";
import { BackupPage } from "@/features/backup/BackupPage";
import { IntegrationsPage } from "@/features/system/IntegrationsPage";

const implemented: Record<string, ReactNode> = {
  "/": <DashboardPage />,
  "/bi": <BiPage />,
  "/crm": <CrmPage />,
  "/crm/campaigns": <CrmPage />,
  "/crm/sms": <CrmPage />,
  "/crm/whatsapp": <CrmPage />,
  "/crm/marketing": <CrmPage />,
  "/crm/engagement": <CrmPage />,
  "/loyalty": <LoyaltyPage />,
  "/b2b": <B2bPage />,
  "/online-store": <OnlineStorePage />,
  "/ai-camera": <AiCameraPage />,
  "/ai-insights": <AiInsightsPage />,
  "/hr": <HrPage />,
  "/tax": <TaxPage />,
  "/documents": <DocumentsPage />,
  "/notifications": <NotificationsPage />,
  "/security": <SecurityPage />,
  "/backup": <BackupPage />,
  "/integrations": <IntegrationsPage />,
  "/import-export": <ImportExportPage />,
  "/products": <ProductsPage />,
  "/categories": <TaxonomyPage />,
  "/subcategories": <TaxonomyPage />,
  "/brands": <TaxonomyPage />,
  "/companies": <TaxonomyPage />,
  "/units": <UnitsPage />,
  "/pricing": <PricingPage />,
  "/barcodes": <BarcodesPage />,
  "/qr": <BarcodesPage />,
  "/inventory": <InventoryPage />,
  "/stock-ops": <StockOpsPage />,
  "/inventory/serials": <BatchSerialPage />,
  "/inventory/expiry": <BatchSerialPage />,
  "/inventory/adjustments": <StockOpsPage />,
  "/inventory/damaged": <StockOpsPage />,
  "/inventory/audit": <StockOpsPage />,
  "/warehouses": <WarehousesPage />,
  "/warehouses/racks": <WarehousesPage />,
  "/warehouses/shelves": <WarehousesPage />,
  "/warehouses/bins": <WarehousesPage />,
  "/stock-transfers": <TransfersPage />,
  "/batches-serials": <BatchSerialPage />,
  "/customers": <CustomersPage />,
  "/customers/ledger": <CustomersPage />,
  "/customers/payment-history": <CustomersPage />,
  "/suppliers": <SuppliersPage />,
  "/suppliers/ledger": <SuppliersPage />,
  "/suppliers/price-lists": <PurchasesPage />,
  "/payments": <PaymentsPage />,
  "/credit": <CreditInstallmentsPage />,
  "/installments": <CreditInstallmentsPage />,
  "/pos": <PosPage />,
  "/pos/new": <PosPage />,
  "/returns": <ReturnsPage />,
  "/exchange": <ReturnsPage />,
  "/invoices": <InvoicesPage />,
  "/sales-management": <SalesManagementPage />,
  "/held-sales": <PosPage entry="holds" />,
  "/salesman": <SalesmanPage />,
  "/pos/salesmen": <SalesmanPage />,
  "/pos/references": <SalesmanPage />,
  "/pos/installments": <CreditInstallmentsPage />,
  "/purchases": <PurchasesPage />,
  "/purchase-returns": <PurchaseReturnsPage />,
  "/deliveries": <DeliveriesPage />,
  "/quotations": <QuotationsPage />,
  "/orders": <QuotationsPage />,
  "/service": <ServicePage />,
  "/service/complaints": <ServicePage />,
  "/service/technicians": <ServicePage />,
  "/service/repairs": <ServicePage />,
  "/service/charges": <ServicePage />,
  "/warranty": <WarrantyPage />,
  "/warranty/replacements": <WarrantyPage />,
  "/warranty/history": <WarrantyPage />,
  "/accounts": <AccountsPage />,
  "/accounts/journals": <AccountsPage />,
  "/accounts/profit-loss": <ReportsHubPage />,
  "/banking": <BankingPage />,
  "/expenses": <ExpensesPage />,
  "/reports": <ReportsHubPage />,
  "/users": <UsersRolesPage />,
  "/permissions": <PermissionsPage />,
  "/approvals": <ApprovalsPage />,
  "/audit": <AuditPage />,
  "/branches": <BranchesPage />,
  "/printing": <PrintingPage />,
  "/devices": <DevicesPage />,
};

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
            element: implemented[module.path] ?? <ModulePlaceholderPage module={module} />,
          })),
          { path: "products/new", element: <ProductFormPage /> },
          { path: "products/:id", element: <ProductFormPage /> },
          { path: "pos/new", element: <PosPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
