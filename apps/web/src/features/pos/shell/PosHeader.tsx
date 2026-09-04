import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { POS_TERMINAL_PATHS } from "../ownership";
import { POS_TOGGLE_ERP_NAV, POS_TOGGLE_SIDEBAR } from "./events";
import { HardwareStatusPill } from "../hardware/HardwareStatusPill";

export { POS_TOGGLE_ERP_NAV };

function PosClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="hidden text-right md:block">
      <div className="text-[11px] font-medium text-slate-400">
        {now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </div>
      <div className="text-xs font-black tracking-wide text-slate-800">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

export function PosHeader({
  branchLabel,
  terminalId,
  cashierName,
  holdCount,
  shiftOpen,
  showBack = false,
}: {
  branchLabel: string;
  terminalId: string;
  cashierName?: string;
  holdCount: number;
  shiftOpen: boolean;
  showBack?: boolean;
}) {
  const { pathname } = useLocation();
  const onTerminal = POS_TERMINAL_PATHS.has(pathname);
  const cashier = cashierName ?? "Cashier";
  const initials = cashier
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="pos-header" role="region" aria-label="POS status">
      <div className="pos-header-left">
        <button
          type="button"
          className="cursor-pointer text-lg text-slate-500 hover:text-slate-800 lg:hidden"
          aria-label="Open POS navigation"
          onClick={() => window.dispatchEvent(new Event(POS_TOGGLE_SIDEBAR))}
        >
          <i className="fa-solid fa-bars" aria-hidden />
        </button>
        <button
          type="button"
          className="cursor-pointer text-lg text-slate-500 hover:text-slate-800"
          aria-label="Menu"
          onClick={() => window.dispatchEvent(new Event(POS_TOGGLE_ERP_NAV))}
        >
          <i className="fa-solid fa-table-cells-large" aria-hidden />
        </button>
        {showBack ? (
          <Link to="/pos" className="pos-back-link hidden sm:inline-flex">
            <i className="fa-solid fa-arrow-left text-[11px]" aria-hidden />
            Back to POS Command Center
          </Link>
        ) : null}
        <div className="pos-header-field">
          <span className="pos-header-kicker">Branch</span>
          <span className="pos-header-value" aria-label="POS Branch">
            {branchLabel}
          </span>
        </div>
        <div className="pos-header-field">
          <span className="pos-header-kicker">Terminal</span>
          <span className="pos-header-value">{terminalId}</span>
        </div>
        <div className="pos-header-field">
          <span className="pos-header-kicker">Cashier</span>
          <span className="pos-header-value">{cashier}</span>
        </div>
        <div className="pos-header-field">
          <span className="pos-header-kicker">Shift Status</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
              shiftOpen
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {shiftOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <PosClock />

      <div className="pos-header-right border-l border-slate-200 pl-4">
        {onTerminal ? (
          <button
            type="button"
            className="pos-header-held"
            aria-label="Held Sales"
            onClick={() => window.dispatchEvent(new Event("pos:open-resume-dialog"))}
          >
            <span className="text-[10px] font-semibold text-slate-500">Held Orders</span>
            <i className="fa-solid fa-cart-shopping text-sm text-slate-600" aria-hidden />
            <span className="text-xs font-bold text-slate-800">{holdCount}</span>
          </button>
        ) : (
          <Link to="/pos/sales/held" className="pos-header-held" aria-label="Held Sales">
            <span className="text-[10px] font-semibold text-slate-500">Held Orders</span>
            <i className="fa-solid fa-cart-shopping text-sm text-slate-600" aria-hidden />
            <span className="text-xs font-bold text-slate-800">{holdCount}</span>
          </Link>
        )}
        {onTerminal ? <HardwareStatusPill /> : null}
        <Link
          to="/notifications"
          className="relative rounded-xl border border-slate-200 bg-slate-50 p-2.5 transition hover:bg-slate-100"
          aria-label="POS Notifications"
        >
          <i className="fa-regular fa-bell text-sm text-slate-600" aria-hidden />
        </Link>
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-[var(--pos-primary)] text-xs font-bold text-white shadow-sm"
          title={cashier}
          aria-label="POS User"
        >
          {initials || "U"}
        </span>
      </div>
    </header>
  );
}
