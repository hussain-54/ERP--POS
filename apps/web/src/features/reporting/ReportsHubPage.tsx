import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
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
        title: "Report failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
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
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <p className="text-sm opacity-70">
        Sales, purchases, stock, profit and accounting — scoped by org, branch, warehouse and permissions.
      </p>

      <div className="flex flex-wrap gap-2">
        {(["sales", "purchases", "stock", "profit", "accounting"] as Tab[]).map((t) => (
          <Button
            key={t}
            type="button"
            variant={tab === t ? "primary" : "secondary"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      <Card title="Filters">
        <ReportFilters value={filter} onChange={setFilter} />
        {tab === "accounting" && (
          <div className="mt-2">
            <Input
              label="Party id (customer/supplier ledgers)"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Report</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            >
              {(options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={() => void run()}>
            Run report
          </Button>
        </div>
      </Card>

      <Card title="Result">
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs">
          {output ? JSON.stringify(output, null, 2) : "Run a report to view results."}
        </pre>
      </Card>
    </div>
  );
}
