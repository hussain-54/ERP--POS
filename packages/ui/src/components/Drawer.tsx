import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "./Button.js";

export interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: "left" | "right";
}

export function Drawer({ open, title, children, onClose, side = "right" }: DrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(15,27,51,0.35)]"
        aria-label="Close drawer overlay"
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute top-0 flex h-full w-full max-w-md flex-col border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-[var(--erp-shadow-md)]",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
        )}
      >
        <div className="flex min-h-11 items-center justify-between border-b border-[var(--erp-border)] px-4">
          <h2 className="text-sm font-semibold text-[var(--erp-ink)]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
