import { useEffect, useMemo, useRef, useState } from "react";
import type { InvoiceAction } from "@electronic-erp/domain";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { partiesApi } from "@/features/customers/parties-api";
import { adminApi } from "@/features/users/admin-api";
import { mapSalesmanEmployees } from "@/features/salesman/SalesmanPage";
import { enterpriseApi } from "@/features/system/enterprise-api";
import { infrastructureApi } from "@/features/system/infrastructure-api";
import { posApi } from "./pos-api";
import { ReceiptPreview, type InvoicePreview } from "./components/ReceiptPreview";
import {
  customerLabel,
  emptySaleFilters,
  formatMoney,
  formatSaleDate,
  INVOICE_TABLE_COLUMNS,
  kpiDisplay,
  parseSaleRow,
  parseSaleSummary,
  SALE_KPI_CARDS,
  SALE_PAGE_SIZE,
  SALE_STATUS_FILTERS,
  SALE_TABS,
  saleColumnClassName,
  saleStatusLabel,
  saleStatusTone,
  terminalLabel,
  type SaleFilterState,
  type SaleRow,
  type SaleSummary,
  type SaleTab,
} from "./sales-workspace";
import {
  POSBadge,
  POSBreadcrumb,
  POSButton,
  POSCard,
  POSEmptyState,
  POSErrorState,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSSearch,
  POSSelect,
  POSStatCard,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTabs,
  POSTd,
  POSTh,
} from "./design-system";

function namedOptions(
  items: Array<{ id: string; name: string }>,
  empty: string,
): Array<{ value: string; label: string }> {
  return [{ value: "", label: empty }, ...items.map((item) => ({ value: item.id, label: item.name }))];
}

function filtersToQuery(
  filters: SaleFilterState,
  tab: SaleTab,
  offset: number,
  fallbackBranchId?: string | null,
) {
  return {
    branchId: filters.branchId || fallbackBranchId || undefined,
    tab,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    customerId: filters.customerId || undefined,
    customerQuery: filters.search.trim() || undefined,
    cashierUserId: filters.cashierUserId || undefined,
    salesmanUserId: filters.salesmanUserId || undefined,
    paymentMethodId: filters.paymentMethodId || undefined,
    deviceId: filters.deviceId || undefined,
    status: filters.status || undefined,
    limit: SALE_PAGE_SIZE,
    offset,
  };
}

