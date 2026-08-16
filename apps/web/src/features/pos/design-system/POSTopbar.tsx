import { useEffect, useState } from "react";
import type { LocaleMode, PosMode } from "../pos-types";
import { POSBadge } from "./POSBadge";
import { POSIconButton } from "./POSIconButton";
import { POSSelect } from "./POSSelect";
import { posCn } from "./posCn";

export interface POSTopbarProps {
  branchId: string | null;
  branches: string[];
  onBranchChange: (id: string) => void;
  cashierName?: string;
  online: boolean;
  holdCount: number;
  mode: PosMode;
  locale: LocaleMode;
  onModeChange: (m: PosMode) => void;
  onLocaleChange: (l: LocaleMode) => void;
  onMenu?: () => void;
  clock?: Date;
  shiftOpen?: boolean;
  onHeldSales?: () => void;
  onNotifications?: () => void;
  notificationCount?: number;
  onShiftToggle?: () => void;
  workspaceLabel?: string;
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
    <div className="mx-auto hidden text-center text-sm md:block">
      <div className="font-semibold tabular-nums text-[var(--pos-ink)]">{time}</div>
      <div className="text-[11px] text-[var(--pos-muted)]">{date}</div>
    </div>
  );
}

/** Operational POS bar — branch, shift, connection, holds. ERP module nav is in AppShell. */
export function POSTopbar({
  branchId,
  branches,
  onBranchChange,
  online,
  holdCount,
  mode,
  locale,
  onModeChange,
  onLocaleChange,
  onMenu,
  shiftOpen = false,
  onHeldSales,
  onShiftToggle,
}: POSTopbarProps) {
  return (
    <div
      className={posCn(
        "flex min-h-12 min-w-0 flex-wrap items-center gap-2 overflow-x-hidden",
        "border-b border-[var(--pos-border)] bg-[var(--pos-workspace)] px-3 py-1.5",
      )}
    >
      {onMenu ? (
        <POSIconButton label="Open menu" className="md:hidden" onClick={onMenu}>
          ☰
        </POSIconButton>
      ) : null}

      <div className="min-w-0 max-w-full sm:w-44">
        <POSSelect
          aria-label="Branch"
          value={branchId ?? ""}
          onChange={(e) => onBranchChange(e.target.value)}
          options={
            branches.length
              ? branches.map((id) => ({ value: id, label: `Branch ${id.slice(0, 8)}` }))
              : [{ value: "", label: "No branch" }]
          }
        />
      </div>

      <POSBadge tone="neutral">Terminal</POSBadge>
      <button
        type="button"
        onClick={onShiftToggle}
        disabled={!onShiftToggle}
        className="rounded-full"
        title={shiftOpen ? "Close shift" : "Open shift"}
      >
        <POSBadge tone={shiftOpen ? "success" : "warning"}>
          {shiftOpen ? "Shift Open" : "No Shift"}
        </POSBadge>
      </button>

      <POSClock />

      <div className="ml-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
        <POSBadge tone={online ? "success" : "danger"}>
          {online ? "Online" : "Offline"}
        </POSBadge>

        <POSButtonishHeld holdCount={holdCount} onClick={onHeldSales} />

        <div className="w-24">
          <POSSelect
            aria-label="Mode"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as PosMode)}
            options={[
              { value: "easy", label: "Easy" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </div>
        <div className="w-24">
          <POSSelect
            aria-label="Language"
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value as LocaleMode)}
            options={[
              { value: "en", label: "EN" },
              { value: "ur", label: "UR" },
              { value: "en_ur", label: "EN+UR" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function POSButtonishHeld({
  holdCount,
  onClick,
}: {
  holdCount: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={posCn(
        "inline-flex h-8 items-center gap-1.5 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2.5 text-xs font-medium",
        "hover:bg-[var(--pos-muted-bg)] focus-visible:shadow-[var(--pos-focus)] disabled:opacity-50",
      )}
      title="Held sales (F2+Shift)"
    >
      Held
      <span className="rounded-full bg-[var(--pos-primary-soft)] px-1.5 font-semibold text-[var(--pos-primary)]">
        {holdCount}
      </span>
    </button>
  );
}
