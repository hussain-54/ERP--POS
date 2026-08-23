import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { restoreHoldTransaction } from "@electronic-erp/domain";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { posApi, snapshotFromHoldResume } from "../api";
import { money } from "../format";
import { SalesPageShell } from "./SalesPageShell";

function holdTotals(snapshot: Record<string, unknown> | undefined) {
  if (!snapshot) return { items: 0, grand: 0 };
  try {
    const restored = restoreHoldTransaction(snapshot);
    const items = restored.cart.length;
    const fromTotals = restored.totals?.grand;
    if (typeof fromTotals === "number" && Number.isFinite(fromTotals)) {
      return { items, grand: fromTotals };
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
    return { items, grand: sum };
  } catch {
    const cart = Array.isArray(snapshot.cart) ? snapshot.cart : [];
    return { items: cart.length, grand: Number((snapshot.totals as { grand?: number } | null)?.grand ?? 0) };
  }
}

export function HeldSalesRegister({ title = "Held sales" }: { title?: string }) {
  const { branchId } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await posApi.listHolds(branchId);
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resume(holdId: string) {
    try {
      const res = await posApi.resumeHold(holdId, false);
      const snapshot = snapshotFromHoldResume(res);
      restoreHoldTransaction(snapshot);
      navigate("/pos/sales/new", { state: { resumeSnapshot: snapshot } });
    } catch (err) {
      push({
        title: "Resume failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    }
  }

  async function discard(holdId: string) {
    if (!window.confirm("Discard this held sale?")) return;
    try {
      await posApi.discardHold(holdId);
      push({ title: "Hold discarded", tone: "success" });
      void load();
    } catch (err) {
      push({
        title: "Discard failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    }
  }

  const rows = useMemo(() => {
    return items.map((row) => {
      const id = String(row.id ?? "");
      const snapshot = (row.cartSnapshot ?? row.cart_snapshot) as Record<string, unknown> | undefined;
      const totals = holdTotals(snapshot);
      const customer =
        String(
          (snapshot?.customerName as string | undefined) ||
            row.customerName ||
            (snapshot?.walkIn ? "Walk-in" : "") ||
            "Walk-in",
        ) || "Walk-in";
      return {
        id,
        label: String(row.holdLabel ?? row.hold_label ?? "Held sale"),
        customer,
        items: totals.items,
        grand: totals.grand,
        heldAt: String(row.heldAt ?? row.held_at ?? ""),
        cashier: String(row.heldBy ?? row.held_by ?? "—").slice(0, 8),
        reference: String(row.notes ?? row.holdReason ?? row.hold_reason ?? "—"),
      };
    });
  }, [items]);

  return (
    <SalesPageShell
      title={title}
      description="Parked carts ready to resume into the sales terminal."
      actions={
        <>
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`rounded-lg px-2.5 py-1.5 ${view === "cards" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded-lg px-2.5 py-1.5 ${view === "table" ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              Table
            </button>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Refresh
          </button>
          <Link to="/pos/sales/new" className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white">
            New Sale
          </Link>
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-slate-400">Loading held sales…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-600">No held sales</p>
            <p className="mt-1 text-xs text-slate-400">Hold a cart from New Sale to park it here.</p>
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <article key={row.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-900">{row.label}</h2>
                    <p className="text-xs text-slate-500">{row.customer}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                    Held
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>
                    <dt>Items</dt>
                    <dd className="font-bold text-slate-800">{row.items}</dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd className="font-bold text-slate-800">{money(row.grand)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd className="font-semibold text-slate-700">
                      {row.heldAt ? new Date(row.heldAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Cashier</dt>
                    <dd className="font-semibold text-slate-700">{row.cashier}</dd>
                  </div>
                </dl>
                <p className="mt-2 truncate text-[11px] text-slate-400">Ref · {row.reference}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void resume(row.id)}
                    className="flex-1 rounded-xl bg-[var(--pos-primary)] py-2 text-xs font-bold text-white"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => void discard(row.id)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                  >
                    Discard
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="pos-sales-table w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-bold">Reference</th>
                  <th className="px-3 py-2 font-bold">Customer</th>
                  <th className="px-3 py-2 font-bold">Items</th>
                  <th className="px-3 py-2 font-bold">Total</th>
                  <th className="px-3 py-2 font-bold">Created</th>
                  <th className="px-3 py-2 font-bold">Cashier</th>
                  <th className="px-3 py-2 font-bold" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{row.label}</td>
                    <td className="px-3 py-2.5">{row.customer}</td>
                    <td className="px-3 py-2.5">{row.items}</td>
                    <td className="px-3 py-2.5 font-semibold">{money(row.grand)}</td>
                    <td className="px-3 py-2.5">{row.heldAt ? new Date(row.heldAt).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2.5">{row.cashier}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => void resume(row.id)}
                        className="rounded-lg bg-[var(--pos-primary)] px-2.5 py-1.5 text-[11px] font-bold text-white"
                      >
                        Resume
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SalesPageShell>
  );
}
