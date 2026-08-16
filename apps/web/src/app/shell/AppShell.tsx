import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, CommandPalette, Dropdown, SearchInput, Select } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import {
  canShowNavItem,
  ERP_NAV_SECTIONS,
  isCommandPaletteChild,
  isPosTerminalPath,
  isSystemAdminPath,
  requiredPermissionForPath,
  resolveShellHeader,
} from "@/app/modules";
import { SidebarNav } from "@/app/shell/SidebarNav";
import { UnauthorizedPage } from "@/features/modules/RouteFallbackPage";

function useViewportMode() {
  const [mode, setMode] = useState<"mobile" | "tablet" | "desktop">("desktop");

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mobile = window.matchMedia("(max-width: 767.98px)");
    const tablet = window.matchMedia("(min-width: 768px) and (max-width: 1023.98px)");
    const apply = () => {
      if (mobile.matches) setMode("mobile");
      else if (tablet.matches) setMode("tablet");
      else setMode("desktop");
    };
    apply();
    mobile.addEventListener("change", apply);
    tablet.addEventListener("change", apply);
    return () => {
      mobile.removeEventListener("change", apply);
      tablet.removeEventListener("change", apply);
    };
  }, []);

  return mode;
}

export function AppShell() {
  const { user, branchId, branches, setBranchId, logout, hasPermission, permissions } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const grantedCount = permissions.length;
  const mode = useViewportMode();

  const overlayNav = mode === "mobile";
  const compact = collapsed && !mobileOpen;
  const isPosTerminal = isPosTerminalPath(location.pathname);
  const isSystemAdmin = isSystemAdminPath(location.pathname);
  const fillWorkspace = isPosTerminal || isSystemAdmin;
  const required = requiredPermissionForPath(location.pathname);
  const forbidden =
    Boolean(required) && grantedCount > 0 && !canShowNavItem(required, grantedCount, hasPermission);
  const header = resolveShellHeader(location.pathname);

  const commandItems = useMemo(() => {
    const items: Array<{ id: string; label: string; group: string; onSelect: () => void }> = [];
    for (const section of ERP_NAV_SECTIONS) {
      if (!canShowNavItem(section.permission, grantedCount, hasPermission)) continue;
      items.push({
        id: `parent:${section.path}`,
        label: section.masterTitle,
        group: section.masterTitle,
        onSelect: () => navigate(section.path),
      });
      for (const child of section.children) {
        if (!isCommandPaletteChild(section, child)) continue;
        if (!canShowNavItem(child.permission, grantedCount, hasPermission)) continue;
        items.push({
          id: `${child.path}:${child.title}`,
          label: child.title,
          group: section.masterTitle,
          onSelect: () => navigate(child.path),
        });
      }
    }
    return items;
  }, [navigate, grantedCount, hasPermission]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setCollapsed(mode === "tablet");
  }, [mode]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.getElementById("erp-nav-close")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        document.getElementById("erp-nav-menu")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  function closeDrawer() {
    setMobileOpen(false);
  }

  const palette = (
    <CommandPalette open={commandOpen} items={commandItems} onClose={() => setCommandOpen(false)} />
  );

  return (
    <div
      className={`${fillWorkspace ? "h-screen overflow-hidden" : "min-h-screen"} max-w-full overflow-x-hidden bg-[var(--erp-bg)] md:grid ${
        collapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[280px_minmax(0,1fr)]"
      }`}
    >
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-label="Close navigation"
          onClick={closeDrawer}
        />
      ) : null}

      <aside
        id="erp-module-nav"
        aria-label="ERP navigation"
        aria-hidden={overlayNav && !mobileOpen}
        aria-modal={overlayNav && mobileOpen ? true : undefined}
        role={overlayNav && mobileOpen ? "dialog" : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(20rem,calc(100vw-2.75rem))] max-w-full flex-col border-r border-[var(--erp-border)] bg-white transition-transform duration-200 ease-out md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full invisible md:visible"
        } ${overlayNav && !mobileOpen ? "pointer-events-none" : ""}`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--erp-border)] px-3">
          <Link to="/" className="flex min-w-0 items-center gap-2" onClick={closeDrawer}>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--erp-brand)] text-sm font-bold text-white">
              E
            </span>
            {compact ? (
              <span className="sr-only">Electronic ERP</span>
            ) : (
              <span className="min-w-0 text-sm font-semibold leading-snug text-[var(--erp-ink)]">
                Electronic ERP
              </span>
            )}
          </Link>
          <div className="flex items-center gap-1">
            <Button
              className="hidden min-h-11 min-w-11 md:inline-flex lg:min-h-9 lg:min-w-9"
              variant="ghost"
              size="sm"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? "»" : "«"}
            </Button>
            <Button
              id="erp-nav-close"
              className="min-h-11 min-w-11 md:hidden"
              variant="ghost"
              size="sm"
              onClick={closeDrawer}
            >
              Close
            </Button>
          </div>
        </div>
        {!compact ? (
          <div className="shrink-0 border-b border-[var(--erp-border)] px-3 py-2">
            <SearchInput
              placeholder="Filter modules…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : null}
        <SidebarNav
          query={compact ? "" : query}
          onNavigate={closeDrawer}
          collapsed={compact}
          grantedCount={grantedCount}
          hasPermission={hasPermission}
        />
      </aside>

      <div className={`flex min-w-0 max-w-full flex-col ${fillWorkspace ? "h-full min-h-0 overflow-hidden" : ""}`}>
        <header className="sticky top-0 z-20 flex min-h-14 min-w-0 flex-wrap items-center gap-2 overflow-x-hidden border-b border-[var(--erp-border)] bg-white px-3 py-2 md:px-5">
          <Button
            id="erp-nav-menu"
            className="min-h-11 min-w-11 md:hidden"
            variant="secondary"
            size="sm"
            aria-expanded={mobileOpen}
            aria-controls="erp-module-nav"
            onClick={() => setMobileOpen(true)}
          >
            Menu
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-[var(--erp-muted)]">
              Electronic ERP / {header.moduleTitle}
            </div>
            <div className="truncate text-sm font-semibold text-[var(--erp-ink)]">
              {header.pageTitle ?? "Workspace"}
            </div>
          </div>
          {isPosTerminal ? (
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-lg border border-[var(--erp-border)] bg-white px-3 text-sm font-medium text-[var(--erp-brand)] hover:bg-[var(--erp-brand-soft)] md:h-9"
            >
              ERP Home
            </Link>
          ) : null}
          <button
            type="button"
            className="hidden h-9 min-w-[180px] items-center justify-between rounded-lg border border-[var(--erp-border)] bg-[var(--erp-bg)] px-3 text-left text-sm text-[var(--erp-muted)] hover:border-[var(--erp-brand)] md:flex"
            onClick={() => setCommandOpen(true)}
          >
            <span>Search modules…</span>
            <kbd className="rounded border border-[var(--erp-border)] bg-white px-1.5 text-[10px] text-[var(--erp-muted)]">
              Ctrl K
            </kbd>
          </button>
          <Button className="min-h-11 md:hidden" variant="secondary" size="sm" onClick={() => setCommandOpen(true)}>
            Search
          </Button>
          {isPosTerminal ? null : (
            <div className="min-w-0 max-w-full sm:w-[9.5rem]">
              <Select
                aria-label="Branch"
                value={branchId ?? ""}
                onChange={(e) => setBranchId(e.target.value)}
                options={
                  branches.length
                    ? branches.map((id) => ({ value: id, label: `Branch ${id.slice(0, 8)}` }))
                    : [{ value: "", label: "No branches" }]
                }
              />
            </div>
          )}
          <Link
            to="/notifications"
            className="inline-flex h-11 items-center rounded-lg border border-[var(--erp-border)] bg-white px-3 text-sm text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] md:h-9"
          >
            Notifications
          </Link>
          {hasPermission("audit.view") ? (
            <Link
              to="/audit"
              className="hidden h-9 items-center rounded-lg border border-[var(--erp-border)] bg-white px-3 text-sm text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] sm:inline-flex"
            >
              Audit
            </Link>
          ) : null}
          <Dropdown
            trigger={
              <Button variant="secondary" size="sm" className="min-h-11 md:min-h-9">
                {user?.fullName ?? "User"}
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
                onSelect: () => {
                  void logout();
                },
              },
            ]}
          />
        </header>

        <main
          className={
            fillWorkspace
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "min-w-0 flex-1 px-3 py-4 md:px-6 md:py-6"
          }
        >
          {forbidden ? <UnauthorizedPage /> : <Outlet />}
        </main>
      </div>

      {palette}
    </div>
  );
}
