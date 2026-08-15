import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { adminApi } from "@/features/users/admin-api";
import { partiesApi } from "@/features/customers/parties-api";
import { reportingApi } from "@/features/reports/reporting-api";
import { mapSalesmanEmployees } from "@/features/salesman/SalesmanPage";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { posApi } from "./pos-api";
import { ReceiptPreview, type InvoicePreview } from "./components/ReceiptPreview";

type Tab = "all" | "completed" | "credit" | "partial" | "cancelled" | "pending";

type SaleRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  postedAt?: string | null;
  customerName?: string | null;
  cashierName?: string | null;
  salesmanName?: string | null;
  itemCount?: number;
  grandTotal: number;
  paidTotal: number;
  remainingTotal: number;
  paymentMethods?: string | null;
  status: string;
  paymentStatus: string;
};

type Summary = {
  totalSales: number;
  totalInvoices: number;
  netSales: number;
  totalDiscount: number;
  totalTax: number;
  pendingAmount: number;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "All Sales" },
  { id: "completed", label: "Completed" },
  { id: "credit", label: "Credit Sales" },
  { id: "partial", label: "Partial Payments" },
  { id: "cancelled", label: "Cancelled" },
  { id: "pending", label: "Pending" },
];

const REPORT_DIMS = [
  "daily",
  "weekly",
  "monthly",
  "product",
  "customer",
  "brand",
  "category",
  "salesman",
  "cash",
] as const;

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3">
      <div className="text-xs uppercase tracking-wide text-[var(--erp-muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        {typeof value === "number" ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
      </div>
    </div>
  );
}

function defaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export function SalesManagementPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [tab, setTab] = useState<Tab>("all");
  const [dates, setDates] = useState(defaultDates);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [cashierUserId, setCashierUserId] = useState("");
  const [salesmanUserId, setSalesmanUserId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [salesmen, setSalesmen] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentMethods, setPaymentMethods] = useState<Array<Record<string, unknown>>>([]);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [format, setFormat] = useState<"80mm" | "58mm" | "a4">("80mm");
  const [reportDim, setReportDim] = useState<string>("daily");
  const [reportOutput, setReportOutput] = useState<unknown>(null);

  const queryParams = useMemo(
    () => ({
      branchId: branchId ?? undefined,
      tab,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      customerId: customerId || undefined,
      customerQuery: customerQuery || undefined,
      cashierUserId: cashierUserId || undefined,
      salesmanUserId: salesmanUserId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      invoiceNumber: invoiceNumber || undefined,
      warehouseId: warehouseId || undefined,
      status: status || undefined,
      paymentStatus: paymentStatus || undefined,
      limit,
      offset,
    }),
    [
      branchId,
      tab,
      dates,
      customerId,
      customerQuery,
      cashierUserId,
      salesmanUserId,
      paymentMethodId,
      invoiceNumber,
      warehouseId,
      status,
      paymentStatus,
      offset,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await posApi.searchSalesManagement(queryParams);
      setSummary(res.summary as Summary);
      setItems(res.items as SaleRow[]);
      setTotal(res.total);
    } catch (err) {
      toast.push({
        title: "Sales load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [queryParams, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void Promise.all([
      partiesApi.listCustomers().then((r) => setCustomers(r.items)),
      adminApi.listUsers().then((r) => setUsers(r.items)),
      partiesApi.listPaymentMethods().then((r) => setPaymentMethods(r.items)),
      enterpriseApi.listEmployees().then((r) =>
        setSalesmen(
          mapSalesmanEmployees(r.items).map((s) => ({ id: s.id, name: s.name })),
        ),
      ),
    ]).catch(() => undefined);
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [tab, dates, customerId, customerQuery, cashierUserId, salesmanUserId, paymentMethodId, invoiceNumber, warehouseId, status, paymentStatus]);

  async function openInvoice(id: string) {
    try {
      const inv = (await posApi.getInvoice(id)) as InvoicePreview;
      setInvoice(inv);
    } catch (err) {
      toast.push({
        title: "Invoice load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function exportCsv() {
    try {
      const csv = await posApi.exportSalesManagement({ ...queryParams, limit: 5000, offset: 0 });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-${dates.dateFrom}-${dates.dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push({ title: "Export ready", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function runReport() {
    try {
      const data = await reportingApi.sales(reportDim, {
        from: dates.dateFrom,
        to: dates.dateTo,
        branchId: branchId ?? undefined,
        salesmanUserId: salesmanUserId || undefined,
        period: "custom",
      });
      setReportOutput(data);
    } catch (err) {
      toast.push({
        title: "Report failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales Management</h1>
          <p className="text-sm text-[var(--erp-muted)]">
            Live sales register with filters, KPIs, and reports from posted transactions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportCsv()}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total Sales" value={summary?.totalSales ?? 0} />
        <Kpi label="Total Invoices" value={summary?.totalInvoices ?? 0} />
        <Kpi label="Net Sales" value={summary?.netSales ?? 0} />
        <Kpi label="Total Discount" value={summary?.totalDiscount ?? 0} />
        <Kpi label="Total Tax" value={summary?.totalTax ?? 0} />
        <Kpi label="Pending Amount" value={summary?.pendingAmount ?? 0} />
      </div>

      <Card title="Filters">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Date from"
            type="date"
            value={dates.dateFrom}
            onChange={(e) => setDates((d) => ({ ...d, dateFrom: e.target.value }))}
          />
          <Input
            label="Date to"
            type="date"
            value={dates.dateTo}
            onChange={(e) => setDates((d) => ({ ...d, dateTo: e.target.value }))}
          />
          <Select
            label="Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={[
              { value: "", label: "All customers" },
              ...customers.map((c) => ({
                value: String(c.id),
                label: String(c.name ?? c.code ?? c.id),
              })),
            ]}
          />
          <Input
            label="Customer search"
            placeholder="Name or mobile"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
          />
          <Select
            label="Cashier"
            value={cashierUserId}
            onChange={(e) => setCashierUserId(e.target.value)}
            options={[
              { value: "", label: "All cashiers" },
              ...users.map((u) => ({
                value: String(u.id),
                label: String(u.full_name ?? u.email ?? u.id),
              })),
            ]}
          />
          <Select
            label="Salesman"
            value={salesmanUserId}
            onChange={(e) => setSalesmanUserId(e.target.value)}
            options={[
              { value: "", label: "All salesmen" },
              ...salesmen.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            label="Payment method"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            options={[
              { value: "", label: "All methods" },
              ...paymentMethods.map((m) => ({
                value: String(m.id),
                label: String(m.name ?? m.code ?? m.id),
              })),
            ]}
          />
          <Input
            label="Invoice #"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowMoreFilters((v) => !v)}
          >
            {showMoreFilters ? "Hide" : "More"} filters
          </Button>
        </div>
        {showMoreFilters ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Input
              label="Warehouse id"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "", label: "Any" },
                { value: "posted", label: "Posted" },
                { value: "void", label: "Void" },
                { value: "returned", label: "Returned" },
                { value: "exchanged", label: "Exchanged" },
              ]}
            />
            <Select
              label="Payment status"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              options={[
                { value: "", label: "Any" },
                { value: "paid", label: "Paid" },
                { value: "partial", label: "Partial" },
                { value: "unpaid", label: "Unpaid" },
                { value: "refunded", label: "Refunded" },
              ]}
            />
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-[var(--erp-border)] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-[var(--erp-brand)] text-white"
                : "bg-[var(--erp-surface)] text-[var(--erp-muted)]"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--erp-border)] text-left text-[var(--erp-muted)]">
                <th className="px-2 py-2">Invoice</th>
                <th className="px-2 py-2">Date / time</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Cashier</th>
                <th className="px-2 py-2">Salesman</th>
                <th className="px-2 py-2 text-right">Items</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right">Paid</th>
                <th className="px-2 py-2 text-right">Remaining</th>
                <th className="px-2 py-2">Payment</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-[var(--erp-border)]/60">
                  <td className="px-2 py-2 font-medium">{s.invoiceNumber}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {new Date(s.postedAt ?? s.createdAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2">{s.customerName ?? "Walk-in"}</td>
                  <td className="px-2 py-2">{s.cashierName ?? "—"}</td>
                  <td className="px-2 py-2">{s.salesmanName ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{s.itemCount ?? 0}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Number(s.grandTotal).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Number(s.paidTotal).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Number(s.remainingTotal).toFixed(2)}
                  </td>
                  <td className="px-2 py-2">{s.paymentMethods ?? "—"}</td>
                  <td className="px-2 py-2">
                    {s.status} / {s.paymentStatus}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => void openInvoice(s.id)}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void openInvoice(s.id)}>
                        Print
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void openInvoice(s.id)}>
                        Invoice
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-[var(--erp-muted)]">
                    {loading ? "Loading…" : "No sales found for current filters"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">
          {items.map((s) => (
            <div key={s.id} className="rounded-lg border border-[var(--erp-border)] p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{s.invoiceNumber}</div>
                  <div className="text-xs text-[var(--erp-muted)]">
                    {new Date(s.postedAt ?? s.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className="rounded bg-[var(--erp-surface)] px-2 py-0.5 text-xs">
                  {s.status} / {s.paymentStatus}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--erp-muted)]">
                <div>Customer: {s.customerName ?? "Walk-in"}</div>
                <div>Cashier: {s.cashierName ?? "—"}</div>
                <div>Salesman: {s.salesmanName ?? "—"}</div>
                <div>Items: {s.itemCount ?? 0}</div>
                <div>Total: {Number(s.grandTotal).toFixed(2)}</div>
                <div>Paid: {Number(s.paidTotal).toFixed(2)}</div>
                <div>Due: {Number(s.remainingTotal).toFixed(2)}</div>
                <div>Pay: {s.paymentMethods ?? "—"}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => void openInvoice(s.id)}>
                  View
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void openInvoice(s.id)}>
                  Print
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void openInvoice(s.id)}>
                  Invoice
                </Button>
              </div>
            </div>
          ))}
          {!items.length ? (
            <div className="rounded-lg border border-dashed border-[var(--erp-border)] px-3 py-8 text-center text-sm text-[var(--erp-muted)]">
              {loading ? "Loading…" : "No sales found for current filters"}
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span className="text-[var(--erp-muted)]">
            {total} sale{total === 1 ? "" : "s"} · page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={offset <= 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={offset + limit >= total || loading}
              onClick={() => setOffset((o) => o + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Sales reports">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Report"
            value={reportDim}
            onChange={(e) => setReportDim(e.target.value)}
            options={REPORT_DIMS.map((d) => ({
              value: d,
              label: d === "cash" ? "payment method" : d,
            }))}
          />
          <Button type="button" onClick={() => void runReport()}>
            Run report
          </Button>
        </div>
        {reportOutput ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded bg-black/5 p-3 text-xs">
            {JSON.stringify(reportOutput, null, 2)}
          </pre>
        ) : null}
      </Card>

      {invoice ? (
        <ReceiptPreview
          invoice={invoice}
          format={format}
          onFormatChange={setFormat}
          onClose={() => setInvoice(null)}
        />
      ) : null}
    </div>
  );
}
