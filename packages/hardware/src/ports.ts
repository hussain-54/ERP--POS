import {
  defaultMediaForDocument,
  renderPrintDocument,
  type PrintDocumentJob,
  type PrintMediaType,
} from "./documents.js";
import {
  failResult,
  okResult,
  type HardwareCapability,
  type HardwareDeviceStatus,
  type HardwareResult,
  type HardwareStatusSnapshot,
} from "./status.js";

export interface ScanEvent {
  code: string;
  format: "barcode" | "qr" | "unknown";
  source: "usb" | "qr" | "camera" | "mobile_camera" | "tablet_camera" | "unknown";
  at: string;
}

export interface PrinterJob {
  type: PrintMediaType;
  payload: string;
  copies?: number;
  documentType?: string;
}

export interface CameraRecognitionResult {
  candidates: Array<{ productIdHint?: string; label: string; confidence: number }>;
  rawFrameBytes?: number;
}

export interface StatusAware {
  getStatus(): HardwareStatusSnapshot;
}

export interface BarcodeScannerPort extends StatusAware {
  onScan(handler: (event: ScanEvent) => void): () => void;
  /** Optional: simulate or request a scan (camera). */
  requestScan?(): Promise<HardwareResult<ScanEvent>>;
}

export interface ThermalPrinterPort extends StatusAware {
  printReceipt(job: PrinterJob): Promise<HardwareResult>;
}

export interface A4PrinterPort extends StatusAware {
  printDocument(job: PrinterJob): Promise<HardwareResult>;
}

export interface LabelPrinterPort extends StatusAware {
  printLabel(job: PrinterJob): Promise<HardwareResult>;
}

export interface BarcodePrinterPort extends StatusAware {
  printBarcode(job: PrinterJob): Promise<HardwareResult>;
}

/** @deprecated prefer ThermalPrinterPort / A4PrinterPort */
export interface PrinterPort {
  print(job: PrinterJob): Promise<void>;
  getStatus?(): HardwareStatusSnapshot;
}

export interface CashDrawerPort extends StatusAware {
  open(context?: { userId?: string; reason?: string }): Promise<HardwareResult>;
}

export interface CameraPort extends StatusAware {
  captureFrame(): Promise<HardwareResult<Uint8Array>>;
  kind: "camera_scanner" | "mobile_camera" | "tablet_camera";
}

export interface CameraRecognitionPort {
  recognizeProduct(frame: Uint8Array): Promise<CameraRecognitionResult>;
}

export type DrawerAuditFn = (entry: {
  action: "cash_drawer.open";
  userId?: string;
  reason?: string;
  status: HardwareDeviceStatus;
  error?: string;
  at: string;
}) => void | Promise<void>;

export type DrawerPermissionFn = () => boolean | Promise<boolean>;

export interface HardwareServiceOptions {
  canOpenDrawer?: DrawerPermissionFn;
  auditDrawer?: DrawerAuditFn;
  maxPrintRetries?: number;
}

/**
 * UI / POS talks only to HardwareService — never to browser or OS device APIs directly.
 * Missing adapters return structured results (unavailable) instead of crashing.
 */
export class HardwareService {
  private readonly maxRetries: number;

  constructor(
    private readonly scanner?: BarcodeScannerPort,
    private readonly thermalPrinter?: ThermalPrinterPort | PrinterPort,
    private readonly a4Printer?: A4PrinterPort | PrinterPort,
    private readonly drawer?: CashDrawerPort,
    private readonly camera?: CameraPort,
    private readonly cameraRecognition?: CameraRecognitionPort,
    private readonly labelPrinter?: LabelPrinterPort,
    private readonly barcodePrinter?: BarcodePrinterPort,
    private readonly options: HardwareServiceOptions = {},
  ) {
    this.maxRetries = options.maxPrintRetries ?? 2;
  }

  listStatuses(): HardwareStatusSnapshot[] {
    const snaps: HardwareStatusSnapshot[] = [];
    if (this.scanner) snaps.push(this.scanner.getStatus());
    if (this.thermalPrinter && "getStatus" in this.thermalPrinter && this.thermalPrinter.getStatus) {
      snaps.push(this.thermalPrinter.getStatus());
    }
    if (this.a4Printer && "getStatus" in this.a4Printer && this.a4Printer.getStatus) {
      snaps.push(this.a4Printer.getStatus());
    }
    if (this.labelPrinter) snaps.push(this.labelPrinter.getStatus());
    if (this.barcodePrinter) snaps.push(this.barcodePrinter.getStatus());
    if (this.drawer) snaps.push(this.drawer.getStatus());
    if (this.camera) snaps.push(this.camera.getStatus());
    if (!snaps.length) {
      snaps.push({
        capability: "usb_barcode_scanner",
        status: "unavailable",
        message: "No hardware adapters configured",
      });
    }
    return snaps;
  }

  subscribeScanner(handler: (event: ScanEvent) => void): () => void {
    if (!this.scanner) return () => undefined;
    try {
      return this.scanner.onScan(handler);
    } catch {
      return () => undefined;
    }
  }

  async requestScan(): Promise<HardwareResult<ScanEvent>> {
    if (!this.scanner?.requestScan) {
      return failResult<ScanEvent>("unavailable", "Scanner not available", false);
    }
    try {
      return await this.scanner.requestScan();
    } catch (err) {
      return failResult<ScanEvent>(
        "unavailable",
        err instanceof Error ? err.message : "Scan failed",
        true,
      );
    }
  }

  async printThermal(job: PrinterJob): Promise<HardwareResult> {
    if (!this.thermalPrinter) {
      return failResult("unavailable", "Thermal printer adapter not configured", true);
    }
    return this.withRetry(async () => {
      if ("printReceipt" in this.thermalPrinter!) {
        return this.thermalPrinter!.printReceipt(job);
      }
      await (this.thermalPrinter as PrinterPort).print(job);
      return okResult();
    });
  }

