import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { POSBadge } from "./POSBadge";
import { POSIconButton } from "./POSIconButton";
import { POSSelect } from "./POSSelect";
import { posCn } from "./posCn";

export interface POSHeaderProps {
  branchId: string | null;
  branchOptions: Array<{ value: string; label: string }>;
  onBranchChange: (id: string) => void;
  terminalId: string;
  terminalOptions: Array<{ value: string; label: string }>;
  onTerminalChange: (id: string) => void;
  cashierName?: string;
  holdCount: number;
  onMenu?: () => void;
  menuOpen?: boolean;
  shiftOpen?: boolean;
  userName?: string;
  onProfile?: () => void;
  onLogout?: () => void;
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
    <div className="text-center text-xs" aria-label="Date / Time">
      <div className="font-semibold tabular-nums text-[var(--pos-ink)]">{time}</div>
      <div className="hidden text-[10px] text-[var(--pos-muted)] sm:block">{date}</div>
    </div>
  );
}

function initials(name?: string) {
  const parts = (name ?? "User").trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

/**
 * Compact POS terminal header. Shared by every POS operational page.
 */
export function POSHeader({
  branchId,
  branchOptions,
  onBranchChange,
  terminalId,
  terminalOptions,
  onTerminalChange,
  cashierName,
  holdCount,
  onMenu,
  menuOpen = false,
  shiftOpen = false,
  userName,
  onProfile,
  onLogout,
}: POSHeaderProps) {
  const [userOpen, setUserOpen] = useState(false);
  const cashier = cashierName ?? userName ?? "—";

  return (
    <header
      className={posCn(
        "pos-header relative z-50 flex min-h-12 min-w-0 items-center gap-2 overflow-x-auto",
        "px-2 py-1.5 sm:px-3",
      )}
    >
      {onMenu ? (
        <POSIconButton
          label="Menu"
          aria-expanded={menuOpen}
          aria-controls="pos-environment-nav"
          onClick={onMenu}
        >
          ☰
        </POSIconButton>
      ) : null}

      <Link
        to="/"
        aria-label="ERP Home"
        title="Return to the 39-module ERP"
        className="inline-flex h-8 shrink-0 items-center rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2 text-xs font-medium text-[var(--pos-primary)] hover:bg-[var(--pos-primary-soft)] focus-visible:outline-none focus-visible:shadow-[var(--pos-focus)]"
      >
        ERP Home
      </Link>

      <div className="w-[8.5rem] shrink-0">
        <POSSelect
          compact
          label="Branch"
          aria-label="Branch"
          value={branchId ?? ""}
          onChange={(e) => onBranchChange(e.target.value)}
          options={
            branchOptions.length
              ? branchOptions
              : [{ value: "", label: "No branch" }]
          }
        />
      </div>

      <div className="w-[8.5rem] shrink-0">
        <POSSelect
          compact
          label="POS Terminal"
          aria-label="POS Terminal"
          value={terminalId}
          onChange={(e) => onTerminalChange(e.target.value)}
          options={terminalOptions.length ? terminalOptions : [{ value: "", label: "This terminal" }]}
        />
      </div>

      <div className="w-[8rem] shrink-0">
        <POSSelect
          compact
          label="Cashier"
          aria-label="Cashier"
          value={cashier}
          onChange={() => undefined}
          options={[{ value: cashier, label: cashier }]}
          disabled
        />
      </div>

      <span aria-label="Shift Status" className="shrink-0">
        <POSBadge tone={shiftOpen ? "success" : "warning"}>
          {shiftOpen ? "Shift Open" : "No Shift"}
        </POSBadge>
      </span>

      <POSClock />

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Link
          to="/held-sales"
          aria-label="Held Sales"
          className={posCn(
            "inline-flex h-8 items-center gap-1.5 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2 text-xs font-medium",
            "hover:bg-[var(--pos-muted-bg)] focus-visible:shadow-[var(--pos-focus)]",
          )}
        >
          Held
          <span className="rounded-[var(--pos-radius-sm)] bg-[var(--pos-light)] px-1.5 font-semibold text-[var(--pos-primary)]">
            {holdCount}
          </span>
        </Link>

        <Link
          to="/notifications"
          aria-label="Notifications"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] text-sm text-[var(--pos-ink)] hover:bg-[var(--pos-muted-bg)]"
        >
          <span aria-hidden>🔔</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            aria-label="User"
            aria-expanded={userOpen}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] pl-1 pr-2 text-xs font-medium text-[var(--pos-ink)] hover:bg-[var(--pos-muted-bg)]"
            onClick={() => setUserOpen((value) => !value)}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--pos-primary)] text-[10px] font-semibold text-white"
              aria-hidden
            >
              {initials(userName ?? cashierName)}
            </span>
            <span className="hidden max-w-[6.5rem] truncate lg:inline">{userName ?? "User"}</span>
          </button>
          {userOpen ? (
            <div className="absolute right-0 z-50 mt-1 min-w-[9rem] rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-workspace)] py-1 text-sm shadow-[var(--pos-shadow-md)]">
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[var(--pos-ink)] hover:bg-[var(--pos-muted-bg)]"
                onClick={() => {
                  setUserOpen(false);
                  onProfile?.();
                }}
              >
                Profile
              </button>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[var(--pos-danger)] hover:bg-[var(--pos-danger-soft)]"
                onClick={() => {
                  setUserOpen(false);
                  onLogout?.();
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export { POSHeader as PosHeader };
