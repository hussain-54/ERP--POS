import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button, Card, ErrorState, LoadingState, useToast } from "@electronic-erp/ui";
import { ReportFilters } from "@/features/reports/ReportFilters";
import { reportingApi, type ReportFilterInput } from "@/features/reports/reporting-api";

type Dash = Record<string, unknown>;
type Tx = { id: string; type: string; label: string; amount: number; at: string };

const KPI_GROUPS: Array<{ title: string; items: Array<{ key: string; label: string }> }> = [
  {
    title: "Sales & profit",
    items: [
      { key: "sales", label: "Total sales" },
      { key: "purchases", label: "Purchases" },
      { key: "grossProfit", label: "Gross profit" },
      { key: "netProfit", label: "Net profit" },
      { key: "salesGrowth", label: "Sales growth %" },
      { key: "purchaseGrowth", label: "Purchase growth %" },
    ],
  },
  {
    title: "Cash & ledgers",
    items: [
      { key: "cash", label: "Cash" },
      { key: "bank", label: "Bank" },
      { key: "receivables", label: "Receivables" },
      { key: "payables", label: "Payables" },
      { key: "customerOutstanding", label: "Customer outstanding" },
      { key: "supplierOutstanding", label: "Supplier outstanding" },
      { key: "todayExpenses", label: "Today’s expenses" },
      { key: "installmentsDue", label: "Installments due" },
    ],
  },
  {
    title: "Stock",
    items: [
      { key: "stockValue", label: "Stock value" },
      { key: "lowStock", label: "Low stock" },
      { key: "outOfStock", label: "Out of stock" },
      { key: "overstock", label: "Overstock" },
    ],
  },
  {
    title: "Operations",
    items: [
      { key: "pendingApprovals", label: "Pending approvals" },
      { key: "pendingDeliveries", label: "Pending deliveries" },
      { key: "pendingRepairs", label: "Pending repairs" },
      { key: "warrantyClaims", label: "Warranty claims" },
      { key: "onlineOrders", label: "Online orders" },
    ],
  },
];

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
  const asNumber = Number(value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(asNumber)) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(asNumber);
  }
  return String(value);
}

function chartLabel(label: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(label)) return label.slice(5, 10);
  if (/^\d{4}-\d{2}/.test(label)) return label.slice(5);
  return label;
}

function formatWhen(at: string): string {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return at;
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Kpi({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-[var(--erp-border)] bg-white px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--erp-muted)]">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold tabular-nums text-[var(--erp-ink)]">
        {formatValue(value)}
      </div>
    </div>
  );
}

function MiniBars({ series }: { series: Array<{ label: string; amount: number }> }) {
  const max = Math.max(...series.map((s) => s.amount), 1);
  return (
    <div className="flex h-36 items-end gap-1.5">
      {series.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-[var(--erp-brand)]"
            style={{ height: `${Math.max((s.amount / max) * 100, 4)}%` }}
            title={`${s.label}: ${formatValue(s.amount)}`}
          />
          <span className="max-w-full truncate text-[10px] text-[var(--erp-muted)]">{chartLabel(s.label)}</span>
        </div>
      ))}
    </div>
  );
}

function InlineEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--erp-border)] px-3 py-8 text-center text-sm text-[var(--erp-muted)]">
      {children}
    </div>
  );
}

export function DashboardPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<ReportFilterInput>({ period: "month" });
  const [dash, setDash] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await reportingApi.executive(filter);
      setDash(res.dashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(message);
      toast.push({
        title: "Dashboard failed",
        description: message,
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
  const recent = (dash?.recentTransactions as Tx[]) ?? [];
  const firstLoad = dash == null && loading;
  const failed = dash == null && Boolean(error);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[var(--erp-muted)]">
            Sales, stock, cash, approvals, and growth at a glance.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <Card
        title="Period"
        actions={
          <Button type="button" size="sm" onClick={() => void load()} disabled={loading}>
            Apply
          </Button>
        }
      >
        <ReportFilters value={filter} onChange={setFilter} />
      </Card>

      {firstLoad ? <LoadingState label="Loading dashboard…" /> : null}
      {failed ? (
        <ErrorState title="Dashboard could not load" description={error ?? undefined} onRetry={() => void load()} />
      ) : null}

      {dash ? (
        <>
          {KPI_GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--erp-muted)]">
                {group.title}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {group.items.map((item) => (
                  <Kpi key={item.key} label={item.label} value={dash[item.key]} />
                ))}
              </div>
            </section>
          ))}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Profit chart (daily)">
              {profitSeries.length ? (
                <MiniBars series={profitSeries} />
              ) : (
                <InlineEmpty>No profit series for this period.</InlineEmpty>
              )}
            </Card>
            <Card title="Recent transactions">
              {recent.length === 0 ? (
                <InlineEmpty>No recent activity.</InlineEmpty>
              ) : (
                <ul className="max-h-64 divide-y divide-[var(--erp-border)] overflow-auto text-sm">
                  {recent.map((t) => (
                    <li key={`${t.type}-${t.id}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral">{t.type}</Badge>
                          <span className="truncate text-[var(--erp-ink)]">{t.label}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--erp-muted)]">{formatWhen(t.at)}</div>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums text-[var(--erp-ink)]">
                        {formatValue(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
