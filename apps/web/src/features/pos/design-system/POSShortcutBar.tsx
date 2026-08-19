import { useNavigate } from "react-router-dom";
import { POS_SHORTCUTS, type PosShortcutAction } from "../pos-types";
import {
  dispatchPosShortcut,
  posShortcutFallbackPath,
} from "../pos-ux";
import { POSActionBar } from "./POSActionBar";
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
    <POSActionBar
      sticky={false}
      className="pos-shortcut-bar shrink-0"
      left={
        <div className="flex flex-nowrap gap-2 text-[11px] text-[var(--pos-muted)]" aria-label="Keyboard shortcuts">
          {POS_SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              title={`${shortcut.key} ${shortcut.label}`}
              onClick={() => activate(shortcut.action)}
              className={posCn(
                "inline-flex items-center gap-1 rounded-[var(--pos-radius-sm)] hover:text-[var(--pos-primary)]",
              )}
            >
              <kbd className="rounded border border-[var(--pos-border)] bg-[var(--pos-muted-bg)] px-1.5 py-0.5 font-semibold text-[var(--pos-ink)]">
                {shortcut.key}
              </kbd>
              <span className="hidden sm:inline">{shortcut.label}</span>
            </button>
          ))}
        </div>
      }
    />
  );
}
