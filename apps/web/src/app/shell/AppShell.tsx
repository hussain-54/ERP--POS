import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  CommandPalette,
  Dropdown,
  SearchInput,
  Select,
} from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import {
  canShowNavItem,
  ERP_MODULES,
  findSectionForPath,
  findModuleByPath,
  isPosTerminalPath,
  requiredPermissionForPath,
} from "@/app/modules";
import { SidebarNav } from "@/app/shell/SidebarNav";
import { UnauthorizedPage } from "@/features/modules/RouteFallbackPage";

export function AppShell() {
  const { user, branchId, branches, setBranchId, logout, hasPermission, permissions } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const grantedCount = permissions.length;

  const compact = collapsed && !mobileOpen;
  const isPosTerminal = isPosTerminalPath(location.pathname);
  const required = requiredPermissionForPath(location.pathname);
  const forbidden =
    Boolean(required) && grantedCount > 0 && !canShowNavItem(required, grantedCount, hasPermission);

  const crumbs = useMemo(() => {
    const section = findSectionForPath(location.pathname);
    const item = findModuleByPath(location.pathname);
    if (section && item && item.title !== section.title) {
      return [section.title, item.title];
    }
    if (section) return [section.title];
    return item ? [item.group, item.title] : ["App"];
  }, [location.pathname]);

  const commandItems = useMemo(
    () =>
      ERP_MODULES.filter(
        (m) =>
          m.sidebar !== false && canShowNavItem(m.permission, grantedCount, hasPermission),
      ).map((m) => ({
        id: `${m.path}:${m.title}`,
        label: m.title,
        group: m.group,
        onSelect: () => navigate(m.path),
      })),
    [navigate, grantedCount, hasPermission],
  );

  if (isPosTerminal && !forbidden) {
    return (
      <div className="min-h-screen bg-[var(--erp-bg)]">
        <Outlet />
        <CommandPalette open={commandOpen} items={commandItems} onClose={() => setCommandOpen(false)} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen lg:grid ${collapsed ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[280px_1fr]"}`}>
      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-[var(--erp-border)] bg-white/95 backdrop-blur transition lg:static ${
          collapsed ? "w-[280px] lg:w-[72px]" : "w-[280px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-16 items-center justify-between gap-1 px-3">
          <Link to="/" className="truncate text-lg font-semibold text-[var(--erp-brand)]">
            {compact ? "E" : "Electronic ERP"}
          </Link>
          <div className="flex items-center gap-1">
            <Button
              className="hidden lg:inline-flex"
              variant="ghost"
              size="sm"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? "»" : "«"}
            </Button>
            <Button className="lg:hidden" variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
              Close
            </Button>
          </div>
        </div>
        {!compact ? (
          <div className="px-3 pb-3">
            <SearchInput
              placeholder="Filter modules…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : null}
        <SidebarNav
          query={compact ? "" : query}
          onNavigate={() => setMobileOpen(false)}
          collapsed={compact}
          grantedCount={grantedCount}
          hasPermission={hasPermission}
        />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--erp-border)] bg-white/90 px-3 backdrop-blur md:px-5">
          <Button className="lg:hidden" variant="secondary" size="sm" onClick={() => setMobileOpen(true)}>
            Menu
          </Button>
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="truncate text-xs text-[var(--erp-muted)]">{crumbs.join(" / ")}</div>
            <div className="truncate text-sm font-medium">Organization workspace</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCommandOpen(true)}>
              Search
            </Button>
            <div className="w-40">
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
            <Badge tone="neutral">Alerts</Badge>
            {hasPermission("audit.view") ? <Badge tone="brand">Audit</Badge> : null}
            <Dropdown
              trigger={
                <Button variant="secondary" size="sm">
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
          </div>
        </header>

        <main className="px-3 py-4 md:px-6 md:py-6">{forbidden ? <UnauthorizedPage /> : <Outlet />}</main>
      </div>

      <CommandPalette open={commandOpen} items={commandItems} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
