import { useState } from "react";
import { money } from "../format";
import type { InvoiceView, SaleListRow, SaleStatus } from "@electronic-erp/contracts";
import { formatInvoiceDateTime, printInvoiceReceipt } from "../invoices/invoice-utils";
import { CustomerDeliveryModal } from "../invoices/CustomerDeliveryModal";

function statusTone(status: string) {
  switch (status) {
    case "posted":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "held":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "draft":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "void":
      return "bg-red-50 text-red-700 border-red-200";
    case "returned":
    case "exchanged":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function SaleStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(status)}`}>
      {status}
    </span>
  );
}

export function SaleDetailDrawer({
  open,
  loading,
  row,
  invoice,
  onClose,
  onReprint,
  onReturn,
  onRefund,
  onVoid,
  onDuplicate,
  canReturn,
  canVoid,
}: {
  open: boolean;
  loading?: boolean;
  row: SaleListRow | null;
  invoice: InvoiceView | null;
  onClose: () => void;
  onReprint: () => void;
  onReturn: () => void;
  onRefund: () => void;
  onVoid: () => void;
  onDuplicate: () => void;
  canReturn?: boolean;
  canVoid?: boolean;
}) {
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryTab, setDeliveryTab] = useState<"whatsapp" | "email" | "print">("whatsapp");

  if (!open) return null;

  const sale = invoice?.sale ?? row;
  const status = (sale?.status ?? "draft") as SaleStatus;
  const posted = status === "posted";
  const dt = formatInvoiceDateTime(invoice?.dateTime ?? sale?.createdAt);
  const grand = Number(sale?.grandTotal ?? 0);
  const paid = Number(invoice?.sale?.paidTotal ?? invoice?.paidAmount ?? grand);
  const remaining = Number(invoice?.sale?.remainingTotal ?? invoice?.remainingAmount ?? 0);
  const customerName = invoice?.customerName ?? row?.customerName ?? "Walk-in Customer";

  return (
    <>
      <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
        <aside
          className="pos-sale-drawer"
          role="dialog"
          aria-modal
          aria-label="Sale detail"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 bg-slate-50/70">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Transaction Details</p>
              <h2 className="truncate text-base font-black text-slate-900">
                #{invoice?.invoiceNumber ?? row?.invoiceNumber ?? "—"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <SaleStatusBadge status={status} />
                {sale?.paymentStatus ? (
                  <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-700">
                    {sale.paymentStatus}
                  </span>
                ) : null}
                <span className="text-[10px] text-slate-400">· {dt.date} {dt.time}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden />
            </button>
          </div>

          {/* Delivery & Dispatch Quick Bar */}
          {invoice && posted ? (
            <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50/50 px-4 py-2 text-xs">
              <span className="font-bold text-blue-900">
                <i className="fa-solid fa-paper-plane mr-1 text-blue-600" />
                Customer Delivery
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryTab("whatsapp");
                    setDeliveryOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
                  title="Send via WhatsApp"
                >
                  <i className="fa-brands fa-whatsapp text-emerald-600" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryTab("email");
                    setDeliveryOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-blue-300 bg-white px-2 py-0.5 text-[11px] font-bold text-blue-800 hover:bg-blue-50"
                  title="Send via Email"
                >
                  <i className="fa-regular fa-envelope text-blue-600" />
                  Email
                </button>
              </div>
            </div>
          ) : null}

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading invoice details…</p>
            ) : (
              <div className="space-y-3.5 text-sm">
                {/* Key Meta Grid */}
                <dl className="grid grid-cols-2 gap-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-400">Customer</dt>
                    <dd className="font-black text-slate-900">{customerName}</dd>
                    {invoice?.customerMobile ? (
                      <dd className="text-[11px] text-slate-500 font-medium">{invoice.customerMobile}</dd>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-400">Branch & Terminal</dt>
                    <dd className="font-semibold text-slate-800">{invoice?.branchName ?? "Main Branch"}</dd>
                    <dd className="text-[10px] text-slate-400">Terminal: {invoice?.terminalId ?? "POS-01"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-400">Cashier</dt>
                    <dd className="font-semibold text-slate-800">{invoice?.cashierName ?? row?.cashierName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-400">Payment Tender</dt>
                    <dd className="font-bold text-blue-700">
                      {row?.paymentMethods ??
                        invoice?.payments?.map((p) => p.method).join(", ") ??
                        "Cash"}
                    </dd>
                  </div>
                </dl>

                {/* Items Table */}
                <div>
                  <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Purchased Items ({invoice?.items?.length ?? 0})
                  </h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-2 py-1.5">Item</th>
                          <th className="px-2 py-1.5 text-center">Qty</th>
                          <th className="px-2 py-1.5 text-right">Price</th>
                          <th className="px-2 py-1.5 text-right">Disc</th>
                          <th className="px-2 py-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoice?.items ?? []).map((item, i) => (
                          <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">
                            <td className="px-2 py-1.5 font-bold text-slate-900">
                              <div>{item.name}</div>
                              {item.warrantyDays ? (
                                <div className="text-[9px] text-blue-600 font-semibold">Warranty: {item.warrantyDays}d</div>
                              ) : null}
                            </td>
                            <td className="px-2 py-1.5 text-center tabular-nums font-bold text-slate-700">
                              {item.qty} {item.unit ?? "pcs"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                              {money(Number(item.rate))}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-red-600">
                              {Number(item.discount) > 0 ? `−${money(Number(item.discount))}` : "0"}
                            </td>
                            <td className="px-2 py-1.5 text-right font-black tabular-nums text-slate-900">
                              {money(Number(item.total))}
                            </td>
                          </tr>
                        ))}
                        {!invoice?.items?.length ? (
                          <tr>
                            <td colSpan={5} className="px-2 py-4 text-center text-slate-400">
                              {row ? `${row.itemCount ?? 0} item(s) in sale` : "No lines recorded"}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Summary */}
                <dl className="space-y-1 rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-200/80">
                  <div className="flex justify-between text-slate-600">
                    <dt>Subtotal</dt>
                    <dd className="font-semibold">{money(Number(sale?.subtotal ?? 0))}</dd>
                  </div>
                  {Number(sale?.discountTotal ?? 0) > 0 ? (
                    <div className="flex justify-between text-red-600 font-semibold">
                      <dt>Discounts Total</dt>
                      <dd>−{money(Number(sale?.discountTotal ?? 0))}</dd>
                    </div>
                  ) : null}
                  {Number(sale?.taxTotal ?? 0) > 0 ? (
                    <div className="flex justify-between text-slate-600">
                      <dt>GST / Tax (17%)</dt>
                      <dd className="font-semibold">{money(Number(sale?.taxTotal ?? 0))}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-black text-slate-900">
                    <dt>Grand Total</dt>
                    <dd className="text-blue-700">{money(grand)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-1 text-xs">
                    <dt className="text-slate-500">Paid Amount</dt>
                    <dd className="font-bold text-slate-800">{money(paid)}</dd>
                  </div>
                  {remaining > 0 ? (
                    <div className="flex justify-between text-xs text-amber-800 font-bold">
                      <dt>Balance / Udhaar</dt>
                      <dd>{money(remaining)}</dd>
                    </div>
                  ) : null}
                </dl>

                {/* Payments Breakdown */}
                {invoice?.payments?.length ? (
                  <div>
                    <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Payment Records
                    </h3>
                    <ul className="space-y-1 text-xs">
                      {invoice.payments.map((p, i) => (
                        <li key={i} className="flex justify-between rounded-lg border border-slate-100 bg-white p-2">
                          <span className="font-semibold text-slate-700">
                            {p.method}
                            {p.reference ? <span className="text-[10px] text-slate-400 font-normal"> · {p.reference}</span> : ""}
                          </span>
                          <span className="font-black text-slate-900">{money(Number(p.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50 p-3">
            {/* Primary Print Actions */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (invoice) printInvoiceReceipt(invoice, "thermal", undefined, true);
                  onReprint();
                }}
                disabled={!invoice}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-40"
              >
                <i className="fa-solid fa-print text-xs" />
                Print Thermal (80mm)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (invoice) printInvoiceReceipt(invoice, "a4", undefined, true);
                }}
                disabled={!invoice}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100 disabled:opacity-40"
              >
                <i className="fa-solid fa-file-invoice text-blue-600 text-xs" />
                Print A4 / PDF
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={onDuplicate}
                disabled={!invoice}
                className="rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Repeat Sale
              </button>
              <button
                type="button"
                onClick={onReturn}
                disabled={!posted || !canReturn}
                className="rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Return
              </button>
              <button
                type="button"
                onClick={onRefund}
                disabled={!posted || !canReturn}
                className="rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Refund
              </button>
            </div>

            {canVoid && status !== "void" ? (
              <button
                type="button"
                onClick={onVoid}
                className="w-full rounded-lg bg-red-50 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
              >
                Void Transaction
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <CustomerDeliveryModal
        open={deliveryOpen}
        invoice={invoice}
        initialTab={deliveryTab}
        onClose={() => setDeliveryOpen(false)}
      />
    </>
  );
}
