import { useCallback, useEffect, useMemo, useState } from "react";
import { afterSalesApi } from "@/features/quotations/after-sales-api";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { posApi } from "../api";
import { money } from "../format";
import { PosSubPageShell } from "../PosSubPageShell";
import { SalesRegister } from "../sales/SalesRegister";
import type { InvoiceView, SaleListRow } from "@electronic-erp/contracts";
import {
  docAmount,
  docField,
  filterTaxDocuments,
  formatInvoiceDateTime,
  INVOICE_META,
  printInvoiceReceipt,
  type InvoiceWorkspaceMode,
} from "./invoice-utils";
import { CustomerDeliveryModal } from "./CustomerDeliveryModal";

function DigitalDeliveryHub() {
  const { branchId } = useAuth();
  const { push } = useToast();
  const [sales, setSales] = useState<SaleListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceView | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"whatsapp" | "email" | "print">("whatsapp");

  const loadRecent = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await posApi.searchSalesManagement({
        branchId,
        tab: "completed",
        limit: 30,
        offset: 0,
      });
      setSales(res.items);
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const filteredSales = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sales;
    return sales.filter((s) => {
      const inv = (s.invoiceNumber ?? "").toLowerCase();
      const cust = (s.customerName ?? "").toLowerCase();
      return inv.includes(needle) || cust.includes(needle);
    });
  }, [sales, q]);

  async function openDelivery(saleId: string, tab: "whatsapp" | "email" | "print") {
    try {
      const inv = await posApi.getInvoice(saleId);
      setSelectedInvoice(inv);
      setInitialTab(tab);
      setDeliveryOpen(true);
    } catch (err) {
      push({
        title: "Could not load invoice",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {/* Top Search & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by customer name or invoice #…"
          className="min-w-[16rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void loadRecent()}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <i className="fa-solid fa-rotate-right mr-1.5" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-full overflow-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Invoice #</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5 text-right">Grand Total</th>
                <th className="px-3 py-2.5">Date / Time</th>
                <th className="px-3 py-2.5 text-center">Payment</th>
                <th className="px-3 py-2.5 text-right">Customer Delivery Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    Loading completed invoices…
                  </td>
                </tr>
              ) : filteredSales.length ? (
                filteredSales.map((sale) => {
                  const dt = formatInvoiceDateTime(sale.createdAt);
                  return (
                    <tr key={sale.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-bold text-slate-900">
                        #{sale.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {sale.customerName ?? "Walk-in Customer"}
                      </td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">
                        {money(sale.grandTotal)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {dt.date} <span className="text-[11px] text-slate-400">{dt.time}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">
                          {sale.paymentMethods || "Cash"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void openDelivery(sale.id, "whatsapp")}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                            title="Send via WhatsApp"
                          >
                            <i className="fa-brands fa-whatsapp text-emerald-600" />
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => void openDelivery(sale.id, "email")}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100"
                            title="Send via Email"
                          >
                            <i className="fa-regular fa-envelope text-blue-600" />
                            Email
                          </button>
                          <button
                            type="button"
                            onClick={() => void openDelivery(sale.id, "print")}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            title="Print or Download PDF"
                          >
                            <i className="fa-solid fa-print text-slate-600" />
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No completed sales found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerDeliveryModal
        open={deliveryOpen}
        invoice={selectedInvoice}
        initialTab={initialTab}
        onClose={() => setDeliveryOpen(false)}
      />
    </div>
  );
}

function DocumentRegister({
  title,
  load,
  columns,
  onOpen,
}: {
  title: string;
  load: () => Promise<Array<Record<string, unknown>>>;
  columns: Array<{ key: string; label: string; render: (row: Record<string, unknown>) => string }>;
  onOpen?: (row: Record<string, unknown>) => void;
}) {
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await load());
    } catch (err) {
      setItems([]);
      push({
        title: `Could not load ${title}`,
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [load, push, title]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((row) =>
      columns.some((c) => c.render(row).toLowerCase().includes(needle)),
    );
  }, [columns, items, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          className="min-w-[14rem] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-full overflow-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-2">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((row) => (
                  <tr key={String(row.id ?? docField(row, "quotation_number", "order_number"))} className="border-t border-slate-100">
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-slate-800">
                        {c.render(row)}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => {
                          setSelected(row);
                          onOpen?.(row);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-slate-400">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selected ? (
        <aside className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold text-slate-800">Document detail</p>
            <button type="button" className="text-xs text-slate-500" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(selected).slice(0, 12).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase text-slate-400">{k.replace(/_/g, " ")}</dt>
                <dd className="font-medium text-slate-800">{String(v ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </aside>
      ) : null}
    </div>
  );
}

export function InvoicesWorkspace({ mode }: { mode: InvoiceWorkspaceMode }) {
  const { branchId } = useAuth();
  const { push } = useToast();

  if (mode === "digital") {
    return (
      <PosSubPageShell
        moduleNumber="07"
        moduleLabel="Invoices & Receipts"
        title="Digital Receipt & Customer Delivery Hub"
        description="Search completed sales and dispatch receipts via WhatsApp, Email, or Print PDF."
      >
        <DigitalDeliveryHub />
      </PosSubPageShell>
    );
  }

  const meta = INVOICE_META[mode];

  if (mode === "invoices" || mode === "receipts" || mode === "reprint") {
    return (
      <PosSubPageShell moduleNumber="07" moduleLabel="Invoices & Receipts" title={meta.title} description={meta.description}>
        <SalesRegister variant="completed" embedded />
      </PosSubPageShell>
    );
  }

  if (mode === "tax") {
    return (
      <PosSubPageShell moduleNumber="07" moduleLabel="Invoices & Receipts" title={meta.title} description={meta.description}>
        <DocumentRegister
          title="tax invoices"
          load={async () => {
            const res = await enterpriseApi.listTaxDocuments();
            return filterTaxDocuments(res.items, "tax_invoice");
          }}
          columns={[
            { key: "type", label: "Type", render: (r) => docField(r, "document_type", "documentType") },
            { key: "source", label: "Source", render: (r) => docField(r, "source_type", "sourceType") },
            { key: "taxable", label: "Taxable", render: (r) => money(docAmount(r, "taxable_amount", "taxableAmount")) },
            { key: "tax", label: "Tax", render: (r) => money(docAmount(r, "tax_amount", "taxAmount")) },
            { key: "total", label: "Total", render: (r) => money(docAmount(r, "grand_total", "grandTotal")) },
            { key: "created", label: "Created", render: (r) => docField(r, "created_at", "createdAt") },
          ]}
          onOpen={async (row) => {
            const sourceId = row.source_id ?? row.sourceId;
            if (!sourceId) return;
            try {
              const inv = await posApi.getInvoice(String(sourceId));
              if (!printInvoiceReceipt(inv, "invoice")) {
                push({ title: "Popup blocked", description: "Allow popups to print.", tone: "danger" });
              }
            } catch {
              push({ title: "Could not load sale invoice", tone: "danger" });
            }
          }}
        />
      </PosSubPageShell>
    );
  }

  if (mode === "quotations") {
    return (
      <PosSubPageShell moduleNumber="07" moduleLabel="Invoices & Receipts" title={meta.title} description={meta.description}>
        <DocumentRegister
          title="quotations"
          load={async () => {
            const res = await afterSalesApi.listQuotations(branchId ?? undefined);
            return res.items;
          }}
          columns={[
            { key: "number", label: "Number", render: (r) => docField(r, "quotation_number", "quotationNumber") },
            { key: "status", label: "Status", render: (r) => docField(r, "status") },
            { key: "customer", label: "Customer", render: (r) => docField(r, "customer_id", "customerId") },
            { key: "total", label: "Total", render: (r) => money(docAmount(r, "grand_total", "grandTotal")) },
            { key: "valid", label: "Valid until", render: (r) => docField(r, "valid_until", "validUntil") },
          ]}
        />
      </PosSubPageShell>
    );
  }

  if (mode === "orders") {
    return (
      <PosSubPageShell moduleNumber="07" moduleLabel="Invoices & Receipts" title={meta.title} description={meta.description}>
        <DocumentRegister
          title="sales orders"
          load={async () => {
            const res = await afterSalesApi.listOrders(branchId ?? undefined);
            return res.items;
          }}
          columns={[
            { key: "number", label: "Number", render: (r) => docField(r, "order_number", "orderNumber") },
            { key: "status", label: "Status", render: (r) => docField(r, "status") },
            { key: "customer", label: "Customer", render: (r) => docField(r, "customer_id", "customerId") },
            { key: "total", label: "Total", render: (r) => money(docAmount(r, "grand_total", "grandTotal")) },
            { key: "created", label: "Created", render: (r) => docField(r, "created_at", "createdAt") },
          ]}
        />
      </PosSubPageShell>
    );
  }

  const docType = mode === "credit-notes" ? "credit_note" : "debit_note";
  return (
    <PosSubPageShell moduleNumber="07" moduleLabel="Invoices & Receipts" title={meta.title} description={meta.description}>
      <DocumentRegister
        title={mode}
        load={async () => {
          const res = await enterpriseApi.listTaxDocuments();
          return filterTaxDocuments(res.items, docType);
        }}
        columns={[
          { key: "type", label: "Type", render: (r) => docField(r, "document_type", "documentType") },
          { key: "source", label: "Source", render: (r) => docField(r, "source_type", "sourceType") },
          { key: "taxable", label: "Taxable", render: (r) => money(docAmount(r, "taxable_amount", "taxableAmount")) },
          { key: "tax", label: "Tax", render: (r) => money(docAmount(r, "tax_amount", "taxAmount")) },
          { key: "total", label: "Total", render: (r) => money(docAmount(r, "grand_total", "grandTotal")) },
          { key: "created", label: "Created", render: (r) => docField(r, "created_at", "createdAt") },
        ]}
      />
    </PosSubPageShell>
  );
}
