import { useEffect, useMemo, useState } from "react";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { adminApi } from "@/features/users/admin-api";
import { posApi } from "./pos-api";
import {
  formatRegisterMoney,
  parseCashShift,
  registerVariance,
  REGISTER_METRIC_LABELS,
  type CashShift,
} from "./register-shift";
import {
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSConfirmDialog,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSModal,
  POSPageHeader,
  POSStatCard,
} from "./design-system";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function RegisterPage() {
  const toast = useToast();
  const { branchId, user, hasPermission } = useAuth();
  const [shift, setShift] = useState<CashShift | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [branchName, setBranchName] = useState<string>("—");
  const [cashierNames, setCashierNames] = useState<Record<string, string>>({});
  const [counted, setCounted] = useState<number | null>(null);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closeNotes, setCloseNotes] = useState("");
  const [openNotes, setOpenNotes] = useState("");

  const [openModal, setOpenModal] = useState(false);
  const [countModal, setCountModal] = useState(false);
  const [countDraft, setCountDraft] = useState("");
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [confirm, setConfirm] = useState<"open" | "close" | null>(null);

  const canShift = hasPermission("pos.shift");
  const canView = canShift || hasPermission("pos.sell");

  async function reload() {
    if (!branchId || !canView) {
      setShift(null);
      return;
    }
    setLoading(true);
    try {
      const res = await posApi.currentShift(branchId);
      const parsed = parseCashShift(res.item);
      setShift(parsed);
      if (parsed?.closingCounted != null) setCounted(parsed.closingCounted);
    } catch (err) {
      toast.push({
        title: "Could not load register",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
      setShift(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, canView]);

  useEffect(() => {
    try {
      void adminApi
        .listBranches()
        .then((r) => {
          const hit = r.items.find((b) => String(b.id) === branchId);
          setBranchName(hit ? String(hit.name ?? "Branch") : "Branch");
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void adminApi
        .listUsers()
        .then((r) => {
          const map: Record<string, string> = {};
          for (const u of r.items) {
            const id = String(u.id ?? "");
            if (!id) continue;
            map[id] = String(u.full_name ?? u.fullName ?? u.email ?? "Cashier");
          }
          setCashierNames(map);
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
  }, [branchId]);

  const expected = shift?.expectedCash ?? (shift ? shift.openingFloat + shift.cashSalesTotal - shift.expenseTotal : null);
  const variance = shift?.status === "closed" ? shift.variance : registerVariance(counted, expected);
  const cashierName = shift?.openedBy
    ? cashierNames[shift.openedBy] ?? "Cashier"
    : user?.fullName ?? "—";
  const openShift = Boolean(shift && shift.status === "open");

  const metricValues: Record<(typeof REGISTER_METRIC_LABELS)[number], { value: string; tone?: "neutral" | "success" | "warning" }> =
    useMemo(
      () => ({
        "Current Register": {
          value: shift ? (shift.status === "open" ? "Open" : "Closed") : "No shift",
          tone: openShift ? "success" : "neutral",
        },
        Branch: { value: branchName },
        Terminal: { value: "—" },
        Cashier: { value: cashierName },
        Shift: { value: shift ? formatWhen(shift.openedAt) : "—" },
        "Opening Balance": { value: formatRegisterMoney(shift?.openingFloat) },
        "Current Cash": { value: formatRegisterMoney(counted ?? expected) },
        "Cash Sales": { value: formatRegisterMoney(shift?.cashSalesTotal) },
        "Card Sales": { value: "—" },
        "Other Payments": { value: "—" },
        Refunds: { value: "—" },
        "Expected Cash": { value: formatRegisterMoney(expected) },
        Variance: {
          value: formatRegisterMoney(variance),
          tone: variance == null ? "neutral" : variance === 0 ? "success" : "warning",
        },
      }),
      [shift, branchName, cashierName, counted, expected, variance, openShift],
    );

  async function doOpen() {
    if (!branchId) return;
    setBusy(true);
    try {
      await posApi.openShift({
        branchId,
        openingFloat: Number(openingFloat) || 0,
        notes: openNotes.trim() || undefined,
      });
      setOpenModal(false);
      setConfirm(null);
      setOpenNotes("");
      await reload();
      toast.push({ title: "Shift opened", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Open shift failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function doClose() {
    if (!shift) return;
    const closingCounted = counted ?? expected ?? shift.openingFloat;
    setBusy(true);
    try {
      await posApi.closeShift(shift.id, {
        closingCounted,
        notes: closeNotes.trim() || undefined,
      });
      setConfirm(null);
      setCounted(null);
      setCloseNotes("");
      await reload();
      toast.push({ title: "Shift closed", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Close shift failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  function saveCount() {
    const n = Number(countDraft);
    if (!Number.isFinite(n) || n < 0) {
      toast.push({ title: "Enter a valid cash count", tone: "danger" });
      return;
    }
    setCounted(n);
    setCountModal(false);
    toast.push({ title: "Cash count saved on this screen", tone: "success" });
  }

  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Reports", to: "/pos/reports" },
          { label: "Register" },
        ]}
      />
      <POSPageHeader
        title="Register"
        subtitle="Cashier shift control from the live cash-shift record. Card, other tenders, and refunds are not stored on the shift."
        actions={
          <>
            <POSButton variant="secondary" size="sm" onClick={() => void reload()} disabled={loading}>
              Refresh
            </POSButton>
            <POSButton
              size="sm"
              onClick={() => {
                setOpeningFloat(String(shift?.openingFloat ?? 0));
                setOpenModal(true);
              }}
              disabled={!canShift || openShift || busy}
            >
              Open Shift
            </POSButton>
            <POSButton
              size="sm"
              variant="secondary"
              onClick={() => setConfirm("close")}
              disabled={!canShift || !openShift || busy}
            >
              Close Shift
            </POSButton>
            <POSButton
              size="sm"
              variant="ghost"
              onClick={() => {
                setCountDraft(counted != null ? String(counted) : expected != null ? String(expected) : "0");
                setCountModal(true);
              }}
              disabled={!canShift || !openShift}
            >
              Cash Count
            </POSButton>
            <POSButton size="sm" variant="ghost" onClick={() => setReconcileOpen(true)} disabled={!canShift || !shift}>
              Reconcile
            </POSButton>
          </>
        }
      />

      {!canView ? (
        <POSEmptyState
          title="Register is not available"
          description="This cashier needs pos.sell or pos.shift to view the cash register."
        />
      ) : null}

      {canView && loading && !shift ? <POSLoadingState label="Loading register…" rows={4} /> : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {REGISTER_METRIC_LABELS.map((label) => {
          const m = metricValues[label];
          return <POSStatCard key={label} label={label} value={m.value} tone={m.tone} />;
        })}
      </div>

      <POSCard padding="sm">
        <p className="text-xs text-[var(--pos-muted)]">
          Cash In and Cash Out are not exposed — the shift API does not post drawer movements.
          Reconcile compares counted cash to expected cash without creating journal entries.
        </p>
      </POSCard>

      {shift?.notes ? (
        <POSCard title="Shift notes" padding="sm">
          <p className="text-sm">{shift.notes}</p>
        </POSCard>
      ) : null}

      <POSModal
        open={openModal}
        title="Open Shift"
        onClose={() => setOpenModal(false)}
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setOpenModal(false)} disabled={busy}>
              Close
            </POSButton>
            <POSButton onClick={() => setConfirm("open")} loading={busy}>
              Open Shift
            </POSButton>
          </>
        }
      >
        <div className="space-y-3">
          <POSInput
            label="Opening Balance"
            type="number"
            min={0}
            step="0.01"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
          <POSInput label="Notes" value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} />
        </div>
      </POSModal>

      <POSModal
        open={countModal}
        title="Cash Count"
        onClose={() => setCountModal(false)}
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setCountModal(false)}>
              Close
            </POSButton>
            <POSButton onClick={saveCount}>Save count</POSButton>
          </>
        }
      >
        <POSInput
          label="Counted cash"
          type="number"
          min={0}
          step="0.01"
          value={countDraft}
          onChange={(e) => setCountDraft(e.target.value)}
          hint={`Expected cash ${formatRegisterMoney(expected)}. Count is kept on this screen until you close the shift.`}
        />
      </POSModal>

      <POSModal
        open={reconcileOpen}
        title="Reconcile"
        onClose={() => setReconcileOpen(false)}
        footer={
          <POSButton variant="ghost" onClick={() => setReconcileOpen(false)}>
            Close
          </POSButton>
        }
      >
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Opening Balance</dt>
            <dd className="tabular-nums">{formatRegisterMoney(shift?.openingFloat)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cash Sales</dt>
            <dd className="tabular-nums">{formatRegisterMoney(shift?.cashSalesTotal)}</dd>
          </div>
          <div className="flex justify-between text-[var(--pos-muted)]">
            <dt>Expenses</dt>
            <dd className="tabular-nums">{formatRegisterMoney(shift?.expenseTotal)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Expected Cash</dt>
            <dd className="tabular-nums">{formatRegisterMoney(expected)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Counted</dt>
            <dd className="tabular-nums">{formatRegisterMoney(counted)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--pos-border)] pt-2 font-semibold">
            <dt>Variance</dt>
            <dd className="tabular-nums">{formatRegisterMoney(variance)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--pos-muted)]">
          This is a drawer check only. Close Shift writes counted cash and variance on the shift record.
        </p>
      </POSModal>

      <POSConfirmDialog
        open={confirm === "open"}
        title="Open this shift?"
        description="Opens a cash shift for the current branch with the opening balance entered."
        confirmLabel="Open Shift"
        loading={busy}
        onConfirm={() => void doOpen()}
        onCancel={() => setConfirm(null)}
      />
      <POSConfirmDialog
        open={confirm === "close"}
        title="Close this shift?"
        description={`Counted cash ${formatRegisterMoney(counted ?? expected)} will be posted on the shift. This does not create extra accounting entries.`}
        confirmLabel="Close Shift"
        danger
        loading={busy}
        onConfirm={() => void doClose()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
