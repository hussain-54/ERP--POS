import { useEffect, useState } from "react";
import { Badge, Card } from "@electronic-erp/ui";

/**
 * Offline POS status surface — Electron main process owns SQLite;
 * renderer reads sync status via IPC / localStorage bridge.
 */
export function OfflinePosStatusPage() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine);
      setPending(Number(localStorage.getItem("erp_pending_ops") ?? "0"));
      setDeviceId(localStorage.getItem("erp_registered_device_id") ?? localStorage.getItem("erp_device_id"));
    };
    sync();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("storage", sync);
    const t = setInterval(sync, 5_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("storage", sync);
      clearInterval(t);
    };
  }, []);

  const status = !online ? "Offline" : pending > 0 ? "Pending" : "Synced";

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Offline POS engine</h1>
      <p className="text-sm opacity-70">
        Local SQLite (Electron) is authoritative while offline. Mutations go to the outbox with
        UUID identity and sync when online — same ERP model, not a demo fork.
      </p>
      <Card title="Device">
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <Badge>{online ? "Online" : "Offline"}</Badge>
            <Badge>{status}</Badge>
            <Badge>Pending ops: {pending}</Badge>
          </div>
          <div>
            Device ID: <code>{deviceId ?? "not registered"}</code>
          </div>
        </div>
      </Card>
      <Card title="Guarantees">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Permanent device ID + server registration</li>
          <li>Canonical UUIDs for offline-created records</li>
          <li>Outbox survives crash; processing rows requeue</li>
          <li>Idempotency keys prevent duplicate bills</li>
          <li>Stock conflicts reconcile via movement events</li>
        </ul>
      </Card>
    </div>
  );
}
