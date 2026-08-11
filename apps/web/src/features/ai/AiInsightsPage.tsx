import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { aiApi } from "./ai-api";

export function AiInsightsPage() {
  const toast = useToast();
  const [kind, setKind] = useState("all");
  const [lookbackDays, setLookbackDays] = useState("180");
  const [horizonDays, setHorizonDays] = useState("30");
  const [fastDays, setFastDays] = useState("30");
  const [slowDays, setSlowDays] = useState("90");
  const [stagnantDays, setStagnantDays] = useState("180");
  const [threshold, setThreshold] = useState("0.78");
  const [payload, setPayload] = useState<{
    explanations?: string[];
    sources?: Array<{ table: string; note: string }>;
    result?: unknown;
  } | null>(null);

  useEffect(() => {
    void aiApi
      .getSettings()
      .then((r) => {
        if (!r.item) return;
        setThreshold(String(r.item.confidence_threshold ?? 0.78));
        setFastDays(String(r.item.fast_days ?? 30));
        setSlowDays(String(r.item.slow_days ?? 90));
        setStagnantDays(String(r.item.stagnant_days ?? 180));
      })
      .catch(() => undefined);
  }, []);

  async function run() {
    try {
      const res = await aiApi.insights({
        kind,
        lookbackDays: Number(lookbackDays),
        horizonDays: Number(horizonDays),
        velocity: {
          fastDays: Number(fastDays),
          slowDays: Number(slowDays),
          stagnantDays: Number(stagnantDays),
        },
      });
      setPayload(res);
      toast.push({ title: "Insights generated", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Insights failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">AI Smart Business</h1>
      <p className="text-sm opacity-70">
        Sales prediction, fast/slow/stagnant movers, demand forecast, purchase recommendations,
        customer patterns, and profit optimization — explainable and traced to source tables.
      </p>

      <Card title="Settings & run">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Insight kind</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {[
                "all",
                "sales_prediction",
                "velocity",
                "demand_forecast",
                "purchase_recommendation",
                "customer_patterns",
                "profit_optimization",
              ].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Lookback days"
            value={lookbackDays}
            onChange={(e) => setLookbackDays(e.target.value)}
          />
          <Input
            label="Horizon days"
            value={horizonDays}
            onChange={(e) => setHorizonDays(e.target.value)}
          />
          <Input label="Fast days" value={fastDays} onChange={(e) => setFastDays(e.target.value)} />
          <Input label="Slow days" value={slowDays} onChange={(e) => setSlowDays(e.target.value)} />
          <Input
            label="Stagnant days"
            value={stagnantDays}
            onChange={(e) => setStagnantDays(e.target.value)}
          />
          <Input
            label="Recognition confidence"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void run()}>
            Generate insights
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void aiApi
                .saveSettings({
                  confidenceThreshold: Number(threshold),
                  velocity: {
                    fastDays: Number(fastDays),
                    slowDays: Number(slowDays),
                    stagnantDays: Number(stagnantDays),
                  },
                })
                .then(() => toast.push({ title: "AI settings saved", tone: "success" }))
                .catch((err) =>
                  toast.push({
                    title: "Save failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Save AI settings
          </Button>
        </div>
      </Card>

      {payload ? (
        <>
          <Card title="Explanations">
            <ul className="list-disc pl-5 text-sm">
              {(payload.explanations ?? []).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Card>
          <Card title="Sources">
            <ul className="text-sm">
              {(payload.sources ?? []).map((s, i) => (
                <li key={`${s.table}-${i}`}>
                  <code>{s.table}</code> — {s.note}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Result JSON">
            <pre className="max-h-[28rem] overflow-auto text-xs">
              {JSON.stringify(payload.result, null, 2)}
            </pre>
          </Card>
        </>
      ) : null}
    </div>
  );
}
