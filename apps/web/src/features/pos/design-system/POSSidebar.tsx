import { NavLink } from "react-router-dom";
import { ERP_NAV_SECTIONS } from "@/app/modules";
import { POSButton } from "./POSButton";
import { POSIconButton } from "./POSIconButton";
import { posCn } from "./posCn";

function posSalesNav(): Array<{ to: string; label: string; end?: boolean }> {
  const section = ERP_NAV_SECTIONS.find((item) => item.id === "05");
  const seen = new Set<string>();
  const children: Array<{ to: string; label: string; end?: boolean }> = [];
  for (const child of section?.children ?? []) {
    if (seen.has(child.path)) continue;
    seen.add(child.path);
    children.push({
      to: child.path,
      label: child.path === "/pos" ? "New Sale" : child.title,
      end: child.path === "/pos" ? true : undefined,
    });
  }
  return [{ to: "/", label: "ERP Home", end: true }, ...children, { to: "/settings", label: "Settings" }];
}

const POS_SALES_NAV = posSalesNav();

export interface POSSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  holdCount: number;
  drawerSummary?: {
    opening: string;
    inHand: string;
    sales: string;
    expenses: string;
    expected: string;
  };
  onCloseShift?: () => void;
}

/** Dark navy POS navigation — same routes as before; design-system chrome only. */
export function POSSidebar({
  collapsed,
  onToggle,
  holdCount,
  drawerSummary,
  onCloseShift,
}: POSSidebarProps) {
  const summary = drawerSummary ?? {
    opening: "—",
    inHand: "—",
    sales: "—",
    expenses: "—",
    expected: "—",
  };

  return (
    <aside
      className={posCn(
        "pos-sidebar flex flex-col border-r border-white/10 transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[240px]",
      )}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed ? (
          <span className="text-sm font-semibold tracking-wide text-[var(--pos-on-navy)]">
            Sales
          </span>
        ) : null}
        <POSIconButton label="Toggle sidebar" tone="onNavy" onClick={onToggle}>
          ☰
        </POSIconButton>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 pb-4" aria-label="POS">
        {POS_SALES_NAV.map((item) => (
          <NavLink
            key={`${item.to}:${item.label}`}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              posCn(
                "flex items-center justify-between rounded-[var(--pos-radius-sm)] px-3 py-2 text-sm transition",
                isActive
                  ? "pos-nav-active"
                  : "text-[var(--pos-on-navy-muted)] hover:bg-white/10 hover:text-[var(--pos-on-navy)]",
              )
            }
          >
            <span className={collapsed ? "mx-auto" : ""}>
              {collapsed ? item.label.slice(0, 1) : item.label}
            </span>
            {!collapsed && item.to === "/held-sales" && holdCount > 0 ? (
              <span className="rounded-full bg-white/20 px-2 text-[11px] font-semibold">
                {holdCount}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-t border-white/10 p-3 text-xs text-[var(--pos-on-navy-muted)]">
          <div className="mb-2 font-medium text-[var(--pos-on-navy)]">Cash Drawer</div>
          <dl className="space-y-1 tabular-nums">
            <div className="flex justify-between">
              <dt>Opening</dt>
              <dd>{summary.opening}</dd>
            </div>
            <div className="flex justify-between">
              <dt>In Hand</dt>
              <dd>{summary.inHand}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Sales</dt>
              <dd>{summary.sales}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Expenses</dt>
              <dd>{summary.expenses}</dd>
            </div>
            <div className="flex justify-between font-semibold text-[var(--pos-on-navy)]">
              <dt>Expected</dt>
              <dd>{summary.expected}</dd>
            </div>
          </dl>
          <POSButton
            className="mt-3 w-full border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            variant="ghost"
            size="sm"
            onClick={onCloseShift}
            title="Uses existing shift/drawer workflow when available"
          >
            Close Shift
          </POSButton>
        </div>
      ) : null}
    </aside>
  );
}
