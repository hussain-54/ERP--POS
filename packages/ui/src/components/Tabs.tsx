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
    <div className="flex gap-1 border-b border-[var(--erp-border)]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "px-3 py-2 text-sm font-medium text-[var(--erp-muted)]",
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
