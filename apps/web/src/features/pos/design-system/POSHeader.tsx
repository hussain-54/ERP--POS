import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { POSBadge } from "./POSBadge";
import { POSButton } from "./POSButton";
import { POSSelect } from "./POSSelect";
import { posCn } from "./posCn";

export const POS_TOGGLE_ERP_NAV_EVENT = "pos:toggle-erp-nav";

export interface POSHeaderProps {
  branchLabel?: string;
  terminalId: string;
  terminalOptions: Array<{ value: string; label: string }>;
  onTerminalChange: (id: string) => void;
  cashierName?: string;
  holdCount: number;
  shiftOpen?: boolean;
}

function POSClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="pos-header-clock" aria-label="Date / Time">
      <span className="pos-header-time">{time}</span>
      <span className="pos-header-date hidden sm:block">{date}</span>
    </div>
  );
}

function HeaderField({
  kicker,
  children,
  className,
}: {
  kicker: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={posCn("pos-header-field", className)}>
      <span className="pos-header-kicker" aria-hidden="true">
        {kicker}
      </span>
      {children}
    </div>
  );
}

function openErpModules() {
  window.dispatchEvent(new Event(POS_TOGGLE_ERP_NAV_EVENT));
}

/** Compact POS status strip — Menu · Branch · Terminal · Cashier · Shift · Clock · Holds · Alerts · User */
export function POSHeader({
  branchLabel = "—",
  terminalId,
  terminalOptions,
  onTerminalChange,
  cashierName,
  holdCount,
  shiftOpen = false,
}: POSHeaderProps) {
  const cashier = cashierName ?? "—";
  const initials = cashier
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="pos-header relative z-10 min-w-0" role="region" aria-label="POS status">
      <div className="pos-header-left">
        <POSButton
          size="sm"
          variant="secondary"
          className="shrink-0"
          aria-label="Menu"
          title="ERP modules"
          onClick={openErpModules}
        >
          Menu
        </POSButton>

        <HeaderField kicker="Branch" className="pos-header-branch">
          <span className="pos-header-value" title={branchLabel} aria-label="POS Branch">
            {branchLabel}
          </span>
        </HeaderField>

        <HeaderField kicker="POS Terminal" className="pos-header-terminal">
          <div className="pos-header-control">
            <POSSelect
              compact
              aria-label="POS Terminal"
              value={terminalId}
              onChange={(e) => onTerminalChange(e.target.value)}
              options={terminalOptions.length ? terminalOptions : [{ value: "", label: "This terminal" }]}
            />
          </div>
        </HeaderField>

        <HeaderField kicker="Cashier" className="pos-header-cashier">
          <span className="pos-header-value" title={cashier} aria-label="Cashier">
            {cashier}
          </span>
        </HeaderField>

        <span aria-label="Shift Status" className="shrink-0">
          <POSBadge tone={shiftOpen ? "success" : "warning"}>{shiftOpen ? "Shift Open" : "Shift Closed"}</POSBadge>
        </span>
      </div>

      <div className="pos-header-center">
        <POSClock />
      </div>

      <div className="pos-header-right">
        <Link
          to="/held-sales"
          aria-label="Held Sales"
          className={posCn(
            "inline-flex h-8 items-center gap-1.5 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2.5 text-xs font-semibold text-[var(--pos-ink)]",
            "hover:border-[var(--pos-primary)] hover:bg-[var(--pos-primary-soft)] focus-visible:outline-none focus-visible:shadow-[var(--pos-focus)]",
          )}
        >
          Held sales
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-[var(--pos-radius-sm)] bg-[var(--pos-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {holdCount}
          </span>
        </Link>
        <Link
          to="/notifications"
          aria-label="POS Notifications"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] text-xs font-semibold text-[var(--pos-ink)] hover:bg-[var(--pos-muted-bg)]"
          title="Notifications"
        >
          <span aria-hidden>🔔</span>
        </Link>
        <span
          aria-label="POS User"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pos-primary)] text-xs font-bold text-white"
          title={cashier}
        >
          {initials || "U"}
        </span>
      </div>
    </div>
  );
}
