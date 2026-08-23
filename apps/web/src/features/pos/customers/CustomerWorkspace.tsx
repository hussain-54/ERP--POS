import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import type { Customer, PartyLedgerEntry, SaleListRow } from "@electronic-erp/contracts";
import { useAuth } from "@/features/auth/AuthContext";
import { partiesApi } from "@/features/customers/parties-api";
import { commerceApi } from "@/features/crm/commerce-api";
import { useToast } from "@electronic-erp/ui";
import { posApi } from "../api";
import { money } from "../format";
import { emptyCustomer } from "../types";
import { PosSubPageShell } from "../PosSubPageShell";
import { CustomerSearchPanel } from "./CustomerSearchPanel";
import {
  enrichCustomerForPos,
  getFocusedCustomerId,
  setFocusedCustomerId,
} from "./customer-utils";

export type CustomerWorkspaceMode =
  | "select"
  | "walk-in"
  | "new"
  | "profile"
  | "history"
  | "ledger"
  | "credit"
  | "loyalty";

const TITLES: Record<CustomerWorkspaceMode, { title: string; description: string }> = {
  select: {
    title: "Customer selection",
    description: "Find a customer by name, phone, or code and attach them to the sale.",
  },
  "walk-in": {
    title: "Walk-in customer",
    description: "Continue checkout without a named customer profile.",
  },
  new: {
    title: "New customer",
    description: "Quick create for cashiers — uses the same Customers API as ERP.",
  },
  profile: {
    title: "Customer profile",
    description: "Cashier view of balances, credit, and contact details.",
  },
  history: {
    title: "Purchase history",
    description: "Recent POS sales for the selected customer.",
  },
  ledger: {
    title: "Customer ledger",
    description: "Ledger entries for the selected customer.",
  },
  credit: {
    title: "Credit / Udhar",
    description: "Credit limit, outstanding, and approval request.",
  },
  loyalty: {
    title: "Loyalty / Points",
    description: "Points balance and recent loyalty activity.",
  },
};

function CustomerGate({
  customer,
  onPick,
  children,
}: {
  customer: Customer | null;
  onPick: (c: Customer) => void;
  children: ReactNode;
}) {
  if (customer) return <>{children}</>;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <p className="shrink-0 text-sm text-slate-500">Select a customer to continue.</p>
      <CustomerSearchPanel onPick={onPick} />
    </div>
  );
}

