import { Link } from "react-router-dom";
import { POSButton } from "./POSButton";
import { POSNav } from "./POSNav";
import { posCn } from "./posCn";

export interface POSSidebarProps {
  open: boolean;
  onNavigate: () => void;
  grantedCount?: number;
  hasPermission?: (key: string) => boolean;
  drawer?: {
    opening: string;
    inHand: string;
    sales: string;
    expenses: string;
    expected: string;
  };
  onCashDrawer?: () => void;
  onCloseShift?: () => void;
  drawerBusy?: boolean;
  drawerMessage?: string | null;
}

/**
 * Dedicated POS sidebar: module nav + cash-drawer utility.
 * This is not the 39-module ERP tree.
 */
export function POSSidebar({
  open,
  onNavigate,
  grantedCount = 0,
  hasPermission = () => true,
  drawer,
  onCashDrawer,
  onCloseShift,
  drawerBusy = false,
  drawerMessage,
}: POSSidebarProps) {
  const summary = drawer ?? {
    opening: "—",
    inHand: "—",
    sales: "—",
    expenses: "—",
    expected: "—",
  };

  return (
    <aside
      className={posCn(
        "pos-sidebar flex shrink-0 flex-col overflow-y-auto",
        "fixed bottom-0 left-0 top-12 z-40 w-[15.5rem] transition-transform duration-200 ease-out",
        "xl:static xl:z-auto xl:h-auto xl:w-56 xl:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
        !open ? "pointer-events-none xl:pointer-events-auto xl:hidden" : "",
      )}
      aria-label="POS sidebar"
    >
      <div className="border-b border-white/10 px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pos-nav-muted)]">
          Point of Sale
        </div>
        <div className="mt-0.5 text-sm font-semibold text-[var(--pos-nav-ink)]">Terminal</div>
      </div>

      <POSNav onNavigate={onNavigate} grantedCount={grantedCount} hasPermission={hasPermission} />

      <div className="mt-auto border-t border-white/10 p-3">
        <Link
          to="/"
          aria-label="ERP Home"
          title="Return to the 39-module ERP"
          onClick={onNavigate}
          className="pos-nav-erp-home mb-3 flex items-center gap-2.5 rounded-[var(--pos-radius-sm)] px-2.5 py-2 text-[13px] text-[var(--pos-nav-ink)] hover:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px] shrink-0"
            aria-hidden
          >
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10.5V20h14v-9.5" />
            <path d="M10 20v-6h4v6" />
          </svg>
          <span className="min-w-0">
            <span className="block font-medium leading-snug">ERP Home</span>
            <span className="block text-[10px] leading-snug text-[var(--pos-nav-muted)]">39-module ERP</span>
          </span>
        </Link>
        <POSButton
          className="w-full border border-white/20 bg-white/10 text-[var(--pos-nav-ink)] hover:bg-white/15"
          size="sm"
          variant="ghost"
          onClick={onCashDrawer}
          disabled={!onCashDrawer || drawerBusy}
        >
          Cash Drawer
        </POSButton>
        <dl className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--pos-nav-muted)]">Opening</dt>
            <dd className="tabular-nums text-[var(--pos-nav-ink)]">{summary.opening}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--pos-nav-muted)]">In Hand</dt>
            <dd className="tabular-nums text-[var(--pos-nav-ink)]">{summary.inHand}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--pos-nav-muted)]">Sales</dt>
            <dd className="tabular-nums text-[var(--pos-nav-ink)]">{summary.sales}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--pos-nav-muted)]">Expenses</dt>
            <dd className="tabular-nums text-[var(--pos-nav-ink)]">{summary.expenses}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="font-semibold text-[var(--pos-nav-ink)]">Expected</dt>
            <dd className="font-semibold tabular-nums text-[var(--pos-nav-ink)]">{summary.expected}</dd>
          </div>
        </dl>
        {drawerMessage ? (
          <p className="mt-2 text-[11px] text-[var(--pos-nav-muted)]">{drawerMessage}</p>
        ) : null}
        <POSButton className="mt-3 w-full" size="sm" variant="primary" onClick={onCloseShift}>
          Close Shift
        </POSButton>
      </div>
    </aside>
  );
}

export { POSSidebar as PosSidebar };
