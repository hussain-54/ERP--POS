import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { POSIconButton } from "./POSIconButton";
import { posCn } from "./posCn";

export function POSModal({
  open,
  title,
  children,
  onClose,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  if (!open || typeof document === "undefined") return null;

  const width =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-modal-title"
        className={posCn(
          "pos-surface flex w-full flex-col shadow-[var(--pos-shadow-md)]",
          width,
          "max-h-[90vh]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--pos-border)] px-4 py-3">
          <h2 id="pos-modal-title" className="text-sm font-semibold">
            {title}
          </h2>
          <POSIconButton label="Close" onClick={onClose}>
            ✕
          </POSIconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-[var(--pos-border)] px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
