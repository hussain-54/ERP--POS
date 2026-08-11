import { useEffect, useMemo, useState } from "react";
import { SearchInput } from "./SearchInput.js";

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
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(18,32,46,0.45)] p-4 pt-[12vh]">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[var(--erp-shadow)]">
        <div className="border-b border-[var(--erp-border)] p-3">
          <SearchInput
            autoFocus
            placeholder="Search modules, actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
        <ul className="max-h-80 overflow-auto p-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--erp-bg)]"
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
