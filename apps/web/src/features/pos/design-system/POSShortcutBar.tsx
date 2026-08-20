import { useNavigate } from "react-router-dom";
import { POS_SHORTCUTS, type PosShortcutAction } from "../pos-types";
import { dispatchPosShortcut, posShortcutFallbackPath } from "../pos-ux";
import { posCn } from "./posCn";

export function POSShortcutBar() {
  const navigate = useNavigate();

  function activate(action: PosShortcutAction) {
    const handled = dispatchPosShortcut(action);
    if (handled) return;
    const path = posShortcutFallbackPath(action);
    if (path) navigate(path);
  }

  return (
    <div
      className="pos-shortcut-bar flex shrink-0 flex-wrap items-center gap-1.5 border-t border-[var(--pos-border)] px-2 py-1.5 sm:px-3"
      aria-label="Keyboard shortcuts"
    >
      {POS_SHORTCUTS.map((shortcut) => (
        <button
          key={shortcut.key}
          type="button"
          title={`${shortcut.key} ${shortcut.label}`}
          onClick={() => activate(shortcut.action)}
          className={posCn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-workspace)] px-2 py-1",
            "text-[11px] font-semibold text-[var(--pos-ink)] hover:border-[var(--pos-primary)] hover:bg-[var(--pos-primary-soft)] hover:text-[var(--pos-primary)]",
            "focus-visible:outline-none focus-visible:shadow-[var(--pos-focus)]",
          )}
        >
          <kbd className="rounded border border-[var(--pos-border)] bg-[var(--pos-primary-soft)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--pos-primary)]">
            {shortcut.key}
          </kbd>
          <span className="hidden sm:inline">{shortcut.label}</span>
        </button>
      ))}
    </div>
  );
}
