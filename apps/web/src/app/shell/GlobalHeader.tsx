import { Link, useNavigate } from "react-router-dom";
import { Button, Dropdown, Select } from "@electronic-erp/ui";
import { Breadcrumbs } from "@/app/shell/Breadcrumbs";

export function GlobalHeader({
  compact,
  moduleTitle,
  pageTitle,
  mobileOpen,
  onOpenMobileNav,
  onOpenSearch,
  branchId,
  branches,
  onBranchChange,
  userName,
  showAudit,
  onLogout,
}: {
  compact?: boolean;
  moduleTitle: string;
  pageTitle: string | null;
  mobileOpen: boolean;
  onOpenMobileNav: () => void;
  onOpenSearch: () => void;
  branchId: string | null;
  branches: string[];
  onBranchChange: (id: string) => void;
  userName: string;
  showAudit: boolean;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  return (
    <header
      data-erp-chrome="header"
      className={`sticky top-0 z-20 flex min-h-14 min-w-0 items-center gap-1.5 overflow-x-auto border-b border-[var(--erp-border)] bg-[var(--erp-surface)] px-2 py-1.5 md:overflow-x-hidden md:px-5 md:py-2 lg:gap-2 ${
        compact ? "flex-nowrap" : "flex-wrap md:flex-nowrap"
      }`}
    >
      <Button
        id="erp-nav-menu"
        className="min-h-11 min-w-11 shrink-0 md:hidden"
        variant="secondary"
        size="sm"
        aria-expanded={mobileOpen}
        aria-controls="erp-module-nav"
        onClick={onOpenMobileNav}
      >
        Menu
      </Button>
      <Breadcrumbs moduleTitle={moduleTitle} pageTitle={pageTitle} />
      <button
        type="button"
        className="hidden min-h-11 min-w-[180px] items-center justify-between rounded-lg border border-[var(--erp-border)] bg-[var(--erp-bg)] px-3 text-left text-sm text-[var(--erp-muted)] hover:border-[var(--erp-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:border-[var(--erp-brand)] md:flex lg:h-9 lg:min-h-9"
        onClick={onOpenSearch}
      >
        <span>Search modules…</span>
        <kbd className="hidden rounded border border-[var(--erp-border)] bg-white px-1.5 text-[10px] text-[var(--erp-muted)] lg:inline">
          Ctrl K
        </kbd>
      </button>
      <Button className="min-h-11 shrink-0 md:hidden" variant="secondary" size="sm" onClick={onOpenSearch}>
        Search
      </Button>
      <div className="w-[7.5rem] shrink-0 sm:w-[9.5rem]">
        <Select
          aria-label="Branch"
          className="min-h-11 lg:min-h-9 lg:h-9"
          value={branchId ?? ""}
          onChange={(e) => onBranchChange(e.target.value)}
          options={
            branches.length
              ? branches.map((id) => ({ value: id, label: `Branch ${id.slice(0, 8)}` }))
              : [{ value: "", label: "No branches" }]
          }
        />
      </div>
      <Link
        to="/notifications"
        aria-label="Notifications"
        className="inline-flex h-11 min-h-11 shrink-0 items-center rounded-lg border border-[var(--erp-border)] bg-white px-3 text-sm text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:bg-[var(--erp-bg)] lg:h-9 lg:min-h-9"
      >
        <span className="md:hidden">Alerts</span>
        <span className="hidden md:inline">Notifications</span>
      </Link>
      {showAudit ? (
        <Link
          to="/audit"
          className="hidden h-11 min-h-11 items-center rounded-lg border border-[var(--erp-border)] bg-white px-3 text-sm text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:bg-[var(--erp-bg)] sm:inline-flex lg:h-9 lg:min-h-9"
        >
          Audit
        </Link>
      ) : null}
      <Dropdown
        trigger={
          <Button variant="secondary" size="sm" className="min-h-11 max-w-[9rem] truncate lg:min-h-9" aria-label="User">
            {userName}
          </Button>
        }
        items={[
          {
            id: "profile",
            label: "Profile",
            onSelect: () => navigate("/settings"),
          },
          {
            id: "logout",
            label: "Sign out",
            danger: true,
            onSelect: onLogout,
          },
        ]}
      />
    </header>
  );
}
