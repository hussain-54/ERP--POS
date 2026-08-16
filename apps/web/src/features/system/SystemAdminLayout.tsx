import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ERP_NAV_SECTIONS,
  isNavChildActive,
  type ErpNavChild,
} from "@/app/modules";

const SYSTEM_ADMIN_GROUPS: ReadonlyArray<{ title: string; childTitles: readonly string[] }> = [
  {
    title: "Organization",
    childTitles: ["Company", "Localization", "Currency", "Language", "Date & Numbering", "Templates"],
  },
  {
    title: "Operations",
    childTitles: ["Barcode", "POS", "Email", "SMS", "Storage", "Logs", "Maintenance"],
  },
  {
    title: "Access & channels",
    childTitles: ["Security", "Integrations", "Store", "Mobile", "HR"],
  },
];

function systemChildren(): ErpNavChild[] {
  return (ERP_NAV_SECTIONS.find((section) => section.id === "39")?.children ?? []).filter(
    (child) => child.sidebar !== false,
  );
}

export function systemAdminNavGroups() {
  const children = systemChildren();
  return SYSTEM_ADMIN_GROUPS.map((group) => ({
    title: group.title,
    items: group.childTitles
      .map((title) => children.find((child) => child.title === title))
      .filter((child): child is ErpNavChild => Boolean(child)),
  }));
}

function navClass(active: boolean, placeholder: boolean) {
  if (active) return "bg-[var(--erp-brand)] font-medium text-white";
  if (placeholder) return "text-[var(--erp-muted)] hover:bg-[var(--erp-bg)] hover:text-[var(--erp-ink)]";
  return "text-[var(--erp-ink)] hover:bg-[var(--erp-bg)]";
}

/**
 * Module 39 workspace. Uses the ERP AppShell for product navigation —
 * this rail is settings sections only, not a second global sidebar.
 */
export function SystemAdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const groups = systemAdminNavGroups();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-white md:overflow-hidden md:flex-row">
      <nav
        aria-label="System Administration"
        className="shrink-0 overflow-x-hidden border-b border-[var(--erp-border)] bg-white md:h-full md:w-56 md:overflow-y-auto md:border-b-0 md:border-r"
      >
        <div className="border-b border-[var(--erp-border)] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--erp-muted)]">
            Control center
          </div>
          <NavLink
            to="/settings"
            end
            className={({ isActive }) =>
              `mt-1.5 flex min-h-11 items-center rounded-md px-2.5 py-2 text-[13px] md:min-h-0 md:py-1.5 ${navClass(isActive, false)}`
            }
          >
            Overview
          </NavLink>
        </div>
        <div className="space-y-3 px-3 py-2 md:px-2 md:py-3">
          {groups.map((group) => (
            <div key={group.title} className="min-w-0">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--erp-muted)]">
                {group.title}
              </div>
              <div className="flex flex-wrap gap-1 md:block md:space-y-0.5 md:overflow-visible">
                {group.items.map((item) => {
                  const active = isNavChildActive(item, location.pathname);
                  return (
                    <NavLink
                      key={`${item.path}:${item.title}`}
                      to={item.path}
                      end
                      className={`flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] leading-snug md:min-h-0 md:py-1.5 ${navClass(
                        active,
                        item.status === "placeholder",
                      )}`}
                    >
                      <span data-erp-label className="min-w-0 whitespace-normal break-words">
                        {item.title}
                      </span>
                      {item.status === "placeholder" && !active ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">Soon</span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-white p-4 md:p-5">{children}</section>
    </div>
  );
}
