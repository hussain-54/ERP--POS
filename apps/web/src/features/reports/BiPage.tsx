import { useEffect, useState } from "react";
import { Button, Card, useToast } from "@electronic-erp/ui";
import { ReportFilters } from "./ReportFilters";
import { reportingApi, type ReportFilterInput } from "./reporting-api";

const METRICS = [
  "best_selling",
  "worst_selling",
  "highest_profit",
  "lowest_profit",
  "customer_lifetime_value",
  "supplier_performance",
  "sales_growth",
  "purchase_growth",
  "monthly_comparison",
  "branch_comparison",
  "warehouse_comparison",
  "salesman_performance",
  "product_margin",
  "inventory_turnover",
] as const;

export function BiPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<ReportFilterInput>({ period: "month" });
  const [metric, setMetric] = useState<string>("best_selling");
  const [output, setOutput] = useState<unknown>(null);

  useEffect(() => {
    void reportingApi
      .catalog()
      .then((c) => {
        if (c.bi?.[0]) setMetric(c.bi[0]);
      })
      .catch(() => undefined);
  }, []);

  async function run() {
    try {
      setOutput(await reportingApi.bi(metric, filter));
    } catch (err) {
      toast.push({
        title: "BI failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Business intelligence</h1>
      <p className="text-sm opacity-70">
        Best/worst sellers, margins, CLV, growth and branch/warehouse comparisons.
      </p>

      <Card title="Filters">
        <ReportFilters value={filter} onChange={setFilter} />
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Metric</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m.split("_").join(" ")}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={() => void run()}>
            Run BI
          </Button>
        </div>
      </Card>

      <Card title="Insight">
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs">
          {output ? JSON.stringify(output, null, 2) : "Choose a metric and run BI."}
        </pre>
      </Card>
    </div>
  );
}
