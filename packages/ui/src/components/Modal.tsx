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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(15,27,51,0.45)]"
        aria-label="Close dialog overlay"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(SURFACE_CLASS, "relative z-10 w-full max-w-lg p-4")}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--erp-ink)]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
