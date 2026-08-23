import { useCallback, useEffect, useMemo, useState } from "react";
import { PosComingSoonPanel, PosSubPageShell } from "../PosSubPageShell";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { posApi } from "../api";
import { money } from "../format";
import {
  formatShiftDuration,
  mapShiftRow,
  otherPaymentsTotal,
  reconciliationLines,
  shiftDifference,
  sumCashMovements,
  type ShiftView,
  type ShiftWorkspaceMode,
} from "./shift-utils";

const META: Record<ShiftWorkspaceMode, { title: string; description: string }> = {
  dashboard: { title: "Current shift", description: "Live shift totals refreshed from the server." },
  open: { title: "Open shift", description: "Start a cashier shift with an opening float." },
  "opening-cash": { title: "Opening cash", description: "Set the opening drawer float when opening a shift." },
  "cash-in": { title: "Cash in", description: "Record cash added to the drawer." },
  "cash-out": { title: "Cash out", description: "Record cash removed from the drawer." },
  drawer: { title: "Cash drawer", description: "Drawer balance and movement summary." },
  transfer: { title: "Cash transfer", description: "Transfer cash between drawers." },
  expenses: { title: "Expenses", description: "Shift expenses recorded as cash out." },
  close: { title: "Shift closing", description: "Reconcile and close the active shift." },
  reconcile: { title: "Cash reconciliation", description: "Expected vs counted cash before close." },
};

