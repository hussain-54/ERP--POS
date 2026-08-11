import { POSButton, POSInput, POSModal } from "../design-system";

interface Props {
  open: boolean;
  title: string;
  description: string;
  reason: string;
  onReasonChange: (v: string) => void;
  canApprove: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

/** Manager/owner override gate — uses current session permissions (no fake PIN auth). */
export function PosApprovalDialog({
  open,
  title,
  description,
  reason,
  onReasonChange,
  canApprove,
  onApprove,
  onCancel,
}: Props) {
  return (
    <POSModal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <POSButton variant="ghost" onClick={onCancel}>
            Cancel
          </POSButton>
          <POSButton disabled={!canApprove || !reason.trim()} onClick={onApprove}>
            Approve override
          </POSButton>
        </>
      }
    >
      <p className="mb-3 text-sm text-[var(--pos-muted)]">{description}</p>
      <POSInput
        label="Reason (required)"
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
      />
      {!canApprove ? (
        <p className="mt-2 text-sm text-[var(--pos-danger)]">
          Current user lacks manager/owner discount permission. Sign in as a manager to approve, or
          reduce the override.
        </p>
      ) : null}
    </POSModal>
  );
}
