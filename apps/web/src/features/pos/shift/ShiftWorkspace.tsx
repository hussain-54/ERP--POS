import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PosComingSoonPanel, PosSubPageShell } from "../PosSubPageShell";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { posApi } from "../api";
import { money } from "../format";
import type { SaleListRow } from "@electronic-erp/contracts";
import { ShiftSummaryModal } from "./ShiftSummaryModal";
import {
  computeShiftBreakdown,
  formatShiftDuration,
  mapShiftRow,
  reconciliationLines,
  shiftDifference,
  type ShiftClosingSummaryData,
  type ShiftPaymentBreakdown,
  type ShiftView,
  type ShiftWorkspaceMode,
} from "./shift-utils";

const META: Record<ShiftWorkspaceMode, { title: string; description: string }> = {
  dashboard: { title: "Current Shift", description: "Real-time cashier shift & drawer cash control." },
  open: { title: "Open Shift", description: "Start a cashier shift with opening cash float." },
  "opening-cash": { title: "Opening Cash", description: "Set the initial cash drawer float when opening a shift." },
  "cash-in": { title: "Cash In", description: "Record cash float additions into the drawer." },
  "cash-out": { title: "Cash Out", description: "Record cash removals or safe drops from the drawer." },
  drawer: { title: "Cash Drawer", description: "Drawer balance, movements, and live expected cash." },
  transfer: { title: "Cash Transfer", description: "Transfer cash between drawers." },
  expenses: { title: "Record Expense", description: "Record petty cash and store expenses paid from drawer." },
  close: { title: "Close Shift", description: "Reconcile counted cash and close the cashier shift." },
  reconcile: { title: "Cash Reconciliation", description: "Expected vs counted cash before shift close." },
};

