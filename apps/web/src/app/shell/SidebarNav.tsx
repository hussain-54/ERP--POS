import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  canShowNavItem,
  ERP_SIDEBAR_SECTIONS,
  findSectionForPath,
  isComingSoonEngineSection,
  isNavChildActive,
  masterTitleById,
  NAV_VISUAL_BREAK_BEFORE,
  type ErpNavChild,
  type ErpNavSection,
} from "@/app/modules";
import { NavIcon } from "@/app/shell/nav-icons";

function sectionMatches(section: ErpNavSection, query: string): boolean {
  if (!query) return true;
  if (section.title.toLowerCase().includes(query)) return true;
  if (section.masterTitle.toLowerCase().includes(query)) return true;
  if (section.id.includes(query)) return true;
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
  return findSectionForPath(pathname)?.id === section.id;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-3.5 w-3.5 shrink-0 ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M7 4.5 13 10 7 15.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function shortcutHint(child: ErpNavChild): string | undefined {
  if (!child.shortcutToModuleId) return undefined;
  const target = masterTitleById(child.shortcutToModuleId);
  return target ? `Shortcut to ${target}` : "Shortcut to another module";
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
    <nav
      className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden overscroll-contain px-2 pb-8"
      aria-label="ERP modules"
    >
      {visible.map((section) => {
        const expanded = !collapsed && (Boolean(open[section.id]) || Boolean(q));
        const children = (q
          ? section.children.filter((child) => childMatches(child.title, child.path, q))
          : section.children
        ).filter((child) => canShowNavItem(child.permission, grantedCount, hasPermission));
        const parentActive = isSectionActive(section, location.pathname);
        const comingSoonParent = isComingSoonEngineSection(section);
        const visualBreak = NAV_VISUAL_BREAK_BEFORE.has(section.id) && !q;

        return (
          <div
            key={section.id}
            data-erp-module={section.id}
            className={visualBreak ? "mt-3 border-t border-[var(--erp-border)] pt-3" : ""}
          >
            <div className="flex items-stretch gap-0.5">
              <NavLink
                to={section.path}
                end={section.path === "/" || section.path === "/pos"}
                onClick={onNavigate}
                title={section.masterTitle}
                className={() =>
                  `flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-[13px] lg:min-h-0 ${
                    parentActive
                      ? "bg-[var(--erp-brand-soft)] font-semibold text-[var(--erp-brand)]"
                      : "font-medium text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]"
                  } ${collapsed ? "justify-center px-2" : ""}`
                }
              >
                <span
                  className={
                    parentActive
                      ? "text-[var(--erp-brand)]"
                      : "text-[var(--erp-muted)]"
                  }
                >
                  <NavIcon name={section.icon} />
                </span>
                {collapsed ? (
                  <span className="sr-only">{section.masterTitle}</span>
                ) : (
                  <>
                    <span aria-hidden className="w-5 shrink-0 text-[11px] tabular-nums text-[var(--erp-muted)]">
                      {section.id}
                    </span>
                    <span data-erp-label className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                      {section.masterTitle}
                    </span>
                  </>
                )}
              </NavLink>
              {!collapsed && children.length > 0 ? (
                <button
                  type="button"
                  aria-label={expanded ? `Collapse ${section.title}` : `Expand ${section.title}`}
                  aria-expanded={expanded}
                  className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--erp-muted)] hover:bg-[var(--erp-bg)] hover:text-[var(--erp-ink)] lg:min-h-0 lg:w-8"
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
                  }
                >
                  <Chevron open={expanded} />
                </button>
              ) : null}
            </div>
            {expanded && children.length > 0 ? (
              <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--erp-border)] pl-2">
                {children.map((child) => {
                  const active = isNavChildActive(child, location.pathname);
                  const shortcut = shortcutHint(child);
                  return (
                    <NavLink
                      key={`${child.path}:${child.title}`}
                      to={child.path}
                      end
                      onClick={onNavigate}
                      title={shortcut ?? child.title}
                      className={() =>
                        `flex min-h-11 items-center justify-between gap-2 rounded-md py-2 pl-2.5 pr-2 text-[13px] leading-snug lg:min-h-0 lg:py-1.5 ${
                          active
                            ? "bg-[var(--erp-brand)] font-medium text-white"
                            : child.shortcutToModuleId
                              ? "text-[var(--erp-muted)] hover:bg-[var(--erp-bg)] hover:text-[var(--erp-ink)]"
                              : "text-[var(--erp-ink)]/80 hover:bg-[var(--erp-bg)] hover:text-[var(--erp-ink)]"
                        }`
                      }
                    >
                      <span data-erp-label className="min-w-0 flex-1 whitespace-normal break-words">
                        {child.title}
                        {shortcut && !active ? (
                          <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">
                            ref
                          </span>
                        ) : null}
                      </span>
                      {child.status === "placeholder" && !active ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--erp-muted)]">
                          Soon
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            ) : null}
            {comingSoonParent && collapsed ? (
              <span className="sr-only">Coming Soon</span>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
