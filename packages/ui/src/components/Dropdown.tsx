import { useEffect, useRef, useState, type ReactNode } from "react";
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
  /** Optional panel header (avatar, name, email). */
  header?: ReactNode;
  className?: string;
  menuClassName?: string;
}

export function Dropdown({
  trigger,
  items,
  align = "right",
  header,
  className,
  menuClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1 min-w-[14rem] max-w-[min(20rem,calc(100vw-1.5rem))] rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-1 shadow-[var(--erp-shadow-md)]",
            align === "right" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {header ? (
            <div className="border-b border-[var(--erp-border)] px-3 py-2.5 mb-1">{header}</div>
          ) : null}
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
