import { POSButton, POSInput, POSModal } from "../design-system";

interface Props {
  open: boolean;
  title: string;
  description: string;
  reason: string;
  onReasonChange: (v: string) => void;
  canApprove: boolean;
  canRequestApproval: boolean;
  requestBusy?: boolean;
  onApprove: () => void;
  onRequestApproval: () => void;
  onCancel: () => void;
}

/** Real permission / approval gate — no fake PIN and no cashier self-override. */
export function PosApprovalDialog({
  open,
  title,
  description,
  reason,
  onReasonChange,
  canApprove,
  canRequestApproval,
  requestBusy,
  onApprove,
  onRequestApproval,
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
          {canApprove ? (
            <POSButton disabled={!reason.trim()} onClick={onApprove}>
              Apply with permission
            </POSButton>
          ) : (
            <POSButton
              disabled={!canRequestApproval || !reason.trim() || requestBusy}
              onClick={onRequestApproval}
            >
              Request approval
            </POSButton>
          )}
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
          This discount exceeds your cap. Submit a real Approval Workflow request. An approved
          request does not raise the cashier cap — a user with the required permission must apply
          it on New Sale. Sale posting still enforces session discount permissions.
        </p>
      ) : null}
      {!canApprove && !canRequestApproval ? (
        <p className="mt-2 text-sm text-[var(--pos-danger)]">
          Requesting approval requires approvals.act.
        </p>
      ) : null}
    </POSModal>
  );
}
