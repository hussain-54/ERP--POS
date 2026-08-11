import {
  HardwareService,
  MemoryA4Printer,
  MemoryBarcodePrinter,
  MemoryCashDrawer,
  MemoryLabelPrinter,
  MemoryThermalPrinter,
  NullBarcodeScanner,
  NullCamera,
  NullCameraRecognition,
} from "@electronic-erp/hardware";

/**
 * Desktop hardware wiring — fail-soft. Unavailable devices return structured
 * failures and never crash the main process.
 *
 * USB wedge scanner can be swapped in later with a real key-listener host from
 * the focused BrowserWindow; default is Null so boot never depends on DOM.
 */
export function createDesktopHardware(): HardwareService {
  return new HardwareService(
    new NullBarcodeScanner(),
    new MemoryThermalPrinter(),
    new MemoryA4Printer(),
    new MemoryCashDrawer(),
    new NullCamera(),
    new NullCameraRecognition(),
    new MemoryLabelPrinter(),
    new MemoryBarcodePrinter(),
  );
}
