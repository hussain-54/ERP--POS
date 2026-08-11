import type { BarcodeScannerPort, ScanEvent } from "../ports.js";
import {
  failResult,
  okResult,
  type HardwareResult,
  type HardwareStatusSnapshot,
} from "../status.js";

/**
 * USB / HID keyboard-wedge barcode & QR scanners.
 * Accumulates rapid keystrokes ending with Enter — never throws into the app.
 */
export class UsbKeyboardWedgeScanner implements BarcodeScannerPort {
  private buffer = "";
  private lastKeyAt = 0;
  private handler: ((event: ScanEvent) => void) | null = null;
  private detach: (() => void) | null = null;
  private connected = true;

  constructor(
    private readonly host: {
      addKeyListener: (fn: (key: string) => void) => () => void;
    },
    private readonly gapMs = 50,
  ) {}

  setConnected(v: boolean) {
    this.connected = v;
  }

  getStatus(): HardwareStatusSnapshot {
    return {
      capability: "usb_barcode_scanner",
      status: this.connected ? (this.handler ? "connected" : "idle") : "disconnected",
      message: this.connected ? "USB wedge scanner" : "Scanner disconnected",
    };
  }

  onScan(handler: (event: ScanEvent) => void): () => void {
    this.handler = handler;
    if (!this.connected) return () => undefined;
    try {
      this.detach = this.host.addKeyListener((key) => this.onKey(key));
    } catch {
      this.connected = false;
      return () => undefined;
    }
    return () => {
      this.handler = null;
      this.detach?.();
      this.detach = null;
    };
  }

  async requestScan(): Promise<HardwareResult<ScanEvent>> {
    if (!this.connected) return failResult<ScanEvent>("disconnected", "USB scanner disconnected", true);
    return failResult<ScanEvent>("unavailable", "USB wedge is push-based; wait for scan", false);
  }

  /** Test helper — inject a completed scan. */
  emit(code: string, format: ScanEvent["format"] = "barcode") {
    this.handler?.({
      code,
      format,
      source: format === "qr" ? "qr" : "usb",
      at: new Date().toISOString(),
    });
  }

  private onKey(key: string) {
    if (!this.connected || !this.handler) return;
    const now = Date.now();
    // Inter-key gap: wedge scanners fire faster than typing; reset buffer on slow keys.
    if (now - this.lastKeyAt > Math.max(this.gapMs * 2.4, 80)) this.buffer = "";
    this.lastKeyAt = now;
    if (key === "Enter") {
      const code = this.buffer.trim();
      this.buffer = "";
      if (!code) return;
      const format = code.includes("http") || code.length > 32 ? "qr" : "barcode";
      try {
        this.handler({
          code,
          format,
          source: format === "qr" ? "qr" : "usb",
          at: new Date().toISOString(),
        });
      } catch {
        // never crash host app
      }
      return;
    }
    if (key.length === 1) this.buffer += key;
  }
}

/** QR-focused scanner facade over the same wedge / camera pipeline. */
export class QrScannerAdapter implements BarcodeScannerPort {
  constructor(private readonly inner: BarcodeScannerPort) {}

  getStatus(): HardwareStatusSnapshot {
    const s = this.inner.getStatus();
    return { ...s, capability: "qr_scanner", message: s.message ?? "QR scanner" };
  }

  onScan(handler: (event: ScanEvent) => void): () => void {
    return this.inner.onScan((e) => {
      if (e.format === "qr" || e.format === "unknown") handler({ ...e, source: "qr", format: "qr" });
    });
  }

  async requestScan(): Promise<HardwareResult<ScanEvent>> {
    const r = await this.inner.requestScan?.();
    if (!r) return failResult<ScanEvent>("unavailable", "QR scan unavailable", false);
    if (r.ok && r.data) return okResult({ ...r.data, format: "qr" as const, source: "qr" as const });
    return failResult<ScanEvent>(r.status, r.error ?? "QR scan failed", r.retryable);
  }
}
