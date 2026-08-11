import type {
  A4PrinterPort,
  BarcodePrinterPort,
  BarcodeScannerPort,
  CameraPort,
  CameraRecognitionPort,
  CashDrawerPort,
  LabelPrinterPort,
  PrinterJob,
  ScanEvent,
  ThermalPrinterPort,
} from "../ports.js";
import {
  failResult,
  okResult,
  type HardwareResult,
  type HardwareStatusSnapshot,
} from "../status.js";

export class NullBarcodeScanner implements BarcodeScannerPort {
  getStatus(): HardwareStatusSnapshot {
    return {
      capability: "usb_barcode_scanner",
      status: "unavailable",
      message: "No scanner attached",
    };
  }

  onScan(_handler: (event: ScanEvent) => void): () => void {
    return () => undefined;
  }

  async requestScan(): Promise<HardwareResult<ScanEvent>> {
    return failResult<ScanEvent>("unavailable", "Scanner unavailable", false);
  }
}

export class NullThermalPrinter implements ThermalPrinterPort {
  getStatus(): HardwareStatusSnapshot {
    return { capability: "printer_80mm", status: "unavailable", message: "No thermal printer" };
  }

  async printReceipt(_job: PrinterJob) {
    return failResult("unavailable", "Thermal printer unavailable", true);
  }
}

export class NullA4Printer implements A4PrinterPort {
  getStatus(): HardwareStatusSnapshot {
    return { capability: "printer_a4", status: "unavailable", message: "No A4 printer" };
  }

  async printDocument(_job: PrinterJob) {
    return failResult("unavailable", "A4 printer unavailable", true);
  }
}

export class NullLabelPrinter implements LabelPrinterPort {
  getStatus(): HardwareStatusSnapshot {
    return { capability: "printer_label", status: "unavailable" };
  }

  async printLabel(_job: PrinterJob) {
    return failResult("unavailable", "Label printer unavailable", true);
  }
}

export class NullBarcodePrinter implements BarcodePrinterPort {
  getStatus(): HardwareStatusSnapshot {
    return { capability: "printer_barcode", status: "unavailable" };
  }

  async printBarcode(_job: PrinterJob) {
    return failResult("unavailable", "Barcode printer unavailable", true);
  }
}

export class NullCashDrawer implements CashDrawerPort {
  getStatus(): HardwareStatusSnapshot {
    return { capability: "cash_drawer", status: "unavailable", message: "No cash drawer" };
  }

  async open() {
    return failResult("unavailable", "Cash drawer unavailable", false);
  }
}

export class NullCamera implements CameraPort {
  kind: CameraPort["kind"] = "camera_scanner";

  getStatus(): HardwareStatusSnapshot {
    return { capability: "camera_scanner", status: "unavailable" };
  }

  async captureFrame(): Promise<HardwareResult<Uint8Array>> {
    return failResult<Uint8Array>("unavailable", "Camera unavailable", false);
  }
}

export class NullCameraRecognition implements CameraRecognitionPort {
  async recognizeProduct(frame: Uint8Array) {
    return { candidates: [], rawFrameBytes: frame.byteLength };
  }
}

/** Memory printers succeed without hardware — useful for Electron/dev when driver missing. */
export class MemoryThermalPrinter implements ThermalPrinterPort {
  readonly jobs: PrinterJob[] = [];
  private failNext = false;
  private status: HardwareStatusSnapshot = {
    capability: "printer_80mm",
    status: "connected",
  };

  setFailNext(v: boolean) {
    this.failNext = v;
  }

  setConnected(connected: boolean) {
    this.status = {
      capability: "printer_80mm",
      status: connected ? "connected" : "disconnected",
    };
  }

  getStatus() {
    return this.status;
  }

  async printReceipt(job: PrinterJob) {
    if (this.status.status === "disconnected" || this.status.status === "unavailable") {
      return failResult(this.status.status, "Printer not connected", true);
    }
    if (this.failNext) {
      this.failNext = false;
      this.status = { ...this.status, lastError: "Print failed" };
      return failResult("print_failed", "Print failed", true);
    }
    this.jobs.push(job);
    this.status = {
      ...this.status,
      status: "connected",
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    };
    return okResult();
  }
}

export class MemoryA4Printer implements A4PrinterPort {
  readonly jobs: PrinterJob[] = [];

  getStatus(): HardwareStatusSnapshot {
    return { capability: "printer_a4", status: "connected" };
  }

  async printDocument(job: PrinterJob) {
    this.jobs.push(job);
    return okResult();
  }
}

export class MemoryLabelPrinter implements LabelPrinterPort {
  readonly jobs: PrinterJob[] = [];

  getStatus(): HardwareStatusSnapshot {
    return { capability: "printer_label", status: "connected" };
  }

  async printLabel(job: PrinterJob) {
    this.jobs.push(job);
    return okResult();
  }
}

export class MemoryBarcodePrinter implements BarcodePrinterPort {
  readonly jobs: PrinterJob[] = [];

  getStatus(): HardwareStatusSnapshot {
    return { capability: "printer_barcode", status: "connected" };
  }

  async printBarcode(job: PrinterJob) {
    this.jobs.push(job);
    return okResult();
  }
}

export class MemoryCashDrawer implements CashDrawerPort {
  openCount = 0;
  private connected = true;

  setConnected(v: boolean) {
    this.connected = v;
  }

  getStatus(): HardwareStatusSnapshot {
    return {
      capability: "cash_drawer",
      status: this.connected ? "connected" : "disconnected",
    };
  }

  async open() {
    if (!this.connected) return failResult("disconnected", "Drawer disconnected", true);
    this.openCount += 1;
    return okResult();
  }
}
