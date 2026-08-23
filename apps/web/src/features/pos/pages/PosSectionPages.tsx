import { POS_MODULES } from "../ownership";
import { PosHubPage } from "./PosHubPage";
import { HeldSalesRegister } from "../sales/HeldSalesRegister";
import { PosDiscountPage } from "./PosDiscountPage";

function sectionById(id: string) {
  const section = POS_MODULES.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown POS section: ${id}`);
  return section;
}

function Hub({ id }: { id: string }) {
  return <PosHubPage section={sectionById(id)} />;
}

export function PosOverviewPage() {
  return <Hub id="overview" />;
}

export function PosSalesHubPage() {
  return <Hub id="sales" />;
}

export function PosCustomersHubPage() {
  return <Hub id="customers" />;
}

export function PosProductsHubPage() {
  return <Hub id="products" />;
}

export function PosPricingHubPage() {
  return <Hub id="pricing" />;
}

export function PosPaymentsHubPage() {
  return <Hub id="payments" />;
}

export function PosInvoicesHubPage() {
  return <Hub id="invoices" />;
}

export function PosReturnsHubPage() {
  return <Hub id="returns" />;
}

export function PosShiftHubPage() {
  return <Hub id="shift" />;
}

export function PosApprovalsHubPage() {
  return <Hub id="approvals" />;
}

export function PosReportsHubPage() {
  return <Hub id="reports" />;
}

export function PosTaxHubPage() {
  return <Hub id="tax" />;
}

export function PosOfflineHubPage() {
  return <Hub id="offline" />;
}

export function PosDevicesHubPage() {
  return <Hub id="devices" />;
}

export function PosSettingsPage() {
  return <Hub id="settings" />;
}

export function PosHeldSalesPage() {
  return <HeldSalesRegister />;
}

export { PosDiscountPage };
