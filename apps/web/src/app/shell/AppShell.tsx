import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { CommandPalette } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import {
  canShowNavItem,
  ERP_NAV_SECTIONS,
  isCommandPaletteChild,
  isPosEnvironmentPath,
  isSystemAdminPath,
  requiredPermissionForPath,
  resolveShellHeader,
} from "@/app/modules";
import { GlobalHeader } from "@/app/shell/GlobalHeader";
import { GlobalSidebar, GlobalSidebarBackdrop } from "@/app/shell/GlobalSidebar";
import { ModuleWorkspace } from "@/app/shell/ModuleWorkspace";
import { useViewportMode } from "@/app/shell/viewport";
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
  const mode = useViewportMode();

  const overlayNav = mode === "mobile";
  const compact = collapsed && !mobileOpen;
  const fillWorkspace = isPosEnvironmentPath(location.pathname) || isSystemAdminPath(location.pathname);
  const required = requiredPermissionForPath(location.pathname);
  const forbidden =
    Boolean(required) && grantedCount > 0 && !canShowNavItem(required, grantedCount, hasPermission);
  const header = resolveShellHeader(location.pathname);

  const commandItems = useMemo(() => {
    const items: Array<{ id: string; label: string; group: string; onSelect: () => void }> = [];
    for (const row of ERP_NAV_SECTIONS) {
      if (!canShowNavItem(row.permission, grantedCount, hasPermission)) continue;
      items.push({
        id: `parent:${row.path}`,
        label: row.masterTitle,
        group: row.masterTitle,
        onSelect: () => navigate(row.path),
      });
      for (const child of row.children) {
        if (!isCommandPaletteChild(row, child)) continue;
        if (!canShowNavItem(child.permission, grantedCount, hasPermission)) continue;
        items.push({
          id: `${child.path}:${child.title}`,
          label: child.title,
          group: row.masterTitle,
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

  useEffect(() => {
    if (isPosEnvironmentPath(location.pathname)) {
      setCollapsed(true);
      return;
    }
    setCollapsed(mode === "tablet");
  }, [location.pathname, mode]);

  useEffect(() => {
    function onPosToggleErpNav() {
      if (isPosEnvironmentPath(location.pathname)) {
        setMobileOpen(true);
        return;
      }
      if (overlayNav) setMobileOpen(true);
      else setCollapsed((value) => !value);
    }
    window.addEventListener("pos:toggle-erp-nav", onPosToggleErpNav);
    return () => window.removeEventListener("pos:toggle-erp-nav", onPosToggleErpNav);
  }, [overlayNav, location.pathname]);

  function closeDrawer() {
    setMobileOpen(false);
  }

  const navMode = overlayNav ? (mobileOpen ? "drawer-open" : "drawer") : compact ? "collapsed" : "expanded";
  const posChrome = isPosEnvironmentPath(location.pathname);

  return (
    <div
      data-erp-viewport={mode}
      data-erp-nav={navMode}
      className={`${fillWorkspace ? "h-screen overflow-hidden" : "min-h-screen"} erp-app max-w-full overflow-x-hidden bg-[var(--erp-bg)] text-[var(--erp-ink)] md:grid ${
        collapsed
          ? "md:grid-cols-[72px_minmax(0,1fr)]"
          : "md:grid-cols-[280px_minmax(0,1fr)]"
      }`}
    >
      <GlobalSidebarBackdrop visible={mobileOpen} onClose={closeDrawer} />
      <GlobalSidebar
        compact={compact}
        overlayNav={overlayNav || (posChrome && mobileOpen)}
        mobileOpen={mobileOpen}
        query={query}
        onQueryChange={setQuery}
        onClose={closeDrawer}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        grantedCount={grantedCount}
        hasPermission={hasPermission}
      />

      <div className={`flex min-w-0 max-w-full flex-col ${fillWorkspace ? "h-full min-h-0 overflow-hidden" : ""}`}>
        {posChrome ? null : (
          <GlobalHeader
          compact={mode === "mobile"}
          moduleTitle={header.moduleTitle}
          pageTitle={header.pageTitle}
          mobileOpen={mobileOpen}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenSearch={() => setCommandOpen(true)}
          branchId={branchId}
          branches={branches}
          onBranchChange={setBranchId}
          userName={user?.fullName ?? "User"}
          showAudit={hasPermission("audit.view")}
          onLogout={() => {
            void logout();
          }}
        />
        )}

        <main
          className={
            fillWorkspace
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "flex min-w-0 flex-1 flex-col"
          }
        >
          {forbidden ? (
            <UnauthorizedPage />
          ) : (
            <ModuleWorkspace>
              <Outlet />
            </ModuleWorkspace>
          )}
        </main>
      </div>

      <CommandPalette open={commandOpen} items={commandItems} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
