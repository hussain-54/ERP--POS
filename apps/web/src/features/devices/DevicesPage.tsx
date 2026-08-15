import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, useToast } from "@electronic-erp/ui";
import { posHardware, usbScanner, cameraScanner } from "@/features/pos/hardware";
import { hardwareApi } from "@/features/printing/hardware-api";

export function DevicesPage() {
  const toast = useToast();
  const [statuses, setStatuses] = useState(posHardware.listStatuses());
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [caps, setCaps] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState("Manual open");
  const [lastScan, setLastScan] = useState("");

  function refresh() {
    setStatuses(posHardware.listStatuses());
  }

  useEffect(() => {
    refresh();
    const unsub = posHardware.subscribeScanner((e) => {
      setLastScan(`${e.format}:${e.code} (${e.source})`);
      refresh();
    });
    void hardwareApi
      .capabilities()
      .then(setCaps)
      .catch(() => setCaps(null));
    void hardwareApi
      .listEvents()
      .then((r) => setEvents(r.items))
      .catch(() => setEvents([]));
    const t = setInterval(refresh, 5_000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  async function openDrawer() {
    const local = await posHardware.openDrawer({ reason });
    try {
      if (local.ok) await hardwareApi.openDrawer({ reason });
    } catch {
      /* audit may fail without permission — local still recorded */
    }
    toast.push({
      title: local.ok ? "Drawer opened" : "Drawer blocked",
      description: local.error ?? local.status,
      tone: local.ok ? "success" : "danger",
    });
    refresh();
    void hardwareApi
      .listEvents()
      .then((r) => setEvents(r.items))
      .catch(() => undefined);
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Devices</h1>
      <p className="text-sm opacity-70">
        Statuses: connected · disconnected · unavailable · permission denied · print failed · retry
      </p>

      <Card title="Local hardware status">
        <div className="space-y-1 text-sm">
          {statuses.map((s) => (
            <div key={s.capability} className="flex justify-between border-b py-1">
              <span>{s.capability}</span>
              <Badge
                tone={
                  s.status === "connected" || s.status === "idle"
                    ? "success"
                    : s.status === "permission_denied" || s.status === "print_failed"
                      ? "danger"
                      : "warning"
                }
              >
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => { usbScanner.setConnected(true); refresh(); }}>
            Connect USB scanner
          </Button>
          <Button type="button" onClick={() => { usbScanner.setConnected(false); refresh(); }}>
            Disconnect USB
          </Button>
          <Button
            type="button"
            onClick={() => {
              cameraScanner.setPermissionDenied(true);
              refresh();
            }}
          >
            Deny camera
          </Button>
          <Button
            type="button"
            onClick={() => {
              cameraScanner.setPermissionDenied(false);
              cameraScanner.setAvailable(true);
              refresh();
            }}
          >
            Reset camera
          </Button>
        </div>
        <p className="mt-2 text-sm opacity-70">Last scan: {lastScan || "—"}</p>
      </Card>

      <Card title="Cash drawer (permission + audit)">
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-2">
          <Button type="button" onClick={() => void openDrawer()}>
            Open drawer
          </Button>
        </div>
      </Card>

      <Card title="Server capability catalog">
        <pre className="max-h-48 overflow-auto text-xs">
          {caps ? JSON.stringify(caps, null, 2) : "Load failed or unauthorized."}
        </pre>
      </Card>

      <Card title="Hardware events">
        <div className="max-h-48 overflow-auto text-sm">
          {events.map((e) => (
            <div key={String(e.id)} className="border-b py-1">
              {String(e.capability)} · {String(e.status)} · {String(e.message ?? "")}
            </div>
          ))}
          {!events.length && <p className="opacity-70">No events.</p>}
        </div>
      </Card>
    </div>
  );
}
