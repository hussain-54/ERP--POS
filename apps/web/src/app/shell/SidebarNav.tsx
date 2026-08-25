import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  canShowNavItem,
  ERP_NAV_SECTIONS,
  ERP_SIDEBAR_SECTIONS,
  findSectionForPath,
  NAV_VISUAL_BREAK_BEFORE,
  type ErpNavSection,
} from "@/app/modules";
import { NavIcon } from "@/app/shell/nav-icons";

function sectionMatches(section: ErpNavSection, query: string): boolean {
  if (!query) return true;
  const source = ERP_NAV_SECTIONS.find((row) => row.id === section.id) ?? section;
  if (source.title.toLowerCase().includes(query)) return true;
  if (source.masterTitle.toLowerCase().includes(query)) return true;
  if (source.name.toLowerCase().includes(query)) return true;
  if (source.id.includes(query) || source.number.includes(query)) return true;
  return source.children.some(
    (child) =>
      child.title.toLowerCase().includes(query) || child.path.toLowerCase().includes(query),
  );
}

export function isSidebarParentActive(section: Pick<ErpNavSection, "id">, pathname: string): boolean {
  return findSectionForPath(pathname)?.id === section.id;
}

export function SidebarNav({
  query,
  onNavigate,
  collapsed = false,
  grantedCount = 0,
  hasPermission = () => true,
  touchTargets = false,
}: {
  query: string;
  onNavigate: () => void;
  collapsed?: boolean;
  grantedCount?: number;
  hasPermission?: (key: string) => boolean;
  /** Mobile drawer: keep 44px rows and fully readable labels. */
  touchTargets?: boolean;
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

  return (
    <nav
      className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden overscroll-contain px-2 pb-8"
      aria-label="ERP modules"
    >
      {visible.map((section) => {
        const parentActive = isSidebarParentActive(section, location.pathname);
        const visualBreak = NAV_VISUAL_BREAK_BEFORE.has(section.id) && !q;

        return (
          <div
            key={section.id}
            data-erp-module={section.id}
            className={visualBreak ? "mt-3 border-t border-[var(--erp-border)] pt-3" : ""}
          >
            <Link
              to={section.path}
              onClick={onNavigate}
              title={section.masterTitle}
              aria-label={section.masterTitle}
              aria-current={parentActive ? "page" : undefined}
              data-touch-nav={touchTargets ? "true" : undefined}
              className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] ${
                parentActive
                  ? "bg-[var(--erp-brand-soft)] font-semibold text-[var(--erp-brand)] ring-1 ring-[var(--erp-brand)]/15"
                  : "font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)] active:bg-[var(--erp-bg)]"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <span className={parentActive ? "text-[var(--erp-brand)]" : "text-[var(--erp-muted)]"}>
                <NavIcon name={section.icon} />
              </span>
              {collapsed ? null : (
                <>
                  <span aria-hidden className="w-5 shrink-0 text-[11px] tabular-nums text-[var(--erp-muted)]">
                    {section.number}
                  </span>
                  <span data-erp-label className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                    {section.masterTitle}
                  </span>
                </>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
