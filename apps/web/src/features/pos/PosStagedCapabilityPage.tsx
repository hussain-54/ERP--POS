import { Link, useLocation } from "react-router-dom";
import { POSBreadcrumb, POSButton, POSCard, POSPageHeader } from "./design-system";
import { POS_OWNERSHIP, type PosOwnershipItem } from "./pos-ownership";

function itemForPath(pathname: string): PosOwnershipItem | undefined {
  return (
    POS_OWNERSHIP.find((item) => item.canonical === pathname) ??
    POS_OWNERSHIP.find((item) => item.aliases.includes(pathname))
  );
}

/**
 * Honest staging screen for POS children that are not yet safely implementable.
 * No fake transactions, stock, payments, or invoices.
 */
export function PosStagedCapabilityPage() {
  const { pathname } = useLocation();
  const item = itemForPath(pathname);
  const title = item?.title ?? "POS capability";
  const note = item?.note ?? "This capability is staged and not available for live posting.";
  const backend = item?.backend ?? "Not connected";
  const related = item?.availableOn;

  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb items={[{ label: "Home", to: "/" }, { label: "POS / Sales", to: "/pos" }, { label: title }]} />
      <POSPageHeader
        title={title}
        subtitle="Staged capability — not live. Existing sales posting was not changed."
      />
      <POSCard padding="sm" title="Not available for production use" description={note}>
        <p className="text-sm text-[var(--pos-muted)]">
          <span className="font-medium text-[var(--pos-ink)]">Dependency: </span>
          {backend}
        </p>
        <p className="mt-2 text-sm text-[var(--pos-muted)]">
          No mock sales, stock movements, payments, or invoices are created from this screen.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <POSButton size="sm" variant="secondary" onClick={() => undefined} disabled title="Not implemented">
            Not available
          </POSButton>
          {related ? (
            <Link to={related}>
              <POSButton size="sm">Open related live screen</POSButton>
            </Link>
          ) : (
            <Link to="/pos">
              <POSButton size="sm">Open POS Terminal</POSButton>
            </Link>
          )}
        </div>
      </POSCard>
    </div>
  );
}
