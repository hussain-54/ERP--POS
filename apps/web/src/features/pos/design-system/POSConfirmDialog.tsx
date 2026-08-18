import { useEffect } from "react";
import { POSButton } from "./POSButton";
import { POSModal } from "./POSModal";

/** POS-styled confirm dialog — wraps POSModal (does not duplicate ERP ConfirmationDialog). */
export function POSConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.target instanceof HTMLTextAreaElement) return;
      if (event.target instanceof HTMLButtonElement) return;
      if (loading) return;
      event.preventDefault();
      event.stopPropagation();
      onConfirm();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, loading, onConfirm]);

  return (
    <POSModal
      open={open}
      title={title}
      onClose={() => {
        if (!loading) onCancel();
      }}
      size="sm"
      footer={
        <>
          <POSButton variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </POSButton>
          <POSButton variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </POSButton>
        </>
      }
    >
      <p className="text-sm text-[var(--pos-muted)]">{description}</p>
    </POSModal>
  );
}
