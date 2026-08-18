import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { POSIconButton } from "./POSIconButton";
import { posCn } from "./posCn";
import { useEscapeToClose } from "./useEscapeToClose";
import { usePosDialogFocus } from "./usePosDialogFocus";

export function POSDrawer({
  open,
  title,
  children,
  onClose,
  side = "right",
  footer,
  size = "md",
  padded = true,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: "left" | "right" | "bottom";
  footer?: ReactNode;
  size?: "md" | "lg" | "full";
  padded?: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  useEscapeToClose(open, onClose);
  usePosDialogFocus(open, panelRef);

  if (!open || typeof document === "undefined") return null;

  const width =
    size === "full"
      ? "w-full max-w-none"
      : size === "lg"
        ? "w-full max-w-xl"
        : "w-full max-w-md";

  return createPortal(
    <div
      className={posCn("fixed inset-0 z-50 flex", side === "bottom" ? "flex-col justify-end" : "")}
      role="presentation"
    >
      <button
        type="button"
        className="flex-1 bg-black/40"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-drawer-title"
        tabIndex={-1}
        className={posCn(
          "flex min-h-0 flex-col bg-[var(--pos-workspace)] shadow-[var(--pos-shadow-md)] outline-none",
          side === "bottom"
            ? "max-h-[90vh] w-full rounded-t-[var(--pos-radius-lg)] border-t border-[var(--pos-border)]"
            : posCn("h-full", width, side === "left" ? "order-first border-r border-[var(--pos-border)]" : "border-l border-[var(--pos-border)]"),
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
        <div className={posCn("min-h-0 flex-1 overflow-auto", padded ? "p-4" : "")}>{children}</div>
        {footer ? (
          <div className="border-t border-[var(--pos-border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
