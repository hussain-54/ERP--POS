import type { BarcodeScannerPort, CameraPort, ScanEvent } from "../ports.js";
import {
  failResult,
  okResult,
  type HardwareResult,
  type HardwareStatusSnapshot,
} from "../status.js";

export type CameraFormFactor = "camera_scanner" | "mobile_camera" | "tablet_camera";

/**
 * Camera / mobile / tablet scanner adapter.
 * Uses injected capture+decode so web/Electron/mobile can plug MediaDevices or native.
 */
export class CameraScannerAdapter implements BarcodeScannerPort, CameraPort {
  kind: CameraFormFactor;
  private permissionDenied = false;
  private available = true;
  private handler: ((event: ScanEvent) => void) | null = null;

  constructor(
    formFactor: CameraFormFactor,
    private readonly io: {
      capture: () => Promise<Uint8Array>;
      decode?: (frame: Uint8Array) => Promise<{ code: string; format: ScanEvent["format"] } | null>;
    },
  ) {
    this.kind = formFactor;
  }

  setAvailable(v: boolean) {
    this.available = v;
  }

  setPermissionDenied(v: boolean) {
    this.permissionDenied = v;
  }

  getStatus(): HardwareStatusSnapshot {
    const capability =
      this.kind === "mobile_camera"
        ? "mobile_camera"
        : this.kind === "tablet_camera"
          ? "tablet_camera"
          : "camera_scanner";
    if (this.permissionDenied) {
      return { capability, status: "permission_denied", message: "Camera permission denied" };
    }
    if (!this.available) {
      return { capability, status: "unavailable", message: "Camera unavailable" };
    }
    return { capability, status: this.handler ? "connected" : "idle" };
  }

  onScan(handler: (event: ScanEvent) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  async captureFrame(): Promise<HardwareResult<Uint8Array>> {
    if (this.permissionDenied) {
      return failResult<Uint8Array>("permission_denied", "Camera permission denied", false);
    }
    if (!this.available) {
      return failResult<Uint8Array>("unavailable", "Camera unavailable", true);
    }
    try {
      const frame = await this.io.capture();
      return okResult(frame);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Capture failed";
      if (/permission/i.test(msg)) {
        this.permissionDenied = true;
        return failResult<Uint8Array>("permission_denied", msg, false);
      }
      return failResult<Uint8Array>("unavailable", msg, true);
    }
  }

  async requestScan(): Promise<HardwareResult<ScanEvent>> {
    const frame = await this.captureFrame();
    if (!frame.ok || !frame.data) {
      return failResult<ScanEvent>(frame.status, frame.error ?? "No frame", frame.retryable);
    }
    try {
      const decoded = this.io.decode
        ? await this.io.decode(frame.data)
        : null;
      if (!decoded) {
        return failResult<ScanEvent>("unavailable", "No code detected in frame", true);
      }
      const event: ScanEvent = {
        code: decoded.code,
        format: decoded.format,
        source: this.kind === "mobile_camera" ? "mobile_camera" : this.kind === "tablet_camera" ? "tablet_camera" : "camera",
        at: new Date().toISOString(),
      };
      this.handler?.(event);
      return okResult(event);
    } catch (err) {
      return failResult<ScanEvent>(
        "unavailable",
        err instanceof Error ? err.message : "Decode failed",
        true,
      );
    }
  }
}
