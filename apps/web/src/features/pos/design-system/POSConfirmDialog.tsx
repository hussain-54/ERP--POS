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
  return (
    <POSModal
      open={open}
      title={title}
      onClose={onCancel}
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
