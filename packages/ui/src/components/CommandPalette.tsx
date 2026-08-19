import { useEffect, useMemo, useState } from "react";
import { SearchInput } from "./SearchInput.js";
import { SURFACE_CLASS } from "../lib/control.js";
import { cn } from "../lib/cn.js";

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: CommandItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 12);
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(15,27,51,0.45)] p-4 pt-[12vh]">
      <div className={cn(SURFACE_CLASS, "w-full max-w-xl overflow-hidden")}>
        <div className="border-b border-[var(--erp-border)] p-3">
          <SearchInput
            className="h-11 min-h-11"
            autoFocus
            placeholder="Search modules, actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
        <ul className="max-h-80 overflow-auto p-1">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between rounded-[var(--erp-radius)] px-3 text-left text-sm hover:bg-[var(--erp-bg)] focus-visible:outline-none focus-visible:bg-[var(--erp-bg)] active:bg-[var(--erp-bg)]"
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                <span>{item.label}</span>
                {item.group ? (
                  <span className="text-xs text-[var(--erp-muted)]">{item.group}</span>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[var(--erp-muted)]">No results</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
