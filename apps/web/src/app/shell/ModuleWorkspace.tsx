import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { canShowNavItem, isSystemAdminPath } from "@/app/modules";
import { ModuleContextNav } from "@/app/shell/ModuleContextNav";
import { ModuleHeader } from "@/app/shell/ModuleHeader";
import { filterWorkspaceNav, resolveModuleWorkspace } from "@/app/shell/module-workspace";
import { PageContainer } from "@/app/shell/PageContainer";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Shared module frame inside the ERP AppShell.
 * Every major module uses this header + context nav + content pattern.
 */
export function ModuleWorkspace({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { hasPermission, permissions } = useAuth();
  const [query, setQuery] = useState("");
  const grantedCount = permissions.length;
  const model = resolveModuleWorkspace(pathname);
  const dense = isSystemAdminPath(pathname);

  const nav = useMemo(() => {
    if (!model) return [];
    return filterWorkspaceNav(query, model.nav).filter((item) =>
      canShowNavItem(item.permission, grantedCount, hasPermission),
    );
  }, [grantedCount, hasPermission, model, query]);

  if (!model) {
    return <PageContainer fill={dense}>{children}</PageContainer>;
  }

  return (
    <PageContainer fill>
      <section
        data-module-workspace={model.id}
        data-erp-workspace-layout="stacked"
        className={
          dense
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--erp-bg)]"
            : "flex min-w-0 flex-1 flex-col bg-[var(--erp-bg)]"
        }
      >
        <ModuleHeader model={model} query={query} onQueryChange={setQuery} />
        <ModuleContextNav model={model} items={nav} pathname={pathname} />
        <div
          className={
            dense
              ? "min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-5"
              : "min-w-0 flex-1 overflow-x-auto px-3 py-3 md:px-5 md:py-4"
          }
        >
          {children}
        </div>
      </section>
    </PageContainer>
  );
}
