import type { ReactNode } from "react";
import { findPosModule, POS_MODULES, POS_TERMINAL_PATHS } from "@/features/pos/ownership";
import { PosCommandCenterRoute } from "@/features/pos/pages/PosCommandCenterRoute";
import {
  PosOfflineHubPage,
  PosOverviewPage,
} from "@/features/pos/pages/PosSectionPages";
import { CustomerWorkspace } from "@/features/pos/customers/CustomerWorkspace";
import { PaymentsWorkspace } from "@/features/pos/payments/PaymentsWorkspace";
import { PricingWorkspace } from "@/features/pos/pricing/PricingWorkspace";
import { ProductWorkspace } from "@/features/pos/products/ProductWorkspace";
import { ReturnsWorkspace } from "@/features/pos/returns/ReturnsWorkspace";
import { ApprovalsWorkspace } from "@/features/pos/approvals/ApprovalsWorkspace";
import { DevicesWorkspace } from "@/features/pos/devices/DevicesWorkspace";
import { InvoicesWorkspace } from "@/features/pos/invoices/InvoicesWorkspace";
import { ReportsWorkspace } from "@/features/pos/reports/ReportsWorkspace";
import { SettingsWorkspace } from "@/features/pos/settings/SettingsWorkspace";
import { ShiftWorkspace } from "@/features/pos/shift/ShiftWorkspace";
import { TaxWorkspace } from "@/features/pos/tax/TaxWorkspace";
import { DraftSalesRegister } from "@/features/pos/sales/DraftSalesRegister";
import { HeldSalesRegister } from "@/features/pos/sales/HeldSalesRegister";
import { SalesRegister } from "@/features/pos/sales/SalesRegister";
import { PosTerminalPage } from "@/features/pos/terminal/PosTerminalPage";

const HUB_BY_ID: Record<string, ReactNode> = {
  overview: <PosOverviewPage />,
  sales: <SalesRegister variant="all" />,
  customers: <CustomerWorkspace mode="select" />,
  products: <ProductWorkspace mode="search" />,
  pricing: <PricingWorkspace mode="check" />,
  payments: <PaymentsWorkspace mode="split" />,
  invoices: <InvoicesWorkspace mode="invoices" />,
  returns: <ReturnsWorkspace mode="sales" />,
  shift: <ShiftWorkspace mode="dashboard" />,
  approvals: <ApprovalsWorkspace mode="all" />,
  reports: <ReportsWorkspace mode="sales" />,
  tax: <TaxWorkspace mode="rules" />,
  offline: <PosOfflineHubPage />,
  devices: <DevicesWorkspace mode="terminals" />,
  settings: <SettingsWorkspace mode="general" />,
};

