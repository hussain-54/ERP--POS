import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { SURFACE_CLASS } from "../lib/control.js";
import { cn } from "../lib/cn.js";

export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export function Modal({ open, title, children, onClose, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(15,27,51,0.45)]"
        aria-label="Close dialog overlay"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          SURFACE_CLASS,
          "erp-modal-panel relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[var(--erp-radius-lg)] p-4 sm:rounded-[var(--erp-radius-lg)]",
        )}
      >
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--erp-ink)]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}
