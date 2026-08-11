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
          className={cn(
            "absolute z-30 mt-2 min-w-[180px] rounded-xl border border-[var(--erp-border)] bg-white p-1 shadow-[var(--erp-shadow)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--erp-bg)]",
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
