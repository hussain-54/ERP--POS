import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState, KpiCard, LoadingState, PageHeader, SearchInput, SectionBlock } from "@electronic-erp/ui";
import { canShowNavItem } from "@/app/modules";
import { APP_NAME } from "@/branding";
import { NavIcon } from "@/app/shell/nav-icons";
import { useAuth } from "@/features/auth/AuthContext";
import { reportingApi } from "@/features/reports/reporting-api";
import {
  filterLauncherModules,
  launcherModules,
  launcherSuggestions,
  type LauncherModule,
} from "./module-launcher";

type ExecutiveDash = Record<string, unknown>;

function money(n: unknown): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function int(n: unknown): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return String(Math.round(v));
}

function ModuleCard({
  module,
  childHints,
}: {
  module: LauncherModule;
  childHints: Array<{ title: string; path: string }>;
}) {
  return (
    <Link
      to={module.path}
      data-launcher-module={module.id}
      className="flex min-h-11 flex-col rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] p-4 shadow-[var(--erp-shadow)] transition hover:border-[var(--erp-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:border-[var(--erp-brand)] active:bg-[var(--erp-brand-soft)]"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--erp-brand-soft)] text-[var(--erp-brand)] [&_svg]:h-5 [&_svg]:w-5">
        <NavIcon name={module.icon} />
      </span>
      <span className="mt-3 text-xs font-semibold tracking-wide text-[var(--erp-muted)]">{module.number}</span>
      <span className="mt-0.5 text-base font-semibold leading-snug text-[var(--erp-ink)]">{module.name}</span>
      <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--erp-muted)]">{module.description}</span>
      {childHints.length ? (
        <span className="mt-3 space-y-1 text-sm text-[var(--erp-brand)]">
          {childHints.slice(0, 3).map((child) => (
            <span key={`${child.path}:${child.title}`} className="block">
              → {child.title}
            </span>
          ))}
        </span>
      ) : null}
      <span className="mt-auto pt-3 text-sm font-semibold text-[var(--erp-brand)]">Open Module →</span>
    </Link>
  );
}

const QUICK_ACTIONS: Array<{ path: string; label: string; permission?: string }> = [
  { path: "/pos", label: "Open POS", permission: "pos.sell" },
  { path: "/products", label: "Products", permission: "products.read" },
  { path: "/inventory", label: "Inventory", permission: "inventory.view" },
  { path: "/customers", label: "Customers", permission: "customers.read" },
  { path: "/purchases", label: "Purchases", permission: "purchases.read" },
  { path: "/reports", label: "Reports", permission: "reports.view" },
];

export function ModuleLauncherPage() {
  const { hasPermission, permissions, user } = useAuth();
  const grantedCount = permissions.length;
  const [query, setQuery] = useState("");
  const [dash, setDash] = useState<ExecutiveDash | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const canViewReports = hasPermission("reports.view");

  const allowed = useMemo(
    () =>
      launcherModules().filter((module) => canShowNavItem(module.permission, grantedCount, hasPermission)),
    [grantedCount, hasPermission],
  );

  const visible = useMemo(() => filterLauncherModules(query, allowed), [allowed, query]);
  const suggestions = useMemo(() => launcherSuggestions(query, allowed), [allowed, query]);

  const quickActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) =>
        action.permission ? canShowNavItem(action.permission, grantedCount, hasPermission) : true,
      ),
    [grantedCount, hasPermission],
  );

  const [dashTick, setDashTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!canViewReports) {
      setDash(null);
      setDashError(null);
      setDashLoading(false);
      return;
    }
    setDashLoading(true);
    setDashError(null);
    void reportingApi
      .executive({ period: "month" })
      .then((res) => {
        if (cancelled) return;
        setDash((res.dashboard ?? {}) as ExecutiveDash);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDash(null);
        setDashError(err instanceof Error ? err.message : "Could not load summary");
      })
      .finally(() => {
        if (!cancelled) setDashLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewReports, dashTick]);

  return (
    <div className="mx-auto w-full max-w-[88rem] space-y-6">
      <PageHeader
        eyebrow={APP_NAME}
        title="Command Center"
        description={`Welcome${user?.fullName ? `, ${user.fullName}` : ""}. Open a module below or jump to a daily workflow.`}
      />

      {quickActions.length ? (
        <SectionBlock title="Quick actions" description="Common workflows without leaving the ERP shell.">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="inline-flex min-h-11 items-center rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface)] px-3 text-sm font-medium text-[var(--erp-ink)] shadow-[var(--erp-shadow)] hover:border-[var(--erp-brand)] hover:text-[var(--erp-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {canViewReports ? (
        <SectionBlock title="This month" description="Live figures from your reporting APIs.">
          {dashLoading ? <LoadingState label="Loading executive summary…" /> : null}
          {!dashLoading && dashError ? (
            <ErrorState title="Summary unavailable" description={dashError} onRetry={() => setDashTick((n) => n + 1)} />
          ) : null}
          {!dashLoading && !dashError && dash ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Sales" value={money(dash.sales)} tone="brand" />
              <KpiCard label="Purchases" value={money(dash.purchases)} />
              <KpiCard label="Gross profit" value={money(dash.grossProfit)} tone="success" />
              <KpiCard
                label="Stock value"
                value={money(dash.stockValue)}
                hint={`${int(dash.lowStock)} low · ${int(dash.outOfStock)} out`}
                tone={Number(dash.outOfStock ?? 0) > 0 ? "warning" : "neutral"}
              />
              <KpiCard label="Receivables" value={money(dash.receivables)} />
              <KpiCard label="Payables" value={money(dash.payables)} />
              <KpiCard label="Cash" value={money(dash.cash)} hint={`Bank ${money(dash.bank)}`} />
              <KpiCard
                label="Alerts"
                value={int(
                  Number(dash.pendingApprovals ?? 0) +
                    Number(dash.pendingDeliveries ?? 0) +
                    Number(dash.pendingRepairs ?? 0),
                )}
                hint="Approvals, deliveries, repairs"
                tone="warning"
              />
            </div>
          ) : null}
          {!dashLoading && !dashError && !dash ? (
            <p className="text-sm text-[var(--erp-muted)]">No executive summary data for this period yet.</p>
          ) : null}
        </SectionBlock>
      ) : null}

      <SectionBlock title="Modules" description="All 39 ERP modules stay inside this application shell.">
        <div className="max-w-xl">
          <SearchInput
            aria-label="Search modules"
            placeholder="Search modules, numbers, or features…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11"
          />
        </div>

        {query.trim() ? (
          <div className="mt-2" aria-live="polite">
            {suggestions.length ? (
              <ul
                aria-label="Module search results"
                className="divide-y divide-[var(--erp-border)] overflow-hidden rounded-[var(--erp-radius-lg)] border border-[var(--erp-border)] bg-[var(--erp-surface)] shadow-[var(--erp-shadow)]"
              >
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--erp-brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--erp-ring)] active:bg-[var(--erp-brand-soft)]"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--erp-ink)]">
                          {item.moduleNumber} {item.moduleName}
                        </span>
                        {item.childTitle ? (
                          <span className="mt-0.5 block text-sm text-[var(--erp-brand)]">→ {item.childTitle}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-[var(--erp-brand)]">Open →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--erp-muted)]">No modules match “{query.trim()}”.</p>
            )}
          </div>
        ) : null}

        <div
          data-launcher-grid
          className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map(({ module, matchedChildren }) => (
            <ModuleCard key={module.id} module={module} childHints={query.trim() ? matchedChildren : []} />
          ))}
        </div>
      </SectionBlock>
    </div>
  );
}
