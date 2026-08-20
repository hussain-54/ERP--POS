import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
import { parseCashShift } from "./register-shift";
import {
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSSelect,
} from "./design-system";

export function CashInOutPage() {
  const toast = useToast();
  const { branchId, hasPermission } = useAuth();
  const canShift = hasPermission("pos.shift");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [kind, setKind] = useState<"cash_in" | "cash_out">("cash_in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    if (!branchId || !canShift) {
      setShiftId(null);
      setMovements([]);
      return;
    }
    setLoading(true);
    try {
      const shiftRes = await posApi.currentShift(branchId);
      const shift = parseCashShift(shiftRes.item);
      setShiftId(shift?.id ?? null);
      if (shift?.id) {
        const list = await posApi.listCashMovements(shift.id);
        setMovements(list.items);
      } else {
        setMovements([]);
      }
    } catch (err) {
      toast.push({
        title: "Cash drawer load failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, canShift]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId || !canShift) return;
    setBusy(true);
    try {
      await posApi.postCashMovement({
        branchId,
        kind,
        amount: Number(amount),
        reason,
      });
      toast.push({
        title: kind === "cash_in" ? "Cash in posted" : "Cash out posted",
        tone: "success",
      });
      setAmount("");
      setReason("");
      await load();
    } catch (err) {
      toast.push({
        title: "Post failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pos-ops-workspace space-y-3">
      <POSBreadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "POS / Sales", to: "/pos" },
          { label: "Cash In / Cash Out" },
        ]}
      />
      <POSPageHeader
        title="Cash In / Cash Out"
        subtitle="Posts to the open shift ledger and updates expected drawer cash."
      />
      {!canShift ? (
        <POSEmptyState title="Shift permission required" description="Requires pos.shift." />
      ) : loading ? (
        <POSLoadingState label="Loading shift…" />
      ) : !shiftId ? (
        <POSEmptyState
          title="No open shift"
          description="Open a POS Shift before recording cash in or cash out."
        />
      ) : (
        <>
          <POSCard padding="sm" title="Post movement">
            <form className="grid gap-2 sm:grid-cols-3" onSubmit={(e) => void onSubmit(e)}>
              <POSSelect
                label="Kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "cash_in" | "cash_out")}
                options={[
                  { value: "cash_in", label: "Cash In" },
                  { value: "cash_out", label: "Cash Out" },
                ]}
              />
              <POSInput
                label="Amount"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <POSInput
                label="Reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="sm:col-span-3">
                <POSButton type="submit" disabled={busy}>
                  {busy ? "Posting…" : "Post"}
                </POSButton>
              </div>
            </form>
          </POSCard>
          <POSCard padding="sm" title="This shift">
            {!movements.length ? (
              <p className="text-sm text-[var(--pos-muted)]">No cash movements yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {movements.map((row) => (
                  <li key={String(row.id)} className="flex justify-between gap-2 border-b border-[var(--pos-border)] py-1">
                    <span>
                      {String(row.kind)} · {String(row.reason)}
                    </span>
                    <span className="tabular-nums">{Number(row.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </POSCard>
        </>
      )}
    </div>
  );
}
