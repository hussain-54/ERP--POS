import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { POSIconButton } from "./POSIconButton";
import { posCn } from "./posCn";

export function POSDrawer({
  open,
  title,
  children,
  onClose,
  side = "right",
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: "left" | "right";
  footer?: ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <button
        type="button"
        className="flex-1 bg-black/40"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-drawer-title"
        className={posCn(
          "flex h-full w-full max-w-md flex-col bg-[var(--pos-workspace)] shadow-[var(--pos-shadow-md)]",
          side === "left" ? "order-first border-r border-[var(--pos-border)]" : "border-l border-[var(--pos-border)]",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--pos-border)] px-4">
          <h2 id="pos-drawer-title" className="text-sm font-semibold">
            {title}
          </h2>
          <POSIconButton label="Close" onClick={onClose}>
            ✕
          </POSIconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--pos-border)] p-4">{footer}</div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
