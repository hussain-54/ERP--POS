import { describe, expect, it } from "vitest";
import {
  MemoryA4Printer,
  MemoryBarcodePrinter,
  MemoryCashDrawer,
  MemoryLabelPrinter,
  MemoryThermalPrinter,
  NullBarcodeScanner,
  NullCashDrawer,
  NullThermalPrinter,
} from "./adapters/null-adapters.js";
import { CameraScannerAdapter } from "./adapters/camera-scanner.js";
import { UsbKeyboardWedgeScanner } from "./adapters/usb-scanner.js";
import { BarcodeHardwareService } from "./barcode-hardware.js";
import {
  buildSalesInvoice,
  buildStockReport,
  renderPrintDocument,
} from "./documents.js";
import { HardwareService } from "./ports.js";

describe("hardware resilience", () => {
  it("does not crash when scanners/printers/drawer unavailable", async () => {
    const hw = new HardwareService(
      new NullBarcodeScanner(),
      new NullThermalPrinter(),
      undefined,
      new NullCashDrawer(),
    );
    const unsub = hw.subscribeScanner(() => undefined);
    unsub();
    const print = await hw.printThermal({ type: "receipt_80", payload: "x" });
    expect(print.ok).toBe(false);
    expect(print.status).toBe("unavailable");
    const drawer = await hw.openDrawer({ userId: "u1" });
    expect(drawer.ok).toBe(false);
    expect(drawer.status).toBe("unavailable");
    const statuses = hw.listStatuses();
    expect(statuses.some((s) => s.status === "unavailable")).toBe(true);
  });

  it("reports permission denied for cash drawer and audits", async () => {
    const audits: unknown[] = [];
    const drawer = new MemoryCashDrawer();
    const hw = new HardwareService(
      undefined,
      undefined,
      undefined,
      drawer,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        canOpenDrawer: () => false,
        auditDrawer: (e) => {
          audits.push(e);
        },
      },
    );
    const result = await hw.openDrawer({ userId: "user-1", reason: "sale" });
    expect(result.status).toBe("permission_denied");
    expect(drawer.openCount).toBe(0);
    expect(audits).toHaveLength(1);
  });

  it("opens drawer when permitted and audits success", async () => {
    const audits: Array<{ status: string }> = [];
    const drawer = new MemoryCashDrawer();
    const hw = new HardwareService(
      undefined,
      undefined,
      undefined,
      drawer,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        canOpenDrawer: async () => true,
        auditDrawer: async (e) => {
          audits.push(e);
        },
      },
    );
    const result = await hw.openDrawer({ reason: "cash sale" });
    expect(result.ok).toBe(true);
    expect(drawer.openCount).toBe(1);
    expect(audits[0]?.status).toBe("connected");
  });

  it("retries print on failure then succeeds", async () => {
    const printer = new MemoryThermalPrinter();
    printer.setFailNext(true);
    const hw = new HardwareService(undefined, printer, undefined, undefined, undefined, undefined, undefined, undefined, {
      maxPrintRetries: 2,
    });
    // first attempt fails, retry succeeds (failNext cleared)
    const result = await hw.printThermal({ type: "receipt_80", payload: "INV" });
    expect(result.ok).toBe(true);
    expect(printer.jobs).toHaveLength(1);
  });

  it("supports USB wedge and camera permission denied", async () => {
    const keys: Array<(k: string) => void> = [];
    const usb = new UsbKeyboardWedgeScanner({
      addKeyListener: (fn) => {
        keys.push(fn);
        return () => undefined;
      },
    });
    const events: string[] = [];
    usb.onScan((e) => events.push(e.code));
    for (const ch of "12345") keys[0]?.(ch);
    keys[0]?.("Enter");
    expect(events).toEqual(["12345"]);

    const cam = new CameraScannerAdapter("mobile_camera", {
      capture: async () => {
        throw new Error("Permission denied by user");
      },
    });
    const scan = await cam.requestScan();
    expect(scan.status).toBe("permission_denied");
    expect(cam.getStatus().status).toBe("permission_denied");
  });

  it("prints document templates and barcode labels / reprint", async () => {
    const thermal = new MemoryThermalPrinter();
    const a4 = new MemoryA4Printer();
    const labels = new MemoryLabelPrinter();
    const barcodes = new MemoryBarcodePrinter();
    const hw = new HardwareService(
      undefined,
      thermal,
      a4,
      undefined,
      undefined,
      undefined,
      labels,
      barcodes,
    );
    const invoice = buildSalesInvoice({
      invoiceNumber: "INV-1",
      date: "2026-08-11",
      lines: [{ name: "Wire", qty: 2, amount: 200 }],
      grandTotal: 200,
    });
    expect(renderPrintDocument(invoice)).toContain("SALES INVOICE");
    const printed = await hw.printDocument(invoice);
    expect(printed.ok).toBe(true);

    const stock = await hw.printDocument(
      buildStockReport({ rows: [{ sku: "A", name: "Item", qty: 3 }] }),
    );
    expect(stock.ok).toBe(true);
    expect(a4.jobs.length).toBeGreaterThan(0);

    const barcodeHw = new BarcodeHardwareService(hw);
    const label = await barcodeHw.printLabel({
      productName: "Cable",
      barcode: "1234567890123",
      price: 99,
    });
    expect(label.ok).toBe(true);
    const reprint = await barcodeHw.reprintLast();
    expect(reprint.ok).toBe(true);
    expect(labels.jobs.length).toBeGreaterThanOrEqual(2);

    const bulk = await barcodeHw.printLabelsBulk([
      { productName: "A", barcode: "111" },
      { productName: "B", barcode: "222" },
    ]);
    expect(bulk.ok).toBe(2);
  });

  it("disconnected printer returns disconnected without throwing", async () => {
    const printer = new MemoryThermalPrinter();
    printer.setConnected(false);
    const hw = new HardwareService(undefined, printer);
    await expect(hw.print({ type: "receipt_58", payload: "x" })).resolves.toMatchObject({
      ok: false,
      status: "disconnected",
    });
  });
});
