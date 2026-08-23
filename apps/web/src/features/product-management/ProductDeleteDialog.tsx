import { Button, Card } from "@electronic-erp/ui";

export function ProductDeleteDialog({
  open,
  productName,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  productName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div className="erp-modal-panel w-full max-w-md" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <Card title="Deactivate product?">
          <p className="text-sm text-[var(--erp-muted)]">
            <strong className="text-[var(--erp-ink)]">{productName}</strong> will be deactivated (soft delete). Sales
            history, stock links, and accounting references are preserved. You can restore the product later from the
            product list.
          </p>
          <p className="mt-2 text-sm text-[var(--erp-muted)]">
            Hard delete is not available — the catalog API only supports deactivation when dependencies exist.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={busy} onClick={onConfirm}>
              Deactivate product
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
