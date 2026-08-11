import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { syncApi } from "./sync-api";

type UiStatus = "online" | "offline" | "syncing" | "synced" | "pending" | "failed" | "conflict";

function deviceKey(): string {
  const k = "erp_device_key";
  let v = localStorage.getItem(k);
  if (!v) {
    v = `web_${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem(k, v);
  }
  return v;
}

function deviceId(): string {
  const k = "erp_device_id";
  let v = localStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(k, v);
  }
  return v;
}

export function SyncCenterPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState<UiStatus>("online");
  const [pendingCount, setPendingCount] = useState(0);
  const [serverStatus, setServerStatus] = useState<Record<string, unknown> | null>(null);
  const [conflicts, setConflicts] = useState<Array<Record<string, unknown>>>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const st = await syncApi.status(localStorage.getItem("erp_registered_device_id") ?? undefined);
      setServerStatus(st);
      const open = Number(st.openConflicts ?? 0);
      const localPending = Number(localStorage.getItem("erp_pending_ops") ?? "0");
      setPendingCount(localPending);
      if (!navigator.onLine) setStatus("offline");
      else if (open > 0) setStatus("conflict");
      else if (localPending > 0) setStatus("pending");
      else if (lastSync) setStatus("synced");
      else setStatus("online");
      const c = await syncApi.listConflicts();
      setConflicts(c.items);
    } catch {
      /* permissions may block — still show connectivity */
      setStatus(navigator.onLine ? "online" : "offline");
    }
  }, [lastSync]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => {
      setOnline(false);
      setStatus("offline");
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
  }, [refresh]);

  async function register() {
    if (!branchId) {
      toast.push({ title: "Select a branch first", tone: "danger" });
      return;
    }
    try {
      const row = (await syncApi.registerDevice({
        branchId,
        deviceKey: deviceKey(),
        name: `Web POS ${deviceId().slice(0, 8)}`,
        platform: "web",
      })) as Record<string, unknown>;
      localStorage.setItem("erp_registered_device_id", String(row.id));
      toast.push({ title: "Device registered", tone: "success" });
      await refresh();
    } catch (err) {
      toast.push({
        title: "Register failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function manualSync() {
    setSyncing(true);
    setStatus("syncing");
    try {
      const id = localStorage.getItem("erp_registered_device_id");
      if (!id) {
        await register();
      }
      const device = localStorage.getItem("erp_registered_device_id");
      if (device) {
        await syncApi.pull({ deviceId: device, tableName: "sales", limit: 50 });
      }
      setLastSync(new Date().toISOString());
      localStorage.setItem("erp_pending_ops", "0");
      setPendingCount(0);
      setStatus("synced");
      toast.push({ title: "Sync complete", tone: "success" });
      await refresh();
    } catch (err) {
      setStatus("failed");
      toast.push({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function resolve(id: string, resolution: string) {
    try {
      await syncApi.resolveConflict(id, { resolution, remarks: "Resolved from sync center" });
      toast.push({ title: "Conflict resolved", tone: "success" });
      await refresh();
    } catch (err) {
      toast.push({
        title: "Resolve failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  const tone =
    status === "failed" || status === "conflict"
      ? "danger"
      : status === "synced" || status === "online"
        ? "success"
        : "neutral";

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Sync center</h1>
        <Badge tone={tone as "danger" | "success" | "neutral"}>{status.toUpperCase()}</Badge>
      </div>

      <Card title="Connectivity">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge>{online ? "Online" : "Offline"}</Badge>
          <Badge>{syncing ? "Syncing" : status === "synced" ? "Synced" : status}</Badge>
          <Badge>Pending: {pendingCount}</Badge>
          {lastSync && <span className="opacity-70">Last sync: {lastSync}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void register()}>
            Register device
          </Button>
          <Button type="button" onClick={() => void manualSync()} disabled={syncing}>
            Manual sync
          </Button>
          <Button type="button" onClick={() => void refresh()}>
            Refresh status
          </Button>
        </div>
        {serverStatus && (
          <pre className="mt-3 overflow-auto text-xs opacity-80">
            {JSON.stringify(serverStatus, null, 2)}
          </pre>
        )}
      </Card>

      <Card title="Conflicts">
        <div className="max-h-64 overflow-auto text-sm">
          {conflicts.map((c) => (
            <div key={String(c.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <div>
                {String(c.entity_type)} · {String(c.entity_id).slice(0, 8)}… · v
                {String(c.client_version)} vs {String(c.server_version)}
              </div>
              <div className="flex gap-1">
                <Button type="button" onClick={() => void resolve(String(c.id), "server_wins")}>
                  Server
                </Button>
                <Button type="button" onClick={() => void resolve(String(c.id), "client_wins")}>
                  Client
                </Button>
                <Button
                  type="button"
                  onClick={() => void resolve(String(c.id), "transaction_reconcile")}
                >
                  Reconcile
                </Button>
              </div>
            </div>
          ))}
          {!conflicts.length && <p className="opacity-70">No open conflicts.</p>}
        </div>
      </Card>
    </div>
  );
}