export function CustomerWorkspace({ mode }: { mode: CustomerWorkspaceMode }) {
  const meta = TITLES[mode];
  const { organizationId, branchId, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const canWrite = hasPermission("customers.write");

  const focusCustomer = useCallback((c: Customer) => {
    setCustomer(c);
    setFocusedCustomerId(c.id);
  }, []);

  useEffect(() => {
    const fromQuery = params.get("customerId");
    const id = fromQuery || getFocusedCustomerId();
    if (!id) {
      setLoadingFocus(false);
      return;
    }
    let cancelled = false;
    void partiesApi
      .getCustomer(id)
      .then((c) => {
        if (!cancelled) {
          setCustomer(c);
          setFocusedCustomerId(c.id);
        }
      })
      .catch(() => {
        if (!cancelled) setFocusedCustomerId(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFocus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function attachToSale(c: Customer) {
    const view = await enrichCustomerForPos(c);
    setFocusedCustomerId(c.id);
    navigate("/pos/sales/new", { state: { attachCustomer: view } });
  }

  async function useWalkIn() {
    setFocusedCustomerId(null);
    navigate("/pos/sales/new", { state: { attachCustomer: emptyCustomer() } });
  }

  return (
    <PosSubPageShell
      moduleNumber="03"
      moduleLabel="Customers"
      title={meta.title}
      description={meta.description}
      actions={
        <>
          {mode !== "new" && canWrite ? (
            <Link
              to="/pos/customers/new"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              New customer
            </Link>
          ) : null}
          <Link to="/pos/sales/new" className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white">
            New Sale
          </Link>
        </>
      }
    >
      {loadingFocus ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : mode === "select" ? (
        <SelectMode
          customer={customer}
          onPick={focusCustomer}
          onAttach={(c) => void attachToSale(c)}
          onWalkIn={() => void useWalkIn()}
        />
      ) : mode === "walk-in" ? (
        <WalkInMode onConfirm={() => void useWalkIn()} />
      ) : mode === "new" ? (
        <NewCustomerMode
          organizationId={organizationId}
          canWrite={canWrite}
          onCreated={(c) => {
            focusCustomer(c);
            void attachToSale(c);
          }}
        />
      ) : mode === "profile" ? (
        <CustomerGate customer={customer} onPick={focusCustomer}>
          <ProfilePanel customer={customer!} onAttach={() => void attachToSale(customer!)} onChange={focusCustomer} />
        </CustomerGate>
      ) : mode === "history" ? (
        <CustomerGate customer={customer} onPick={focusCustomer}>
          <HistoryView customer={customer!} branchId={branchId} />
        </CustomerGate>
      ) : mode === "ledger" ? (
        <CustomerGate customer={customer} onPick={focusCustomer}>
          <LedgerView customer={customer!} />
        </CustomerGate>
      ) : mode === "credit" ? (
        <CustomerGate customer={customer} onPick={focusCustomer}>
          <CreditView customer={customer!} onRefresh={focusCustomer} />
        </CustomerGate>
      ) : (
        <CustomerGate customer={customer} onPick={focusCustomer}>
          <LoyaltyView customer={customer!} />
        </CustomerGate>
      )}
    </PosSubPageShell>
  );
}

function SelectMode({
  customer,
  onPick,
  onAttach,
  onWalkIn,
}: {
  customer: Customer | null;
  onPick: (c: Customer) => void;
  onAttach: (c: Customer) => void;
  onWalkIn: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
      <div className="min-h-0 flex-1 overflow-hidden">
        <CustomerSearchPanel onPick={onPick} selectedId={customer?.id} />
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 lg:w-72">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected</p>
        {customer ? (
          <>
            <p className="text-sm font-bold text-slate-900">{customer.name}</p>
            <p className="text-xs text-slate-500">
              {customer.code}
              {customer.mobile ? ` · ${customer.mobile}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              Outstanding {money(Number(customer.outstanding ?? 0))} · Limit{" "}
              {money(Number(customer.creditLimit ?? 0))}
            </p>
            <button
              type="button"
              onClick={() => onAttach(customer)}
              className="mt-2 rounded-xl bg-[var(--pos-primary)] py-2.5 text-xs font-bold text-white"
            >
              Attach to New Sale
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <Link to={`/pos/customers/profile?customerId=${customer.id}`} className="rounded-lg border border-slate-200 py-1.5 text-center text-[11px] font-semibold text-slate-600">
                Profile
              </Link>
              <Link to={`/pos/customers/history?customerId=${customer.id}`} className="rounded-lg border border-slate-200 py-1.5 text-center text-[11px] font-semibold text-slate-600">
                History
              </Link>
              <Link to={`/pos/customers/ledger?customerId=${customer.id}`} className="rounded-lg border border-slate-200 py-1.5 text-center text-[11px] font-semibold text-slate-600">
                Ledger
              </Link>
              <Link to={`/pos/customers/credit?customerId=${customer.id}`} className="rounded-lg border border-slate-200 py-1.5 text-center text-[11px] font-semibold text-slate-600">
                Credit
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">Pick a customer from the list.</p>
        )}
        <button
          type="button"
          onClick={onWalkIn}
          className="mt-auto rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600"
        >
          Use Walk-in
        </button>
      </aside>
    </div>
  );
}

function WalkInMode({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <i className="fa-solid fa-user text-xl" aria-hidden />
      </div>
      <h2 className="mt-4 text-base font-bold text-slate-900">Walk-in shopper</h2>
      <p className="mt-2 text-sm text-slate-500">
        No named profile — retail pricing, no credit or loyalty on this sale.
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-6 w-full rounded-xl bg-[var(--pos-primary)] py-3 text-sm font-bold text-white"
      >
        Start sale as Walk-in
      </button>
      <Link to="/pos/customers" className="mt-3 text-xs font-semibold text-[var(--pos-primary)]">
        Or search for a customer
      </Link>
    </div>
  );
}

function NewCustomerMode({
  organizationId,
  canWrite,
  onCreated,
}: {
  organizationId: string | null;
  canWrite: boolean;
  onCreated: (c: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canWrite) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        You need <strong>customers.write</strong> permission to create customers from POS.
      </div>
    );
  }

  async function submit() {
    if (!organizationId || !name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await partiesApi.createCustomer({
        organizationId,
        name: name.trim(),
        code: code.trim() || `C-${Date.now().toString(36).toUpperCase()}`,
        mobile: mobile.trim() || undefined,
        customerType: "retail",
        creditLimit: "0",
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block text-xs font-semibold text-slate-600">
        Name
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Phone
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          inputMode="tel"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Customer code (optional)
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Auto-generated if blank"
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-[var(--pos-primary)] py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create & attach to sale"}
      </button>
    </div>
  );
}

function ProfilePanel({
  customer,
  onAttach,
  onChange,
}: {
  customer: Customer;
  onAttach: () => void;
  onChange: (c: Customer) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    void partiesApi
      .getCustomer(customer.id)
      .then((c) => {
        if (!cancelled) onChange(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Refresh once when focused customer id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  return (
    <div className="space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
          <p className="text-xs text-slate-500">
            {customer.code} · {customer.customerType}
            {customer.mobile ? ` · ${customer.mobile}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onAttach}
          className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white"
        >
          Attach to sale
        </button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-400">Credit limit</dt>
          <dd className="mt-1 font-bold text-slate-900">{money(Number(customer.creditLimit ?? 0))}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-400">Outstanding</dt>
          <dd className="mt-1 font-bold text-slate-900">{money(Number(customer.outstanding ?? 0))}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-400">Email</dt>
          <dd className="mt-1 font-semibold text-slate-800">{customer.email || "—"}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-400">Status</dt>
          <dd className="mt-1 font-semibold text-slate-800">
            {customer.isBlocked ? "Blocked" : "Active"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2 text-xs">
        <Link to={`/pos/customers/history?customerId=${customer.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600">
          Purchase history
        </Link>
        <Link to={`/pos/customers/ledger?customerId=${customer.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600">
          Ledger
        </Link>
        <Link to={`/pos/customers/credit?customerId=${customer.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600">
          Credit
        </Link>
        <Link to={`/pos/customers/loyalty?customerId=${customer.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600">
          Loyalty
        </Link>
      </div>
    </div>
  );
}

function HistoryView({ customer, branchId }: { customer: Customer; branchId: string | null }) {
  const [items, setItems] = useState<SaleListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void posApi
      .searchSalesManagement({
        branchId: branchId ?? undefined,
        customerId: customer.id,
        tab: "all",
        limit: 40,
        offset: 0,
      })
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id, branchId]);

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-bold text-slate-800">{customer.name}</p>
        <p className="text-[11px] text-slate-400">Recent invoices</p>
      </div>
      {loading ? (
        <p className="p-4 text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">No sales found for this customer.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-bold text-slate-900">{row.invoiceNumber}</td>
                <td className="px-3 py-2 text-slate-600">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 capitalize text-slate-600">{row.status}</td>
                <td className="px-3 py-2 text-right font-semibold">{money(Number(row.grandTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LedgerView({ customer }: { customer: Customer }) {
  const [items, setItems] = useState<PartyLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void partiesApi
      .customerLedger(customer.id)
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-bold text-slate-800">{customer.name}</p>
        <p className="text-[11px] text-slate-400">
          Outstanding {money(Number(customer.outstanding ?? 0))}
        </p>
      </div>
      {loading ? (
        <p className="p-4 text-sm text-slate-400">Loading ledger…</p>
      ) : items.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">No ledger entries.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <span>
                <span className="block font-semibold text-slate-800">{e.entryType}</span>
                <span className="text-slate-400">
                  {e.description || e.sourceType}
                  {e.occurredAt ? ` · ${new Date(e.occurredAt).toLocaleDateString()}` : ""}
                </span>
              </span>
              <span className="text-right font-bold tabular-nums text-slate-900">
                <span className="block text-emerald-700">+{money(Number(e.credit))}</span>
                <span className="block text-red-600">−{money(Number(e.debit))}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreditView({
  customer,
  onRefresh,
}: {
  customer: Customer;
  onRefresh: (c: Customer) => void;
}) {
  const { hasPermission, organizationId } = useAuth();
  const { push } = useToast();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const limit = Number(customer.creditLimit ?? 0);
  const outstanding = Number(customer.outstanding ?? 0);
  const available = Math.max(0, limit - outstanding);

  async function requestApproval() {
    if (!hasPermission("credit.manage") || !organizationId) {
      push({ title: "Permission required", description: "credit.manage needed", tone: "danger" });
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      push({ title: "Enter a valid amount", tone: "danger" });
      return;
    }
    try {
      await partiesApi.requestCreditApproval({
        organizationId,
        customerId: customer.id,
        requestedAmount: String(n),
        reason: reason.trim() || "POS credit request",
        sourceType: "pos",
      });
      push({ title: "Credit approval requested", tone: "success" });
      const fresh = await partiesApi.getCustomer(customer.id);
      onRefresh(fresh);
    } catch (err) {
      push({
        title: "Request failed",
        description: err instanceof Error ? err.message : "Try again",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 overflow-y-auto">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">Limit</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{money(limit)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">Outstanding</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{money(outstanding)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase text-slate-400">Available</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{money(available)}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Request credit limit change</h3>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Requested limit"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          inputMode="decimal"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void requestApproval()}
          className="rounded-xl bg-[var(--pos-primary)] px-4 py-2 text-xs font-bold text-white"
        >
          Submit approval request
        </button>
      </div>
    </div>
  );
}

function LoyaltyView({ customer }: { customer: Customer }) {
  const [account, setAccount] = useState<Record<string, unknown> | null>(null);
  const [ledger, setLedger] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      commerceApi.account(customer.id).catch(() => ({ item: null })),
      commerceApi.ledger(customer.id).catch(() => ({ items: [] })),
    ])
      .then(([acc, led]) => {
        if (cancelled) return;
        setAccount(acc.item ?? null);
        setLedger(led.items ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  const points = Number(account?.pointsBalance ?? account?.balance ?? account?.points ?? 0);

  return (
    <div className="space-y-4 overflow-y-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-800">{customer.name}</p>
        {loading ? (
          <p className="mt-2 text-sm text-slate-400">Loading loyalty…</p>
        ) : (
          <p className="mt-2 text-3xl font-bold text-[var(--pos-primary)]">{points} pts</p>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase text-slate-400">
          Recent activity
        </div>
        {ledger.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">No loyalty ledger entries.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ledger.slice(0, 30).map((row, i) => (
              <li key={String(row.id ?? i)} className="flex justify-between px-4 py-2 text-xs">
                <span className="text-slate-600">
                  {String(row.entryType ?? row.type ?? "entry")}
                  {row.createdAt ? ` · ${new Date(String(row.createdAt)).toLocaleDateString()}` : ""}
                </span>
                <span className="font-bold">{Number(row.points ?? row.amount ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

