import { POS_SHORTCUTS } from "../types";

export function PosShortcutBar() {
  const left = POS_SHORTCUTS.slice(0, 4);
  const right = POS_SHORTCUTS.slice(4);
  return (
    <footer className="pos-shortcut-bar shrink-0" aria-label="Keyboard shortcuts">
      <div className="flex items-center gap-5">
        {left.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="pos-shortcut-chip">{s.label}</span>
            <span>{s.fnKey}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-5">
        {right.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="pos-shortcut-chip">{s.label}</span>
            <span>{s.fnKey}</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
