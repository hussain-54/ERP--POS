import { formatMoney, formatSaleDate } from "../sales-workspace";
import {
  originalPaymentLabel,
  remainingQtyTotal,
  returnedQtyTotal,
  selectedQtyTotal,
  type ParsedReturnableSale,
  type ReturnableDraft,
} from "../returns-workspace";
import { POSBadge } from "../design-system/POSBadge";
import { POSButton } from "../design-system/POSButton";
import { POSCard } from "../design-system/POSCard";
import { POSEmptyState } from "../design-system/POSEmptyState";
import { POSInput } from "../design-system/POSInput";
import { POSLoadingState } from "../design-system/POSLoadingState";
import { POSSearch } from "../design-system/POSSearch";
import { POSSelect } from "../design-system/POSSelect";

export function PosWorkflowAlert({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--pos-radius)] border border-[var(--pos-warning)] bg-[var(--pos-warning-soft)] px-3 py-2 text-sm text-[var(--pos-warning)]"
    >
      <strong className="block">This operation cannot continue as entered</strong>
      <ul className="mt-1 list-disc pl-4">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

export function PosSaleReview({
  sale,
  lines,
  refundAmount,
  compact = false,
}: {
  sale: ParsedReturnableSale;
  lines: ReturnableDraft[];
  refundAmount?: number | null;
  compact?: boolean;
}) {
  const customer =
    sale.customerName ?? (sale.hasCustomer ? sale.customerId : null) ?? "Walk-in";
  const payment = originalPaymentLabel(sale.originalPayments, sale.paidAmount);
  const thisReturnQty = selectedQtyTotal(lines);
  const fields = [
    { label: "Original invoice", value: sale.invoiceNumber || sale.saleId },
    { label: "Customer", value: sale.customerMobile ? `${customer} · ${sale.customerMobile}` : customer },
    { label: "Sale date", value: formatSaleDate(sale.saleDate) },
    { label: "Cashier", value: sale.cashierName ?? "—" },
    { label: "Original payment", value: payment },
    { label: "Returned quantity", value: String(returnedQtyTotal(lines)) },
    { label: "Remaining quantity", value: String(remainingQtyTotal(lines)) },
    {
      label: "Refund amount",
      value: refundAmount == null ? "—" : formatMoney(refundAmount),
    },
  ];

  return (
    <dl className={compact ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-2 md:grid-cols-2 xl:grid-cols-4"}>
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--pos-muted)]">{field.label}</dt>
          <dd className="truncate text-sm font-medium text-[var(--pos-ink)]">{field.value}</dd>
        </div>
      ))}
      {sale.status ? (
        <div className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--pos-muted)]">Status</dt>
          <dd>
            <POSBadge>{sale.status}</POSBadge>
            {thisReturnQty > 0 ? (
              <span className="ml-2 text-xs text-[var(--pos-muted)]">This return qty {thisReturnQty}</span>
            ) : null}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function PosInvoiceSearch({
  title,
  invoiceNumber,
  customerQuery,
  dateFrom,
  dateTo,
  warehouseId,
  warehouses,
  matches,
  busy,
  canSearch,
  onInvoiceNumber,
  onCustomerQuery,
  onDateFrom,
  onDateTo,
  onWarehouseId,
  onSearch,
  onSelect,
}: {
  title: string;
  invoiceNumber: string;
  customerQuery: string;
  dateFrom: string;
  dateTo: string;
  warehouseId: string;
  warehouses: Array<{ id: string; name: string }>;
  matches: Array<Record<string, unknown>>;
  busy: boolean;
  canSearch: boolean;
  onInvoiceNumber: (value: string) => void;
  onCustomerQuery: (value: string) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  onWarehouseId: (value: string) => void;
  onSearch: () => void;
  onSelect: (sale: Record<string, unknown>) => void;
}) {
  return (
    <POSCard title={title} description="Search posted invoices. Select one record to review before changing stock or money.">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        <POSSearch
          label="Invoice"
          placeholder="Invoice #"
          value={invoiceNumber}
          onChange={(e) => onInvoiceNumber(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
        />
        <POSInput
          label="Customer"
          value={customerQuery}
          onChange={(e) => onCustomerQuery(e.target.value)}
          placeholder="Name or mobile"
        />
        <POSInput label="Date from" type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} />
        <POSInput label="Date to" type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} />
        <POSSelect
          label="Warehouse"
          value={warehouseId}
          onChange={(e) => onWarehouseId(e.target.value)}
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
      </div>
      <div className="mt-3">
        <POSButton onClick={onSearch} loading={busy} disabled={!canSearch}>
          Search
        </POSButton>
      </div>
      {busy && !matches.length ? <POSLoadingState label="Searching invoices…" rows={4} className="mt-3" /> : null}
      <ul className="mt-3 max-h-64 divide-y overflow-auto text-sm">
        {matches.map((sale) => (
          <li key={String(sale.id)} className="flex items-center justify-between gap-2 py-2">
            <div>
              <strong>{String(sale.invoiceNumber ?? "")}</strong>
              <div className="text-[var(--pos-muted)]">
                {formatMoney(Number(sale.grandTotal ?? 0))} · {String(sale.status ?? "")}
                {sale.customerName ? ` · ${String(sale.customerName)}` : ""}
                {sale.createdAt || sale.created_at
                  ? ` · ${formatSaleDate(String(sale.createdAt ?? sale.created_at ?? ""))}`
                  : ""}
              </div>
            </div>
            <POSButton size="sm" variant="secondary" onClick={() => onSelect(sale)} disabled={busy}>
              Select
            </POSButton>
          </li>
        ))}
      </ul>
      {!busy && !matches.length ? (
        <POSEmptyState title="Search an invoice" description="Posted and previously returned invoices appear here." />
      ) : null}
    </POSCard>
  );
}
