import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { infrastructureApi } from "@/features/system/infrastructure-api";

export function BackupPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [points, setPoints] = useState<Array<Record<string, unknown>>>([]);
  const [mode, setMode] = useState("daily");
  const [target, setTarget] = useState("local");
  const [label, setLabel] = useState("Nightly encrypted backup");
  const [pointId, setPointId] = useState("");
  const [lastPlan, setLastPlan] = useState<unknown>(null);

  async function reload() {
    const [j, p] = await Promise.all([
      infrastructureApi.listBackupJobs(),
      infrastructureApi.listRestorePoints(),
    ]);
    setJobs(j.items);
    setPoints(p.items);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Backup / DR architecture</h1>
      <p className="text-sm opacity-70">
        Automatic / daily / local / cloud / incremental backup jobs, restore points, and restore
        requests. Encrypted backup paths are queued.{" "}
        <strong>Disaster recovery is not claimed</strong> until a restore is actually tested and
        verified.
      </p>

      <Card title="Create backup job">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Mode</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              {["automatic", "daily", "full", "incremental"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Target</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="local">local</option>
              <option value="cloud">cloud</option>
            </select>
          </label>
          <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <Button
          className="mt-3"
          type="button"
          onClick={() =>
            void infrastructureApi
              .createBackupJob({ mode, target, encrypted: true, label })
              .then((r) => {
                setLastPlan((r as { plan?: unknown }).plan ?? r);
                return reload();
              })
              .then(() => toast.push({ title: "Backup job queued (encrypted)", tone: "success" }))
          }
        >
          Queue encrypted backup
        </Button>
        <pre className="mt-2 max-h-32 overflow-auto text-xs">
          {lastPlan ? JSON.stringify(lastPlan, null, 2) : ""}
        </pre>
      </Card>

      <Card title="Jobs">
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {jobs.map((j) => (
            <li key={String(j.id)}>
              {String(j.mode)}/{String(j.target)} · {String(j.status)} · encrypted=
              {String(j.encrypted)} · DR claimed={String(j.disaster_recovery_claimed)}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Restore points + verify">
        <Button
          type="button"
          onClick={() =>
            void infrastructureApi
              .createRestorePoint({
                label: `RP-${new Date().toISOString().slice(0, 10)}`,
                backupJobId: jobs[0] ? String(jobs[0].id) : undefined,
              })
              .then(() => reload())
          }
        >
          Create restore point
        </Button>
        <ul className="mt-2 space-y-1 text-sm">
          {points.map((p) => (
            <li key={String(p.id)}>
              <button type="button" className="underline" onClick={() => setPointId(String(p.id))}>
                {String(p.label)}
              </button>
            </li>
          ))}
        </ul>
        <Input
          className="mt-2"
          label="Restore point id"
          value={pointId}
          onChange={(e) => setPointId(e.target.value)}
        />
        <Button
          className="mt-2"
          type="button"
          variant="secondary"
          onClick={() =>
            void infrastructureApi
              .requestRestore({ restorePointId: pointId, verifyOnly: true })
              .then((r) =>
                toast.push({
                  title: "Verify-only restore recorded",
                  description: JSON.stringify(r).slice(0, 180),
                  tone: "info",
                }),
              )
          }
        >
          Request restore verification (not full DR claim)
        </Button>
      </Card>
    </div>
  );
}
