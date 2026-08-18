import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { partiesApi } from "@/features/customers/parties-api";
import { posApi } from "./pos-api";
import { formatMoney } from "./sales-workspace";
import {
  INSTALLMENT_LINE_COLUMNS,
  INSTALLMENT_PLAN_COLUMNS,
  installmentStatusTone,
  parseInstallmentPlanRow,
  previewInstallmentSchedule,
  type InstallmentPlanRow,
} from "./installments-workspace";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSEmptyState,
  POSInput,
  POSLoadingState,
  POSPageHeader,
  POSSearch,
  POSSelect,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTd,
  POSTh,
} from "./design-system";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function InstallmentsPage() {
  const toast = useToast();
  const { branchId, hasPermission } = useAuth();
  const canManage = hasPermission("installments.manage");

  const [query, setQuery] = useState("");
  const [plans, setPlans] = useState<InstallmentPlanRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<Array<{ id: string; name: string }>>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");

  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceHits, setInvoiceHits] = useState<Array<Record<string, unknown>>>([]);
  const [saleId, setSaleId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [totalAmount, setTotalAmount] = useState("");
  const [downPayment, setDownPayment] = useState("0");
  const [installmentCount, setInstallmentCount] = useState("4");
  const [startDate, setStartDate] = useState(today);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly" | "quarterly">("monthly");
  const [asOf] = useState(today);

  const load = useCallback(async () => {
    if (!canManage) {
      setPlans([]);
      return;
    }
    setLoading(true);
    try {
      const res = await partiesApi.searchInstallmentPlans({
        branchId: branchId || undefined,
        limit: 50,
        offset: 0,
      });
      setPlans(res.items.map((row) => parseInstallmentPlanRow(row, asOf)));
    } catch (err) {
      toast.push({
        title: "Installments load failed",
        description: err instanceof Error ? err.message : "Requires installments.manage",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, [asOf, branchId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = plans.find((plan) => plan.id === selectedId) ?? null;
  const visiblePlans = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return plans;
    return plans.filter((plan) =>
      `${plan.planNumber} ${plan.customerName} ${plan.invoiceNumber} ${plan.status}`.toLowerCase().includes(
        needle,
      ),
    );
  }, [plans, query]);

  const preview = useMemo(() => {
    const count = Number(installmentCount);
    if (!(Number(totalAmount) > 0) || !(count > 0) || !startDate) return null;
    try {
      return previewInstallmentSchedule({
        totalAmount,
        downPayment: downPayment || "0",
        installmentCount: count,
        startDate,
        frequency,
      });
    } catch {
      return null;
    }
  }, [downPayment, frequency, installmentCount, startDate, totalAmount]);

  async function searchCustomers() {
    const q = customerQuery.trim();
    if (!q) {
      setCustomerHits([]);
      return;
    }
    try {
      const res = await partiesApi.listCustomers(q);
      setCustomerHits(res.items.map((c) => ({ id: String(c.id), name: String(c.name ?? "Customer") })));
    } catch (err) {
      toast.push({
        title: "Customer search failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function searchInvoices() {
    const q = invoiceQuery.trim();
    if (!q && !customerId) {
      setInvoiceHits([]);
      return;
    }
    try {
      const res = await posApi.searchSalesManagement({
        branchId: branchId || undefined,
        customerId: customerId || undefined,
        customerQuery: q || undefined,
        invoiceNumber: q || undefined,
        limit: 20,
        offset: 0,
      });
      setInvoiceHits(res.items ?? []);
    } catch (err) {
      toast.push({
        title: "Invoice search failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  function pickCustomer(id: string, name: string) {
    setCustomerId(id);
    setCustomerName(name);
    setCustomerHits([]);
    setCustomerQuery(name);
  }

  function pickInvoice(sale: Record<string, unknown>) {
    setSaleId(String(sale.id ?? ""));
    setInvoiceNumber(String(sale.invoiceNumber ?? sale.invoice_number ?? ""));
    const remaining = Number(sale.remainingTotal ?? sale.remaining_total ?? sale.grandTotal ?? sale.grand_total ?? 0);
    if (remaining > 0) setTotalAmount(String(remaining));
    if (sale.customerId || sale.customer_id) {
      setCustomerId(String(sale.customerId ?? sale.customer_id));
      setCustomerName(String(sale.customerName ?? sale.customer_name ?? customerName));
    }
    setInvoiceHits([]);
    setInvoiceQuery(String(sale.invoiceNumber ?? sale.invoice_number ?? ""));
  }

  async function createPlan() {
    if (!canManage) {
      toast.push({
        title: "Not permitted",
        description: "Creating plans requires installments.manage.",
        tone: "danger",
      });
      return;
    }
    if (!branchId) {
      toast.push({ title: "Select a branch", tone: "danger" });
      return;
    }
    if (!customerId || !saleId) {
      toast.push({
        title: "Customer and invoice required",
        description: "Search and select them. Do not paste IDs.",
        tone: "danger",
      });
      return;
    }
    setBusy(true);
    try {
      await partiesApi.createInstallmentPlan({
        branchId,
        customerId,
        sourceType: "sale",
        sourceId: saleId,
        totalAmount,
        downPayment: downPayment || "0",
        installmentCount: Number(installmentCount),
        startDate,
        frequency,
      });
      toast.push({ title: "Installment plan created", tone: "success" });
      setSaleId("");
      setInvoiceNumber("");
      setTotalAmount("");
      await load();
    } catch (err) {
      toast.push({
        title: "Plan failed",
        description: err instanceof Error ? err.message : "Could not create plan",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <POSPageHeader
        title="Installments"
        subtitle="Plans from installment_plans. Schedule math uses buildInstallmentPlan. There is no installment payment poster here — collect remaining on Payments or New Sale."
        actions={
          <POSButton variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </POSButton>
        }
      />

      {!canManage ? (
        <POSEmptyState
          title="Installments are not available"
          description="Creating and viewing plans requires installments.manage."
        />
      ) : null}

      <POSCard title="Create plan">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <POSSearch
                label="Customer"
                aria-label="Customer"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Name or mobile"
              />
              <POSButton
                size="sm"
                variant="ghost"
                className="mt-1"
                disabled={!canManage}
                onClick={() => void searchCustomers()}
              >
                Search customers
              </POSButton>
              {customerHits.length ? (
                <ul className="mt-1 max-h-32 overflow-auto text-sm">
                  {customerHits.map((c) => (
                    <li key={c.id}>
                      <POSButton size="sm" variant="ghost" onClick={() => pickCustomer(c.id, c.name)}>
                        {c.name}
                      </POSButton>
                    </li>
                  ))}
                </ul>
              ) : null}
              {customerName ? <p className="mt-1 text-xs text-[var(--pos-muted)]">Selected {customerName}</p> : null}
            </div>
            <div>
              <POSSearch
                label="Invoice"
                aria-label="Invoice"
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                placeholder="Invoice #"
              />
              <POSButton
                size="sm"
                variant="ghost"
                className="mt-1"
                disabled={!canManage}
                onClick={() => void searchInvoices()}
              >
                Search invoices
              </POSButton>
              {invoiceHits.length ? (
                <ul className="mt-1 max-h-32 overflow-auto text-sm">
                  {invoiceHits.map((sale) => (
                    <li key={String(sale.id)}>
                      <POSButton size="sm" variant="ghost" onClick={() => pickInvoice(sale)}>
                        {String(sale.invoiceNumber ?? sale.invoice_number)} · {formatMoney(Number(sale.grandTotal ?? 0))}
                      </POSButton>
                    </li>
                  ))}
                </ul>
              ) : null}
              {invoiceNumber ? <p className="mt-1 text-xs text-[var(--pos-muted)]">Selected {invoiceNumber}</p> : null}
            </div>
            <POSInput label="Total Amount" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            <POSInput label="Down payment" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
            <POSInput
              label="Installments"
              value={installmentCount}
              onChange={(e) => setInstallmentCount(e.target.value)}
            />
            <POSInput label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <POSSelect
              label="Frequency"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as "weekly" | "biweekly" | "monthly" | "quarterly")
              }
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "weekly", label: "Weekly" },
                { value: "biweekly", label: "Biweekly" },
                { value: "quarterly", label: "Quarterly" },
              ]}
            />
          </div>
          {preview ? (
            <p className="mt-2 text-xs text-[var(--pos-muted)]">
              Remaining {preview.remainingAmount} · period {preview.monthlyAmount} · first due{" "}
              {preview.schedule[0]?.dueDate ?? "—"}
            </p>
          ) : null}
          <div className="mt-3">
            <POSButton onClick={() => void createPlan()} disabled={busy || !canManage || !customerId || !saleId}>
              Create plan
            </POSButton>
          </div>
        </POSCard>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.9fr)]">
        <POSCard padding="none">
          <div className="p-3">
            <POSSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Plan, customer, invoice…"
            />
          </div>
          {loading && !plans.length ? (
            <POSLoadingState label="Loading installment plans…" rows={6} className="p-3" />
          ) : (
            <POSTable>
              <POSTableHead>
                <tr>
                  {INSTALLMENT_PLAN_COLUMNS.map((col) => (
                    <POSTh key={col}>{col}</POSTh>
                  ))}
                </tr>
              </POSTableHead>
              <POSTableBody>
                {visiblePlans.map((plan) => (
                  <tr key={plan.id} onClick={() => setSelectedId(plan.id)}>
                    <POSTd className="font-medium">{plan.planNumber}</POSTd>
                    <POSTd>{plan.customerName}</POSTd>
                    <POSTd>{plan.invoiceNumber}</POSTd>
                    <POSTd className="tabular-nums">{formatMoney(plan.totalAmount)}</POSTd>
                    <POSTd className="tabular-nums">{formatMoney(plan.paid)}</POSTd>
                    <POSTd className="tabular-nums">{formatMoney(plan.remaining)}</POSTd>
                    <POSTd>{plan.nextDueDate ?? "—"}</POSTd>
                    <POSTd>
                      <POSBadge tone={installmentStatusTone(plan.status)}>{plan.status}</POSBadge>
                    </POSTd>
                  </tr>
                ))}
              </POSTableBody>
            </POSTable>
          )}
        </POSCard>

        <POSCard title="Details">
          <POSTable>
            <POSTableHead>
              <tr>
                {INSTALLMENT_LINE_COLUMNS.map((col) => (
                  <POSTh key={col}>{col}</POSTh>
                ))}
              </tr>
            </POSTableHead>
            <POSTableBody>
              {(selected?.lines ?? []).map((line) => (
                <tr key={line.sequenceNo}>
                  <POSTd>{line.sequenceNo}</POSTd>
                  <POSTd>{line.dueDate}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(Number(line.amount))}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(Number(line.paid))}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(Number(line.remaining))}</POSTd>
                  <POSTd>
                    <POSBadge tone={installmentStatusTone(line.status)}>{line.status}</POSBadge>
                  </POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
          {!selected ? (
            <POSEmptyState title="Select a plan" description="Installment lines use stored schedule amounts." />
          ) : null}
        </POSCard>
      </div>
    </div>
  );
}
