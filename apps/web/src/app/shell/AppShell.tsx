import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  CommandPalette,
  Dropdown,
  SearchInput,
  Select,
} from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { ERP_MODULES } from "@/app/modules";

export function AppShell() {
  const { user, branchId, branches, setBranchId, logout, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ERP_MODULES;
    return ERP_MODULES.filter(
      (m) => m.title.toLowerCase().includes(q) || m.group.toLowerCase().includes(q),
    );
  }, [query]);

  const crumbs = useMemo(() => {
    const mod = ERP_MODULES.find((m) => m.path === location.pathname);
    return mod ? [mod.group, mod.title] : ["App"];
  }, [location.pathname]);

  const commandItems = ERP_MODULES.map((m) => ({
    id: m.path,
    label: m.title,
    group: m.group,
    onSelect: () => navigate(m.path),
  }));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[280px] border-r border-[var(--erp-border)] bg-white/95 backdrop-blur transition lg:static ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="text-lg font-semibold text-[var(--erp-brand)]">
            Electronic ERP
          </Link>
          <Button className="lg:hidden" variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
            Close
          </Button>
        </div>
        <div className="px-3 pb-3">
          <SearchInput
            placeholder="Filter modules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <nav className="h-[calc(100vh-8rem)] space-y-1 overflow-auto px-2 pb-6">
          {filteredNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2 text-sm ${
                  isActive
                    ? "bg-[var(--erp-brand)] text-white"
                    : "text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
                }`
              }
            >
              <div className="font-medium">{item.title}</div>
              <div className="text-xs opacity-80">{item.group}</div>
            </NavLink>
          ))}
        </nav>
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

        <main className="px-3 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={commandOpen} items={commandItems} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
