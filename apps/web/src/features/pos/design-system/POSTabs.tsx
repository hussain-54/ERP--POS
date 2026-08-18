import type { KeyboardEvent } from "react";
import { posCn } from "./posCn";

export interface POSTabItem<T extends string = string> {
  id: T;
  label: string;
}

/** Underline tabs — not pill buttons. Arrow keys move between tabs. */
export function POSTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: ReadonlyArray<POSTabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    if (!tabs.length) return;
    const current = tabs.findIndex((tab) => tab === event.target);
    const index = current < 0 ? 0 : current;
    event.preventDefault();
    let next = index;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const item = items[next];
    if (!item) return;
    onChange(item.id);
    tabs[next]?.focus();
  }

  return (
    <div
      role="tablist"
      className={posCn("flex flex-wrap gap-0 border-b border-[var(--pos-border)]", className)}
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={posCn(
              "relative -mb-px h-9 px-3 text-[13px] font-medium",
              selected
                ? "border-b-2 border-[var(--pos-primary)] text-[var(--pos-primary)]"
                : "border-b-2 border-transparent text-[var(--pos-muted)] hover:text-[var(--pos-ink)]",
            )}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
