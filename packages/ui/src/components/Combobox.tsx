import { useMemo, useState } from "react";
import { cn } from "../lib/cn.js";
import { Input } from "./Input.js";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  label?: string;
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
}

export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8);
  }, [options, query]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div className="relative w-full">
      <Input
        label={label}
        value={query || selectedLabel}
        placeholder={placeholder}
        error={error}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value) onChange?.("");
        }}
      />
      {query ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[var(--erp-border)] bg-white shadow-[var(--erp-shadow)]">
          {filtered.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-[var(--erp-bg)]",
                  value === opt.value && "bg-[var(--erp-bg)] font-medium",
                )}
                onClick={() => {
                  onChange?.(opt.value);
                  setQuery("");
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[var(--erp-muted)]">No matches</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
