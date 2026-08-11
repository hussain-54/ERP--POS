/** Hardware connection / operation status — never crash the app when devices are missing. */
export type HardwareDeviceStatus =
  | "connected"
  | "disconnected"
  | "unavailable"
  | "permission_denied"
  | "print_failed"
  | "idle"
  | "busy";

export type HardwareCapability =
  | "usb_barcode_scanner"
  | "qr_scanner"
  | "camera_scanner"
  | "mobile_camera"
  | "tablet_camera"
  | "printer_a4"
  | "printer_80mm"
  | "printer_58mm"
  | "printer_barcode"
  | "printer_label"
  | "cash_drawer";

export interface HardwareStatusSnapshot {
  capability: HardwareCapability;
  status: HardwareDeviceStatus;
  message?: string;
  lastError?: string | null;
  lastSuccessAt?: string | null;
  retryCount?: number;
}

export interface HardwareResult<T = void> {
  ok: boolean;
  status: HardwareDeviceStatus;
  data?: T;
  error?: string;
  retryable: boolean;
}

export function okResult<T = void>(data?: T): HardwareResult<T> {
  return { ok: true, status: "connected", data, retryable: false };
}

export function failResult<T = void>(
  status: HardwareDeviceStatus,
  error: string,
  retryable = true,
): HardwareResult<T> {
  return { ok: false, status, error, retryable };
}
