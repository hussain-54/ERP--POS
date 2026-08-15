import { useEffect, useState } from "react";
import { Button, Card, useToast } from "@electronic-erp/ui";
import { ReportFilters } from "@/features/reports/ReportFilters";
import { reportingApi, type ReportFilterInput } from "@/features/reports/reporting-api";

type Dash = Record<string, unknown>;

function Kpi({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{String(value ?? "—")}</div>
    </div>
  );
}

function MiniBars({ series }: { series: Array<{ label: string; amount: number }> }) {
  const max = Math.max(...series.map((s) => s.amount), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {series.map((s) => (
        <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-[var(--erp-brand)]"
            style={{ height: `${Math.max((s.amount / max) * 100, 4)}%` }}
            title={`${s.label}: ${s.amount}`}
          />
          <span className="max-w-full truncate text-[10px] opacity-60">{s.label.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<ReportFilterInput>({ period: "month" });
  const [dash, setDash] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await reportingApi.executive(filter);
      setDash(res.dashboard);
    } catch (err) {
      toast.push({
        title: "Dashboard failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profitSeries = (dash?.profitSeries as Array<{ label: string; amount: number }>) ?? [];
  const recent =
    (dash?.recentTransactions as Array<{
      id: string;
      type: string;
      label: string;
      amount: number;
      at: string;
    }>) ?? [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Executive dashboard</h1>
          <p className="text-sm opacity-70">Sales, stock, cash, approvals and growth at a glance.</p>
        </div>
        <Button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <Card title="Filters">
        <ReportFilters value={filter} onChange={setFilter} />
        <Button className="mt-3" type="button" variant="secondary" onClick={() => void load()}>
          Apply filters
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Kpi label="Total sales" value={dash?.sales} />
        <Kpi label="Purchases" value={dash?.purchases} />
        <Kpi label="Gross profit" value={dash?.grossProfit} />
        <Kpi label="Net profit" value={dash?.netProfit} />
        <Kpi label="Cash" value={dash?.cash} />
        <Kpi label="Bank" value={dash?.bank} />
        <Kpi label="Receivables" value={dash?.receivables} />
        <Kpi label="Payables" value={dash?.payables} />
        <Kpi label="Stock value" value={dash?.stockValue} />
        <Kpi label="Low stock" value={dash?.lowStock} />
        <Kpi label="Out of stock" value={dash?.outOfStock} />
        <Kpi label="Overstock" value={dash?.overstock} />
        <Kpi label="Today’s expenses" value={dash?.todayExpenses} />
        <Kpi label="Installments due" value={dash?.installmentsDue} />
        <Kpi label="Customer outstanding" value={dash?.customerOutstanding} />
        <Kpi label="Supplier outstanding" value={dash?.supplierOutstanding} />
        <Kpi label="Pending approvals" value={dash?.pendingApprovals} />
        <Kpi label="Pending deliveries" value={dash?.pendingDeliveries} />
        <Kpi label="Pending repairs" value={dash?.pendingRepairs} />
        <Kpi label="Warranty claims" value={dash?.warrantyClaims} />
        <Kpi label="Online orders" value={dash?.onlineOrders} />
        <Kpi label="Sales growth %" value={dash?.salesGrowth} />
        <Kpi label="Purchase growth %" value={dash?.purchaseGrowth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profit chart (daily)">
          {profitSeries.length ? (
            <MiniBars series={profitSeries} />
          ) : (
            <p className="text-sm opacity-70">No profit series for this period.</p>
          )}
        </Card>
        <Card title="Recent transactions">
          <ul className="max-h-64 space-y-2 overflow-auto text-sm">
            {recent.length === 0 && <li className="opacity-70">No recent activity.</li>}
            {recent.map((t) => (
              <li key={`${t.type}-${t.id}`} className="flex justify-between gap-2 border-b border-[var(--erp-border)] py-1">
                <span>
                  <span className="opacity-60">{t.type}</span> {t.label}
                </span>
                <span className="tabular-nums">{t.amount}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
