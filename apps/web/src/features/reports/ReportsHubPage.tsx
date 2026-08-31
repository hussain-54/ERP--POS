import { useEffect, useState } from "react";
import { Breadcrumb, Button, Card, Input, PageHeader, useToast } from "@electronic-erp/ui";
import { ReportFilters } from "./ReportFilters";
import { reportingApi, type ReportFilterInput } from "./reporting-api";

type Tab = "sales" | "purchases" | "stock" | "profit" | "accounting";

export function ReportsHubPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("sales");
  const [filter, setFilter] = useState<ReportFilterInput>({ period: "month" });
  const [partyId, setPartyId] = useState("");
  const [catalog, setCatalog] = useState<{
    sales: string[];
    purchases: string[];
    stock: string[];
    profit: string[];
    accounting: string[];
  } | null>(null);
  const [key, setKey] = useState("daily");
  const [output, setOutput] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void reportingApi
      .catalog()
      .then((c) => {
        setCatalog(c);
        setKey(c.sales[0] ?? "daily");
      })
      .catch((err) =>
        toast.push({
          title: "Catalog failed",
          description: err instanceof Error ? err.message : "Error",
          tone: "danger",
        }),
      );
  }, [toast]);

  useEffect(() => {
    if (!catalog) return;
    const first =
      tab === "sales"
        ? catalog.sales[0]
        : tab === "purchases"
          ? catalog.purchases[0]
          : tab === "stock"
            ? catalog.stock[0]
            : tab === "profit"
              ? catalog.profit[0]
              : catalog.accounting[0];
    setKey(first ?? "");
  }, [tab, catalog]);

  async function run() {
    setLoading(true);
    try {
      const f = { ...filter, partyId: partyId || undefined };
      let data: unknown;
      if (tab === "sales") data = await reportingApi.sales(key, f);
      else if (tab === "purchases") data = await reportingApi.purchases(key, f);
      else if (tab === "stock") data = await reportingApi.stock(key, f);
      else if (tab === "profit") data = await reportingApi.profit(key, f);
      else data = await reportingApi.accounting(key, f);
      setOutput(data);
    } catch (err) {
      toast.push({
        title: "Report query failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  const options =
    tab === "sales"
      ? catalog?.sales
      : tab === "purchases"
        ? catalog?.purchases
        : tab === "stock"
          ? catalog?.stock
          : tab === "profit"
            ? catalog?.profit
            : catalog?.accounting;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Intelligence & BI", href: "/reports" },
          { label: "Reports Hub" },
        ]}
      />

      <PageHeader
        moduleNumber="18"
        title="Enterprise Reports & BI Analytics"
        description="Comprehensive transactional, stock valuation, gross margin, aging receivables/payables, and financial reporting engine."
      />

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        {(["sales", "purchases", "stock", "profit", "accounting"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              tab === t
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Filter & Run Controls */}
        <Card title="Report Parameters & Scope" description="Configure time horizons, branches, and entities." divided className="lg:col-span-1">
          <ReportFilters value={filter} onChange={setFilter} />
          {tab === "accounting" && (
            <div className="mt-2.5">
              <Input
                label="Party ID (Customer / Supplier Ledger)"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                placeholder="Leave blank for global"
              />
            </div>
          )}

          <div className="mt-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Select Report Matrix</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            >
              {options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button type="button" onClick={() => void run()} loading={loading} className="w-full">
              Execute Report
            </Button>
          </div>
        </Card>

        {/* Output Area */}
        <Card title="Generated Report Output" description={key ? `Matrix: ${key} (${tab})` : "Run query above"} divided className="lg:col-span-2">
          {output ? (
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-emerald-400 font-mono text-xs shadow-inner">
              <pre>{JSON.stringify(output, null, 2)}</pre>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400">
              Select your parameters and click "Execute Report" to view results.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
