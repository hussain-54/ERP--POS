import { useEffect, useMemo, useState } from "react";
import { restoreHoldTransaction } from "@electronic-erp/domain";
import { posApi, snapshotFromHoldResume } from "../api";
import { money } from "../format";

function holdTotals(snapshot: Record<string, unknown> | undefined) {
  if (!snapshot) return { items: 0, grand: 0, itemNames: [] as string[] };
  try {
    const restored = restoreHoldTransaction(snapshot);
    const items = restored.cart.length;
    const itemNames = (restored.cart as Array<{ name?: string }>).map((c) => c.name || "Item").slice(0, 3);
    const fromTotals = restored.totals?.grand;
    if (typeof fromTotals === "number" && Number.isFinite(fromTotals)) {
      return { items, grand: fromTotals, itemNames };
    }
    let sum = 0;
    for (const raw of restored.cart) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const qty = Number(r.qty ?? 1);
      const rate = Number(r.rate ?? r.unitPrice ?? 0);
      const discount = Number(r.discount ?? 0);
      sum += Math.max(0, qty * rate - discount);
    }
    return { items, grand: sum, itemNames };
  } catch {
    const cart = Array.isArray(snapshot.cart) ? snapshot.cart : [];
    return {
      items: cart.length,
      grand: Number((snapshot.totals as { grand?: number } | null)?.grand ?? 0),
      itemNames: [],
    };
  }
}

export function ResumeSaleDialog({
  open,
  branchId,
  onClose,
  onResume,
}: {
  open: boolean;
  branchId?: string | null;
  onClose: () => void;
  onResume: (snapshot: Record<string, unknown>) => void;
}) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !branchId) return;
    setLoading(true);
    void posApi
      .listHolds(branchId)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, branchId]);

  const heldRows = useMemo(() => {
    return items.map((row) => {
      const id = String(row.id ?? "");
      const snapshot = (row.cartSnapshot ?? row.cart_snapshot) as Record<string, unknown> | undefined;
      const totals = holdTotals(snapshot);
      const customer =
        String(
          (snapshot?.customerName as string | undefined) ||
            row.customerName ||
            (snapshot?.walkIn ? "Walk-in Customer" : "") ||
            "Walk-in Customer",
        ) || "Walk-in Customer";
      const reference = String(row.notes ?? row.holdReason ?? row.hold_reason ?? "");
      const heldAt = String(row.heldAt ?? row.held_at ?? "");
      return {
        id,
        raw: row,
        snapshot,
        label: String(row.holdLabel ?? row.hold_label ?? "Held Sale"),
        customer,
        itemsCount: totals.items,
        itemNames: totals.itemNames,
        grand: totals.grand,
        heldAt,
        reference,
      };
    });
  }, [items]);

  if (!open) return null;

  async function handleResume(holdId: string, fallbackSnapshot?: Record<string, unknown>) {
    setResumingId(holdId);
    try {
      const res = await posApi.resumeHold(holdId, false);
      const snapshot = snapshotFromHoldResume(res);
      restoreHoldTransaction(snapshot);
      onResume(snapshot);
      onClose();
    } catch {
      // If network resume fails, attempt restoring local snapshot
      if (fallbackSnapshot) {
        restoreHoldTransaction(fallbackSnapshot);
        onResume(fallbackSnapshot);
        onClose();
      }
    } finally {
      setResumingId(null);
    }
  }

  async function handleDiscard(holdId: string) {
    if (!window.confirm("Discard this held sale?")) return;
    try {
      await posApi.discardHold(holdId);
      setItems((prev) => prev.filter((i) => String(i.id) !== holdId));
    } catch {
      // ignore
    }
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal max-w-xl p-5 text-left"
        role="dialog"
        aria-modal
        aria-label="Resume Held Sale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <i className="fa-solid fa-play text-base" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Resume Held Sale</h2>
              <p className="text-xs text-slate-500">
                Pick a parked cart to restore into the active POS workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Content */}
        <div className="my-3 max-h-96 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading held sales…</div>
          ) : heldRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center">
              <i className="fa-solid fa-cart-shopping text-2xl text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-600">No sales on hold</p>
              <p className="text-[11px] text-slate-400">Press Hold (F6) from the cart to park a transaction.</p>
            </div>
          ) : (
            heldRows.map((h) => {
              const dt = h.heldAt ? new Date(h.heldAt) : null;
              const timeStr = dt
                ? `${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${dt.toLocaleDateString()}`
                : "Just now";

              return (
                <div
                  key={h.id}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-blue-500 hover:bg-blue-50/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{h.customer}</span>
                        {h.reference ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                            {h.reference}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        <i className="fa-regular fa-clock mr-1" />
                        {timeStr}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-blue-600">{money(h.grand)}</span>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        {h.itemsCount} {h.itemsCount === 1 ? "Item" : "Items"}
                      </p>
                    </div>
                  </div>

                  {h.itemNames.length > 0 ? (
                    <div className="mt-2 text-[11px] text-slate-600 truncate border-t border-slate-200/60 pt-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mr-1.5">Items:</span>
                      {h.itemNames.join(", ")}
                      {h.itemsCount > h.itemNames.length ? ` +${h.itemsCount - h.itemNames.length} more` : ""}
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-200/50 pt-2">
                    <button
                      type="button"
                      onClick={() => handleDiscard(h.id)}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 transition"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      disabled={resumingId === h.id}
                      onClick={() => handleResume(h.id, h.snapshot)}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-98"
                    >
                      <i className="fa-solid fa-play text-[9px]" />
                      <span>{resumingId === h.id ? "Resuming…" : "Resume Sale"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
