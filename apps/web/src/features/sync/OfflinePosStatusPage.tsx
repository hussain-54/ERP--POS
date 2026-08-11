import { useEffect, useState } from "react";
import { Badge, Button, Card } from "@electronic-erp/ui";

type DesktopBridge = {
  getStatus?: () => Promise<Record<string, unknown>>;
  syncNow?: () => Promise<Record<string, unknown>>;
  syncStatus?: () => Promise<Record<string, unknown> | null>;
  listPendingSales?: () => Promise<unknown[]>;
};

function desktop(): DesktopBridge | null {
  return (window as unknown as { electronicErpDesktop?: DesktopBridge }).electronicErpDesktop ?? null;
}

/**
 * Offline POS status — Electron owns SQLite + SyncCoordinator;
 * web fallback shows browser online state only.
 */
export function OfflinePosStatusPage() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sync, setSync] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  async function refresh() {
    const bridge = desktop();
    if (bridge?.getStatus) {
      setIsDesktop(true);
      const status = await bridge.getStatus();
      setOnline(Boolean(status.online));
      setDeviceId(typeof status.deviceId === "string" ? status.deviceId : null);
      const syncProgress =
        (status.sync as Record<string, unknown> | null | undefined) ??
        (bridge.syncStatus ? await bridge.syncStatus() : null);
      setSync(syncProgress);
      setPending(Number(syncProgress?.pendingCount ?? 0));
      if (bridge.listPendingSales) {
        const sales = await bridge.listPendingSales();
        if (Array.isArray(sales) && !syncProgress) setPending(sales.length);
      }
      return;
    }
    setIsDesktop(false);
    setOnline(navigator.onLine);
    setPending(Number(localStorage.getItem("erp_pending_ops") ?? "0"));
    setDeviceId(localStorage.getItem("erp_registered_device_id") ?? localStorage.getItem("erp_device_id"));
  }

  useEffect(() => {
    void refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = setInterval(() => void refresh(), 5_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(t);
    };
  }, []);

  const statusLabel = !online
    ? "Offline"
    : Number(sync?.pendingCount ?? pending) > 0
      ? "Pending"
      : sync?.status
        ? String(sync.status)
        : "Synced";

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Offline POS engine</h1>
      <p className="text-sm opacity-70">
        Local SQLite (Electron) is authoritative while offline. Outbox sales sync to cloud via
        SyncCoordinator when online.
      </p>
      <Card title="Device">
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{isDesktop ? "Electron" : "Web"}</Badge>
            <Badge>{online ? "Online" : "Offline"}</Badge>
            <Badge>{statusLabel}</Badge>
            <Badge>Pending ops: {Number(sync?.pendingCount ?? pending)}</Badge>
          </div>
          <div>
            Device ID: <code>{deviceId ?? "not registered"}</code>
          </div>
          {sync?.lastSyncAt ? (
            <div>
              Last sync: <code>{String(sync.lastSyncAt)}</code>
            </div>
          ) : null}
          {sync?.lastError ? (
            <div className="text-[var(--erp-danger)]">Last error: {String(sync.lastError)}</div>
          ) : null}
          {isDesktop ? (
            <Button
              size="sm"
              disabled={busy || !online}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    await desktop()?.syncNow?.();
                    await refresh();
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {busy ? "Syncing…" : "Sync now"}
            </Button>
          ) : null}
        </div>
      </Card>
      <Card title="Guarantees">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Permanent device ID + server registration</li>
          <li>Canonical UUIDs for offline-created records</li>
          <li>Outbox survives crash; processing rows requeue</li>
          <li>Idempotency keys prevent duplicate bills</li>
          <li>Cloud apply via PosRepository on sync push</li>
        </ul>
      </Card>
    </div>
  );
}
