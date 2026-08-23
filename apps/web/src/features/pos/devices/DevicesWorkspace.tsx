import { useEffect, useMemo, useState } from "react";
import { deviceHardware } from "@/features/devices/hardware-service";
import { hardwareApi } from "@/features/printing/hardware-api";
import { infrastructureApi } from "@/features/system/infrastructure-api";
import { PosComingSoonPanel, PosSubPageShell } from "../PosSubPageShell";
import {
  CAPABILITY_FILTER,
  DEVICE_META,
  flattenCapabilities,
  statusTone,
  type DeviceWorkspaceMode,
} from "./device-utils";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(status)}`}>
      {status}
    </span>
  );
}

export function DevicesWorkspace({ mode }: { mode: DeviceWorkspaceMode }) {
  const meta = DEVICE_META[mode];
  const [statuses, setStatuses] = useState(deviceHardware.listStatuses());
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [caps, setCaps] = useState<Record<string, unknown> | null>(null);
  const [terminals, setTerminals] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setStatuses(deviceHardware.listStatuses());
    const unsub = deviceHardware.subscribeScanner(() => setStatuses(deviceHardware.listStatuses()));
    const t = setInterval(() => {
      if (!document.hidden) setStatuses(deviceHardware.listStatuses());
    }, 15_000);
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const tasks: Promise<void>[] = [];
    if (mode === "terminals" || mode === "status") {
      tasks.push(
        infrastructureApi
          .devices()
          .then((r) => setTerminals(r.items))
          .catch(() => setTerminals([])),
      );
    }
    if (mode === "status" || mode === "drawer") {
      tasks.push(
        hardwareApi
          .listEvents()
          .then((r) => setEvents(r.items))
          .catch(() => setEvents([])),
      );
    }
    if (mode === "status") {
      tasks.push(
        hardwareApi
          .capabilities()
          .then(setCaps)
          .catch(() => setCaps(null)),
      );
    }
    void Promise.all(tasks).finally(() => setLoading(false));
  }, [mode]);

  const filteredStatuses = useMemo(() => {
    const keys = CAPABILITY_FILTER[mode];
    if (!keys) return statuses;
    return statuses.filter((s) => keys.includes(s.capability));
  }, [mode, statuses]);

  if (mode === "payment-terminal") {
    return (
      <PosSubPageShell moduleNumber="14" moduleLabel="Devices & Terminal" title={meta.title} description={meta.description}>
        <PosComingSoonPanel
          title="Payment terminal"
          reason="Integrated PSP / card terminal hardware is not connected. Card payments are record-only on the Payments screen."
        />
      </PosSubPageShell>
    );
  }

  if (mode === "customer-display") {
    return (
      <PosSubPageShell moduleNumber="14" moduleLabel="Devices & Terminal" title={meta.title} description={meta.description}>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            No customer pole display driver is registered in this browser host. Status:{" "}
            <StatusBadge status="unavailable" />
          </p>
        </div>
      </PosSubPageShell>
    );
  }

  return (
    <PosSubPageShell moduleNumber="14" moduleLabel="Devices & Terminal" title={meta.title} description={meta.description}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Status reflects this workstation and server audit — devices are not simulated as connected.
        </p>

        {(mode === "terminals" || mode === "status") && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {terminals.map((d) => (
                  <tr key={String(d.id)} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{String(d.label ?? d.device_name ?? d.id ?? "—")}</td>
                    <td className="px-3 py-2 text-slate-600">{String(d.platform ?? "—")}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={String(d.status ?? "unknown")} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">{String(d.last_seen_at ?? d.lastSeenAt ?? "—")}</td>
                  </tr>
                ))}
                {!terminals.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                      {loading ? "Loading…" : "No registered terminals."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {(mode === "status" || mode !== "terminals") && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-800">Local hardware</h2>
            <div className="space-y-1">
              {(mode === "status" ? statuses : filteredStatuses).map((s) => (
                <div key={s.capability} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                  <span className="font-medium text-slate-700">{s.capability}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
              {!filteredStatuses.length && mode !== "status" ? (
                <p className="py-4 text-sm text-slate-400">No matching capabilities reported.</p>
              ) : null}
            </div>
          </div>
        )}

        {(mode === "status" || mode === "drawer") && events.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-bold text-slate-800">Hardware events</h2>
            <div className="max-h-48 space-y-1 overflow-auto text-sm">
              {events.map((e) => (
                <div key={String(e.id)} className="border-b border-slate-100 py-1 text-slate-700">
                  {String(e.capability ?? "—")} · {String(e.status ?? "—")} · {String(e.message ?? "")}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {mode === "status" && caps ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Capability</th>
                  <th className="px-3 py-2">Server value</th>
                </tr>
              </thead>
              <tbody>
                {flattenCapabilities(caps).map((row) => (
                  <tr key={row.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-slate-600">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </PosSubPageShell>
  );
}
