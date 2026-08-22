import { Link, useLocation } from "react-router-dom";
import type { PosDrawerSummary } from "../types";

export function PosSidebar({
  holdCount,
  drawer,
  onCloseShift,
}: {
  holdCount: number;
  drawer: PosDrawerSummary;
  onCloseShift: () => void;
}) {
  const { pathname } = useLocation();
  const nav = [
    { path: "/pos", label: "POS", icon: "fa-cart-shopping" },
    { path: "/pos/sales/resume", label: "Hold / Resume", icon: "fa-clock", badge: holdCount },
    { path: "/pos/customers", label: "Customers", icon: "fa-user" },
    { path: "/pos/products", label: "Products", icon: "fa-box" },
    { path: "/pos/pricing", label: "Price & Discount", icon: "fa-tag" },
    { path: "/pos/reports", label: "Reports", icon: "fa-chart-simple" },
    { path: "/pos/settings", label: "Settings", icon: "fa-gear" },
  ];

  function active(path: string) {
    if (path === "/pos") return pathname === "/pos" || pathname === "/pos/sales/new";
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <aside className="pos-terminal-nav flex w-[var(--pos-sidebar-width)] shrink-0 flex-col justify-between bg-[var(--pos-nav-bg)] text-[var(--pos-nav-ink)] select-none">
      <div>
        <div className="pos-sidebar-brand">
          <i className="fa-solid fa-cart-shopping text-lg" aria-hidden />
          <span className="pos-sidebar-brand-word">POS</span>
        </div>
        <nav className="mt-3 space-y-1 px-2.5" aria-label="POS navigation">
          {nav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`pos-nav-link ${active(item.path) ? "pos-nav-active" : ""}`}
              aria-current={active(item.path) ? "page" : undefined}
            >
              <i className={`fa-solid ${item.icon} w-5 text-sm`} aria-hidden />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              {item.badge != null && item.badge > 0 ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>

      <div className="pos-sidebar-util space-y-3">
        <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--pos-nav-muted)]">
          <span>Cash Drawer</span>
          <i className="fa-solid fa-cash-register text-slate-500" aria-hidden />
        </div>
        <dl className="space-y-1.5 px-1 text-xs tabular-nums">
          <div className="flex justify-between text-[var(--pos-nav-muted)]">
            <dt>Opening</dt>
            <dd className="font-medium text-slate-200">{drawer.opening}</dd>
          </div>
          <div className="flex justify-between text-[var(--pos-nav-muted)]">
            <dt>In Hand</dt>
            <dd className="font-bold text-emerald-400">{drawer.inHand}</dd>
          </div>
          <div className="flex justify-between text-[var(--pos-nav-muted)]">
            <dt>Sales</dt>
            <dd className="font-medium text-slate-200">{drawer.sales}</dd>
          </div>
          <div className="flex justify-between text-[var(--pos-nav-muted)]">
            <dt>Expenses</dt>
            <dd className="font-medium text-red-400">{drawer.expenses}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-slate-300">
            <dt>Expected</dt>
            <dd className="font-semibold text-white">{drawer.expected}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onCloseShift}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.99]"
        >
          Close Shift
        </button>
      </div>
    </aside>
  );
}
