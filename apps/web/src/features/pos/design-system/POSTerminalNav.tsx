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
}: POSTerminalNavProps) {
  const { pathname } = useLocation();

  return (
    <nav
      className="pos-terminal-nav flex w-[var(--pos-sidebar-width)] shrink-0 flex-col bg-[var(--pos-nav-bg)] text-[var(--pos-nav-ink)]"
      aria-label="POS navigation"
    >
      <div className="pos-sidebar-brand">
        <span className="pos-sidebar-mark" aria-hidden>
          POS
        </span>
        <div>
          <div className="pos-sidebar-title">Point of Sale</div>
          <div className="pos-sidebar-sub">Retail terminal</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {POS_TERMINAL_NAV.map((item) => {
          const active = isNavActive(pathname, item.path);
          const badge = item.badge === "hold" && holdCount > 0 ? holdCount : null;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={posCn("pos-nav-link", active && "pos-nav-active")}
              aria-current={active ? "page" : undefined}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {badge != null ? (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--pos-danger)] px-1 text-[10px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="pos-sidebar-util space-y-2">
        <div className="space-y-1.5 text-[11px]">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--pos-nav-muted)]">
            Cash Drawer
          </div>
          <dl className="space-y-1 tabular-nums">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--pos-nav-muted)]">Opening</dt>
              <dd>{drawer.opening}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--pos-nav-muted)]">In Hand</dt>
              <dd className="font-semibold text-emerald-300">{drawer.inHand}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--pos-nav-muted)]">Sales</dt>
              <dd>{drawer.sales}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--pos-nav-muted)]">Expenses</dt>
              <dd className="text-rose-300">{drawer.expenses}</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-white/10 pt-1.5 font-semibold">
              <dt>Expected</dt>
              <dd>{drawer.expected}</dd>
            </div>
          </dl>
        </div>
        <POSButton
          size="sm"
          variant="ghost"
          className="w-full border border-white/20 bg-white/10 text-[var(--pos-nav-ink)] hover:bg-white/15"
          onClick={canOpenDrawer ? onCashDrawer : undefined}
          disabled={!canOpenDrawer || drawerBusy}
        >
          Cash Drawer
        </POSButton>
        <POSButton size="sm" variant="primary" className="w-full" onClick={onCloseShift}>
          Close Shift
        </POSButton>
      </div>
    </nav>
  );
}
