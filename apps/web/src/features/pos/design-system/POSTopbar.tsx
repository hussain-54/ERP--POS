import type { LocaleMode, PosMode } from "../pos-types";
import { POS_SHORTCUTS } from "../pos-types";
import { POSBadge } from "./POSBadge";
import { POSIconButton } from "./POSIconButton";
import { POSSelect } from "./POSSelect";
import { posCn } from "./posCn";

export interface POSTopbarProps {
  branchId: string | null;
  branches: string[];
  onBranchChange: (id: string) => void;
  cashierName: string;
  online: boolean;
  syncing?: boolean;
  holdCount: number;
  mode: PosMode;
  locale: LocaleMode;
  onModeChange: (m: PosMode) => void;
  onLocaleChange: (l: LocaleMode) => void;
  onMenu: () => void;
  clock: Date;
  shiftOpen?: boolean;
  /** Open held-sales panel */
  onHeldSales?: () => void;
  /** Notifications — not yet wired to a backend feed */
  onNotifications?: () => void;
  notificationCount?: number;
}

/** Sticky POS top bar — branch, terminal, cashier, shift, clock, holds, profile. */
export function POSTopbar({
  branchId,
  branches,
  onBranchChange,
  cashierName,
  online,
  syncing,
  holdCount,
  mode,
  locale,
  onModeChange,
  onLocaleChange,
  onMenu,
  clock,
  shiftOpen = false,
  onHeldSales,
  onNotifications,
  notificationCount = 0,
}: POSTopbarProps) {
  const time = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = clock.toLocaleDateString();
  const initials = cashierName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";

  return (
    <header
      className={posCn(
        "sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-2",
        "border-b border-[var(--pos-border)] bg-[var(--pos-workspace)] px-3 py-2 shadow-[var(--pos-shadow)]",
      )}
    >
      <POSIconButton label="Open menu" className="lg:hidden" onClick={onMenu}>
        ☰
      </POSIconButton>

      <div className="w-40 sm:w-44">
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

      <POSBadge tone="primary">POS Terminal</POSBadge>
      <POSBadge tone="neutral">{cashierName}</POSBadge>
      <POSBadge tone={shiftOpen ? "success" : "warning"}>
        {shiftOpen ? "Shift Open" : "No Shift"}
      </POSBadge>

      <div className="mx-auto hidden text-center text-sm md:block">
        <div className="font-semibold tabular-nums text-[var(--pos-ink)]">{time}</div>
        <div className="text-xs text-[var(--pos-muted)]">{date}</div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
        <POSBadge tone={online ? "success" : "warning"}>
          {syncing ? "Syncing" : online ? "Online" : "Offline"}
        </POSBadge>

        <POSButtonishHeld
          holdCount={holdCount}
          onClick={onHeldSales}
        />

        <POSIconButton
          label={
            onNotifications
              ? "Notifications"
              : "Notifications (not connected yet)"
          }
          onClick={() => onNotifications?.()}
          disabled={!onNotifications}
        >
          <span className="relative">
            ✉
            {notificationCount > 0 ? (
              <span className="absolute -right-2 -top-1 rounded-full bg-[var(--pos-danger)] px-1 text-[9px] text-white">
                {notificationCount}
              </span>
            ) : null}
          </span>
        </POSIconButton>

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

        <details className="relative">
          <summary className="cursor-pointer list-none rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2 py-1.5 text-xs text-[var(--pos-muted)] hover:bg-[var(--pos-muted-bg)]">
            Keys
          </summary>
          <ul className="absolute right-0 z-30 mt-1 w-56 rounded-[var(--pos-radius)] border border-[var(--pos-border)] bg-[var(--pos-workspace)] p-2 text-xs shadow-[var(--pos-shadow-md)]">
            {POS_SHORTCUTS.map((s) => (
              <li key={s.key} className="flex justify-between gap-2 py-1">
                <kbd className="font-semibold text-[var(--pos-ink)]">{s.key}</kbd>
                <span className="text-[var(--pos-muted)]">{s.label}</span>
              </li>
            ))}
          </ul>
        </details>

        <div
          className="flex items-center gap-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-muted-bg)] py-1 pl-1 pr-2"
          title={cashierName}
        >
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--pos-primary)] text-[11px] font-bold text-white"
            aria-hidden
          >
            {initials}
          </span>
          <span className="hidden max-w-[7rem] truncate text-xs font-medium sm:inline">{cashierName}</span>
        </div>
      </div>
    </header>
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
