export type DeviceWorkspaceMode =
  | "terminals"
  | "barcode"
  | "qr"
  | "receipt-printer"
  | "a4-printer"
  | "drawer"
  | "customer-display"
  | "payment-terminal"
  | "status";

export const DEVICE_META: Record<DeviceWorkspaceMode, { title: string; description: string }> = {
  terminals: { title: "POS terminals", description: "Registered security devices for this organization." },
  barcode: { title: "Barcode scanner", description: "USB keyboard-wedge barcode scanner status." },
  qr: { title: "QR scanner", description: "QR / camera scanner availability." },
  "receipt-printer": { title: "Receipt printer", description: "80mm thermal receipt printer status." },
  "a4-printer": { title: "A4 printer", description: "A4 document printer status." },
  drawer: { title: "Cash drawer", description: "Cash drawer connection and audit trail." },
  "customer-display": { title: "Customer display", description: "Customer-facing pole display." },
  "payment-terminal": { title: "Payment terminal", description: "Integrated card / PSP terminal." },
  status: { title: "Device status", description: "All local hardware and server events." },
};

/** Map POS device screens to local hardware capability ids. */
export const CAPABILITY_FILTER: Partial<Record<DeviceWorkspaceMode, string[]>> = {
  barcode: ["usb_barcode_scanner", "printer_barcode"],
  qr: ["qr_scanner", "camera_scanner"],
  "receipt-printer": ["printer_80mm"],
  "a4-printer": ["printer_a4"],
  drawer: ["cash_drawer"],
};

export function statusTone(status: string): string {
  if (status === "connected" || status === "idle") return "bg-emerald-50 text-emerald-700";
  if (status === "permission_denied" || status === "print_failed") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-800";
}

export function flattenCapabilities(raw: Record<string, unknown> | null): Array<{ name: string; value: string }> {
  if (!raw) return [];
  const rows: Array<{ name: string; value: string }> = [];
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
        rows.push({ name: `${k}.${sk}`, value: String(sv ?? "—") });
      }
    } else {
      rows.push({ name: k, value: String(v ?? "—") });
    }
  }
  return rows;
}
