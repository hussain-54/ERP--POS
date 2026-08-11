import {
  buildBarcodeLabel,
  renderPrintDocument,
} from "./documents.js";
import type { HardwareService } from "./ports.js";
import { failResult, type HardwareResult } from "./status.js";

export interface BarcodeLabelRequest {
  productName: string;
  barcode: string;
  price?: number;
  copies?: number;
}

/**
 * Barcode hardware workflows: scan, label print, reprint.
 * Generation stays in catalog/domain; this layer only talks to devices.
 */
export class BarcodeHardwareService {
  private lastLabel: BarcodeLabelRequest | null = null;

  constructor(private readonly hardware: HardwareService) {}

  async scan(): Promise<HardwareResult<{ code: string; format: string }>> {
    const result = await this.hardware.requestScan();
    if (!result.ok || !result.data) {
      return failResult<{ code: string; format: string }>(
        result.status,
        result.error ?? "Scan failed",
        result.retryable,
      );
    }
    return {
      ok: true,
      status: "connected",
      retryable: false,
      data: { code: result.data.code, format: result.data.format },
    };
  }

  async printLabel(req: BarcodeLabelRequest): Promise<HardwareResult> {
    this.lastLabel = req;
    const doc = buildBarcodeLabel(req);
    doc.copies = req.copies ?? 1;
    return this.hardware.printDocument(doc);
  }

  async printLabelsBulk(reqs: BarcodeLabelRequest[]): Promise<{
    ok: number;
    failed: number;
    results: HardwareResult[];
  }> {
    const results: HardwareResult[] = [];
    let ok = 0;
    let failed = 0;
    for (const req of reqs) {
      const r = await this.printLabel(req);
      results.push(r);
      if (r.ok) ok += 1;
      else failed += 1;
    }
    return { ok, failed, results };
  }

  async reprintLast(): Promise<HardwareResult> {
    if (!this.lastLabel) {
      return failResult("unavailable", "No previous label to reprint", false);
    }
    return this.printLabel(this.lastLabel);
  }

  previewLabel(req: BarcodeLabelRequest): string {
    return renderPrintDocument(buildBarcodeLabel(req));
  }
}
