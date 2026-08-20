import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { POSBreadcrumb, POSButton, POSCard, POSPageHeader } from "./design-system";
import { POS_OWNERSHIP } from "./pos-ownership";

const POS_HUB_DESCRIPTIONS: Record<string, string> = {
  "/pos": "Ring a sale on this terminal.",
  "/held-sales": "Parked tickets and resume.",
  "/invoices": "Posted sales register and reprints.",
  "/sales-management": "Shift, drawer totals, and close-out.",
  "/returns": "Find an invoice and post a return.",
  "/exchange": "Return items and post a replacement sale.",
  "/payments": "Receipt register and on-account collects.",
  "/discounts": "POS discount policy and approvals.",
  "/pos/references": "Sale references from posted tickets.",
  "/pos/salesmen": "POS salesman roster.",
  "/pos/installments": "Installment plans from live records.",
  "/pos/settings": "POS terminal, hardware, and tenders.",
};

export const POS_REPORT_LINKS = POS_OWNERSHIP.map((item) => ({
  path: item.canonical,
  title: item.title,
  description: POS_HUB_DESCRIPTIONS[item.canonical] ?? item.note,
}));

function HubShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb items={[{ label: "Home", to: "/" }, { label: title }]} />
      <POSPageHeader title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}

export function PosCustomersPage() {
  const navigate = useNavigate();
  return (
    <HubShell
      title="Customers"
      subtitle="Customer lookup and walk-in stay on the POS terminal. The ERP Customers module is unchanged."
    >
      <POSCard
        padding="sm"
        title="Customer on this terminal"
        description="Search, create, and assign customers while ringing a sale. This hub does not load the ERP customer master."
      >
        <POSButton size="sm" onClick={() => navigate("/pos")}>
          Open POS
        </POSButton>
      </POSCard>
    </HubShell>
  );
}

export function PosProductsPage() {
  const navigate = useNavigate();
  return (
    <HubShell
      title="Products"
      subtitle="Scan and search products on the POS terminal. Product Management remains the catalog master."
    >
      <POSCard
        padding="sm"
        title="Product discovery"
        description="Barcode, search, favorites, and categories stay on New Sale. This screen does not load the full catalog."
      >
        <div className="flex flex-wrap gap-2">
          <POSButton size="sm" onClick={() => navigate("/pos")}>
            Open POS
          </POSButton>
          <POSButton size="sm" variant="secondary" onClick={() => navigate("/products/new")}>
            Create product
          </POSButton>
        </div>
      </POSCard>
    </HubShell>
  );
}

export function PosReportsPage() {
  const navigate = useNavigate();
  return (
    <HubShell
      title="Reports"
      subtitle="Operational POS registers. Each link opens an existing live screen — not a second ERP reports module."
    >
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {POS_REPORT_LINKS.map((item) => (
          <POSCard key={item.path} padding="sm" title={item.title} description={item.description}>
            <POSButton variant="secondary" size="sm" onClick={() => navigate(item.path)}>
              Open
            </POSButton>
          </POSCard>
        ))}
      </div>
    </HubShell>
  );
}