function hubForPath(path: string): ReactNode {
  if (path === "/pos/sales/resume") return <HeldSalesRegister title="Resume sale" />;
  if (path === "/pos/sales/held") return <HeldSalesRegister />;
  if (path === "/pos/sales/drafts") return <DraftSalesRegister />;
  if (path === "/pos/sales/completed") return <SalesRegister variant="completed" />;
  if (path === "/pos/sales/void") return <SalesRegister variant="void" />;

  if (path === "/pos/customers/walk-in") return <CustomerWorkspace mode="walk-in" />;
  if (path === "/pos/customers/new") return <CustomerWorkspace mode="new" />;
  if (path === "/pos/customers/profile") return <CustomerWorkspace mode="profile" />;
  if (path === "/pos/customers/history") return <CustomerWorkspace mode="history" />;
  if (path === "/pos/customers/ledger") return <CustomerWorkspace mode="ledger" />;
  if (path === "/pos/customers/credit") return <CustomerWorkspace mode="credit" />;
  if (path === "/pos/customers/loyalty") return <CustomerWorkspace mode="loyalty" />;

  if (path === "/pos/products/barcode") return <ProductWorkspace mode="barcode" />;
  if (path === "/pos/products/sku") return <ProductWorkspace mode="sku" />;
  if (path === "/pos/products/favorites") return <ProductWorkspace mode="favorites" />;
  if (path === "/pos/products/recent") return <ProductWorkspace mode="recent" />;
  if (path === "/pos/products/categories") return <ProductWorkspace mode="categories" />;
  if (path === "/pos/products/stock") return <ProductWorkspace mode="stock" />;
  if (path === "/pos/products/qr") return <ProductWorkspace mode="qr" />;
  if (path === "/pos/products/camera") return <ProductWorkspace mode="camera" />;

  if (path === "/pos/pricing/override") return <PricingWorkspace mode="override" />;
  if (path === "/pos/pricing/discount") return <PricingWorkspace mode="discount" />;
  if (path === "/pos/pricing/promotions") return <PricingWorkspace mode="promotions" />;
  if (path === "/pos/pricing/coupons") return <PricingWorkspace mode="coupons" />;
  if (path === "/pos/pricing/customer") return <PricingWorkspace mode="customer" />;
  if (path === "/pos/pricing/approval") return <PricingWorkspace mode="approval" />;

  if (path === "/pos/payments/cash") return <PaymentsWorkspace mode="cash" />;
  if (path === "/pos/payments/card") return <PaymentsWorkspace mode="card" />;
  if (path === "/pos/payments/bank") return <PaymentsWorkspace mode="bank" />;
  if (path === "/pos/payments/qr") return <PaymentsWorkspace mode="qr" />;
  if (path === "/pos/payments/jazzcash") return <PaymentsWorkspace mode="jazzcash" />;
  if (path === "/pos/payments/easypaisa") return <PaymentsWorkspace mode="easypaisa" />;
  if (path === "/pos/payments/sadapay") return <PaymentsWorkspace mode="sadapay" />;
  if (path === "/pos/payments/wallet") return <PaymentsWorkspace mode="wallet" />;
  if (path === "/pos/payments/partial") return <PaymentsWorkspace mode="partial" />;
  if (path === "/pos/payments/credit") return <PaymentsWorkspace mode="credit" />;
  if (path === "/pos/payments/installment") return <PaymentsWorkspace mode="installment" />;
  if (path === "/pos/payments/refund") return <PaymentsWorkspace mode="refund" />;

  if (path === "/pos/returns/by-invoice") return <ReturnsWorkspace mode="by-invoice" />;
  if (path === "/pos/returns/by-barcode") return <ReturnsWorkspace mode="by-barcode" />;
  if (path === "/pos/returns/partial") return <ReturnsWorkspace mode="partial" />;
  if (path === "/pos/returns/full") return <ReturnsWorkspace mode="full" />;
  if (path === "/pos/returns/exchange") return <ReturnsWorkspace mode="exchange" />;
  if (path === "/pos/returns/cash-refund") return <ReturnsWorkspace mode="cash-refund" />;
  if (path === "/pos/returns/store-credit") return <ReturnsWorkspace mode="store-credit" />;
  if (path === "/pos/returns/reasons") return <ReturnsWorkspace mode="reasons" />;

  if (path === "/pos/shifts/open") return <ShiftWorkspace mode="open" />;
  if (path === "/pos/shifts/opening-cash") return <ShiftWorkspace mode="opening-cash" />;
  if (path === "/pos/shifts/cash-in") return <ShiftWorkspace mode="cash-in" />;
  if (path === "/pos/shifts/cash-out") return <ShiftWorkspace mode="cash-out" />;
  if (path === "/pos/shifts/drawer") return <ShiftWorkspace mode="drawer" />;
  if (path === "/pos/shifts/transfer") return <ShiftWorkspace mode="transfer" />;
  if (path === "/pos/shifts/expenses") return <ShiftWorkspace mode="expenses" />;
  if (path === "/pos/shifts/close") return <ShiftWorkspace mode="close" />;
  if (path === "/pos/shifts/reconcile") return <ShiftWorkspace mode="reconcile" />;

  if (path === "/pos/approvals/discount") return <ApprovalsWorkspace mode="discount" />;
  if (path === "/pos/approvals/price-override") return <ApprovalsWorkspace mode="price-override" />;
  if (path === "/pos/approvals/void") return <ApprovalsWorkspace mode="void" />;
  if (path === "/pos/approvals/refund") return <ApprovalsWorkspace mode="refund" />;
  if (path === "/pos/approvals/return") return <ApprovalsWorkspace mode="return" />;
  if (path === "/pos/approvals/exchange") return <ApprovalsWorkspace mode="exchange" />;
  if (path === "/pos/approvals/credit") return <ApprovalsWorkspace mode="credit" />;
  if (path === "/pos/approvals/cash") return <ApprovalsWorkspace mode="cash" />;

  if (path === "/pos/invoices/receipts") return <InvoicesWorkspace mode="receipts" />;
  if (path === "/pos/invoices/tax") return <InvoicesWorkspace mode="tax" />;
  if (path === "/pos/invoices/quotations") return <InvoicesWorkspace mode="quotations" />;
  if (path === "/pos/invoices/orders") return <InvoicesWorkspace mode="orders" />;
  if (path === "/pos/invoices/credit-notes") return <InvoicesWorkspace mode="credit-notes" />;
  if (path === "/pos/invoices/debit-notes") return <InvoicesWorkspace mode="debit-notes" />;
  if (path === "/pos/invoices/reprint") return <InvoicesWorkspace mode="reprint" />;
  if (path === "/pos/invoices/digital") return <InvoicesWorkspace mode="digital" />;

  if (path === "/pos/reports/cashier") return <ReportsWorkspace mode="cashier" />;
  if (path === "/pos/reports/branch") return <ReportsWorkspace mode="branch" />;
  if (path === "/pos/reports/terminal") return <ReportsWorkspace mode="terminal" />;
  if (path === "/pos/reports/products") return <ReportsWorkspace mode="products" />;
  if (path === "/pos/reports/categories") return <ReportsWorkspace mode="categories" />;
  if (path === "/pos/reports/payments") return <ReportsWorkspace mode="payments" />;
  if (path === "/pos/reports/discounts") return <ReportsWorkspace mode="discounts" />;
  if (path === "/pos/reports/returns") return <ReportsWorkspace mode="returns" />;
  if (path === "/pos/reports/refunds") return <ReportsWorkspace mode="refunds" />;
  if (path === "/pos/reports/voids") return <ReportsWorkspace mode="voids" />;
  if (path === "/pos/reports/shifts") return <ReportsWorkspace mode="shifts" />;
  if (path === "/pos/reports/cash") return <ReportsWorkspace mode="cash" />;
  if (path === "/pos/reports/tax") return <ReportsWorkspace mode="tax" />;
  if (path === "/pos/reports/margin") return <ReportsWorkspace mode="margin" />;

  if (path === "/pos/tax/rates") return <TaxWorkspace mode="rates" />;
  if (path === "/pos/tax/inclusive") return <TaxWorkspace mode="inclusive" />;
  if (path === "/pos/tax/exemptions") return <TaxWorkspace mode="exemptions" />;
  if (path === "/pos/tax/ntn") return <TaxWorkspace mode="ntn" />;
  if (path === "/pos/tax/fbr-invoice") return <TaxWorkspace mode="fbr-invoice" />;
  if (path === "/pos/tax/fbr-submit") return <TaxWorkspace mode="fbr-submit" />;
  if (path === "/pos/tax/fbr-status") return <TaxWorkspace mode="fbr-status" />;
  if (path === "/pos/tax/compliance") return <TaxWorkspace mode="compliance" />;

  if (path === "/pos/devices/barcode") return <DevicesWorkspace mode="barcode" />;
  if (path === "/pos/devices/qr") return <DevicesWorkspace mode="qr" />;
  if (path === "/pos/devices/receipt-printer") return <DevicesWorkspace mode="receipt-printer" />;
  if (path === "/pos/devices/a4-printer") return <DevicesWorkspace mode="a4-printer" />;
  if (path === "/pos/devices/drawer") return <DevicesWorkspace mode="drawer" />;
  if (path === "/pos/devices/customer-display") return <DevicesWorkspace mode="customer-display" />;
  if (path === "/pos/devices/payment-terminal") return <DevicesWorkspace mode="payment-terminal" />;
  if (path === "/pos/devices/status") return <DevicesWorkspace mode="status" />;

  if (path === "/pos/settings/terminal") return <SettingsWorkspace mode="terminal" />;
  if (path === "/pos/settings/receipt") return <SettingsWorkspace mode="receipt" />;
  if (path === "/pos/settings/invoice") return <SettingsWorkspace mode="invoice" />;
  if (path === "/pos/settings/payments") return <SettingsWorkspace mode="payments" />;
  if (path === "/pos/settings/tax") return <SettingsWorkspace mode="tax" />;
  if (path === "/pos/settings/discounts") return <SettingsWorkspace mode="discounts" />;
  if (path === "/pos/settings/returns") return <SettingsWorkspace mode="returns" />;
  if (path === "/pos/settings/credit") return <SettingsWorkspace mode="credit" />;
  if (path === "/pos/settings/shifts") return <SettingsWorkspace mode="shifts" />;
  if (path === "/pos/settings/numbering") return <SettingsWorkspace mode="numbering" />;
  if (path === "/pos/settings/hardware") return <SettingsWorkspace mode="hardware" />;
  if (path === "/pos/settings/offline") return <SettingsWorkspace mode="offline" />;

  if (POS_TERMINAL_PATHS.has(path)) return <PosTerminalPage />;

  const mod = findPosModule(path);
  if (mod && HUB_BY_ID[mod.id]) return HUB_BY_ID[mod.id];
  return <PosOverviewPage />;
}

/** Implemented POS route map for the ERP router. */
export function buildPosImplementedRoutes(): Record<string, ReactNode> {
  const routes: Record<string, ReactNode> = {
    "/pos": <PosCommandCenterRoute />,
  };

  for (const mod of POS_MODULES) {
    routes[mod.path] = HUB_BY_ID[mod.id] ?? <PosOverviewPage />;
    for (const child of mod.children) {
      if (child.path === "/pos") continue;
      routes[child.path] = hubForPath(child.path);
    }
  }

  routes["/pos/shift"] = <ShiftWorkspace mode="dashboard" />;

  return routes;
}
