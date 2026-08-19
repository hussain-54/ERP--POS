import { cn } from "../lib/cn.js";

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--erp-border)]" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={cn(
            "inline-flex min-h-11 items-center px-3 text-sm font-medium text-[var(--erp-muted)]",
            value === item.id && "border-b-2 border-[var(--erp-brand)] text-[var(--erp-brand)]",
          )}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