export function SalesWorkspace({
  title = "Sales Dashboard",
  subtitle = "Retail transaction register from live POS sales.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const toast = useToast();
  const { branchId } = useAuth();
  const loadGen = useRef(0);

  const [tab, setTab] = useState<SaleTab>("all");
  const [draft, setDraft] = useState<SaleFilterState>(() => emptySaleFilters(branchId ?? ""));
  const [applied, setApplied] = useState<SaleFilterState>(() => emptySaleFilters(branchId ?? ""));
  const [moreOpen, setMoreOpen] = useState(false);

  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [cashiers, setCashiers] = useState<Array<{ id: string; name: string }>>([]);
  const [salesmen, setSalesmen] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [terminals, setTerminals] = useState<Array<{ id: string; name: string }>>([]);
  const [terminalNames, setTerminalNames] = useState<Record<string, string>>({});
  const [moreLoaded, setMoreLoaded] = useState(false);

  const [summary, setSummary] = useState<SaleSummary | null>(null);
  const [items, setItems] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [format, setFormat] = useState<"80mm" | "58mm" | "a4">("80mm");
  const [autoAction, setAutoAction] = useState<InvoiceAction | undefined>(undefined);
  const [moreId, setMoreId] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;
    setDraft((current) => (current.branchId ? current : { ...current, branchId }));
    setApplied((current) => (current.branchId ? current : { ...current, branchId }));
  }, [branchId]);

  const queryParams = useMemo(
    () => filtersToQuery(applied, tab, offset, branchId),
    [applied, tab, offset, branchId],
  );

  useEffect(() => {
    const gen = ++loadGen.current;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const res = await posApi.searchSalesManagement(queryParams);
        if (gen !== loadGen.current) return;
        setSummary(parseSaleSummary(res.summary));
        setItems(res.items.map((row) => parseSaleRow(row)));
        setTotal(res.total);
      } catch (err) {
        if (gen !== loadGen.current) return;
        const message = err instanceof Error ? err.message : "Please try again";
        setLoadError(message);
        if (message !== "Not authenticated") {
          toast.push({ title: "Sales load failed", description: message, tone: "danger" });
        }
      } finally {
        if (gen === loadGen.current) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    try {
      void partiesApi
        .listCustomers()
        .then((res) => {
          if (cancelled) return;
          setCustomers(res.items.map((customer) => ({ id: String(customer.id), name: String(customer.name ?? "Customer") })));
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void adminApi
        .listUsers()
        .then((res) => {
          if (cancelled) return;
          setCashiers(
            res.items
              .map((user) => ({
                id: String(user.id ?? ""),
                name: String(user.full_name ?? user.fullName ?? user.email ?? "Cashier"),
              }))
              .filter((user) => user.id),
          );
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void partiesApi
        .listPaymentMethods()
        .then((res) => {
          if (cancelled) return;
          setPaymentMethods(
            res.items.map((method) => ({
              id: String(method.id),
              name: String(method.name ?? method.code ?? "Payment"),
            })),
          );
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void enterpriseApi
        .listEmployees()
        .then((res) => {
          if (cancelled) return;
          setSalesmen(mapSalesmanEmployees(res.items).map((salesman) => ({ id: salesman.id, name: salesman.name })));
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!moreOpen || moreLoaded) return;
    let cancelled = false;
    try {
      void adminApi
        .listBranches()
        .then((res) => {
          if (cancelled) return;
          setBranches(
            res.items
              .map((branch) => ({ id: String(branch.id ?? ""), name: String(branch.name ?? "Branch") }))
              .filter((branch) => branch.id),
          );
        })
        .catch(() => undefined);
    } catch {
      /* not signed in */
    }
    try {
      void infrastructureApi
        .devices()
        .then((res) => {
          if (cancelled) return;
          const list: Array<{ id: string; name: string }> = [];
          const names: Record<string, string> = {};
          for (const device of res.items) {
            const id = String(device.id ?? device.device_id ?? "");
            if (!id) continue;
            const name = String(device.name ?? device.label ?? device.code ?? "Terminal");
            list.push({ id, name });
            names[id] = name;
          }
          setTerminals(list);
          setTerminalNames(names);
          setMoreLoaded(true);
        })
        .catch(() => undefined);
    } catch {
      /* devices list is optional */
    }
    return () => {
      cancelled = true;
    };
  }, [moreOpen, moreLoaded]);

  function patchDraft<K extends keyof SaleFilterState>(key: K, value: SaleFilterState[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applySearch() {
    setApplied(draft);
    setOffset(0);
    setReloadNonce((value) => value + 1);
  }

  function resetFilters() {
    const next = emptySaleFilters(branchId ?? "");
    setDraft(next);
    setApplied(next);
    setTab("all");
    setOffset(0);
  }

  function changeTab(next: SaleTab) {
    setTab(next);
    setOffset(0);
  }

  async function openInvoice(id: string, action?: InvoiceAction) {
    try {
      const inv = (await posApi.getInvoice(id)) as InvoicePreview;
      setAutoAction(action);
      setInvoice(inv);
      setMoreId(null);
    } catch (err) {
      toast.push({
        title: "Invoice load failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    }
  }

  async function exportCsv() {
    try {
      const csv = await posApi.exportSalesManagement({ ...queryParams, limit: 100, offset: 0 });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-${applied.dateFrom}-${applied.dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push({ title: "Export ready", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    }
  }

  const page = Math.floor(offset / SALE_PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / SALE_PAGE_SIZE));

  function rowActions(sale: SaleRow) {
    return (
      <div className="relative flex flex-nowrap items-center gap-1">
        <POSButton size="sm" variant="ghost" onClick={() => void openInvoice(sale.id)}>
          View
        </POSButton>
        <POSButton size="sm" variant="ghost" onClick={() => void openInvoice(sale.id, "print_80mm")}>
          Print
        </POSButton>
        <POSButton
          size="sm"
          variant="ghost"
          aria-expanded={moreId === sale.id}
          onClick={(event) => {
            event.stopPropagation();
            setMoreId((id) => (id === sale.id ? null : sale.id));
          }}
        >
          More
        </POSButton>
        {moreId === sale.id ? (
          <div className="absolute right-0 top-8 z-20 min-w-[10rem] rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] bg-[var(--pos-workspace)] py-1 shadow-[var(--pos-shadow-md)]">
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--pos-muted-bg)]"
              onClick={() => void openInvoice(sale.id, "download_pdf")}
            >
              Preview / PDF
            </button>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--pos-muted-bg)]"
              onClick={() => void openInvoice(sale.id, "save")}
            >
              Download
            </button>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--pos-muted-bg)]"
              onClick={() => void openInvoice(sale.id, "whatsapp")}
            >
              WhatsApp
            </button>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--pos-muted-bg)]"
              onClick={() => void openInvoice(sale.id, "email")}
            >
              Email
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3">
      <div className="shrink-0 space-y-3">
        <POSBreadcrumb
          items={[
            { label: "Home", to: "/" },
            { label: "Sales Management", to: "/pos/reports" },
            { label: "Sales Dashboard" },
          ]}
        />
        <POSPageHeader
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <POSButton variant="primary" size="sm" onClick={applySearch} disabled={loading}>
                Search
              </POSButton>
              <POSButton variant="ghost" size="sm" onClick={resetFilters} disabled={loading}>
                Reset
              </POSButton>
              <POSButton variant="secondary" size="sm" onClick={() => void exportCsv()}>
                Export
              </POSButton>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {SALE_KPI_CARDS.map((card) => (
            <POSStatCard
              key={card.id}
              label={card.label}
              value={kpiDisplay(summary, card.id)}
              tone={card.tone}
            />
          ))}
        </div>

        <POSCard padding="sm">
          <div className="mb-2">
            <POSSearch
              label="Search"
              placeholder="Search by invoice #, customer, phone, SKU…"
              value={draft.search}
              onChange={(event) => patchDraft("search", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <fieldset className="xl:col-span-2">
              <legend className="mb-1 text-sm font-medium text-[var(--pos-ink)]">Date Range</legend>
              <div className="grid grid-cols-2 gap-2">
                <POSInput
                  aria-label="Date from"
                  type="date"
                  value={draft.dateFrom}
                  onChange={(event) => patchDraft("dateFrom", event.target.value)}
                />
                <POSInput
                  aria-label="Date to"
                  type="date"
                  value={draft.dateTo}
                  onChange={(event) => patchDraft("dateTo", event.target.value)}
                />
              </div>
            </fieldset>
            <POSSelect
              compact
              label="Customer"
              value={draft.customerId}
              onChange={(event) => patchDraft("customerId", event.target.value)}
              options={namedOptions(customers, "All customers")}
            />
            <POSSelect
              compact
              label="Cashier"
              value={draft.cashierUserId}
              onChange={(event) => patchDraft("cashierUserId", event.target.value)}
              options={namedOptions(cashiers, "All cashiers")}
            />
            <POSSelect
              compact
              label="Salesman"
              value={draft.salesmanUserId}
              onChange={(event) => patchDraft("salesmanUserId", event.target.value)}
              options={namedOptions(salesmen, "All salesmen")}
            />
            <POSSelect
              compact
              label="Payment Method"
              value={draft.paymentMethodId}
              onChange={(event) => patchDraft("paymentMethodId", event.target.value)}
              options={namedOptions(paymentMethods, "All methods")}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <POSButton
              size="sm"
              variant={moreOpen ? "primary" : "ghost"}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((value) => !value)}
            >
              More Filters
            </POSButton>
          </div>
          {moreOpen ? (
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <POSSelect
                compact
                label="Status"
                value={draft.status}
                onChange={(event) => patchDraft("status", event.target.value)}
                options={SALE_STATUS_FILTERS.map((item) => ({ value: item.value, label: item.label }))}
              />
              <POSSelect
                compact
                label="Branch"
                value={draft.branchId}
                onChange={(event) => patchDraft("branchId", event.target.value)}
                options={namedOptions(branches, "Current branch")}
              />
              <POSSelect
                compact
                label="Terminal"
                value={draft.deviceId}
                onChange={(event) => patchDraft("deviceId", event.target.value)}
                options={namedOptions(terminals, "All terminals")}
              />
            </div>
          ) : null}
        </POSCard>

        <POSTabs items={SALE_TABS} value={tab} onChange={changeTab} />
      </div>

      <POSCard padding="none" className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <POSTable className="pos-register-table">
            <POSTableHead>
              <tr>
                {INVOICE_TABLE_COLUMNS.map((col) => (
                  <POSTh key={col} className={saleColumnClassName(col)}>
                    {col}
                  </POSTh>
                ))}
              </tr>
            </POSTableHead>
            <POSTableBody>
              {items.map((sale) => (
                <tr key={sale.id}>
                  <POSTd className={saleColumnClassName("Invoice #")}>
                    <span className="font-medium">{sale.invoiceNumber}</span>
                  </POSTd>
                  <POSTd className={`whitespace-nowrap ${saleColumnClassName("Date / Time")}`}>
                    {formatSaleDate(sale.postedAt ?? sale.createdAt)}
                  </POSTd>
                  <POSTd className={saleColumnClassName("Customer")}>
                    <div>{customerLabel(sale)}</div>
                    {sale.customerMobile ? (
                      <div className="text-[11px] text-[var(--pos-muted)]">{sale.customerMobile}</div>
                    ) : null}
                  </POSTd>
                  <POSTd className={saleColumnClassName("Cashier")}>{sale.cashierName?.trim() || "Cashier"}</POSTd>
                  <POSTd className={saleColumnClassName("Salesman")}>{sale.salesmanName?.trim() || "—"}</POSTd>
                  <POSTd className={saleColumnClassName("Items")}>{sale.itemCount ?? 0}</POSTd>
                  <POSTd className={saleColumnClassName("Total Amount")}>{formatMoney(sale.grandTotal)}</POSTd>
                  <POSTd className={saleColumnClassName("Paid Amount")}>{formatMoney(sale.paidTotal)}</POSTd>
                  <POSTd className={saleColumnClassName("Remaining")}>{formatMoney(sale.remainingTotal)}</POSTd>
                  <POSTd className={saleColumnClassName("Payment Method")}>{sale.paymentMethods?.trim() || "—"}</POSTd>
                  <POSTd className={saleColumnClassName("Status")}>
                    <POSBadge tone={saleStatusTone(sale.status, sale.paymentStatus)}>
                      {saleStatusLabel(sale.status, sale.paymentStatus)}
                    </POSBadge>
                    {sale.deviceId ? (
                      <div className="mt-0.5 hidden text-[10px] text-[var(--pos-muted)] xl:block">
                        {terminalLabel(sale.deviceId, terminalNames)}
                      </div>
                    ) : null}
                  </POSTd>
                  <POSTd className={saleColumnClassName("Action")}>{rowActions(sale)}</POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
          {loading && items.length === 0 ? (
            <POSLoadingState label="Loading sales…" rows={8} className="p-3" />
          ) : null}
          {loadError && items.length === 0 ? (
            <POSErrorState title="Could not load sales" description={loadError} onAction={applySearch} />
          ) : null}
          {!loading && !loadError && items.length === 0 ? (
            <POSEmptyState
              title="No sales in this register"
              description="Posted tickets matching these filters will appear here. Totals come from the live sales-management API."
            />
          ) : null}
        </div>
        {total > SALE_PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-2 border-t border-[var(--pos-border)] px-3 py-2 text-sm">
            <span className="text-[var(--pos-muted)]">
              {total} sale{total === 1 ? "" : "s"} · page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <POSButton
                size="sm"
                variant="secondary"
                disabled={offset <= 0 || loading}
                onClick={() => setOffset((value) => Math.max(0, value - SALE_PAGE_SIZE))}
              >
                Previous
              </POSButton>
              <POSButton
                size="sm"
                variant="secondary"
                disabled={offset + SALE_PAGE_SIZE >= total || loading}
                onClick={() => setOffset((value) => value + SALE_PAGE_SIZE)}
              >
                Next
              </POSButton>
            </div>
          </div>
        ) : null}
      </POSCard>

      {invoice ? (
        <ReceiptPreview
          invoice={invoice}
          format={format}
          autoAction={autoAction}
          onFormatChange={setFormat}
          onClose={() => {
            setInvoice(null);
            setAutoAction(undefined);
          }}
        />
      ) : null}
    </div>
  );
}
