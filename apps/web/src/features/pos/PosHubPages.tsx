import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { POSBadge, POSBreadcrumb, POSButton, POSCard, POSPageHeader } from "./design-system";
import { POS_REFERENCE_IA } from "./pos-reference-ia";

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

function statusTone(status: string): "primary" | "success" | "warning" | "neutral" {
  if (status === "live") return "success";
  if (status === "terminal") return "primary";
  if (status === "shared") return "neutral";
  return "warning";
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

/** Reference Reports hub — 15-section POS map → live routes only. */
export function PosReportsPage() {
  const navigate = useNavigate();
  return (
    <HubShell
      title="Reports"
      subtitle="POS reference map (15 sections). Links open existing screens — no invented report engines."
    >
      <div className="space-y-4">
        {POS_REFERENCE_IA.map((section) => (
          <POSCard
            key={section.id}
            padding="sm"
            title={`${section.id}. ${section.title}`}
            description={`${section.links.length} destinations`}
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.links.map((link) => (
                <button
                  key={`${section.id}-${link.label}-${link.path}`}
                  type="button"
                  className="flex flex-col items-start gap-1 rounded-[var(--pos-radius)] border border-[var(--pos-border)] bg-[var(--pos-bg)] px-3 py-2 text-left hover:border-[var(--pos-primary)]"
                  onClick={() => navigate(link.path)}
                  title={link.note}
                >
                  <span className="text-xs font-semibold text-[var(--pos-ink)]">{link.label}</span>
                  <span className="flex items-center gap-2">
                    <POSBadge tone={statusTone(link.status)}>{link.status}</POSBadge>
                    <span className="truncate font-mono text-[10px] text-[var(--pos-muted)]">{link.path}</span>
                  </span>
                  {link.note ? <span className="text-[10px] text-[var(--pos-muted)]">{link.note}</span> : null}
                </button>
              ))}
            </div>
          </POSCard>
        ))}
      </div>
    </HubShell>
  );
}
