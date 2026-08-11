import { Badge, Button, Select } from "@electronic-erp/ui";
import type { LocaleMode, PosMode } from "../pos-types";
import { POS_SHORTCUTS } from "../pos-types";

interface Props {
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

export function PosHeader({
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
}: Props) {
  const time = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = clock.toLocaleDateString();

  return (
    <header className="sticky top-0 z-20 flex h-14 flex-wrap items-center gap-2 border-b border-[var(--pos-border)] bg-[var(--pos-card)] px-3 shadow-sm">
      <Button variant="ghost" size="sm" className="lg:hidden" onClick={onMenu} title="Menu">
        ☰
      </Button>

      <div className="w-44">
        <Select
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

      <Badge tone="neutral">Terminal · Main</Badge>
      <Badge tone="brand">{cashierName}</Badge>
      <Badge tone={shiftOpen ? "success" : "warning"}>{shiftOpen ? "Shift Open" : "No Shift"}</Badge>

      <div className="mx-auto hidden text-center text-sm md:block">
        <div className="font-semibold tabular-nums">{time}</div>
        <div className="text-xs text-[var(--pos-muted)]">{date}</div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Badge tone={online ? "success" : "warning"}>
          {syncing ? "↻ Syncing" : online ? "● Online" : "● Offline — Local"}
        </Badge>
        <Badge tone="neutral">Held {holdCount}</Badge>
        <Select
          aria-label="Mode"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as PosMode)}
          options={[
            { value: "easy", label: "Easy" },
            { value: "advanced", label: "Advanced" },
          ]}
        />
        <Select
          aria-label="Language"
          value={locale}
          onChange={(e) => onLocaleChange(e.target.value as LocaleMode)}
          options={[
            { value: "en", label: "EN" },
            { value: "ur", label: "UR" },
            { value: "en_ur", label: "EN+UR" },
          ]}
        />
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-lg border border-[var(--pos-border)] px-2 py-1 text-xs text-[var(--pos-muted)]">
            Shortcuts
          </summary>
          <ul className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-[var(--pos-border)] bg-white p-2 text-xs shadow-lg">
            {POS_SHORTCUTS.map((s) => (
              <li key={s.key} className="flex justify-between gap-2 py-1">
                <kbd className="font-semibold">{s.key}</kbd>
                <span className="text-[var(--pos-muted)]">{s.label}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </header>
  );
}