export function ShiftWorkspace({ mode }: { mode: ShiftWorkspaceMode }) {
  const meta = META[mode];
  const { branchId, user, hasPermission } = useAuth();
  const { push } = useToast();
  const canShift = hasPermission("pos.shift");

  const [shift, setShift] = useState<ShiftView | null>(null);
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [openNotes, setOpenNotes] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementReference, setMovementReference] = useState("");
  const [closingCounted, setClosingCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const load = useCallback(async () => {
    if (!branchId) return;
    setBusy(true);
    try {
      const res = await posApi.currentShift(branchId);
      const mapped = mapShiftRow(res.item);
      setShift(mapped);
      if (mapped?.id) {
        const mov = await posApi.listCashMovements(mapped.id);
        setMovements(mov.items);
      } else {
        setMovements([]);
      }
    } catch {
      setShift(null);
      setMovements([]);
    } finally {
      setBusy(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { cashIn, cashOut } = sumCashMovements(movements);
  const actual = Number(closingCounted) || 0;
  const difference = shift ? shiftDifference(actual, shift.expectedCash) : 0;

  const showDashboard =
    mode === "dashboard" || mode === "drawer" || mode === "close" || mode === "reconcile";

  async function openShift() {
    if (!branchId) return;
    setBusy(true);
    try {
      await posApi.openShift({
        branchId,
        openingFloat: Number(openingFloat) || 0,
        notes: openNotes.trim() || undefined,
      });
      push({ title: "Shift opened", tone: "success" });
      await load();
    } catch (err) {
      push({ title: "Open failed", description: err instanceof Error ? err.message : "Error", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function postMovement(kind: "cash_in" | "cash_out") {
    if (!branchId || !shift) return;
    setBusy(true);
    try {
      await posApi.postCashMovement({
        branchId,
        kind,
        amount: Number(movementAmount) || 0,
        reason: movementReason.trim(),
        reference: movementReference.trim() || undefined,
      });
      push({ title: kind === "cash_in" ? "Cash in recorded" : "Cash out recorded", tone: "success" });
      setMovementAmount("");
      setMovementReason("");
      setMovementReference("");
      await load();
    } catch (err) {
      push({ title: "Movement failed", description: err instanceof Error ? err.message : "Error", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!shift) return;
    setBusy(true);
    try {
      await posApi.closeShift(shift.id, {
        closingCounted: Number(closingCounted) || 0,
        notes: closeNotes.trim() || undefined,
      });
      push({ title: "Shift closed", description: `Variance ${money(difference)}`, tone: "success" });
      setClosingCounted("");
      await load();
    } catch (err) {
      push({ title: "Close failed", description: err instanceof Error ? err.message : "Error", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (!canShift) {
    return (
      <PosSubPageShell moduleNumber="09" moduleLabel="Shift & Cash" title={meta.title} description={meta.description}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          You need the pos.shift permission to manage shifts.
        </div>
      </PosSubPageShell>
    );
  }

  return (
    <PosSubPageShell moduleNumber="09" moduleLabel="Shift & Cash" title={meta.title} description={meta.description}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {mode === "transfer" ? (
          <PosComingSoonPanel
            title="Cash transfer"
            reason="Inter-drawer cash transfer is not exposed by the POS API yet. Use Cash Out on the source drawer and Cash In on the destination."
          />
        ) : null}

        {showDashboard && (
          <ShiftDashboardPanel
            shift={shift}
            busy={busy}
            cashierLabel={user?.fullName ?? shift?.openedBy?.slice(0, 8) ?? "—"}
            terminalLabel="POS Terminal"
            cashIn={cashIn}
            cashOut={cashOut}
            onRefresh={() => void load()}
          />
        )}

        {(mode === "open" || mode === "opening-cash") && !shift && (
          <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-xs font-semibold text-slate-600">
              Opening cash
              <input
                type="number"
                min={0}
                step={0.01}
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Notes
              <textarea value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
            </label>
            <button type="button" disabled={busy} onClick={() => void openShift()} className="w-full rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white disabled:opacity-40">
              Open shift
            </button>
          </div>
        )}

        {(mode === "cash-in" || mode === "cash-out" || mode === "expenses") && (
          <CashMovementForm
            kind={mode === "cash-in" ? "cash_in" : "cash_out"}
            title={mode === "expenses" ? "Record expense (cash out)" : undefined}
            amount={movementAmount}
            reason={movementReason}
            reference={movementReference}
            busy={busy}
            disabled={!shift}
            onAmount={setMovementAmount}
            onReason={setMovementReason}
            onReference={setMovementReference}
            onSubmit={() => void postMovement(mode === "cash-in" ? "cash_in" : "cash_out")}
          />
        )}

        {(mode === "close" || mode === "reconcile") && shift && (
          <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Reconciliation</h3>
            <dl className="space-y-1 text-xs">
              {reconciliationLines(shift, cashIn, cashOut).map((line) => (
                <div key={line.label} className={`flex justify-between ${line.emphasis ? "font-bold text-slate-900" : "text-slate-600"}`}>
                  <dt>{line.label}</dt>
                  <dd>{money(line.value)}</dd>
                </div>
              ))}
            </dl>
            <label className="block text-xs font-semibold text-slate-600">
              Actual cash counted
              <input
                type="number"
                min={0}
                step={0.01}
                value={closingCounted}
                onChange={(e) => setClosingCounted(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            {closingCounted ? (
              <p className="text-xs font-bold text-slate-800">Difference: {money(difference)}</p>
            ) : null}
            <label className="block text-xs font-semibold text-slate-600">
              Close notes
              <textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
            </label>
            <button
              type="button"
              disabled={busy || !closingCounted}
              onClick={() => void closeShift()}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              Close shift
            </button>
            <p className="text-[10px] text-slate-500">
              Expected cash is calculated server-side via refreshShiftTotals.
            </p>
          </div>
        )}

        {movements.length > 0 && mode !== "transfer" ? (
          <div className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-bold uppercase text-slate-400">Cash movements</h3>
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-1">Kind</th>
                  <th>Reason</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={String(m.id)} className="border-t border-slate-100">
                    <td className="py-1.5 font-semibold">{String(m.kind)}</td>
                    <td>{String(m.reason ?? "")}</td>
                    <td className="text-right font-semibold">{money(Number(m.amount ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </PosSubPageShell>
  );
}

function ShiftDashboardPanel({
  shift,
  busy,
  cashierLabel,
  terminalLabel,
  cashIn,
  cashOut,
  onRefresh,
}: {
  shift: ShiftView | null;
  busy: boolean;
  cashierLabel: string;
  terminalLabel: string;
  cashIn: number;
  cashOut: number;
  onRefresh: () => void;
}) {
  const cards = useMemo(() => {
    if (!shift) return [];
    return [
      { label: "Opening cash", value: money(shift.openingFloat) },
      { label: "Cash sales", value: money(shift.cashSalesTotal) },
      { label: "Other payments", value: money(otherPaymentsTotal(shift)) },
      { label: "Cash in", value: money(cashIn) },
      { label: "Cash out", value: money(cashOut) },
      { label: "Expected cash", value: money(shift.expectedCash) },
    ];
  }, [shift, cashIn, cashOut]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Current shift</p>
          <p className="text-sm font-bold text-slate-900">
            {shift ? (shift.status === "open" ? "Open" : "Closed") : "No open shift"}
            {shift?.openedAt ? ` · ${formatShiftDuration(shift.openedAt)}` : ""}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={onRefresh} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
          Refresh
        </button>
      </div>
      <dl className="mb-3 grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-slate-400">Cashier</dt>
          <dd className="font-semibold">{cashierLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Terminal</dt>
          <dd className="font-semibold">{terminalLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Sales total</dt>
          <dd className="font-semibold">{shift ? money(shift.salesTotal) : "—"}</dd>
        </div>
      </dl>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50 p-2.5">
            <p className="text-[10px] font-bold uppercase text-slate-400">{c.label}</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashMovementForm({
  kind,
  title,
  amount,
  reason,
  reference,
  busy,
  disabled,
  onAmount,
  onReason,
  onReference,
  onSubmit,
}: {
  kind: "cash_in" | "cash_out";
  title?: string;
  amount: string;
  reason: string;
  reference: string;
  busy: boolean;
  disabled: boolean;
  onAmount: (v: string) => void;
  onReason: (v: string) => void;
  onReference: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{title ?? (kind === "cash_in" ? "Cash in" : "Cash out")}</h3>
      {disabled ? <p className="text-xs text-amber-700">Open a shift before recording movements.</p> : null}
      <input type="number" min={0} step={0.01} value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="Amount" className="w-full rounded-xl border px-3 py-2 text-sm" />
      <input value={reason} onChange={(e) => onReason(e.target.value)} placeholder="Reason (required)" className="w-full rounded-xl border px-3 py-2 text-sm" />
      <input value={reference} onChange={(e) => onReference(e.target.value)} placeholder="Reference (optional)" className="w-full rounded-xl border px-3 py-2 text-sm" />
      <button type="button" disabled={busy || disabled || !reason.trim()} onClick={onSubmit} className="w-full rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white disabled:opacity-40">
        Record {kind === "cash_in" ? "cash in" : "cash out"}
      </button>
    </div>
  );
}
