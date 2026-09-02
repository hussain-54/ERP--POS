import { useEffect, useRef, useState } from "react";
import { triggerCashDrawerKick } from "./hardware-broadcast";
import { printInvoiceReceipt } from "../invoices/invoice-utils";
import type { InvoiceView } from "@electronic-erp/contracts";

export function HardwareStatusPill({
  onOpenScanner,
}: {
  onOpenScanner?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [drawerKickStatus, setDrawerKickStatus] = useState<"idle" | "kicked">("idle");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Devices configuration items
  const devices = [
    {
      id: "scanner",
      name: "Barcode / QR Scanner",
      icon: "fa-barcode",
      status: "Ready",
      detail: "USB Keyboard Wedge & Camera Active",
      actionLabel: "Open Camera Scanner",
      action: () => {
        setOpen(false);
        onOpenScanner?.();
      },
    },
    {
      id: "thermal",
      name: "Receipt Printer (80mm)",
      icon: "fa-print",
      status: "Ready",
      detail: "Thermal ESC/POS Direct Print",
      actionLabel: "Test Print (Receipt)",
      action: () => {
        const sampleInvoice: InvoiceView = {
          invoiceNumber: "TEST-RECEIPT-01",
          customerName: "Sample Customer",
          branchName: "Main Branch",
          cashierName: "Cashier",
          dateTime: new Date().toISOString(),
          sale: {
            id: "test-1",
            organizationId: "org-1",
            branchId: "branch-1",
            warehouseId: "wh-1",
            invoiceNumber: "TEST-RECEIPT-01",
            subtotal: 1500,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: 1500,
            paidTotal: 1500,
            remainingTotal: 0,
            posMode: "easy",
            localeMode: "en",
            status: "posted",
            paymentStatus: "paid",
            idempotencyKey: "idem-test",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
          items: [
            {
              name: "Test Hardware Diagnostics Item",
              qty: 1,
              rate: 1500,
              discount: 0,
              tax: 0,
              total: 1500,
              unit: "Pcs",
            },
          ],
          payments: [{ method: "Cash", amount: 1500, reference: null }],
        };
        printInvoiceReceipt(sampleInvoice, "thermal", "Electronic Store Diagnostics");
      },
    },
    {
      id: "a4",
      name: "A4 Tax Invoice Printer",
      icon: "fa-file-invoice",
      status: "Ready",
      detail: "System A4 PDF / Tax Invoice",
      actionLabel: "Test Print (A4)",
      action: () => {
        const sampleInvoice: InvoiceView = {
          invoiceNumber: "TEST-A4-01",
          customerName: "Sample Customer",
          branchName: "Main Branch",
          cashierName: "Cashier",
          dateTime: new Date().toISOString(),
          sale: {
            id: "test-2",
            organizationId: "org-1",
            branchId: "branch-1",
            warehouseId: "wh-1",
            invoiceNumber: "TEST-A4-01",
            subtotal: 5000,
            discountTotal: 250,
            taxTotal: 850,
            grandTotal: 5600,
            paidTotal: 5600,
            remainingTotal: 0,
            posMode: "easy",
            localeMode: "en",
            status: "posted",
            paymentStatus: "paid",
            idempotencyKey: "idem-test-a4",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
          items: [{ name: "Diagnostics Cable Set 4mm", qty: 2, rate: 2500, discount: 250, tax: 850, total: 5600, unit: "Set" }],
          payments: [{ method: "Bank Transfer", amount: 5600, reference: "DIAG-01" }],
        };
        printInvoiceReceipt(sampleInvoice, "a4", "Electronic Store Diagnostics");
      },
    },
    {
      id: "drawer",
      name: "Cash Drawer",
      icon: "fa-cash-register",
      status: "Ready",
      detail: "Kick pulse on cash payment",
      actionLabel: "Open Cash Drawer (Test)",
      action: async () => {
        await triggerCashDrawerKick("Cashier Diagnostics Test");
        setDrawerKickStatus("kicked");
        setTimeout(() => setDrawerKickStatus("idle"), 2500);
      },
    },
    {
      id: "display",
      name: "Customer Pole Display",
      icon: "fa-desktop",
      status: "Active",
      detail: "Real-time cart & totals broadcast",
      actionLabel: "Open Secondary Display Window",
      action: () => {
        window.open("/pos/devices/customer-display", "POSCustomerDisplay", "width=800,height=600");
      },
    },
    {
      id: "terminal",
      name: "Payment Terminal / Card POS",
      icon: "fa-credit-card",
      status: "Standby",
      detail: "Manual & Integrated Card Ready",
      actionLabel: null,
      action: null,
    },
  ];

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Subtle non-cluttering Status Pill */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-98"
        title="Hardware Peripherals Status"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Hardware (6 Ready)</span>
        <i className="fa-solid fa-chevron-down text-[9px] text-emerald-600" />
      </button>

      {/* Popover Card */}
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-84 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <i className="fa-solid fa-microchip text-xs" />
              </div>
              <h3 className="text-xs font-black text-slate-900">Connected Peripherals</h3>
            </div>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 uppercase">
              All Systems OK
            </span>
          </div>

          <div className="my-2.5 space-y-2 max-h-80 overflow-y-auto pr-1">
            {devices.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className={`fa-solid ${d.icon} text-slate-500 text-xs`} />
                    <span className="font-bold text-slate-800">{d.name}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {d.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">{d.detail}</p>
                {d.actionLabel && d.action ? (
                  <button
                    type="button"
                    onClick={d.action}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                  >
                    {d.id === "drawer" && drawerKickStatus === "kicked" ? "✓ Drawer Opened!" : d.actionLabel}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-2 text-center text-[10px] text-slate-400">
            Hardware Service · Keyboard Wedge · Thermal 80mm · Auto-Kick
          </div>
        </div>
      ) : null}
    </div>
  );
}
