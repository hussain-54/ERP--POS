import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { POSButton, POSCard, POSPageHeader } from "./design-system";

const REPORT_LINKS = [
  { path: "/invoices", title: "Invoices", description: "Posted sales register and reprints." },
  { path: "/sales-management", title: "Register", description: "Shift, drawer totals, and close-out." },
  { path: "/returns", title: "Returns", description: "Find an invoice and post a return." },
  { path: "/exchange", title: "Exchange", description: "Return items and post a replacement sale." },
  { path: "/payments", title: "Payments", description: "Receipt register and on-account collects." },
  { path: "/pos/references", title: "References", description: "Sale references from posted tickets." },
  { path: "/pos/salesmen", title: "Salesmen", description: "POS salesman roster." },
  { path: "/pos/installments", title: "Installments", description: "Installment plans from live records." },
] as const;

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
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
      <POSCard title="Customer on this terminal" description="Search, create, and assign customers while ringing a sale.">
        <POSButton onClick={() => navigate("/pos")}>Open POS</POSButton>
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
      <POSCard title="Product discovery" description="Barcode, search, favorites, and categories stay on New Sale. This screen does not load the full catalog.">
        <POSButton onClick={() => navigate("/pos")}>Open POS</POSButton>
      </POSCard>
    </HubShell>
  );
}

export function PosReportsPage() {
  const navigate = useNavigate();
  return (
    <HubShell
      title="Reports"
      subtitle="Operational POS registers. Each link opens an existing live screen."
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_LINKS.map((item) => (
          <POSCard key={item.path} title={item.title} description={item.description}>
            <POSButton variant="secondary" size="sm" onClick={() => navigate(item.path)}>
              Open
            </POSButton>
          </POSCard>
        ))}
      </div>
    </HubShell>
  );
}
