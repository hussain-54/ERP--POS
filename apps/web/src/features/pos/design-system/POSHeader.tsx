import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { POSBadge } from "./POSBadge";
import { POSSelect } from "./POSSelect";
import { posCn } from "./posCn";

export interface POSHeaderProps {
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
  const date = now.toLocaleDateString();
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

/**
 * POS workspace status strip. Branch, user, notifications, and global menu
 * live on the ERP GlobalHeader — this is not a second application header.
 */
export function POSHeader({
  terminalId,
  terminalOptions,
  onTerminalChange,
  cashierName,
  holdCount,
  shiftOpen = false,
}: POSHeaderProps) {
  const cashier = cashierName ?? "—";

  return (
    <div className="pos-header relative z-10 min-w-0" role="region" aria-label="POS status">
      <div className="pos-header-left">
        <HeaderField kicker="Terminal" className="pos-header-terminal">
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

        <div className="pos-header-field pos-header-cashier" aria-label="Cashier">
          <span className="pos-header-kicker">Cashier</span>
          <span className="pos-header-value" title={cashier}>
            {cashier}
          </span>
        </div>

        <span aria-label="Shift Status" className="shrink-0">
          <POSBadge tone={shiftOpen ? "success" : "warning"}>
            {shiftOpen ? "Shift Open" : "No Shift"}
          </POSBadge>
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
            "inline-flex h-8 items-center gap-1.5 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2 text-xs font-semibold",
            "hover:bg-[var(--pos-muted-bg)] focus-visible:outline-none focus-visible:shadow-[var(--pos-focus)]",
          )}
        >
          Held
          <span className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-light)] px-1.5 font-semibold text-[var(--pos-primary)]">
            {holdCount}
          </span>
        </Link>
      </div>
    </div>
  );
}
