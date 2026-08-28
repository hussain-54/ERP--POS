import { useEffect } from "react";
import type { InvoiceView } from "@electronic-erp/contracts";
import { money } from "../format";
import { openWhatsAppReceipt, printInvoiceReceipt } from "../invoices/invoice-utils";

export function PostSaleDialog({
  open,
  invoice,
  paidAmount,
  changeAmount,
  customerMobile,
  onClose,
  onNewSale,
}: {
  open: boolean;
  invoice: InvoiceView | null;
  paidAmount?: number;
  changeAmount?: number;
  customerMobile?: string | null;
  onClose: () => void;
  onNewSale: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onNewSale();
      }
      if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (invoice) printInvoiceReceipt(invoice, "thermal");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, invoice, onNewSale]);

  if (!open || !invoice) return null;

  const invNum = invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const grand = Number(invoice.sale?.grandTotal ?? 0);
  const change = changeAmount != null ? changeAmount : Math.max(0, (paidAmount ?? grand) - grand);

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal max-w-md p-5 text-center"
        role="dialog"
        aria-modal
        aria-label="Sale Completed"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Icon */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <i className="fa-solid fa-check text-2xl" />
        </div>

        <h2 className="text-lg font-black text-slate-900">Sale Completed Successfully!</h2>
        <p className="mt-0.5 text-xs text-slate-500">Invoice: <span className="font-bold text-slate-800">{invNum}</span></p>

        {/* Amount & Change Card */}
        <div className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Total Paid:</span>
            <span className="text-base font-black text-slate-900">{money(grand)}</span>
          </div>
          {change > 0 ? (
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-black text-emerald-800">
              <span>Change to Return:</span>
              <span className="text-base text-emerald-700">{money(change)}</span>
            </div>
          ) : null}
        </div>

        {/* Action Buttons Grid */}
        <div className="space-y-2">
          {/* Primary Print Thermal Button */}
          <button
            type="button"
            autoFocus
            onClick={() => {
              printInvoiceReceipt(invoice, "thermal");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-98"
          >
            <i className="fa-solid fa-print text-base" />
            Print Thermal Receipt (80mm)
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                printInvoiceReceipt(invoice, "a4");
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <i className="fa-solid fa-file-invoice text-blue-600" />
              Print A4 Invoice
            </button>

            <button
              type="button"
              onClick={() => {
                openWhatsAppReceipt(invoice, customerMobile);
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
            >
              <i className="fa-brands fa-whatsapp text-emerald-600 text-sm" />
              WhatsApp Share
            </button>
          </div>

          {/* New Sale Button */}
          <button
            type="button"
            onClick={onNewSale}
            className="mt-2 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            Start Next Sale (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
