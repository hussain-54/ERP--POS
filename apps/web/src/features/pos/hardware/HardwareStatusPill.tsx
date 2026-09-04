import { useEffect, useMemo, useRef, useState } from "react";
import type { HardwareStatusSnapshot } from "@electronic-erp/hardware";
import { deviceHardware } from "@/features/devices/hardware-service";
import { triggerCashDrawerKick } from "./hardware-broadcast";

function statusLabel(status: HardwareStatusSnapshot["status"]): string {
  if (status === "connected" || status === "idle" || status === "busy") return "Connected";
  if (status === "permission_denied") return "Permission Required";
  if (status === "disconnected") return "Not Connected";
  return "Not Connected";
}

function statusTone(status: HardwareStatusSnapshot["status"]): string {
  if (status === "connected" || status === "idle" || status === "busy") return "text-emerald-700";
  if (status === "permission_denied") return "text-amber-700";
  return "text-slate-500";
}

function capabilityLabel(capability: string): string {
  const map: Record<string, string> = {
    usb_barcode_scanner: "Barcode Scanner",
    camera_scanner: "Camera",
    printer_80mm: "Receipt Printer",
    printer_a4: "A4 Printer",
    cash_drawer: "Cash Drawer",
  };
  return map[capability] ?? capability;
}

export function HardwareStatusPill({
  onOpenScanner,
}: {
  onOpenScanner?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [drawerKickStatus, setDrawerKickStatus] = useState<"idle" | "kicked" | "blocked">("idle");
  const [statuses, setStatuses] = useState<HardwareStatusSnapshot[]>(() => deviceHardware.listStatuses());
  const popoverRef = useRef<HTMLDivElement>(null);

  function refresh() {
    setStatuses(deviceHardware.listStatuses());
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 8000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const visible = useMemo(
    () =>
      statuses.filter((s) =>
        ["usb_barcode_scanner", "camera_scanner", "printer_80mm", "cash_drawer"].includes(s.capability),
      ),
    [statuses],
  );

  const connectedCount = visible.filter((s) =>
    ["connected", "idle", "busy"].includes(s.status),
  ).length;
  const allConnected = connectedCount === visible.length && visible.length > 0;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          refresh();
          setOpen((v) => !v);
        }}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
          allConnected
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        }`}
        title="Hardware status"
      >
        <span
          className={`h-2 w-2 rounded-full ${allConnected ? "bg-emerald-500" : "bg-slate-400"}`}
        />
        <span>
          Hardware ({connectedCount}/{visible.length || statuses.length} connected)
        </span>
        <i className="fa-solid fa-chevron-down text-[9px]" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-black text-slate-900">Peripherals</h3>
            <span className="text-[9px] font-bold uppercase text-slate-500">Live status</span>
          </div>
          <div className="my-2.5 space-y-2 max-h-80 overflow-y-auto pr-1">
            {visible.map((d) => (
              <div key={d.capability} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800">{capabilityLabel(d.capability)}</span>
                  <span className={`text-[10px] font-bold ${statusTone(d.status)}`}>{statusLabel(d.status)}</span>
                </div>
                {d.message ? <p className="mt-0.5 text-[10px] text-slate-500">{d.message}</p> : null}
                {d.capability === "camera_scanner" && onOpenScanner ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onOpenScanner();
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Open Camera Scanner
                  </button>
                ) : null}
                {d.capability === "cash_drawer" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await triggerCashDrawerKick("Cashier hardware check");
                      setDrawerKickStatus(result ? "kicked" : "blocked");
                      refresh();
                      window.setTimeout(() => setDrawerKickStatus("idle"), 2500);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    {drawerKickStatus === "kicked"
                      ? "Drawer pulse sent"
                      : drawerKickStatus === "blocked"
                        ? "Drawer not available"
                        : "Test cash drawer"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <p className="border-t border-slate-100 pt-2 text-center text-[10px] text-slate-400">
            Memory printers stay Not Connected until a physical device is configured.
          </p>
        </div>
      ) : null}
    </div>
  );
}
