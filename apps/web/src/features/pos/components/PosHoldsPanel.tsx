import type { HeldSaleFilter } from "@electronic-erp/contracts";
import {
  POSBadge,
  POSButton,
  POSEmptyState,
  POSInput,
} from "../design-system";

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

export function PosHoldsPanel({
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
    <div className="space-y-3">
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

      {holds.length === 0 ? (
        <POSEmptyState title="No held bills" description="Hold a sale to resume later (F2)" />
      ) : (
        <ul className="space-y-2 text-sm">
          {holds.map((h) => (
            <li
              key={h.id}
              className="space-y-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{h.holdLabel ?? h.id}</div>
                  <div className="text-xs text-[var(--pos-muted)]">
                    {h.heldAt ? new Date(h.heldAt).toLocaleString() : ""}
                    {h.cartItemCount != null ? ` · ${h.cartItemCount} items` : ""}
                    {h.minutesUntilExpiry != null ? ` · ${h.minutesUntilExpiry}m left` : ""}
                  </div>
                  {h.holdReason ? (
                    <div className="truncate text-xs">{h.holdReason}</div>
                  ) : null}
                  {h.notes ? (
                    <div className="truncate text-xs text-[var(--pos-muted)]">{h.notes}</div>
                  ) : null}
                </div>
                <POSBadge tone={toneFor(h.bucket, h.status)}>
                  {h.bucket ?? h.status ?? "held"}
                </POSBadge>
              </div>
              <div className="flex flex-wrap gap-1">
                {h.status === "held" && h.bucket !== "expired" ? (
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