  async printA4(job: PrinterJob): Promise<HardwareResult> {
    if (!this.a4Printer) {
      return failResult("unavailable", "A4 printer adapter not configured", true);
    }
    return this.withRetry(async () => {
      if ("printDocument" in this.a4Printer!) {
        return this.a4Printer!.printDocument({ ...job, type: "a4" });
      }
      await (this.a4Printer as PrinterPort).print({ ...job, type: "a4" });
      return okResult();
    });
  }

  async printLabel(job: PrinterJob): Promise<HardwareResult> {
    if (this.labelPrinter) {
      return this.withRetry(() => this.labelPrinter!.printLabel({ ...job, type: "label" }));
    }
    // Fallback to thermal path for environments without dedicated label printer
    return this.printThermal({ ...job, type: "label" });
  }

  async printBarcode(job: PrinterJob): Promise<HardwareResult> {
    if (this.barcodePrinter) {
      return this.withRetry(() => this.barcodePrinter!.printBarcode({ ...job, type: "barcode" }));
    }
    return this.printLabel({ ...job, type: "barcode" });
  }

  /** Generic print — routes by media type. Never throws for missing hardware. */
  async print(job: PrinterJob): Promise<HardwareResult> {
    try {
      if (job.type === "a4") return this.printA4(job);
      if (job.type === "label") return this.printLabel(job);
      if (job.type === "barcode") return this.printBarcode(job);
      return this.printThermal(job);
    } catch (err) {
      return failResult(
        "print_failed",
        err instanceof Error ? err.message : "Print failed",
        true,
      );
    }
  }

  async printDocument(doc: PrintDocumentJob): Promise<HardwareResult> {
    const media = doc.media ?? defaultMediaForDocument(doc.documentType);
    const payload = renderPrintDocument({ ...doc, media });
    return this.print({
      type: media,
      payload,
      copies: doc.copies ?? 1,
      documentType: doc.documentType,
    });
  }

  async openDrawer(context?: { userId?: string; reason?: string }): Promise<HardwareResult> {
    const at = new Date().toISOString();
    if (!this.drawer) {
      const result = failResult("unavailable", "Cash drawer adapter not configured", false);
      await this.options.auditDrawer?.({
        action: "cash_drawer.open",
        userId: context?.userId,
        reason: context?.reason,
        status: result.status,
        error: result.error,
        at,
      });
      return result;
    }

    try {
      const allowed = this.options.canOpenDrawer
        ? await this.options.canOpenDrawer()
        : true;
      if (!allowed) {
        const result = failResult("permission_denied", "Missing cash drawer permission", false);
        await this.options.auditDrawer?.({
          action: "cash_drawer.open",
          userId: context?.userId,
          reason: context?.reason,
          status: "permission_denied",
          error: result.error,
          at,
        });
        return result;
      }

      const result = await this.drawer.open(context);
      await this.options.auditDrawer?.({
        action: "cash_drawer.open",
        userId: context?.userId,
        reason: context?.reason,
        status: result.status,
        error: result.error,
        at,
      });
      return result;
    } catch (err) {
      const result = failResult(
        "unavailable",
        err instanceof Error ? err.message : "Drawer open failed",
        true,
      );
      await this.options.auditDrawer?.({
        action: "cash_drawer.open",
        userId: context?.userId,
        reason: context?.reason,
        status: result.status,
        error: result.error,
        at,
      });
      return result;
    }
  }

  async capture(): Promise<HardwareResult<Uint8Array>> {
    if (!this.camera) {
      return failResult<Uint8Array>("unavailable", "Camera adapter not configured", false);
    }
    try {
      return await this.camera.captureFrame();
    } catch (err) {
      return failResult<Uint8Array>(
        "unavailable",
        err instanceof Error ? err.message : "Capture failed",
        true,
      );
    }
  }

  async recognizeFromCamera(): Promise<HardwareResult<CameraRecognitionResult>> {
    if (!this.camera || !this.cameraRecognition) {
      return failResult<CameraRecognitionResult>(
        "unavailable",
        "Camera recognition adapter not configured",
        false,
      );
    }
    try {
      const frameResult = await this.camera.captureFrame();
      if (!frameResult.ok || !frameResult.data) {
        return failResult<CameraRecognitionResult>(
          frameResult.status,
          frameResult.error ?? "No frame",
          frameResult.retryable,
        );
      }
      const data = await this.cameraRecognition.recognizeProduct(frameResult.data);
      return okResult(data);
    } catch (err) {
      return failResult<CameraRecognitionResult>(
        "unavailable",
        err instanceof Error ? err.message : "Recognition failed",
        true,
      );
    }
  }

  private async withRetry(fn: () => Promise<HardwareResult>): Promise<HardwareResult> {
    let last: HardwareResult = failResult("print_failed", "Print failed", true);
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        last = await fn();
        if (last.ok || !last.retryable) return last;
      } catch (err) {
        last = failResult(
          "print_failed",
          err instanceof Error ? err.message : "Print failed",
          true,
        );
      }
    }
    // Preserve device status (unavailable / disconnected / permission_denied);
    // only normalize unknown retries to print_failed.
    if (
      last.status === "unavailable" ||
      last.status === "disconnected" ||
      last.status === "permission_denied"
    ) {
      return { ...last, retryable: true };
    }
    return { ...last, status: "print_failed", retryable: true };
  }
}

export type { HardwareCapability, HardwareDeviceStatus, HardwareResult, HardwareStatusSnapshot };
export type { PrintDocumentJob, PrintMediaType };
