import { money } from "../format";
import type { InvoiceView, SaleListRow, SaleStatus } from "@electronic-erp/contracts";

function statusTone(status: string) {
  switch (status) {
    case "posted":
      return "bg-emerald-50 text-emerald-700";
    case "held":
      return "bg-amber-50 text-amber-800";
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "void":
      return "bg-red-50 text-red-700";
    case "returned":
    case "exchanged":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function SaleStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(status)}`}>
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
  if (!open) return null;

  const sale = invoice?.sale ?? row;
  const status = (sale?.status ?? "draft") as SaleStatus;
  const posted = status === "posted";

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="pos-sale-drawer"
        role="dialog"
        aria-modal
        aria-label="Sale detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Invoice</p>
            <h2 className="truncate text-base font-bold text-slate-900">
              {invoice?.invoiceNumber ?? row?.invoiceNumber ?? "—"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <SaleStatusBadge status={status} />
              {sale?.paymentStatus ? (
                <span className="text-[10px] font-semibold uppercase text-slate-500">
                  Pay · {sale.paymentStatus}
                </span>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading invoice…</p>
          ) : (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-400">Customer</dt>
                  <dd className="font-semibold text-slate-800">
                    {invoice?.customerName ?? row?.customerName ?? "Walk-in"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Cashier</dt>
                  <dd className="font-semibold text-slate-800">
                    {invoice?.cashierName ?? row?.cashierName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Date / time</dt>
                  <dd className="font-semibold text-slate-800">
                    {invoice?.dateTime
                      ? new Date(invoice.dateTime).toLocaleString()
                      : sale?.createdAt
                        ? new Date(sale.createdAt).toLocaleString()
                        : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Terminal / device</dt>
                  <dd className="font-semibold text-slate-800">{invoice?.terminalId ?? sale?.deviceId ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Payment</dt>
                  <dd className="font-semibold text-slate-800">
                    {row?.paymentMethods ??
                      invoice?.payments?.map((p) => p.method).join(", ") ??
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Reference</dt>
                  <dd className="font-semibold text-slate-800">{invoice?.reference ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Shift</dt>
                  <dd className="font-semibold text-slate-800">—</dd>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Items</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Product</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Qty</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Price</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Disc</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Tax</th>
                        <th className="px-2 py-1.5 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoice?.items ?? []).map((item, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 font-medium text-slate-800">{item.name}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{item.qty}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{money(Number(item.rate))}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-red-600">
                            {money(Number(item.discount))}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{money(Number(item.tax))}</td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                            {money(Number(item.total))}
                          </td>
                        </tr>
                      ))}
                      {!invoice?.items?.length ? (
                        <tr>
                          <td colSpan={6} className="px-2 py-4 text-center text-slate-400">
                            {row ? `${row.itemCount ?? 0} line(s) · open invoice for detail` : "No lines"}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <dl className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold">{money(Number(sale?.subtotal ?? 0))}</dd>
                </div>
                <div className="flex justify-between text-red-600">
                  <dt>Discount</dt>
                  <dd className="font-semibold">−{money(Number(sale?.discountTotal ?? 0))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Tax</dt>
                  <dd className="font-semibold">{money(Number(sale?.taxTotal ?? 0))}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-slate-900">
                  <dt>Total</dt>
                  <dd className="text-[var(--pos-primary)]">{money(Number(sale?.grandTotal ?? 0))}</dd>
                </div>
              </dl>

              {invoice?.payments?.length ? (
                <div>
                  <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Payments</h3>
                  <ul className="space-y-1 text-xs">
                    {invoice.payments.map((p, i) => (
                      <li key={i} className="flex justify-between rounded-lg border border-slate-100 px-2 py-1.5">
                        <span>{p.method}{p.reference ? ` · ${p.reference}` : ""}</span>
                        <span className="font-semibold">{money(Number(p.amount))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onReprint}
              disabled={!invoice}
              className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Reprint
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              disabled={!invoice}
              className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Repeat sale
            </button>
            <button
              type="button"
              onClick={onReturn}
              disabled={!posted || !canReturn}
              className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Return
            </button>
            <button
              type="button"
              onClick={onRefund}
              disabled={!posted || !canReturn}
              className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Refund
            </button>
          </div>
          <button
            type="button"
            onClick={onVoid}
            disabled={!canVoid || status === "void"}
            className="w-full rounded-xl bg-red-50 py-2 text-xs font-bold text-red-700 disabled:opacity-40"
          >
            Void / Cancel
          </button>
        </div>
      </aside>
    </div>
  );
}
