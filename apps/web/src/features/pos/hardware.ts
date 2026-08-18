import {
  HardwareService,
  MemoryA4Printer,
  MemoryBarcodePrinter,
  MemoryCashDrawer,
  MemoryLabelPrinter,
  MemoryThermalPrinter,
  NullCameraRecognition,
  UsbKeyboardWedgeScanner,
  CameraScannerAdapter,
} from "@electronic-erp/hardware";

const usbScanner = new UsbKeyboardWedgeScanner({
  addKeyListener: (fn) => {
    if (typeof window === "undefined") return () => undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") fn("Enter", e);
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) fn(e.key, e);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  },
});

const cameraScanner = new CameraScannerAdapter("camera_scanner", {
  capture: async () => {
    // Web placeholder — Electron/mobile inject real MediaDevices capture
    throw new Error("Camera capture not configured in this host");
  },
});

/**
 * POS talks only to HardwareService.
 * Web uses memory printers (preview) + USB wedge; Electron replaces adapters.
 */
export const posHardware = new HardwareService(
  usbScanner,
  new MemoryThermalPrinter(),
  new MemoryA4Printer(),
  new MemoryCashDrawer(),
  cameraScanner,
  new NullCameraRecognition(),
  new MemoryLabelPrinter(),
  new MemoryBarcodePrinter(),
  {
    canOpenDrawer: () => {
      // Host should wire RBAC; default allow when session token present
      return Boolean(localStorage.getItem("erp.accessToken"));
    },
    auditDrawer: (entry) => {
      const key = "erp_hardware_audit";
      const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      prev.unshift(entry);
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 100)));
    },
  },
);

export { usbScanner, cameraScanner };
