import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export const POS_TOGGLE_ERP_NAV = "pos:toggle-erp-nav";

function PosClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="text-right">
      <div className="text-[11px] font-medium text-gray-400">
        {now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </div>
      <div className="text-xs font-black tracking-wide text-gray-800">
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
}: {
  branchLabel: string;
  terminalId: string;
  cashierName?: string;
  holdCount: number;
  shiftOpen: boolean;
}) {
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
          className="mr-1 cursor-pointer text-lg text-gray-500 hover:text-gray-800"
          aria-label="Menu"
          onClick={() => window.dispatchEvent(new Event(POS_TOGGLE_ERP_NAV))}
        >
          <i className="fa-solid fa-bars" aria-hidden />
        </button>
        <div className="pos-header-field">
          <span className="pos-header-kicker">Branch</span>
          <span className="pos-header-value" aria-label="POS Branch">
            {branchLabel}
          </span>
        </div>
        <div className="pos-header-field">
          <span className="pos-header-kicker">POS Terminal</span>
          <span className="pos-header-value">{terminalId}</span>
        </div>
        <div className="pos-header-field">
          <span className="pos-header-kicker">Cashier</span>
          <span className="pos-header-value">{cashier}</span>
        </div>
        <div className="pos-header-field">
          <span className="pos-header-kicker">Shift</span>
          <span className={`pos-header-value font-bold ${shiftOpen ? "text-emerald-600" : "text-amber-600"}`}>
            {shiftOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <PosClock />

      <div className="pos-header-right border-l border-gray-200 pl-5">
        <Link to="/pos/sales/resume" className="pos-header-held" aria-label="Held Sales">
          <span className="text-[10px] font-semibold text-gray-500">Held Sales</span>
          <i className="fa-solid fa-cart-shopping text-sm text-gray-600" aria-hidden />
          <span className="text-xs font-bold text-gray-800">{holdCount}</span>
        </Link>
        <Link
          to="/notifications"
          className="relative rounded-xl border border-gray-200 bg-gray-50 p-2.5 transition hover:bg-gray-100"
          aria-label="POS Notifications"
        >
          <i className="fa-regular fa-bell text-sm text-gray-600" aria-hidden />
        </Link>
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-blue-600 text-xs font-bold text-white shadow-sm"
          title={cashier}
          aria-label="POS User"
        >
          {initials || "U"}
        </span>
      </div>
    </header>
  );
}
