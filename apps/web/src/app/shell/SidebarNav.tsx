import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  canShowNavItem,
  ERP_SIDEBAR_SECTIONS,
  isComingSoonEngineSection,
  isPosTerminalPath,
  type ErpNavSection,
} from "@/app/modules";
import { NavIcon } from "@/app/shell/nav-icons";

function sectionMatches(section: ErpNavSection, query: string): boolean {
  if (!query) return true;
  if (section.title.toLowerCase().includes(query)) return true;
  if (section.masterTitle.toLowerCase().includes(query)) return true;
  return section.children.some(
    (child) =>
      child.title.toLowerCase().includes(query) || child.path.toLowerCase().includes(query),
  );
}

function childMatches(title: string, path: string, query: string): boolean {
  if (!query) return true;
  return title.toLowerCase().includes(query) || path.toLowerCase().includes(query);
}

function isSectionActive(section: ErpNavSection, pathname: string): boolean {
  if (section.path === "/") return pathname === "/";
  if (pathname === section.path) return true;
  if (section.id === "05" && isPosTerminalPath(pathname)) return true;
  if (section.children.some((child) => child.path === pathname)) return true;
  return pathname.startsWith(`${section.path}/`);
}

export function SidebarNav({
  query,
  onNavigate,
  collapsed = false,
  grantedCount = 0,
  hasPermission = () => true,
}: {
  query: string;
  onNavigate: () => void;
  collapsed?: boolean;
  grantedCount?: number;
  hasPermission?: (key: string) => boolean;
}) {
  const location = useLocation();
  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      ERP_SIDEBAR_SECTIONS.filter(
        (section) =>
          canShowNavItem(section.permission, grantedCount, hasPermission) && sectionMatches(section, q),
      ),
    [q, grantedCount, hasPermission],
  );

  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const section of ERP_SIDEBAR_SECTIONS) {
        if (isSectionActive(section, location.pathname) || q) {
          next[section.id] = true;
        }
      }
      return next;
    });
  }, [location.pathname, q]);

  return (
    <nav className="h-[calc(100vh-8rem)] space-y-0.5 overflow-auto px-2 pb-6" aria-label="ERP modules">
      {visible.map((section) => {
        const expanded = !collapsed && (Boolean(open[section.id]) || Boolean(q));
        const children = (q
          ? section.children.filter((child) => childMatches(child.title, child.path, q))
          : section.children
        ).filter((child) => canShowNavItem(child.permission, grantedCount, hasPermission));
        const parentActive = isSectionActive(section, location.pathname);
        const comingSoonParent = isComingSoonEngineSection(section);

        return (
          <div key={section.id} className="pb-0.5">
            <div className="flex items-stretch gap-0.5">
              <NavLink
                to={section.path}
                end
                onClick={onNavigate}
                title={section.masterTitle}
                className={({ isActive }) =>
                  `flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${
                    isActive || parentActive
                      ? "bg-[var(--erp-brand)] text-white"
                      : "text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
                  } ${collapsed ? "justify-center px-2" : ""}`
                }
              >
                <NavIcon name={section.icon} />
                {collapsed ? (
                  <span className="sr-only">{section.title}</span>
                ) : (
                  <span className="truncate font-medium">{section.title}</span>
                )}
                {comingSoonParent && !collapsed ? (
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide opacity-70" aria-hidden="true">
                    Soon
                  </span>
                ) : null}
              </NavLink>
              {!collapsed && children.length > 0 ? (
                <button
                  type="button"
                  aria-label={expanded ? `Collapse ${section.title}` : `Expand ${section.title}`}
                  aria-expanded={expanded}
                  className="w-8 shrink-0 rounded-xl text-[var(--erp-muted)] hover:bg-[var(--erp-bg)]"
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
                  }
                >
                  {expanded ? "▾" : "▸"}
                </button>
              ) : null}
            </div>
            {expanded && children.length > 0 ? (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--erp-border)] pl-2">
                {children.map((child) => (
                  <NavLink
                    key={`${child.path}:${child.title}`}
                    to={child.path}
                    end
                    onClick={onNavigate}
                    title={child.title}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] ${
                        isActive
                          ? "bg-[var(--erp-brand)]/10 font-medium text-[var(--erp-brand-strong)]"
                          : "text-[var(--erp-muted)] hover:bg-[var(--erp-bg)] hover:text-[var(--erp-ink)]"
                      }`
                    }
                  >
                    <span className="truncate">{child.title}</span>
                    {child.status === "placeholder" ? (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">
                        Soon
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
