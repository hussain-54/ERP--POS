import { Link } from "react-router-dom";
import { Button, SearchInput } from "@electronic-erp/ui";
import { APP_MARK, APP_NAME } from "@/branding";
import { SidebarNav } from "@/app/shell/SidebarNav";

export function GlobalSidebar({
  compact,
  overlayNav,
  mobileOpen,
  query,
  onQueryChange,
  onClose,
  onToggleCollapsed,
  grantedCount,
  hasPermission,
}: {
  compact: boolean;
  overlayNav: boolean;
  mobileOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onToggleCollapsed: () => void;
  grantedCount: number;
  hasPermission: (key: string) => boolean;
}) {
  return (
    <aside
      id="erp-module-nav"
      data-erp-chrome="sidebar"
      aria-label="ERP navigation"
      aria-hidden={overlayNav && !mobileOpen}
      aria-modal={overlayNav && mobileOpen ? true : undefined}
      role={overlayNav && mobileOpen ? "dialog" : undefined}
      className={`fixed inset-y-0 left-0 z-40 flex w-[min(20rem,calc(100vw-2.75rem))] max-w-full flex-col border-r border-[var(--erp-border)] bg-[var(--erp-surface)] transition-transform duration-200 ease-out md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full invisible md:visible"
      } ${overlayNav && !mobileOpen ? "pointer-events-none" : ""}`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--erp-border)] px-3">
        <Link to="/command-center" className="flex min-w-0 items-center gap-2" onClick={onClose}>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--erp-brand)] text-[10px] font-bold tracking-tight text-white">
            {APP_MARK}
          </span>
          {compact ? (
            <span className="sr-only">{APP_NAME}</span>
          ) : (
            <span className="min-w-0 text-sm font-semibold leading-snug text-[var(--erp-ink)]">{APP_NAME}</span>
          )}
        </Link>
        <div className="flex items-center gap-1">
          <Button
            className="hidden min-h-11 min-w-11 md:inline-flex lg:min-h-9 lg:min-w-9"
            variant="ghost"
            size="sm"
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
          >
            {compact ? "»" : "«"}
          </Button>
          <Button
            id="erp-nav-close"
            className="min-h-11 min-w-11 md:hidden"
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
      {!compact ? (
        <div className="shrink-0 border-b border-[var(--erp-border)] px-3 py-2">
          <SearchInput
            placeholder="Filter modules…"
            aria-label="Filter modules"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="h-11"
          />
        </div>
      ) : null}
      <SidebarNav
        query={compact ? "" : query}
        onNavigate={onClose}
        collapsed={compact}
        grantedCount={grantedCount}
        hasPermission={hasPermission}
        touchTargets={overlayNav || mobileOpen}
      />
    </aside>
  );
}

export function GlobalSidebarBackdrop({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="fixed inset-0 z-30 bg-black/30 md:hidden"
      aria-label="Close navigation"
      onClick={onClose}
    />
  );
}
