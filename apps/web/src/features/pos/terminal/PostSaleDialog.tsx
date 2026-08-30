import { useEffect, useState } from "react";
import type { InvoiceView } from "@electronic-erp/contracts";
import { money } from "../format";
import {
  downloadPdfInvoice,
  formatInvoiceDateTime,
  printInvoiceReceipt,
} from "../invoices/invoice-utils";
import { CustomerDeliveryModal } from "../invoices/CustomerDeliveryModal";

export function PostSaleDialog({
  open,
  invoice,
  paidAmount,
  changeAmount,
  customerMobile,
  customerEmail,
  paymentMethod = "Cash",
  onClose,
  onNewSale,
}: {
  open: boolean;
  invoice: InvoiceView | null;
  paidAmount?: number;
  changeAmount?: number;
  customerMobile?: string | null;
  customerEmail?: string | null;
  paymentMethod?: string;
  onClose: () => void;
  onNewSale: () => void;
}) {
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryTab, setDeliveryTab] = useState<"whatsapp" | "email" | "print">("whatsapp");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !deliveryOpen) {
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
  }, [open, invoice, onNewSale, deliveryOpen]);

  if (!open || !invoice) return null;

  const enrichedInvoice: InvoiceView = {
    ...invoice,
    customerMobile: invoice.customerMobile ?? customerMobile ?? null,
    customerEmail: invoice.customerEmail ?? customerEmail ?? null,
  };

  const invNum = enrichedInvoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const dt = formatInvoiceDateTime(enrichedInvoice.dateTime ?? enrichedInvoice.sale?.createdAt);
  const grand = Number(enrichedInvoice.sale?.grandTotal ?? 0);
  const paid = paidAmount != null ? paidAmount : grand;
  const change = changeAmount != null ? changeAmount : Math.max(0, paid - grand);
  const customerName = enrichedInvoice.customerName ?? "Walk-in Customer";

  return (
    <>
      <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="pos-modal max-w-lg p-5 text-center"
          role="dialog"
          aria-modal
          aria-label="Sale Completed"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Success Icon */}
          <div className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
            <i className="fa-solid fa-circle-check text-3xl" />
          </div>

          <h2 className="text-xl font-black tracking-tight text-slate-900">Sale Completed!</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Invoice: <span className="font-bold text-slate-900">#{invNum}</span> · {dt.date} at {dt.time}
          </p>

          {/* Transaction Summary Card */}
          <div className="my-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left">
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-200/80 pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Customer</span>
                <p className="truncate font-black text-slate-800">{customerName}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400">Payment Method</span>
                <p className="font-black text-blue-700 capitalize">{paymentMethod}</p>
              </div>
            </div>

            {/* Billed Items Count / Preview */}
            <div className="flex items-center justify-between border-b border-slate-200/80 py-1.5 text-xs text-slate-600">
              <span className="text-[10px] font-bold uppercase text-slate-400">Billed Items</span>
              <span className="font-bold text-slate-800">
                {enrichedInvoice.items?.length ?? 0} {enrichedInvoice.items?.length === 1 ? "Product" : "Products"} (
                {enrichedInvoice.items?.reduce((acc, it) => acc + Number(it.qty || 0), 0) ?? 0} Units)
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Total Paid</span>
                <p className="text-base font-black text-slate-900">{money(paid)}</p>
              </div>
              {change > 0 ? (
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Change Returned</span>
                  <p className="text-base font-black text-emerald-600">{money(change)}</p>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                  <p className="text-sm font-bold text-emerald-600">Settled Full</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons Grid */}
          <div className="space-y-2">
            {/* Primary Print Thermal Button */}
            <button
              type="button"
              autoFocus
              onClick={() => {
                printInvoiceReceipt(enrichedInvoice, "thermal");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-98"
            >
              <i className="fa-solid fa-print text-base" />
              Print Thermal Receipt (80mm)
            </button>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  downloadPdfInvoice(enrichedInvoice);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                title="Download or print formal A4 tax invoice"
              >
                <i className="fa-solid fa-file-invoice text-blue-600" />
                <span>A4 / PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeliveryTab("whatsapp");
                  setDeliveryOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                title="Share receipt via WhatsApp"
              >
                <i className="fa-brands fa-whatsapp text-emerald-600 text-sm" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeliveryTab("email");
                  setDeliveryOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 py-2 text-xs font-bold text-indigo-800 transition hover:bg-indigo-100"
                title="Send receipt via Email"
              >
                <i className="fa-regular fa-envelope text-indigo-600 text-sm" />
                <span>Email</span>
              </button>
            </div>

            {/* Start New Sale Button */}
            <button
              type="button"
              onClick={onNewSale}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              <span>Start Next Sale</span>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">Esc</kbd>
            </button>
          </div>
        </div>
      </div>

      <CustomerDeliveryModal
        open={deliveryOpen}
        invoice={enrichedInvoice}
        initialTab={deliveryTab}
        onClose={() => setDeliveryOpen(false)}
      />
    </>
  );
}
