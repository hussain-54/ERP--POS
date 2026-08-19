import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface DropdownItem {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-30 mt-1 min-w-[11rem] rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-1 shadow-[var(--erp-shadow-md)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={cn(
                "block min-h-11 w-full rounded-[var(--erp-radius-sm)] px-3 text-left text-sm hover:bg-[var(--erp-bg)] focus-visible:outline-none focus-visible:bg-[var(--erp-bg)] active:bg-[var(--erp-bg)]",
                item.danger && "text-[var(--erp-danger)]",
              )}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
