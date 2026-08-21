import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
import {
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSStatCard,
} from "./design-system";

type DayTotals = {
  businessDate: string;
  totalSales: number;
  cashSales: number;
  creditSales: number;
  refunds: number;
  cashIn: number;
  cashOut: number;
  openingCash: number;
  expectedCash: number;
};

export function DayClosingPage() {
  const toast = useToast();
  const { branchId, hasPermission } = useAuth();
  const canShift = hasPermission("pos.shift");
  const [businessDate, setBusinessDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totals, setTotals] = useState<DayTotals | null>(null);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadPreview() {
    if (!branchId || !canShift) {
      setTotals(null);
      return;
    }
    setLoading(true);
    try {
      const res = await posApi.previewDayClose({ branchId, businessDate });
      setTotals(res.totals as DayTotals);
    } catch (err) {
      toast.push({
        title: "Day preview failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, businessDate, canShift]);

  async function onClose(e: FormEvent) {
    e.preventDefault();
    if (!branchId || !canShift) return;
    setBusy(true);
    try {
      await posApi.closeDay({
        branchId,
        businessDate,
        actualCash: Number(actualCash),
        notes: notes || undefined,
      });
      toast.push({ title: "Day closed", tone: "success" });
      await loadPreview();
    } catch (err) {
      toast.push({
        title: "Day close failed",
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
        items={[{ label: "Home", to: "/" }, { label: "POS / Sales", to: "/pos" }, { label: "Day Closing" }]}
      />
      <POSPageHeader
        title="Day Closing"
        subtitle="Auditable close record. Close the open shift first. Method splits beyond cash/credit stay 0 until tender classification is enriched."
      />
      {!canShift ? (
        <POSEmptyState title="Shift permission required" description="Requires pos.shift." />
      ) : (
        <>
          <POSCard padding="sm" title="Business date">
            <POSInput
              label="Date"
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
            />
          </POSCard>
          {loading ? (
            <POSLoadingState label="Building day totals…" />
          ) : totals ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <POSStatCard label="Total sales" value={totals.totalSales.toFixed(2)} />
                <POSStatCard label="Cash / paid" value={totals.cashSales.toFixed(2)} />
                <POSStatCard label="Credit remaining" value={totals.creditSales.toFixed(2)} />
                <POSStatCard label="Refunds" value={totals.refunds.toFixed(2)} />
                <POSStatCard label="Cash in" value={totals.cashIn.toFixed(2)} />
                <POSStatCard label="Cash out" value={totals.cashOut.toFixed(2)} />
                <POSStatCard label="Opening cash" value={totals.openingCash.toFixed(2)} />
                <POSStatCard label="Expected cash" value={totals.expectedCash.toFixed(2)} />
              </div>
              <POSCard padding="sm" title="Close day">
                <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => void onClose(e)}>
                  <POSInput
                    label="Actual cash"
                    required
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                  />
                  <POSInput
                    label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="sm:col-span-2">
                    <POSButton type="submit" disabled={busy}>
                      {busy ? "Closing…" : "Close day"}
                    </POSButton>
                  </div>
                </form>
              </POSCard>
            </>
          ) : (
            <POSEmptyState title="No totals" description="Could not build day closing preview." />
          )}
        </>
      )}
    </div>
  );
}
