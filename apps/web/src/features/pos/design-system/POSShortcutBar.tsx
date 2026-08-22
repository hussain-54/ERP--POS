import { useNavigate } from "react-router-dom";
import { POS_SHORTCUTS, type PosShortcutAction } from "../pos-types";
import { dispatchPosShortcut, posShortcutFallbackPath } from "../pos-ux";
import { posCn } from "./posCn";

type ShortcutItem = (typeof POS_SHORTCUTS)[number];

export function POSShortcutBar() {
  const navigate = useNavigate();
  const left: ShortcutItem[] = POS_SHORTCUTS.slice(0, 4);
  const right: ShortcutItem[] = POS_SHORTCUTS.slice(4);

  function activate(action: PosShortcutAction) {
    const handled = dispatchPosShortcut(action);
    if (handled) return;
    const path = posShortcutFallbackPath(action);
    if (path) navigate(path);
  }

  function renderGroup(items: ShortcutItem[]) {
    return items.map((shortcut) => (
      <button
        key={shortcut.key}
        type="button"
        title={`${shortcut.key} ${shortcut.label}`}
        aria-label={`${shortcut.key} ${shortcut.label}`}
        onClick={() => activate(shortcut.action)}
        className={posCn(
          "inline-flex min-h-8 items-center gap-1.5 rounded-[var(--pos-radius-sm)] px-0.5",
          "text-[11px] text-[var(--pos-muted)]",
          "hover:text-[var(--pos-ink)]",
          "focus-visible:outline-none focus-visible:shadow-[var(--pos-focus)]",
        )}
      >
        <kbd className="rounded border border-[var(--pos-border)] bg-[var(--pos-bg)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--pos-ink)] shadow-sm">
          {shortcut.key}
        </kbd>
        <span>{shortcut.label}</span>
      </button>
    ));
  }

  return (
    <footer
      className="pos-shortcut-bar flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[var(--pos-border)] px-4 py-2 sm:px-6"
      aria-label="Keyboard shortcuts"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">{renderGroup(left)}</div>
      <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1">{renderGroup(right)}</div>
    </footer>
  );
}
