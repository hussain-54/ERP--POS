import { createBrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { AppShell } from "@/app/shell/AppShell";
import { ERP_MODULES } from "@/app/modules";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import { ProductsPage } from "@/features/catalog/ProductsPage";
import { ProductFormPage } from "@/features/catalog/ProductFormPage";
import { TaxonomyPage } from "@/features/catalog/TaxonomyPage";
import { UnitsPage } from "@/features/catalog/UnitsPage";
import { ImportExportPage } from "@/features/catalog/ImportExportPage";
import { BarcodesPage } from "@/features/catalog/BarcodesPage";
import { PricingPage } from "@/features/catalog/PricingPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { WarehousesPage } from "@/features/inventory/WarehousesPage";
import { BatchSerialPage } from "@/features/inventory/BatchSerialPage";
import { CustomersPage } from "@/features/parties/CustomersPage";
import { SuppliersPage } from "@/features/parties/SuppliersPage";
import { PaymentsPage } from "@/features/parties/PaymentsPage";
import { CreditInstallmentsPage } from "@/features/parties/CreditInstallmentsPage";
import { PosPage } from "@/features/pos/PosPage";
import { ReturnsPage } from "@/features/pos/ReturnsPage";
import { InvoicesPage } from "@/features/pos/InvoicesPage";
import { SalesmanPage } from "@/features/pos/SalesmanPage";
import { PurchasesPage } from "@/features/purchases/PurchasesPage";
import { PurchaseReturnsPage } from "@/features/purchases/PurchaseReturnsPage";
import { TransfersPage } from "@/features/purchases/TransfersPage";
import { DeliveriesPage } from "@/features/purchases/DeliveriesPage";
import { QuotationsPage } from "@/features/after-sales/QuotationsPage";
import { ServicePage } from "@/features/after-sales/ServicePage";
import { WarrantyPage } from "@/features/after-sales/WarrantyPage";
import { AccountsPage } from "@/features/finance/AccountsPage";
import { BankingPage } from "@/features/finance/BankingPage";
import { ExpensesPage } from "@/features/finance/ExpensesPage";
import { DashboardPage } from "@/features/reporting/DashboardPage";
import { ReportsHubPage } from "@/features/reporting/ReportsHubPage";
import { BiPage } from "@/features/reporting/BiPage";
import { UsersRolesPage } from "@/features/admin/UsersRolesPage";
import { PermissionsPage } from "@/features/admin/PermissionsPage";
import { ApprovalsPage } from "@/features/admin/ApprovalsPage";
import { AuditPage } from "@/features/admin/AuditPage";
import { BranchesPage } from "@/features/admin/BranchesPage";
import { SyncCenterPage } from "@/features/sync/SyncCenterPage";
import { OfflinePosStatusPage } from "@/features/sync/OfflinePosStatusPage";
import { PrintingPage } from "@/features/hardware/PrintingPage";
import { DevicesPage } from "@/features/hardware/DevicesPage";
import { CrmPage } from "@/features/commerce/CrmPage";
import { LoyaltyPage } from "@/features/commerce/LoyaltyPage";
import { B2bPage } from "@/features/commerce/B2bPage";
import { OnlineStorePage } from "@/features/commerce/OnlineStorePage";
import { AiCameraPage } from "@/features/ai/AiCameraPage";
import { AiInsightsPage } from "@/features/ai/AiInsightsPage";
import { HrPage } from "@/features/enterprise/HrPage";
import { TaxPage } from "@/features/enterprise/TaxPage";
import { DocumentsPage } from "@/features/enterprise/DocumentsPage";
import { NotificationsPage } from "@/features/enterprise/NotificationsPage";
import { SecurityPage } from "@/features/infrastructure/SecurityPage";
import { BackupPage } from "@/features/infrastructure/BackupPage";
import { IntegrationsPage } from "@/features/infrastructure/IntegrationsPage";

const implemented: Record<string, ReactNode> = {
  "/": <DashboardPage />,
  "/bi": <BiPage />,
  "/crm": <CrmPage />,
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
  "/units": <UnitsPage />,
  "/pricing": <PricingPage />,
  "/barcodes": <BarcodesPage />,
  "/inventory": <InventoryPage />,
  "/warehouses": <WarehousesPage />,
  "/stock-transfers": <TransfersPage />,
  "/batches-serials": <BatchSerialPage />,
  "/customers": <CustomersPage />,
  "/suppliers": <SuppliersPage />,
  "/payments": <PaymentsPage />,
  "/credit": <CreditInstallmentsPage />,
  "/installments": <CreditInstallmentsPage />,
  "/pos": <PosPage />,
  "/returns": <ReturnsPage />,
  "/invoices": <InvoicesPage />,
  "/held-sales": <PosPage />,
  "/salesman": <SalesmanPage />,
  "/purchases": <PurchasesPage />,
  "/purchase-returns": <PurchaseReturnsPage />,
  "/deliveries": <DeliveriesPage />,
  "/quotations": <QuotationsPage />,
  "/service": <ServicePage />,
  "/warranty": <WarrantyPage />,
  "/accounts": <AccountsPage />,
  "/banking": <BankingPage />,
  "/expenses": <ExpensesPage />,
  "/reports": <ReportsHubPage />,
  "/users": <UsersRolesPage />,
  "/permissions": <PermissionsPage />,
  "/approvals": <ApprovalsPage />,
  "/audit": <AuditPage />,
  "/branches": <BranchesPage />,
  "/sync": <SyncCenterPage />,
  "/offline-pos": <OfflinePosStatusPage />,
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
        ],
      },
    ],
  },
]);
