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
}

/** Sticky POS top bar — white workspace chrome. */
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
}: POSTopbarProps) {
  const time = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = clock.toLocaleDateString();

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

      <POSBadge tone="neutral">Terminal · Main</POSBadge>
      <POSBadge tone="primary">{cashierName}</POSBadge>
      <POSBadge tone={shiftOpen ? "success" : "warning"}>
        {shiftOpen ? "Shift Open" : "No Shift"}
      </POSBadge>

      <div className="mx-auto hidden text-center text-sm md:block">
        <div className="font-semibold tabular-nums text-[var(--pos-ink)]">{time}</div>
        <div className="text-xs text-[var(--pos-muted)]">{date}</div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <POSBadge tone={online ? "success" : "warning"}>
          {syncing ? "↻ Syncing" : online ? "● Online" : "● Offline — Local"}
        </POSBadge>
        <POSBadge tone="neutral">Held {holdCount}</POSBadge>
        <div className="w-28">
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
            Shortcuts
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
      </div>
    </header>
  );
}
