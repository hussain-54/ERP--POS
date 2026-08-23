import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { POS_MODULES } from "../ownership";
import type { PosDrawerSummary } from "../types";

function pathActive(pathname: string, path: string) {
  if (path === "/pos") return pathname === "/pos";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function PosSidebar({
  holdCount,
  drawer,
  onCloseShift,
  mobileOpen,
  onCloseMobile,
}: {
  holdCount: number;
  drawer: PosDrawerSummary;
  onCloseShift: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const { pathname } = useLocation();
  const activeModuleId = useMemo(() => {
    if (pathname === "/pos") return null;
    const normalized = pathname === "/pos/shift" ? "/pos/shifts" : pathname;
    return (
      POS_MODULES.find(
        (m) =>
          normalized === m.path ||
          normalized.startsWith(`${m.path}/`) ||
          m.children.some((c) => c.path === normalized),
      )?.id ?? null
    );
  }, [pathname]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function isExpanded(id: string) {
    if (expanded[id] != null) return expanded[id];
    return activeModuleId === id;
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !isExpanded(id) }));
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="pos-nav-backdrop lg:hidden"
          aria-label="Close POS navigation"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={`pos-workspace-nav flex w-[var(--pos-sidebar-width)] shrink-0 flex-col bg-white text-slate-700 select-none ${
          mobileOpen ? "pos-workspace-nav-open" : ""
        }`}
        aria-label="POS module navigation"
      >
        <div className="pos-sidebar-brand">
          <Link to="/pos" className="flex items-center gap-2.5 text-white" onClick={onCloseMobile}>
            <i className="fa-solid fa-cart-shopping text-base" aria-hidden />
            <span className="pos-sidebar-brand-word">POS</span>
          </Link>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-2" aria-label="POS navigation">
          <Link
            to="/pos"
            onClick={onCloseMobile}
            className={`pos-nav-link ${pathname === "/pos" ? "pos-nav-active" : ""}`}
            aria-current={pathname === "/pos" ? "page" : undefined}
          >
            <i className="fa-solid fa-border-all w-4 text-sm" aria-hidden />
            <span className="flex-1 truncate text-[13px] font-semibold">Command Center</span>
          </Link>

          {POS_MODULES.map((mod) => {
            const open = isExpanded(mod.id);
            const moduleActive = activeModuleId === mod.id;
            const holdBadge = mod.kpiKey === "holds" && holdCount > 0 ? holdCount : null;
            return (
              <div key={mod.id} className="rounded-lg">
                <div className="flex items-stretch gap-0.5">
                  <Link
                    to={mod.path}
                    onClick={onCloseMobile}
                    className={`pos-nav-link min-w-0 flex-1 ${moduleActive ? "pos-nav-active" : ""}`}
                    aria-current={pathname === mod.path ? "page" : undefined}
                  >
                    <span className="w-5 shrink-0 text-center text-[10px] font-bold tabular-nums opacity-70">
                      {mod.number}
                    </span>
                    <i className={`fa-solid ${mod.icon} w-4 shrink-0 text-sm`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{mod.shortTitle}</span>
                    {holdBadge != null ? (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {holdBadge}
                      </span>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    className="pos-nav-expand"
                    aria-expanded={open}
                    aria-label={`${open ? "Collapse" : "Expand"} ${mod.title}`}
                    onClick={() => toggle(mod.id)}
                  >
                    <i className={`fa-solid fa-chevron-${open ? "down" : "right"} text-[10px]`} aria-hidden />
                  </button>
                </div>
                {open ? (
                  <div className="mb-1 ml-3 space-y-0.5 border-l border-slate-200 pl-2">
                    {mod.children.map((item) => (
                      <Link
                        key={item.path + item.title}
                        to={item.path}
                        onClick={onCloseMobile}
                        className={`pos-nav-child ${pathActive(pathname, item.path) ? "pos-nav-child-active" : ""}`}
                        aria-current={pathname === item.path ? "page" : undefined}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.status === "soon" ? (
                          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-amber-600">
                            Soon
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="pos-sidebar-util space-y-3">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Cash Drawer</span>
            <i className="fa-solid fa-cash-register text-slate-400" aria-hidden />
          </div>
          <dl className="space-y-1.5 px-1 text-xs tabular-nums">
            <div className="flex justify-between text-slate-500">
              <dt>Opening</dt>
              <dd className="font-medium text-slate-800">{drawer.opening}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>In Hand</dt>
              <dd className="font-bold text-emerald-600">{drawer.inHand}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>Sales</dt>
              <dd className="font-medium text-slate-800">{drawer.sales}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>Expenses</dt>
              <dd className="font-medium text-red-500">{drawer.expenses}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-600">
              <dt>Expected</dt>
              <dd className="font-semibold text-slate-900">{drawer.expected}</dd>
            </div>
          </dl>
          <button type="button" onClick={onCloseShift} className="pos-sidebar-cta">
            Close Shift
          </button>
        </div>
      </aside>
    </>
  );
}
