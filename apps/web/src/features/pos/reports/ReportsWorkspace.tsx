import { useCallback, useEffect, useState } from "react";
import { ReportFilters } from "@/features/reports/ReportFilters";
import type { ReportFilterInput } from "@/features/reports/reporting-api";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { PosComingSoonPanel, PosSubPageShell } from "../PosSubPageShell";
import { PosReportMetrics, PosReportTable } from "./report-view";
import { loadPosReport, POS_REPORT_META, type PosReportMode } from "./report-utils";

export function ReportsWorkspace({ mode }: { mode: PosReportMode }) {
  const meta = POS_REPORT_META[mode];
  const { branchId } = useAuth();
  const { push } = useToast();
  const [filter, setFilter] = useState<ReportFilterInput>({ period: "month", branchId: branchId ?? undefined });
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Array<{ label: string; value: string; hint?: string }>>([]);
  const [rows, setRows] = useState<Array<{ key: string; label: string; amount: number; qty?: number }>>([]);
  const [note, setNote] = useState<string | undefined>();

  const run = useCallback(async () => {
    if (meta.unavailable) return;
    setLoading(true);
    try {
      const result = await loadPosReport(mode, filter, branchId);
      setMetrics(result.metrics);
      setRows(result.rows);
      setNote(result.note);
    } catch (err) {
      setMetrics([]);
      setRows([]);
      push({
        title: "Report failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [branchId, filter, meta.unavailable, mode, push]);

  useEffect(() => {
    if (branchId && !filter.branchId) {
      setFilter((f) => ({ ...f, branchId }));
    }
  }, [branchId, filter.branchId]);

  useEffect(() => {
    if (meta.unavailable) return;
    setLoading(true);
    void loadPosReport(mode, { period: "month", branchId: branchId ?? undefined }, branchId)
      .then((result) => {
        setMetrics(result.metrics);
        setRows(result.rows);
        setNote(result.note);
      })
      .catch((err) => {
        setMetrics([]);
        setRows([]);
        push({
          title: "Report failed",
          description: err instanceof Error ? err.message : "Try again",
          tone: "danger",
        });
      })
      .finally(() => setLoading(false));
    // Initial load only — filter changes require Run report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, branchId, meta.unavailable]);

  return (
    <PosSubPageShell moduleNumber="11" moduleLabel="Reports" title={meta.title} description={meta.description}>
      {meta.unavailable ? (
        <PosComingSoonPanel title={meta.title} reason={meta.unavailable} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <ReportFilters value={filter} onChange={setFilter} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={loading}
                className="rounded-xl bg-[var(--pos-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Running…" : "Run report"}
              </button>
            </div>
          </div>
          {note ? <p className="shrink-0 text-xs text-amber-700">{note}</p> : null}
          <PosReportMetrics items={metrics} />
          <div className="min-h-0 flex-1 overflow-auto">
            <PosReportTable rows={rows} />
          </div>
        </div>
      )}
    </PosSubPageShell>
  );
}
