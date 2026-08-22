import { Link, useLocation } from "react-router-dom";
import { POS_TERMINAL_NAV } from "../pos-ownership";
import { POSButton } from "./POSButton";
import { posCn } from "./posCn";

export interface POSTerminalNavProps {
  holdCount: number;
  drawer: {
    opening: string;
    inHand: string;
    sales: string;
    expenses: string;
    expected: string;
  };
  drawerBusy?: boolean;
  canOpenDrawer?: boolean;
  onCashDrawer?: () => void;
  onCloseShift?: () => void;
  /** Narrow / overlay rail for tablet+mobile (reference keeps desktop rail visible). */
  collapsed?: boolean;
}

function isNavActive(pathname: string, path: string): boolean {
  if (path === "/pos") return pathname === "/pos" || pathname === "/pos/new";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function POSTerminalNav({
  holdCount,
  drawer,
  drawerBusy = false,
  canOpenDrawer = false,
  onCashDrawer,
  onCloseShift,
  collapsed = false,
}: POSTerminalNavProps) {
  const { pathname } = useLocation();

  return (
    <nav
      className={posCn(
        "pos-terminal-nav flex shrink-0 flex-col bg-[var(--pos-nav-bg)] text-[var(--pos-nav-ink)]",
        collapsed ? "pos-terminal-nav--collapsed" : "w-[var(--pos-sidebar-width)]",
      )}
      aria-label="POS navigation"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="pos-sidebar-brand">
        <span className="pos-sidebar-mark" aria-hidden>
          POS
        </span>
        {collapsed ? null : <span className="pos-sidebar-brand-word">POS</span>}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {POS_TERMINAL_NAV.map((item) => {
          const active = isNavActive(pathname, item.path);
          const badge = item.badge === "hold" && holdCount > 0 ? holdCount : null;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={posCn("pos-nav-link", active && "pos-nav-active")}
              aria-current={active ? "page" : undefined}
            >
              <span className="min-w-0 flex-1 truncate">{collapsed ? item.label.slice(0, 1) : item.label}</span>
              {!collapsed && badge != null ? (
                <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--pos-danger)] px-1 text-[10px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="pos-sidebar-util space-y-3">
        {collapsed ? null : (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--pos-nav-muted)]">
              <span>Cash Drawer</span>
            </div>
            <dl className="space-y-1.5 px-1 tabular-nums">
              <div className="flex justify-between gap-2 text-[var(--pos-nav-muted)]">
                <dt>Opening</dt>
                <dd className="font-medium text-slate-200">{drawer.opening}</dd>
              </div>
              <div className="flex justify-between gap-2 text-[var(--pos-nav-muted)]">
                <dt>In Hand</dt>
                <dd className="font-bold text-emerald-400">{drawer.inHand}</dd>
              </div>
              <div className="flex justify-between gap-2 text-[var(--pos-nav-muted)]">
                <dt>Sales</dt>
                <dd className="font-medium text-slate-200">{drawer.sales}</dd>
              </div>
              <div className="flex justify-between gap-2 text-[var(--pos-nav-muted)]">
                <dt>Expenses</dt>
                <dd className="font-medium text-red-400">{drawer.expenses}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-800 pt-1.5 font-bold text-slate-300">
                <dt>Expected</dt>
                <dd className="font-semibold text-white">{drawer.expected}</dd>
              </div>
            </dl>
          </div>
        )}
        <POSButton
          size="sm"
          variant="ghost"
          className="w-full border border-white/20 bg-white/10 text-[var(--pos-nav-ink)] hover:bg-white/15"
          onClick={canOpenDrawer ? onCashDrawer : undefined}
          disabled={!canOpenDrawer || drawerBusy}
          aria-label="Cash Drawer"
          title="Cash Drawer"
        >
          {collapsed ? "CD" : "Cash Drawer"}
        </POSButton>
        <POSButton
          size="sm"
          variant="primary"
          className="w-full rounded-[var(--pos-radius)]"
          onClick={onCloseShift}
          aria-label="Close Shift"
          title="Close Shift"
        >
          {collapsed ? "CS" : "Close Shift"}
        </POSButton>
      </div>
    </nav>
  );
}
