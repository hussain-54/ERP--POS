import { POS_SECTIONS } from "../ownership";
import { PosHubPage } from "./PosHubPage";

function sectionById(id: string) {
  return POS_SECTIONS.find((s) => s.id === id)!;
}

export function PosOverviewPage() {
  return <PosHubPage section={sectionById("overview")} />;
}

export function PosSalesHubPage() {
  return <PosHubPage section={sectionById("sales")} />;
}

export function PosCustomersHubPage() {
  return <PosHubPage section={sectionById("customers")} />;
}

export function PosProductsHubPage() {
  return <PosHubPage section={sectionById("products")} />;
}

export function PosPricingHubPage() {
  return <PosHubPage section={sectionById("pricing")} />;
}

export function PosPaymentsHubPage() {
  return <PosHubPage section={sectionById("payments")} />;
}

export function PosInvoicesHubPage() {
  return <PosHubPage section={sectionById("invoices")} />;
}

export function PosReturnsHubPage() {
  return <PosHubPage section={sectionById("returns")} />;
}

export function PosShiftHubPage() {
  return <PosHubPage section={sectionById("shift")} />;
}

export function PosApprovalsHubPage() {
  return <PosHubPage section={sectionById("approvals")} />;
}

export function PosReportsHubPage() {
  return <PosHubPage section={sectionById("reports")} />;
}

export function PosTaxHubPage() {
  return <PosHubPage section={sectionById("tax")} />;
}

export function PosOfflineHubPage() {
  return <PosHubPage section={sectionById("offline")} />;
}

export function PosDevicesHubPage() {
  return <PosHubPage section={sectionById("devices")} />;
}

export function PosSettingsPage() {
  return <PosHubPage section={sectionById("settings")} />;
}

export function PosHeldSalesPage() {
  return <PosHubPage section={sectionById("sales")} />;
}
