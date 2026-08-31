import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, ErrorState, KpiCard, LoadingState, PageHeader, SearchInput } from "@electronic-erp/ui";
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
  return `Rs. ${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function int(n: unknown): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return String(Math.round(v));
}

const CATEGORY_FILTERS = [
  { id: "all", label: "All 39 Modules" },
  { id: "core", label: "Core & Sales", numbers: ["01", "02", "03", "04", "05", "06", "07", "08"] },
  { id: "supply", label: "Inventory & Supply", numbers: ["09", "10", "11", "12", "13", "14", "15"] },
  { id: "finance", label: "Finance & Accounts", numbers: ["16", "17", "18", "19", "20", "21", "22", "30"] },
  { id: "operations", label: "Operations & Admin", numbers: ["23", "24", "25", "26", "27", "28", "29", "31", "32", "33", "34", "35", "36", "37", "38", "39"] },
];

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
      className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div>
        {/* Top bar: Module Number + Icon + Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50/80 border border-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white [&_svg]:h-5 [&_svg]:w-5 shadow-xs">
              <NavIcon name={module.icon} />
            </span>
            <div>
              <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-blue-600 transition">
                #{module.number}
              </span>
              <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition">
                {module.name}
              </h3>
            </div>
          </div>

          <Badge
            tone={module.status === "implemented" ? "brand" : "neutral"}
            size="sm"
          >
            {module.status === "implemented" ? "Live" : "Preview"}
          </Badge>
        </div>

        {/* Module Description */}
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500 group-hover:text-slate-600">
          {module.description}
        </p>

        {/* Matched Child Hints when searching */}
        {childHints.length ? (
          <div className="mt-3 space-y-1 rounded-lg bg-blue-50/50 p-2 text-xs text-blue-700 border border-blue-100">
            {childHints.slice(0, 3).map((child) => (
              <span key={`${child.path}:${child.title}`} className="block truncate font-medium">
                → {child.title}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Bottom CTA footer */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-blue-600 group-hover:text-blue-700">
        <span>Enter Module</span>
        <i className="fa-solid fa-arrow-right text-[11px] transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

const QUICK_ACTIONS: Array<{ path: string; label: string; icon: string; permission?: string }> = [
  { path: "/pos", label: "Retail POS Terminal", icon: "fa-cash-register", permission: "pos.sell" },
  { path: "/products", label: "Product Catalog", icon: "fa-boxes-stacked", permission: "products.read" },
  { path: "/inventory", label: "Live Stock & Batches", icon: "fa-warehouse", permission: "inventory.view" },
  { path: "/customers", label: "Customer Directory", icon: "fa-users", permission: "customers.read" },
  { path: "/purchases", label: "Purchase Orders", icon: "fa-truck-ramp-box", permission: "purchases.read" },
  { path: "/reports", label: "Reports & Analytics", icon: "fa-chart-line", permission: "reports.view" },
];

export function ModuleLauncherPage() {
  const { hasPermission, permissions, user } = useAuth();
  const grantedCount = permissions.length;
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [dash, setDash] = useState<ExecutiveDash | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const canViewReports = hasPermission("reports.view");

  const allowed = useMemo(
    () =>
      launcherModules().filter((module) => canShowNavItem(module.permission, grantedCount, hasPermission)),
    [grantedCount, hasPermission],
  );

  const categoryFiltered = useMemo(() => {
    if (activeCategory === "all") return allowed;
    const cat = CATEGORY_FILTERS.find((c) => c.id === activeCategory);
    if (!cat?.numbers) return allowed;
    return allowed.filter((m) => cat.numbers?.includes(m.number));
  }, [allowed, activeCategory]);

  const visible = useMemo(() => filterLauncherModules(query, categoryFiltered), [categoryFiltered, query]);
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
    <div className="mx-auto w-full max-w-[90rem] space-y-6 pb-8">
      {/* 1. ENTERPRISE PAGE HEADER */}
      <PageHeader
        moduleNumber="01"
        eyebrow={APP_NAME}
        title="Command Center"
        description={`Welcome back, ${user?.fullName || "Executive User"}. Direct access to all 39 ERP modules, daily workflows, and live key performance indicators.`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/pos"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <i className="fa-solid fa-cash-register" />
              <span>Launch POS</span>
            </Link>
          </div>
        }
      />

      {/* 2. FREQUENT WORKFLOWS SHORTCUT STRIP */}
      {quickActions.length ? (
        <Card
          title="Frequent Operational Workflows"
          description="Instant shortcuts into high-frequency day-to-day modules."
          divided
        >
          <div className="flex flex-wrap gap-2.5">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 active:scale-[0.98]"
              >
                <i className={`fa-solid ${action.icon} text-slate-400 group-hover:text-blue-600`} />
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {/* 3. EXECUTIVE KPIS */}
      {canViewReports ? (
        <Card
          title="Executive Performance Summary (This Month)"
          description="Real-time operational financial figures across all branches."
          actions={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setDashTick((n) => n + 1)}
              leftIcon={<i className="fa-solid fa-arrow-rotate-right text-[10px]" />}
            >
              Refresh
            </Button>
          }
          divided
        >
          {dashLoading ? <LoadingState label="Loading executive financial summary…" /> : null}
          {!dashLoading && dashError ? (
            <ErrorState title="Summary figures unavailable" description={dashError} onRetry={() => setDashTick((n) => n + 1)} />
          ) : null}
          {!dashLoading && !dashError && dash ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <KpiCard
                label="Sales Turnover"
                value={money(dash.sales)}
                tone="brand"
                icon={<i className="fa-solid fa-sack-dollar" />}
              />
              <KpiCard
                label="Purchases"
                value={money(dash.purchases)}
                icon={<i className="fa-solid fa-cart-shopping" />}
              />
              <KpiCard
                label="Gross Margin"
                value={money(dash.grossProfit)}
                tone="success"
                icon={<i className="fa-solid fa-arrow-trend-up" />}
              />
              <KpiCard
                label="Stock Valuation"
                value={money(dash.stockValue)}
                hint={`${int(dash.lowStock)} low · ${int(dash.outOfStock)} out of stock`}
                tone={Number(dash.outOfStock ?? 0) > 0 ? "warning" : "neutral"}
                icon={<i className="fa-solid fa-boxes-stacked" />}
              />
              <KpiCard
                label="Receivables (Udhaar)"
                value={money(dash.receivables)}
                icon={<i className="fa-solid fa-hand-holding-dollar" />}
              />
              <KpiCard
                label="Payables"
                value={money(dash.payables)}
                icon={<i className="fa-solid fa-file-invoice-dollar" />}
              />
              <KpiCard
                label="Cash in Hand"
                value={money(dash.cash)}
                hint={`Bank: ${money(dash.bank)}`}
                icon={<i className="fa-solid fa-money-bill-wave" />}
              />
              <KpiCard
                label="Pending Action Items"
                value={int(
                  Number(dash.pendingApprovals ?? 0) +
                    Number(dash.pendingDeliveries ?? 0) +
                    Number(dash.pendingRepairs ?? 0),
                )}
                hint="Approvals, deliveries & repairs"
                tone="warning"
                icon={<i className="fa-solid fa-bell" />}
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* 4. STRUCTURED 39-MODULE CARD MATRIX */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Enterprise Module Directory
            </h2>
            <p className="text-xs text-slate-500">
              All 39 approved ERP modules structured by functional area.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <SearchInput
              aria-label="Search modules"
              placeholder="Search by module name, number, feature…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 text-xs"
            />
          </div>
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Suggestions dropdown if searching */}
        {query.trim() && suggestions.length > 0 ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-xs font-bold text-blue-900 mb-2">Direct section matches:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {suggestions.slice(0, 6).map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex items-center justify-between rounded-lg bg-white p-2.5 text-xs font-semibold text-slate-800 border border-slate-200 shadow-xs hover:border-blue-400 hover:text-blue-700 transition"
                >
                  <span className="truncate">
                    #{item.moduleNumber} {item.moduleName} {item.childTitle ? `→ ${item.childTitle}` : ""}
                  </span>
                  <i className="fa-solid fa-arrow-right text-[10px] text-blue-600" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* 39-Module Grid */}
        <div
          data-launcher-grid
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {visible.map(({ module, matchedChildren }) => (
            <ModuleCard key={module.id} module={module} childHints={query.trim() ? matchedChildren : []} />
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-bold text-slate-700">No modules match your query “{query}”</p>
            <p className="mt-1 text-xs text-slate-500">Try clearing the search or choosing "All 39 Modules".</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setQuery("");
                setActiveCategory("all");
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
