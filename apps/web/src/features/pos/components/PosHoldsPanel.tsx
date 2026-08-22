import type { HeldSaleFilter } from "@electronic-erp/contracts";
import { memo } from "react";
import {
  POSBadge,
  POSButton,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "../design-system";
import { displayCustomerName, holdNumber, snapshotTotals } from "../held-sales";

export type HeldSaleListItem = {
  id: string;
  holdLabel?: string | null;
  holdReason?: string | null;
  notes?: string | null;
  heldAt?: string;
  expiresAt?: string | null;
  heldBy?: string | null;
  customerId?: string | null;
  status?: string;
  bucket?: string;
  cartItemCount?: number;
  minutesUntilExpiry?: number | null;
  isExpired?: boolean;
  cartSnapshot?: Record<string, unknown>;
};

type Props = {
  holds: HeldSaleListItem[];
  filter: HeldSaleFilter;
  onFilterChange: (f: HeldSaleFilter) => void;
  holdReason: string;
  onHoldReasonChange: (v: string) => void;
  holdNotes: string;
  onHoldNotesChange: (v: string) => void;
  busy?: boolean;
  canCreateHold?: boolean;
  onCreateHold?: () => void;
  onResume: (id: string) => void;
  onResumeCheckout: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTransfer: (id: string) => void;
  onCancel: (id: string) => void;
  onDiscard: (id: string) => void;
};

const FILTERS: Array<{ id: HeldSaleFilter; label: string }> = [
  { id: "all_pending", label: "All" },
  { id: "active", label: "Active" },
  { id: "expiring", label: "Expiring" },
  { id: "expired", label: "Expired" },
  { id: "today", label: "Today" },
  { id: "mine", label: "Mine" },
];

function toneFor(bucket?: string, status?: string) {
  if (status === "expired" || bucket === "expired") return "danger" as const;
  if (bucket === "expiring") return "warning" as const;
  return "primary" as const;
}

function statusLabel(bucket?: string, status?: string) {
  if (status === "expired" || bucket === "expired") return "Expired";
  if (bucket === "expiring") return "Expiring soon";
  if (status === "cancelled") return "Cancelled";
  if (status === "discarded") return "Discarded";
  if (status === "resumed") return "Resumed";
  return "Active";
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

export const PosHoldsPanel = memo(function PosHoldsPanel({
  holds,
  filter,
  onFilterChange,
  holdReason,
  onHoldReasonChange,
  holdNotes,
  onHoldNotesChange,
  busy,
  canCreateHold,
  onCreateHold,
  onResume,
  onResumeCheckout,
  onEdit,
  onDuplicate,
  onTransfer,
  onCancel,
  onDiscard,
}: Props) {
  return (
    <div className="pos-holds-drawer space-y-3">
      {onCreateHold ? (
        <div className="space-y-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] p-3">
          <div className="text-xs font-medium text-[var(--pos-muted)]">New hold</div>
          <POSInput
            label="Hold reason"
            value={holdReason}
            onChange={(e) => onHoldReasonChange(e.target.value)}
            placeholder="Customer stepped out…"
          />
          <POSInput
            label="Notes"
            value={holdNotes}
            onChange={(e) => onHoldNotesChange(e.target.value)}
            placeholder="Optional notes"
          />
          <POSButton
            size="sm"
            onClick={onCreateHold}
            disabled={!canCreateHold || busy}
            loading={busy}
          >
            Hold current sale (F2)
          </POSButton>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <POSButton
            key={f.id}
            size="sm"
            variant={filter === f.id ? "primary" : "ghost"}
            onClick={() => onFilterChange(f.id)}
          >
            {f.label}
          </POSButton>
        ))}
      </div>

      {busy && holds.length === 0 ? (
        <POSLoadingState label="Loading held bills…" rows={4} />
      ) : holds.length === 0 ? (
        <POSEmptyState title="No held bills" description="Hold a sale to resume later (F2)" />
      ) : (
        <POSTable className="pos-register-table">
          <POSTableHead>
              <tr>
              <POSTh>Hold #</POSTh>
              <POSTh>Customer</POSTh>
              <POSTh>Items</POSTh>
              <POSTh className="text-right">Amount</POSTh>
              <POSTh>Time</POSTh>
              <POSTh>Status</POSTh>
              <POSTh>Action</POSTh>
            </tr>
          </POSTableHead>
          <POSTableBody>
            {holds.map((h) => {
              const totals = snapshotTotals(h.cartSnapshot);
              const resumable = h.status === "held" && h.bucket !== "expired";
              const customerLabel = displayCustomerName(
                {
                  customerName: null,
                  customerId: h.customerId ?? null,
                  cartSnapshot: h.cartSnapshot ?? {},
                },
                {},
              );
              return (
                <tr key={h.id}>
                  <POSTd>
                    <div className="min-w-0">
                      <div className="font-medium">{holdNumber({ holdLabel: h.holdLabel ?? null, heldAt: h.heldAt ?? "" })}</div>
                      {h.holdReason ? (
                        <div className="truncate text-[11px] text-[var(--pos-muted)]">{h.holdReason}</div>
                      ) : null}
                    </div>
                  </POSTd>
                  <POSTd>
                    <div className="max-w-[8rem] truncate text-sm font-medium" title={customerLabel}>
                      {customerLabel}
                    </div>
                  </POSTd>
                  <POSTd className="tabular-nums">{h.cartItemCount ?? "—"}</POSTd>
                  <POSTd className="text-right tabular-nums font-semibold">
                    {totals ? `Rs ${formatMoney(totals.grand)}` : "—"}
                  </POSTd>
                  <POSTd className="text-[11px] text-[var(--pos-muted)]">
                    {h.heldAt ? new Date(h.heldAt).toLocaleString() : "—"}
                    {h.minutesUntilExpiry != null ? ` · ${h.minutesUntilExpiry}m left` : ""}
                  </POSTd>
                  <POSTd>
                    <POSBadge tone={toneFor(h.bucket, h.status)}>{statusLabel(h.bucket, h.status)}</POSBadge>
                  </POSTd>
                  <POSTd>
                    <div className="flex flex-wrap gap-1">
                      {resumable ? (
                        <>
                          <POSButton size="sm" onClick={() => onResume(h.id)}>
                            Resume
                          </POSButton>
                          <POSButton size="sm" variant="success" onClick={() => onResumeCheckout(h.id)}>
                            Resume & pay
                          </POSButton>
                          <POSButton size="sm" variant="secondary" onClick={() => onEdit(h.id)}>
                            Edit
                          </POSButton>
                          <POSButton size="sm" variant="ghost" onClick={() => onTransfer(h.id)}>
                            Transfer
                          </POSButton>
                          <POSButton size="sm" variant="ghost" onClick={() => onCancel(h.id)}>
                            Cancel
                          </POSButton>
                        </>
                      ) : null}
                      <POSButton size="sm" variant="secondary" onClick={() => onDuplicate(h.id)}>
                        Duplicate
                      </POSButton>
                      {h.status === "held" || h.status === "expired" ? (
                        <POSButton size="sm" variant="ghost" onClick={() => onDiscard(h.id)}>
                          Discard
                        </POSButton>
                      ) : null}
                    </div>
                  </POSTd>
                </tr>
              );
            })}
          </POSTableBody>
        </POSTable>
      )}
    </div>
  );
});
