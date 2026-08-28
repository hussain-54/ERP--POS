import { useState } from "react";
import type { InvoiceView } from "@electronic-erp/contracts";
import { money } from "../format";
import {
  buildEmailReceiptSubject,
  buildWhatsAppReceiptText,
  downloadPdfInvoice,
  formatInvoiceDateTime,
  openEmailReceipt,
  openWhatsAppReceipt,
  printInvoiceReceipt,
} from "./invoice-utils";

export type DeliveryTab = "whatsapp" | "email" | "print";

export function CustomerDeliveryModal({
  open,
  invoice,
  initialTab = "whatsapp",
  onClose,
}: {
  open: boolean;
  invoice: InvoiceView | null;
  initialTab?: DeliveryTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DeliveryTab>(initialTab);
  const [phone, setPhone] = useState(invoice?.customerMobile ?? "");
  const [email, setEmail] = useState(invoice?.customerEmail ?? "");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [whatsappStatus, setWhatsappStatus] = useState<"idle" | "opening" | "sent">("idle");

  if (!open || !invoice) return null;

  const invNum = invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const dt = formatInvoiceDateTime(invoice.dateTime ?? invoice.sale?.createdAt);
  const grand = Number(invoice.sale?.grandTotal ?? 0);
  const paid = Number(invoice.sale?.paidTotal ?? invoice.paidAmount ?? grand);
  const change = Math.max(0, paid - grand);
  const previewText = buildWhatsAppReceiptText(invoice);
  const emailSubject = buildEmailReceiptSubject(invoice);

  function handleSendWhatsApp() {
    setWhatsappStatus("opening");
    try {
      openWhatsAppReceipt(invoice!, phone || undefined);
      setTimeout(() => setWhatsappStatus("sent"), 800);
    } catch {
      setWhatsappStatus("idle");
    }
  }

  function handleSendEmail() {
    setEmailStatus("sending");
    try {
      openEmailReceipt(invoice!, email || undefined);
      setTimeout(() => setEmailStatus("sent"), 800);
    } catch {
      setEmailStatus("failed");
    }
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal max-w-lg p-5 text-left"
        role="dialog"
        aria-modal
        aria-label="Customer Delivery Hub"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              <i className="fa-solid fa-paper-plane mr-2 text-blue-600" />
              Receipt & Invoice Delivery
            </h2>
            <p className="text-xs text-slate-500">
              Invoice: <span className="font-bold text-slate-800">#{invNum}</span> · {dt.date} {dt.time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Mini Summary Banner */}
        <div className="my-3 flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-200/70">
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-bold">Billed To</span>
            <p className="font-bold text-slate-800">{invoice.customerName ?? "Walk-in Customer"}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase text-slate-400 font-bold">Total Paid</span>
            <p className="text-sm font-black text-slate-900">{money(paid)}</p>
            {change > 0 ? (
              <p className="text-[10px] font-bold text-emerald-600">Change: {money(change)}</p>
            ) : null}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab("whatsapp")}
            className={`flex-1 rounded-lg py-1.5 text-center transition ${
              tab === "whatsapp" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-brands fa-whatsapp mr-1.5 text-emerald-600" />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`flex-1 rounded-lg py-1.5 text-center transition ${
              tab === "email" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-regular fa-envelope mr-1.5 text-blue-600" />
            Email
          </button>
          <button
            type="button"
            onClick={() => setTab("print")}
            className={`flex-1 rounded-lg py-1.5 text-center transition ${
              tab === "print" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-print mr-1.5 text-slate-700" />
            Print / PDF
          </button>
        </div>

        {/* TAB 1: WHATSAPP */}
        {tab === "whatsapp" && (
          <div className="mt-3.5 space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Customer Mobile Phone #
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 03001234567 or 923001234567"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-98"
                >
                  <i className="fa-brands fa-whatsapp text-sm" />
                  {whatsappStatus === "opening" ? "Opening…" : whatsappStatus === "sent" ? "Sent / Opened ✓" : "Send WhatsApp"}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                * Opens verified direct WhatsApp dispatch URL with formatted invoice breakdown.
              </p>
            </div>

            {/* Message Preview */}
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Formatted Text Preview:
              </span>
              <pre className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                {previewText}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: EMAIL */}
        {tab === "email" && (
          <div className="mt-3.5 space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Recipient Email Address
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-98"
                >
                  <i className="fa-regular fa-paper-plane text-xs" />
                  {emailStatus === "sending"
                    ? "Sending…"
                    : emailStatus === "sent"
                      ? "Sent / Opened ✓"
                      : emailStatus === "failed"
                        ? "Failed — Retry"
                        : "Send Email"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1">
              <p className="text-[10px] font-bold uppercase text-slate-400">Subject</p>
              <p className="font-bold text-slate-800">{emailSubject}</p>
            </div>

            {emailStatus === "failed" && (
              <div className="rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700">
                <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                Could not trigger email client. Please check mailto settings or download PDF invoice instead.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PRINT & PDF */}
        {tab === "print" && (
          <div className="mt-3.5 space-y-2.5">
            <button
              type="button"
              onClick={() => printInvoiceReceipt(invoice, "thermal")}
              className="flex w-full items-center justify-between rounded-xl bg-blue-600 p-3 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-print text-sm" />
                Print Thermal POS Receipt (80mm)
              </span>
              <span className="rounded bg-blue-700 px-2 py-0.5 text-[10px]">Instant</span>
            </button>

            <button
              type="button"
              onClick={() => printInvoiceReceipt(invoice, "a4")}
              className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-file-invoice text-blue-600 text-sm" />
                Print A4 Tax Invoice
              </span>
              <span className="text-[10px] text-slate-500">Formal A4 Layout</span>
            </button>

            <button
              type="button"
              onClick={() => downloadPdfInvoice(invoice)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white p-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-file-pdf text-red-600 text-sm" />
                Download PDF Document
              </span>
              <span className="text-[10px] text-slate-500">Save as PDF</span>
            </button>
          </div>
        )}

        {/* Pinned Done Button */}
        <div className="mt-4 border-t border-slate-200 pt-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