export function ShiftWorkspace({ mode }: { mode: ShiftWorkspaceMode }) {
  const meta = META[mode];
  const { branchId, user, hasPermission } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const canShift = hasPermission("pos.shift");

  const [shift, setShift] = useState<ShiftView | null>(null);
  const [sales, setSales] = useState<SaleListRow[]>([]);
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);

  // Open shift inputs
  const [openingFloat, setOpeningFloat] = useState("0");
  const [openNotes, setOpenNotes] = useState("");
  const [confirmOpenModal, setConfirmOpenModal] = useState(false);

  // Cash movement inputs
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementReference, setMovementReference] = useState("");

  // Close shift inputs
  const [closingCounted, setClosingCounted] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [confirmCloseModal, setConfirmCloseModal] = useState(false);

  // Summary post-close modal
  const [closingSummary, setClosingSummary] = useState<ShiftClosingSummaryData | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setBusy(true);
    try {
      const res = await posApi.currentShift(branchId);
      const mapped = mapShiftRow(res.item);
      setShift(mapped);

      if (mapped?.id) {
        const [movRes, salesRes] = await Promise.all([
          posApi.listCashMovements(mapped.id).catch(() => ({ items: [] })),
          posApi.searchSalesManagement({ branchId, limit: 100 }).catch(() => ({ items: [] })),
        ]);
        setMovements(movRes.items);
        setSales(salesRes.items || []);
      } else {
        setMovements([]);
        setSales([]);
      }
    } catch {
      setShift(null);
      setMovements([]);
      setSales([]);
    } finally {
      setBusy(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const breakdown: ShiftPaymentBreakdown = useMemo(() => {
    return computeShiftBreakdown(shift, sales, movements);
  }, [shift, sales, movements]);

  const actual = Number(closingCounted) || 0;
  const difference = shift ? shiftDifference(actual, breakdown.expectedCash) : 0;

  const showDashboard =
    mode === "dashboard" || mode === "drawer" || mode === "close" || mode === "reconcile";

  async function handleOpenShift() {
    if (!branchId) return;
    setBusy(true);
    try {
      await posApi.openShift({
        branchId,
        openingFloat: Number(openingFloat) || 0,
        notes: openNotes.trim() || undefined,
      });
      push({ title: "Shift Opened Successfully", tone: "success" });
      setConfirmOpenModal(false);
      await load();
      navigate("/pos/shifts");
    } catch (err) {
      push({ title: "Open Shift Failed", description: err instanceof Error ? err.message : "Error", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function postMovement(kind: "cash_in" | "cash_out") {
    if (!branchId || !shift) return;
    const amt = Number(movementAmount) || 0;
    if (amt <= 0) {
      push({ title: "Invalid Amount", description: "Please enter an amount greater than 0.", tone: "danger" });
      return;
    }
    if (!movementReason.trim()) {
      push({ title: "Reason Required", description: "Please provide a reason for this cash movement.", tone: "danger" });
      return;
    }

    setBusy(true);
    try {
      await posApi.postCashMovement({
        branchId,
        kind,
        amount: amt,
        reason: movementReason.trim(),
        reference: movementReference.trim() || undefined,
      });
      push({
        title: kind === "cash_in" ? `Cash In Recorded (+${money(amt)})` : `Cash Out Recorded (−${money(amt)})`,
        tone: "success",
      });
      setMovementAmount("");
      setMovementReason("");
      setMovementReference("");
      await load();
      navigate("/pos/shifts");
    } catch (err) {
      push({ title: "Movement Failed", description: err instanceof Error ? err.message : "Error", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseShift() {
    if (!shift) return;
    setBusy(true);
    try {
      const nowStr = new Date().toISOString();
      const summaryData: ShiftClosingSummaryData = {
        shiftId: shift.id,
        branchName: "Main Branch",
        cashierName: user?.fullName || "Cashier",
        terminalId: "Counter 1",
        openedAt: shift.openedAt || nowStr,
        closedAt: nowStr,
        duration: formatShiftDuration(shift.openedAt, nowStr),
        openingCash: breakdown.openingCash,
        cashSales: breakdown.cashSales,
        cardSales: breakdown.cardSales,
        walletSales: breakdown.walletSales,
        totalSales: breakdown.totalSales,
        cashIn: breakdown.cashIn,
        cashOut: breakdown.cashOut,
        expenses: breakdown.expenses,
        expectedCash: breakdown.expectedCash,
        actualCash: actual,
        difference,
        notes: closeNotes.trim() || undefined,
        movementsCount: movements.length,
        salesCount: sales.length,
      };

      await posApi.closeShift(shift.id, {
        closingCounted: actual,
        notes: closeNotes.trim() || undefined,
      });

      push({
        title: "Shift Closed Successfully",
        description: `Variance: ${difference >= 0 ? "+" : "−"}Rs. ${money(Math.abs(difference))}`,
        tone: "success",
      });

      setClosingCounted("");
      setCloseNotes("");
      setConfirmCloseModal(false);
      setClosingSummary(summaryData);
      setSummaryModalOpen(true);
      await load();
    } catch (err) {
      push({ title: "Close Shift Failed", description: err instanceof Error ? err.message : "Error", tone: "danger" });
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
            title="Cash Transfer"
            reason="Inter-drawer cash transfer is not exposed by the POS API yet. Use Cash Out on the source drawer and Cash In on the destination."
          />
        ) : null}

        {/* ==================================================
            CURRENT SHIFT DASHBOARD (8 METRICS)
        ================================================== */}
        {showDashboard && (
          <div className="space-y-4">
            <ShiftHeaderPanel
              shift={shift}
              breakdown={breakdown}
              busy={busy}
              cashierLabel={user?.fullName ?? shift?.openedBy?.slice(0, 8) ?? "Counter Cashier"}
              terminalLabel="Counter 1"
              onRefresh={() => void load()}
              onOpenShift={() => navigate("/pos/shifts/open")}
              onCloseShift={() => navigate("/pos/shifts/close")}
            />

            {shift && (
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/pos/shifts/cash-in"
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <i className="fa-solid fa-arrow-down-to-bracket text-emerald-600" />
                  <span>+ Cash In</span>
                </Link>

                <Link
                  to="/pos/shifts/cash-out"
                  className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                >
                  <i className="fa-solid fa-arrow-up-from-bracket text-amber-600" />
                  <span>− Cash Out (Drop)</span>
                </Link>

                <Link
                  to="/pos/shifts/expenses"
                  className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 transition hover:bg-rose-100"
                >
                  <i className="fa-solid fa-money-bill-wave text-rose-600" />
                  <span>− Record Expense</span>
                </Link>

                <Link
                  to="/pos/sales/new"
                  className="ml-auto flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                >
                  <i className="fa-solid fa-cash-register" />
                  <span>Go to POS Terminal</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ==================================================
            OPEN SHIFT VIEW
        ================================================== */}
        {(mode === "open" || mode === "opening-cash") && !shift && (
          <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <i className="fa-solid fa-cash-register text-lg" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Open Cashier Shift</h3>
                <p className="text-xs text-slate-500">Enter opening cash float in drawer to start selling</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Opening Cash (Float) *
                <input
                  type="number"
                  min={0}
                  step={1}
                  autoFocus
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-black text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>

              {/* Quick Presets */}
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Quick Float Presets:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {[0, 2000, 5000, 10000, 20000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOpeningFloat(String(amt))}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-blue-500 hover:bg-blue-50"
                    >
                      Rs. {money(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-bold text-slate-700">
                Shift Notes / Counter Reference
                <textarea
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="e.g. Counter 1 Morning Shift, 100x50 notes counted"
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmOpenModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-98 disabled:opacity-50"
            >
              <i className="fa-solid fa-lock-open text-xs" />
              <span>Confirm & Open Shift</span>
            </button>
          </div>
        )}

        {/* ==================================================
            CASH IN / CASH OUT / EXPENSES VIEW
        ================================================== */}
        {(mode === "cash-in" || mode === "cash-out" || mode === "expenses") && (
          <CashMovementForm
            kind={mode === "cash-in" ? "cash_in" : "cash_out"}
            title={
              mode === "expenses"
                ? "Record Store Expense (Cash Out)"
                : mode === "cash-in"
                  ? "Record Cash In (Drawer Float)"
                  : "Record Cash Out (Drop / Transfer)"
            }
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

        {/* ==================================================
            CLOSE SHIFT RECONCILIATION VIEW
        ================================================== */}
        {(mode === "close" || mode === "reconcile") && shift && (
          <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <i className="fa-solid fa-lock text-lg" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Shift Reconciliation & Closing</h3>
                <p className="text-xs text-slate-500">Count physical cash in drawer and verify variance</p>
              </div>
            </div>

            {/* 8-Point Reconciliation Strip */}
            <dl className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
              {reconciliationLines(shift, breakdown).map((line) => (
                <div
                  key={line.label}
                  className={`flex justify-between ${
                    line.emphasis
                      ? "border-t border-slate-200 pt-1.5 text-sm font-black text-slate-900"
                      : "text-slate-600"
                  }`}
                >
                  <dt>{line.label}:</dt>
                  <dd className="font-bold tabular-nums">Rs. {money(line.value)}</dd>
                </div>
              ))}
            </dl>

            {/* Counted Cash Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Actual Cash Counted in Drawer (Rs.) *
                <input
                  type="number"
                  min={0}
                  step="any"
                  autoFocus
                  value={closingCounted}
                  onChange={(e) => setClosingCounted(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base font-black text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>

              {/* Variance Visual Indicator */}
              {closingCounted ? (
                <div
                  className={`flex items-center justify-between rounded-xl p-3 text-xs font-bold ${
                    difference === 0
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : difference > 0
                        ? "bg-blue-50 text-blue-800 border border-blue-200"
                        : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  <span>
                    {difference === 0
                      ? "✓ Exact Match (Zero Variance)"
                      : difference > 0
                        ? "▲ Cash Surplus (Over)"
                        : "▼ Cash Shortage (Under)"}
                  </span>
                  <span className="text-sm font-black tabular-nums">
                    {difference >= 0 ? "+" : "−"}Rs. {money(Math.abs(difference))}
                  </span>
                </div>
              ) : null}

              <label className="block text-xs font-bold text-slate-700">
                Closing Notes / Explanation
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="e.g. Difference due to rounding / tea expense receipt attached"
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={busy || !closingCounted}
              onClick={() => setConfirmCloseModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-rose-700 active:scale-98 disabled:opacity-50"
            >
              <i className="fa-solid fa-lock text-xs" />
              <span>Proceed to Close Shift</span>
            </button>
          </div>
        )}

        {/* ==================================================
            CASH MOVEMENTS LEDGER TABLE
        ================================================== */}
        {movements.length > 0 && mode !== "transfer" ? (
          <div className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slate-400">Cash Movements Ledger</h3>
              <span className="text-[10px] font-bold text-slate-500">
                {movements.length} {movements.length === 1 ? "Entry" : "Entries"}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-2">Type</th>
                  <th className="py-2">Reason</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => {
                  const isCashIn = m.kind === "cash_in";
                  return (
                    <tr key={String(m.id)}>
                      <td className="py-2 font-bold">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                            isCashIn ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          <i className={`fa-solid ${isCashIn ? "fa-arrow-down" : "fa-arrow-up"} text-[8px]`} />
                          {isCashIn ? "Cash In" : "Cash Out"}
                        </span>
                      </td>
                      <td className="py-2 text-slate-800">{String(m.reason ?? "—")}</td>
                      <td className="py-2 text-slate-500 font-mono text-[11px]">{String(m.reference ?? "—")}</td>
                      <td
                        className={`py-2 text-right font-black tabular-nums ${
                          isCashIn ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {isCashIn ? "+" : "−"}Rs. {money(Number(m.amount ?? 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* ==================================================
            CONFIRM OPEN SHIFT MODAL
        ================================================== */}
        {confirmOpenModal ? (
          <div className="pos-modal-backdrop" role="presentation" onClick={() => setConfirmOpenModal(false)}>
            <div
              className="pos-modal max-w-sm p-5 text-left"
              role="dialog"
              aria-modal
              aria-label="Confirm Open Shift"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-blue-600 mb-3">
                <i className="fa-solid fa-circle-question text-2xl" />
                <h3 className="text-base font-black text-slate-900">Confirm Shift Opening</h3>
              </div>
              <p className="text-xs text-slate-600">
                You are opening a new cashier shift with an opening float of:
              </p>
              <div className="my-3 rounded-xl bg-blue-50 p-3 text-center">
                <span className="text-xl font-black text-blue-700">Rs. {money(Number(openingFloat) || 0)}</span>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmOpenModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleOpenShift()}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  {busy ? "Opening…" : "Confirm & Start"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ==================================================
            CONFIRM CLOSE SHIFT MODAL
        ================================================== */}
        {confirmCloseModal ? (
          <div className="pos-modal-backdrop" role="presentation" onClick={() => setConfirmCloseModal(false)}>
            <div
              className="pos-modal max-w-md p-5 text-left"
              role="dialog"
              aria-modal
              aria-label="Confirm Close Shift"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-rose-600 mb-3">
                <i className="fa-solid fa-triangle-exclamation text-2xl" />
                <h3 className="text-base font-black text-slate-900">Confirm Shift Finalization</h3>
              </div>
              <p className="text-xs text-slate-600">
                Are you sure you want to finalize and close this shift? This will lock sales totals and record closing
                cash count.
              </p>

              <div className="my-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-2.5 text-center text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Expected</span>
                  <span className="font-bold text-slate-900">Rs. {money(breakdown.expectedCash)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Counted</span>
                  <span className="font-bold text-blue-700">Rs. {money(actual)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Variance</span>
                  <span
                    className={`font-black ${
                      difference === 0 ? "text-emerald-600" : difference > 0 ? "text-blue-600" : "text-rose-600"
                    }`}
                  >
                    {difference >= 0 ? "+" : "−"}Rs. {money(Math.abs(difference))}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmCloseModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCloseShift()}
                  className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                >
                  {busy ? "Closing…" : "Confirm & Close Shift"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ==================================================
            POST-CLOSE SHIFT SUMMARY MODAL
        ================================================== */}
        <ShiftSummaryModal
          open={summaryModalOpen}
          data={closingSummary}
          onClose={() => setSummaryModalOpen(false)}
          onStartNewShift={() => navigate("/pos/shifts/open")}
        />
      </div>
    </PosSubPageShell>
  );
}

function ShiftHeaderPanel({
  shift,
  breakdown,
  busy,
  cashierLabel,
  terminalLabel,
  onRefresh,
  onOpenShift,
  onCloseShift,
}: {
  shift: ShiftView | null;
  breakdown: ShiftPaymentBreakdown;
  busy: boolean;
  cashierLabel: string;
  terminalLabel: string;
  onRefresh: () => void;
  onOpenShift: () => void;
  onCloseShift: () => void;
}) {
  // 8 Metrics Grid
  const cards = [
    { label: "Opening Cash", value: money(breakdown.openingCash), icon: "fa-lock-open", color: "text-slate-700" },
    { label: "Cash Sales", value: money(breakdown.cashSales), icon: "fa-money-bill-1-wave", color: "text-emerald-700" },
    { label: "Card Sales", value: money(breakdown.cardSales), icon: "fa-credit-card", color: "text-blue-700" },
    { label: "Wallet Sales", value: money(breakdown.walletSales), icon: "fa-wallet", color: "text-purple-700" },
    { label: "Cash In", value: money(breakdown.cashIn), icon: "fa-arrow-down-to-bracket", color: "text-emerald-700" },
    { label: "Cash Out", value: money(breakdown.cashOut), icon: "fa-arrow-up-from-bracket", color: "text-amber-700" },
    { label: "Expenses", value: money(breakdown.expenses), icon: "fa-receipt", color: "text-rose-700" },
    { label: "Expected Cash", value: money(breakdown.expectedCash), icon: "fa-vault", color: "text-blue-600", hero: true },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                shift?.status === "open" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <h3 className="text-sm font-black text-slate-900">
              {shift ? (shift.status === "open" ? "Active Cashier Shift" : "Shift Closed") : "No Active Shift"}
            </h3>
            {shift?.openedAt ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                Duration: {formatShiftDuration(shift.openedAt)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Cashier: <strong>{cashierLabel}</strong> · Terminal: <strong>{terminalLabel}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onRefresh}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            <i className="fa-solid fa-rotate text-[11px]" />
            <span>Refresh</span>
          </button>

          {!shift ? (
            <button
              type="button"
              onClick={onOpenShift}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              <i className="fa-solid fa-lock-open text-[11px]" />
              <span>Open Shift</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onCloseShift}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
            >
              <i className="fa-solid fa-lock text-[11px]" />
              <span>Close Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* 8 Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl p-2.5 transition ${
              c.hero
                ? "bg-blue-600 text-white shadow-md lg:col-span-1"
                : "bg-slate-50/90 border border-slate-100 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${c.hero ? "text-blue-200" : "text-slate-400"}`}>
                {c.label}
              </span>
              <i className={`fa-solid ${c.icon} text-xs ${c.hero ? "text-blue-200" : "text-slate-400"}`} />
            </div>
            <p className={`mt-1 text-sm font-black tabular-nums truncate ${c.hero ? "text-white" : c.color}`}>
              Rs. {c.value}
            </p>
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
  const isCashIn = kind === "cash_in";

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            isCashIn ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
          }`}
        >
          <i className={`fa-solid ${isCashIn ? "fa-arrow-down-to-bracket" : "fa-arrow-up-from-bracket"} text-lg`} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">{title ?? (isCashIn ? "Cash In" : "Cash Out")}</h3>
          <p className="text-xs text-slate-500">
            {isCashIn ? "Add cash float to current drawer" : "Remove cash or record store expense"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">
          Amount (Rs.) *
          <input
            type="number"
            min={0}
            step="any"
            autoFocus
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-black text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Reason / Category *
          <input
            type="text"
            value={reason}
            onChange={(e) => onReason(e.target.value)}
            placeholder={isCashIn ? "e.g. Additional morning change float" : "e.g. Store tea expense / Safe drop"}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Reference / Slip # (Optional)
          <input
            type="text"
            value={reference}
            onChange={(e) => onReference(e.target.value)}
            placeholder="e.g. VOUCHER-9281"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy || disabled || !amount || !reason}
        onClick={onSubmit}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-xs transition active:scale-98 disabled:opacity-50 ${
          isCashIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
        }`}
      >
        <i className="fa-solid fa-check text-xs" />
        <span>{isCashIn ? "Confirm Cash In" : "Confirm Cash Out"}</span>
      </button>
    </div>
  );
}
