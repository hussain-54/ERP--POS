import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { InvoiceView, SaleListRow, SaleManagementTab, SaleStatus } from "@electronic-erp/contracts";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@electronic-erp/ui";
import { posApi } from "../api";
import { money } from "../format";
import { resolveSalesDateRange, SALES_DATE_PRESETS, type SalesDatePreset } from "./dateRanges";
import { SalesPageShell } from "./SalesPageShell";
import { SaleDetailDrawer, SaleStatusBadge } from "./SaleDetailDrawer";
import { printInvoiceReceipt } from "../invoices/invoice-utils";
import "./sales-register.css";

export type SalesRegisterVariant = "all" | "completed" | "void" | "draft";

const VARIANT_CONFIG: Record<
  SalesRegisterVariant,
  { title: string; description: string; tab: SaleManagementTab; status?: SaleStatus }
> = {
  all: {
    title: "Sales register",
    description: "Search and filter POS sales for this branch.",
    tab: "all",
  },
  completed: {
    title: "Completed sales",
    description: "Posted and fully paid invoices.",
    tab: "completed",
  },
  void: {
    title: "Void / Cancelled sales",
    description: "Voided transactions for this branch.",
    tab: "cancelled",
  },
  draft: {
    title: "Server drafts",
    description: "Unfinished draft sales on the server.",
    tab: "pending",
    status: "draft",
  },
};

function resolveTabAndStatus(
  variant: SalesRegisterVariant,
  statusFilter: string,
): { tab: SaleManagementTab; status?: SaleStatus } {
  const cfg = VARIANT_CONFIG[variant];
  if (variant !== "all") {
    return { tab: cfg.tab, status: cfg.status };
  }
  if (statusFilter === "draft" || statusFilter === "held") {
    return { tab: "pending", status: statusFilter as SaleStatus };
  }
  if (statusFilter === "void") {
    return { tab: "cancelled", status: "void" };
  }
  if (statusFilter === "posted") {
    return { tab: "completed" };
  }
  return { tab: "all" };
}

export function SalesRegister({
  variant,
  embedded = false,
}: {
  variant: SalesRegisterVariant;
  /** When true, omit page chrome (used inside DraftSalesRegister). */
  embedded?: boolean;
}) {
  const cfg = VARIANT_CONFIG[variant];
  const { branchId, hasPermission } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentQuery, setPaymentQuery] = useState("");
  const [preset, setPreset] = useState<SalesDatePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [items, setItems] = useState<SaleListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SaleListRow | null>(null);
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const dates = useMemo(
    () => resolveSalesDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const queryShape = useMemo(
    () => resolveTabAndStatus(variant, statusFilter),
    [variant, statusFilter],
  );

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await posApi.searchSalesManagement({
        branchId,
        tab: queryShape.tab,
        status: queryShape.status,
        dateFrom: dates.dateFrom,
        dateTo: dates.dateTo,
        customerQuery: q.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      let rows = res.items;
      if (variant === "draft") {
        rows = rows.filter((r) => r.status === "draft");
      }
      if (paymentQuery.trim()) {
        const needle = paymentQuery.trim().toLowerCase();
        rows = rows.filter((r) => (r.paymentMethods ?? "").toLowerCase().includes(needle));
      }
      setItems(rows);
      setTotal(variant === "draft" || paymentQuery.trim() ? rows.length : res.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      push({
        title: "Could not load sales",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [
    branchId,
    queryShape.tab,
    queryShape.status,
    dates.dateFrom,
    dates.dateTo,
    q,
    invoiceNumber,
    paymentQuery,
    variant,
    push,
  ]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(id);
  }, [load]);

  async function openDetail(row: SaleListRow) {
    setSelected(row);
    setInvoice(null);
    setDetailLoading(true);
    try {
      const inv = await posApi.getInvoice(row.id);
      setInvoice(inv);
    } catch {
      setInvoice(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function reprint() {
    if (!invoice) return;
    if (!printInvoiceReceipt(invoice, "thermal", undefined, true)) {
      push({ title: "Popup blocked", description: "Allow popups to reprint.", tone: "danger" });
    }
  }

  function goReturn(refund: boolean) {
    if (!selected) return;
    navigate("/pos/returns", {
      state: { saleId: selected.id, mode: refund ? "refund" : "return" },
    });
  }

  function duplicateSale() {
    if (!invoice) {
      push({ title: "Nothing to repeat", tone: "danger" });
      return;
    }
    const itemCount = invoice.items?.length ?? 0;
    navigate("/pos/sales/new", {
      state: {
        resumeSnapshot: {
          cart: [],
          customerId: invoice.sale?.customerId ?? "",
          customerName: invoice.customerName ?? null,
          walkIn: !invoice.sale?.customerId,
          invoiceDiscount: "0",
          notes: `Repeat of ${invoice.invoiceNumber ?? "sale"} — re-add ${itemCount} item(s)`,
        },
      },
    });
  }

  function onVoid() {
    push({
      title: "Void not available",
      description: "Posted-sale void is not exposed by the API yet. Use return/refund where allowed.",
      tone: "danger",
    });
  }

  const showStatusFilter = variant === "all";
  /** Posted-sale void is not API-backed yet — keep action visible but disabled. */
  const canVoid = false;

  const body = (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
          <div className="flex flex-wrap gap-1.5">
            {SALES_DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                  preset === p.id ? "bg-[var(--pos-primary)] text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              />
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customer / mobile / SKU…"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Invoice number"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={paymentQuery}
              onChange={(e) => setPaymentQuery(e.target.value)}
              placeholder="Payment method"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            {showStatusFilter ? (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="held">Held</option>
                <option value="draft">Draft</option>
                <option value="posted">Completed</option>
                <option value="void">Void / Cancelled</option>
              </select>
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                {total} result{total === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-6 text-sm text-slate-400">Loading sales…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No sales match these filters.</p>
          ) : (
            <table className="pos-sales-table w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-bold">Invoice</th>
                  <th className="px-3 py-2 font-bold">Customer</th>
                  <th className="px-3 py-2 font-bold">Cashier</th>
                  <th className="px-3 py-2 font-bold">Date</th>
                  <th className="px-3 py-2 font-bold">Payment</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/40"
                    onClick={() => void openDetail(row)}
                  >
                    <td className="px-3 py-2.5 font-bold text-slate-900">{row.invoiceNumber}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.customerName ?? "Walk-in"}</td>
                    <td className="px-3 py-2.5 text-slate-600">{row.cashierName ?? "—"}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{row.paymentMethods ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <SaleStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                      {money(Number(row.grandTotal))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <SaleDetailDrawer
        open={Boolean(selected)}
        loading={detailLoading}
        row={selected}
        invoice={invoice}
        onClose={() => {
          setSelected(null);
          setInvoice(null);
        }}
        onReprint={reprint}
        onReturn={() => goReturn(false)}
        onRefund={() => goReturn(true)}
        onVoid={onVoid}
        onDuplicate={duplicateSale}
        canReturn={hasPermission("pos.return")}
        canVoid={canVoid}
      />
    </>
  );

  if (embedded) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>;
  }

  return (
    <SalesPageShell
      title={cfg.title}
      description={cfg.description}
      actions={
        <>
          <Link to="/pos/sales/new" className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white">
            New Sale
          </Link>
          <Link
            to="/pos/sales/held"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Held
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Refresh
          </button>
        </>
      }
    >
      {body}
    </SalesPageShell>
  );
}
