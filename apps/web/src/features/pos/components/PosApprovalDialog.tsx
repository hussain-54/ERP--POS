import { Button, Card, Input } from "@electronic-erp/ui";

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md space-y-3 p-4 shadow-xl" title={title}>
        <p className="text-sm text-[var(--erp-muted)]">{description}</p>
        <Input
          label="Reason (required)"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
        {!canApprove ? (
          <p className="text-sm text-[var(--erp-danger)]">
            Current user lacks manager/owner discount permission. Sign in as a manager to approve, or
            reduce the override.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!canApprove || !reason.trim()} onClick={onApprove}>
            Approve override
          </Button>
        </div>
      </Card>
    </div>
  );
}
