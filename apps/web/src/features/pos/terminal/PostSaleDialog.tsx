import { useEffect, useState } from "react";
import type { InvoiceView } from "@electronic-erp/contracts";
import { money } from "../format";
import {
  downloadPdfInvoice,
  formatInvoiceDateTime,
  openEmailReceipt,
  openWhatsAppReceipt,
  printInvoiceReceipt,
} from "../invoices/invoice-utils";

export function PostSaleDialog({
  open,
  invoice,
  paidAmount,
  changeAmount,
  customerMobile,
  customerEmail,
  customerName,
  paymentMethod = "Cash",
  installmentSummary = null,
  onClose,
  onNewSale,
  onViewSale,
}: {
  open: boolean;
  invoice: InvoiceView | null;
  paidAmount?: number;
  changeAmount?: number;
  customerMobile?: string | null;
  customerEmail?: string | null;
  customerName?: string;
  paymentMethod?: string;
  installmentSummary?: {
    downPayment: number;
    remaining: number;
    count: number;
    frequency?: string;
  } | null;
  onClose: () => void;
  onNewSale: () => void;
  onViewSale?: () => void;
}) {
  // Inline sharing input states
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "opened" | "failed">("idle");
  const [whatsappState, setWhatsappState] = useState<"idle" | "opened" | "blocked">("idle");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !showPhonePrompt && !showEmailPrompt) {
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
  }, [open, invoice, onNewSale, showPhonePrompt, showEmailPrompt]);

  // Sync initial phone/email when invoice changes
  useEffect(() => {
    if (invoice) {
      setPhoneInput(invoice.customerMobile ?? customerMobile ?? "");
      setEmailInput(invoice.customerEmail ?? customerEmail ?? "");
      setEmailState("idle");
      setWhatsappState("idle");
      setShowPhonePrompt(false);
      setShowEmailPrompt(false);
    }
  }, [invoice, customerMobile, customerEmail]);

  if (!open || !invoice) return null;

  const enrichedInvoice: InvoiceView = {
    ...invoice,
    customerMobile: phoneInput || invoice.customerMobile || customerMobile || null,
    customerEmail: emailInput || invoice.customerEmail || customerEmail || null,
  };

  const invNum = enrichedInvoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const dt = formatInvoiceDateTime(enrichedInvoice.dateTime ?? enrichedInvoice.sale?.createdAt);
  const grand = Number(enrichedInvoice.sale?.grandTotal ?? 0);
  const subtotal = Number(enrichedInvoice.sale?.subtotal ?? grand);
  const disc = Number(enrichedInvoice.sale?.discountTotal ?? 0);
  const tax = Number(enrichedInvoice.sale?.taxTotal ?? 0);
  const paid = paidAmount != null ? paidAmount : Number(enrichedInvoice.sale?.paidTotal ?? grand);
  const change = changeAmount != null ? changeAmount : Math.max(0, paid - grand);
  const remaining = Number(enrichedInvoice.sale?.remainingTotal ?? Math.max(0, grand - paid));
  const customerNameDisplay = customerName ?? enrichedInvoice.customerName ?? "Walk-in Customer";
  const customerPhone = enrichedInvoice.customerMobile ?? "";

  function handleShareWhatsApp() {
    const phone = (phoneInput || customerPhone || "").trim();
    if (!phone) {
      setShowPhonePrompt(true);
      return;
    }
    const opened = openWhatsAppReceipt(enrichedInvoice, phone);
    setWhatsappState(opened ? "opened" : "blocked");
  }

  function handleSendEmail() {
    const email = (emailInput || enrichedInvoice.customerEmail || "").trim();
    if (!email) {
      setShowEmailPrompt(true);
      return;
    }
    setEmailState("sending");
    const opened = openEmailReceipt(enrichedInvoice, email);
    setEmailState(opened ? "opened" : "failed");
  }

  return (
    <>
      <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="pos-modal max-w-xl p-5 text-center"
          role="dialog"
          aria-modal
          aria-label="Sale Completed"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Payment Success Hero */}
          <div className="mx-auto mb-3 max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
            <div className="flex items-center gap-2 text-emerald-800">
              <i className="fa-solid fa-circle-check text-2xl" />
              <div>
                <p className="text-sm font-black uppercase tracking-wide">Payment Successful</p>
                <p className="text-2xl font-black text-emerald-900">Rs. {money(grand)}</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-emerald-950">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700">Payment Method</span>
                <p className="font-black capitalize">{paymentMethod}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700">Transaction</span>
                <p className="font-black">#{invNum}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700">Time</span>
                <p className="font-semibold">{dt.time}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700">Customer</span>
                <p className="font-semibold truncate">{customerNameDisplay}</p>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-black tracking-tight text-slate-900">
            SALE COMPLETED ✓
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Invoice: <span className="font-bold text-slate-900">#{invNum}</span> · {dt.date} at {dt.time}
          </p>

          {/* Transaction Metadata Card */}
          <div className="my-3 rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-left space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-200/80 pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Customer</span>
                <p className="truncate font-black text-slate-900">
                  {customerNameDisplay}
                  {customerPhone ? <span className="text-slate-400 font-normal ml-1">({customerPhone})</span> : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400">Payment Method</span>
                <p className="font-black text-blue-700 capitalize">{paymentMethod}</p>
              </div>
            </div>

            {/* Billed Items Detailed Preview */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 px-0.5">
                <span>Items ({enrichedInvoice.items?.length ?? 0})</span>
                <span>Line Total</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-slate-200/60 bg-white p-1.5 text-xs">
                {(enrichedInvoice.items ?? []).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-0.5 px-1 border-b border-slate-100 last:border-b-0">
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <span className="text-[10px] text-slate-400 ml-1">
                        (x{item.qty} {item.unit || "Pcs"})
                      </span>
                    </div>
                    <span className="shrink-0 font-black text-slate-900">
                      Rs. {Number(item.total).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Breakdown Grid */}
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-white p-2 text-center text-xs border border-slate-200/80">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Subtotal</span>
                <span className="font-bold text-slate-800">Rs. {money(subtotal)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Discount</span>
                <span className={disc > 0 ? "font-bold text-emerald-600" : "text-slate-500"}>
                  {disc > 0 ? `−${money(disc)}` : "0.00"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">GST / Tax</span>
                <span className="font-bold text-slate-800">Rs. {money(tax)}</span>
              </div>
              <div>
                <span className="text-[10px] text-blue-600 block uppercase font-black">Total</span>
                <span className="font-black text-slate-900">Rs. {money(grand)}</span>
              </div>
            </div>

            {/* Paid & Change / Udhaar Row */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="rounded-lg bg-white p-2 border border-slate-200 text-left">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Amount Paid</span>
                <p className="text-base font-black tabular-nums text-slate-900">Rs. {money(paid)}</p>
              </div>
              <div className="rounded-lg bg-white p-2 border border-slate-200 text-right">
                {change > 0 ? (
                  <>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Change Returned</span>
                    <p className="text-base font-black tabular-nums text-emerald-600">Rs. {money(change)}</p>
                  </>
                ) : remaining > 0 ? (
                  <>
                    <span className="text-[10px] font-bold uppercase text-amber-700 block">Outstanding</span>
                    <p className="text-base font-black tabular-nums text-amber-600">Rs. {money(remaining)}</p>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Status</span>
                    <p className="text-sm font-black text-emerald-600">Settled in Full</p>
                  </>
                )}
              </div>
            </div>

            {(enrichedInvoice.payments?.length ?? 0) > 1 ? (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-2 text-left text-xs space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-800">Split Payment</p>
                {enrichedInvoice.payments!.map((p, idx) => (
                  <div key={idx} className="flex justify-between gap-2 text-cyan-950">
                    <span className="font-semibold capitalize">{p.method}</span>
                    <span className="font-black tabular-nums">Rs. {money(Number(p.amount) || 0)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 border-t border-cyan-200 pt-1 font-black text-cyan-950">
                  <span>Total</span>
                  <span className="tabular-nums">
                    Rs. {money(enrichedInvoice.payments!.reduce((s, p) => s + (Number(p.amount) || 0), 0))}
                  </span>
                </div>
              </div>
            ) : null}

            {installmentSummary ? (
              <div className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-left text-xs space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Installment Plan</p>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">Down Payment</span>
                  <span className="font-black tabular-nums">Rs. {money(installmentSummary.downPayment)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">Remaining</span>
                  <span className="font-bold tabular-nums text-amber-700">Rs. {money(installmentSummary.remaining)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">Plan</span>
                  <span className="font-semibold text-slate-800">
                    {installmentSummary.count} {installmentSummary.frequency ?? "monthly"} installments
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Inline Phone Prompt for WhatsApp (if missing) */}
          {showPhonePrompt ? (
            <div className="my-2 rounded-xl border border-emerald-300 bg-emerald-50 p-2.5 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900">Enter Customer WhatsApp / Mobile Number:</span>
                <button
                  type="button"
                  onClick={() => setShowPhonePrompt(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  autoFocus
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="03001234567"
                  className="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!phoneInput.trim()) return;
                    const opened = openWhatsAppReceipt(
                      { ...enrichedInvoice, customerMobile: phoneInput.trim() },
                      phoneInput.trim(),
                    );
                    setShowPhonePrompt(false);
                    setWhatsappState(opened ? "opened" : "blocked");
                  }}
                  disabled={!phoneInput.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          ) : null}

          {/* Inline Email Prompt (if requested) */}
          {showEmailPrompt ? (
            <div className="my-2 rounded-xl border border-indigo-300 bg-indigo-50 p-2.5 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900">Enter Customer Email Address:</span>
                <button
                  type="button"
                  onClick={() => setShowEmailPrompt(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  autoFocus
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="customer@example.com"
                  className="flex-1 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!emailInput.trim()) return;
                    setEmailState("sending");
                    const opened = openEmailReceipt(
                      { ...enrichedInvoice, customerEmail: emailInput.trim() },
                      emailInput.trim(),
                    );
                    setShowEmailPrompt(false);
                    setEmailState(opened ? "opened" : "failed");
                  }}
                  disabled={!emailInput.trim()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          ) : null}

          {whatsappState === "opened" ? (
            <p className="my-1.5 text-xs font-bold text-emerald-800">
              WhatsApp opened — send the message in WhatsApp to deliver the receipt.
            </p>
          ) : null}
          {whatsappState === "blocked" ? (
            <p className="my-1.5 text-xs font-bold text-amber-800">
              WhatsApp did not open. Allow pop-ups or check the customer number.
            </p>
          ) : null}

          {emailState !== "idle" ? (
            <div
              className={`my-1.5 rounded-lg p-2 text-xs font-bold ${
                emailState === "sending"
                  ? "bg-blue-50 text-blue-700"
                  : emailState === "opened"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-red-50 text-red-800"
              }`}
            >
              {emailState === "sending" && "Sending… opening email client"}
              {emailState === "opened" && "Email client opened — send the message to deliver the receipt."}
              {emailState === "failed" && (
                <div className="flex items-center justify-between">
                  <span>Failed — Retry</span>
                  <button type="button" onClick={handleSendEmail} className="ml-2 underline text-red-900">
                    Retry
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* Receipt actions */}
          <div className="mt-3 space-y-2">
            <button
              type="button"
              autoFocus
              onClick={() => {
                printInvoiceReceipt(enrichedInvoice, "thermal");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-700 active:scale-98"
            >
              <i className="fa-solid fa-print text-base" />
              <span>Print Receipt</span>
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  downloadPdfInvoice(enrichedInvoice);
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-98"
                title="Download / save receipt PDF"
              >
                <i className="fa-solid fa-download text-slate-600" />
                <span>Download Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-98"
                title="Open WhatsApp with receipt message"
              >
                <i className="fa-brands fa-whatsapp text-emerald-600 text-sm" />
                <span>{whatsappState === "opened" ? "WhatsApp Opened" : "Send via WhatsApp"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleSendEmail}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 py-2 text-xs font-bold text-indigo-800 transition hover:bg-indigo-100 active:scale-98"
              title="Email receipt to customer"
            >
              <i className="fa-regular fa-envelope text-indigo-600 text-sm" />
              <span>
                {emailState === "opened"
                  ? "Email Opened"
                  : emailState === "sending"
                    ? "Sending…"
                    : emailState === "failed"
                      ? "Failed — Retry"
                      : "Email Receipt"}
              </span>
            </button>

            {onViewSale ? (
              <button
                type="button"
                onClick={onViewSale}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
              >
                <i className="fa-regular fa-file-lines" aria-hidden />
                View Sale
              </button>
            ) : null}

            <button
              type="button"
              onClick={onNewSale}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-slate-800 active:scale-98"
            >
              <span>New Sale</span>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-slate-300">
                Esc
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
