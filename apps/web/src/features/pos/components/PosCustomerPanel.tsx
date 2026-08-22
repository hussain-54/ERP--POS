import { memo, useEffect, useState } from "react";
import type { CustomerSearchHit } from "@electronic-erp/contracts";
import type { PosCustomerProfile } from "@electronic-erp/domain";
import type { PriceLevel } from "../pos-types";
import { POS_SEARCH_FLUSH_MS } from "../pos-catalog-load";
import { suggestPosCustomerCode } from "../pos-quotation";
import {
  POSBadge,
  POSButton,
  POSDrawer,
  POSInput,
  POSModal,
  POSSelect,
} from "../design-system";

export type PosCustomerFormInput = {
  code: string;
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
  cnic?: string;
  customerType?: "retail" | "wholesale" | "dealer";
};

interface Props {
  customer: PosCustomerProfile | null;
  walkIn: boolean;
  customers: CustomerSearchHit[];
  customerQuery: string;
  onCustomerQuery: (q: string) => void;
  onSelectCustomer: (id: string) => void;
  onWalkIn: () => void;
  onCreateCustomer?: (input: PosCustomerFormInput) => Promise<void>;
  onUpdateCustomer?: (id: string, input: PosCustomerFormInput) => Promise<void>;
  onLoadHistory?: (id: string) => Promise<
    Array<{ id: string; entryType: string; amount: string; occurredAt: string; description?: string | null }>
  >;
  creatingCustomer?: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canRead: boolean;
  priceLevel: PriceLevel;
  onPriceLevel: (p: PriceLevel) => void;
  salesmanId: string;
  salesmen: Array<{ id: string; name: string }>;
  onSalesman: (id: string) => void;
  referenceId: string;
  references: Array<{ id: string; name: string }>;
  onReference: (id: string) => void;
  delivery: boolean;
  onDelivery: (v: boolean) => void;
  customerRef: React.RefObject<HTMLInputElement | null>;
  advanced: boolean;
  creditHint?: string | null;
  /** Inline customer search failure (prefer over silent empty). */
  searchError?: string | null;
}

const emptyForm = (): PosCustomerFormInput => ({
  code: suggestPosCustomerCode(),
  name: "",
  mobile: "",
  email: "",
  address: "",
  cnic: "",
  customerType: "retail",
});

function moneyLabel(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function priceTierLabel(level: string | null | undefined): string {
  if (!level) return "—";
  if (level === "retail") return "Retail";
  if (level === "wholesale") return "Wholesale";
  if (level === "dealer") return "Dealer";
  return level;
}

function CustomerStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="pos-customer-stat rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2 py-1" title={hint}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--pos-muted)]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--pos-ink)]">{value}</div>
    </div>
  );
}

export const PosCustomerPanel = memo(function PosCustomerPanel({
  customer,
  walkIn,
  customers,
  customerQuery,
  onCustomerQuery,
  onSelectCustomer,
  onWalkIn,
  onCreateCustomer,
  onUpdateCustomer,
  onLoadHistory,
  creatingCustomer,
  canCreate,
  canEdit,
  canRead,
  priceLevel,
  onPriceLevel,
  salesmanId,
  salesmen,
  onSalesman,
  referenceId,
  references,
  onReference,
  delivery,
  onDelivery,
  customerRef,
  advanced,
  creditHint,
  searchError = null,
}: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState<PosCustomerFormInput>(emptyForm);
  const [history, setHistory] = useState<
    Array<{ id: string; entryType: string; amount: string; occurredAt: string; description?: string | null }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [queryDraft, setQueryDraft] = useState(customerQuery);
  useEffect(() => {
    setQueryDraft(customerQuery);
  }, [customerQuery]);
  useEffect(() => {
    if (queryDraft === customerQuery) return;
    const handle = window.setTimeout(() => onCustomerQuery(queryDraft), POS_SEARCH_FLUSH_MS);
    return () => window.clearTimeout(handle);
  }, [queryDraft, customerQuery, onCustomerQuery]);

  function openNew() {
    setForm(emptyForm());
    setNewOpen(true);
  }

  function openEdit() {
    if (!customer) return;
    setForm({
      code: customer.code,
      name: customer.name,
      mobile: customer.mobile ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      cnic: "",
      customerType: customer.customerType,
    });
    setEditOpen(true);
  }

  async function submitNew() {
    if (!onCreateCustomer || !form.code.trim() || !form.name.trim()) return;
    await onCreateCustomer({
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      mobile: form.mobile?.trim() || undefined,
      email: form.email?.trim() || undefined,
      address: form.address?.trim() || undefined,
      cnic: form.cnic?.trim() || undefined,
    });
    setNewOpen(false);
    setForm(emptyForm());
  }

  async function submitEdit() {
    if (!onUpdateCustomer || !customer || !form.name.trim()) return;
    await onUpdateCustomer(customer.id, {
      ...form,
      name: form.name.trim(),
      mobile: form.mobile?.trim() || undefined,
      email: form.email?.trim() || undefined,
      address: form.address?.trim() || undefined,
      cnic: form.cnic?.trim() || undefined,
    });
    setEditOpen(false);
  }

  async function openHistory() {
    if (!customer || !onLoadHistory) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      setHistory(await onLoadHistory(customer.id));
    } finally {
      setHistoryLoading(false);
    }
  }

  const formFields = (
    <div className="space-y-3">
      <POSInput
        label="Code"
        required
        value={form.code}
        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        disabled={editOpen}
        hint={editOpen ? undefined : "Generated for you — change if your store uses another code"}
      />
      <POSInput
        label="Name"
        required
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      />
      <POSInput
        label="Mobile"
        value={form.mobile ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
      />
      <POSInput
        label="Email"
        type="email"
        value={form.email ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
      />
      <POSInput
        label="Address"
        value={form.address ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
      />
      <POSInput
        label="CNIC"
        value={form.cnic ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, cnic: e.target.value }))}
        placeholder={editOpen ? "Leave blank to keep existing" : undefined}
      />
      <POSSelect
        label="Customer type / price tier"
        value={form.customerType ?? "retail"}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            customerType: e.target.value as "retail" | "wholesale" | "dealer",
          }))
        }
        options={[
          { value: "retail", label: "Retail" },
          { value: "wholesale", label: "Wholesale" },
          { value: "dealer", label: "Dealer" },
        ]}
      />
    </div>
  );

  const loyaltyValue =
    walkIn || !customer
      ? "—"
      : customer.loyaltyPoints == null
        ? "—"
        : String(customer.loyaltyPoints);

  return (
    <>
      <section className="pos-tx-customer px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="pos-field-label--compact">Customer</h3>
          <div className="flex shrink-0 gap-1">
            <POSButton size="sm" variant={walkIn ? "primary" : "ghost"} onClick={onWalkIn}>
              Walk-in Customer
            </POSButton>
            <POSButton
              size="sm"
              variant="secondary"
              onClick={openNew}
              disabled={!canCreate || !onCreateCustomer}
              title={canCreate ? "Create customer" : "Requires customers.write"}
            >
              New Customer
            </POSButton>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <POSInput
              ref={customerRef as React.RefObject<HTMLInputElement>}
              label="Customer search"
              placeholder={
                canRead
                  ? walkIn
                    ? "Search to replace walk-in — name, mobile, or code…"
                    : "Name, mobile, or code…"
                  : "No customers.read permission"
              }
              value={queryDraft}
              onChange={(e) => setQueryDraft(e.target.value)}
              disabled={!canRead}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (queryDraft !== customerQuery) onCustomerQuery(queryDraft);
                const first = customers[0];
                if (first) onSelectCustomer(first.id);
              }}
            />
          </div>
        </div>

        {searchError ? (
          <p role="alert" className="mt-1.5 text-xs text-[var(--pos-danger)]">
            {searchError}
          </p>
        ) : null}

        {customers.length > 0 ? (
          <ul className="mt-2 max-h-28 overflow-auto rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] text-sm">
            {customers.slice(0, 8).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-[var(--pos-muted-bg)] focus-visible:bg-[var(--pos-primary-soft)]"
                  onClick={() => onSelectCustomer(c.id)}
                >
                  <span>
                    {c.name}
                    <span className="ml-1 text-[10px] uppercase text-[var(--pos-muted)]">
                      {c.customerType}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--pos-muted)]">{c.mobile ?? c.code}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2 rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-2.5 py-2 text-xs">
          {walkIn ? (
            <div className="flex items-center gap-2">
              <POSBadge tone="neutral">Walk-in</POSBadge>
              <span className="font-medium text-[var(--pos-ink)]">Cash / full payment required</span>
            </div>
          ) : customer ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-[var(--pos-ink)]">{customer.name}</div>
                  <div className="text-[var(--pos-muted)]">
                    {customer.code}
                    {customer.mobile ? ` · ${customer.mobile}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {canEdit && onUpdateCustomer ? (
                    <POSButton size="sm" variant="ghost" onClick={openEdit}>
                      Edit
                    </POSButton>
                  ) : null}
                  {onLoadHistory ? (
                    <POSButton size="sm" variant="ghost" onClick={() => void openHistory()}>
                      History
                    </POSButton>
                  ) : null}
                </div>
              </div>
              {customer.isBlocked ? <POSBadge tone="danger">Blocked</POSBadge> : null}
              {creditHint ? (
                <p className="pt-1 text-[11px] text-[var(--pos-warning)]">{creditHint}</p>
              ) : null}
            </div>
          ) : (
            <div className="text-[var(--pos-muted)]">Search by name, mobile, or code — or use Walk-in</div>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <CustomerStat label="Price Tier" value={priceTierLabel(priceLevel)} />
          <CustomerStat
            label="Credit Limit"
            value={walkIn || !customer ? "—" : moneyLabel(customer.creditLimit)}
            hint="Maximum udhaar allowed for this customer"
          />
          <CustomerStat
            label="Udhaar"
            value={walkIn || !customer ? "—" : moneyLabel(customer.outstanding)}
            hint="Current outstanding balance (udhaar)"
          />
          <CustomerStat
            label="Available"
            value={
              walkIn || !customer
                ? "—"
                : moneyLabel(
                    String(
                      Math.max(
                        0,
                        (Number(customer.creditLimit) || 0) - (Number(customer.outstanding) || 0),
                      ),
                    ),
                  )
            }
            hint="Credit limit minus outstanding udhaar"
          />
          <CustomerStat
            label="Loyalty Points"
            value={loyaltyValue}
            hint={
              customer && customer.loyaltyPoints == null
                ? "Shown when loyalty.view is granted and the loyalty account loads"
                : undefined
            }
          />
        </div>

        {advanced ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <POSSelect
                label="Price level"
                value={priceLevel}
                onChange={(e) => onPriceLevel(e.target.value as PriceLevel)}
                options={[
                  { value: "retail", label: "Retail" },
                  { value: "wholesale", label: "Wholesale" },
                  { value: "dealer", label: "Dealer" },
                ]}
              />
              <POSSelect
                label="Salesman"
                value={salesmanId}
                onChange={(e) => onSalesman(e.target.value)}
                options={[
                  { value: "", label: "None" },
                  ...salesmen.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <POSSelect
                label="Reference"
                value={referenceId}
                onChange={(e) => onReference(e.target.value)}
                options={[
                  { value: "", label: "None" },
                  ...references.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            </div>

            <label className="mt-2 flex items-center gap-2 text-sm text-[var(--pos-ink)]">
              <input
                type="checkbox"
                className="rounded border-[var(--pos-border)]"
                checked={delivery}
                onChange={(e) => onDelivery(e.target.checked)}
              />
              Delivery required
            </label>
            <p className="mt-1 text-[11px] text-[var(--pos-muted)]">
              Flags the sale for a delivery note. POS does not add a delivery fee. Credit /
              installments follow after customer select.
            </p>
          </>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--pos-muted)]">
            Quick Sale: walk-in by default. Switch to Advanced for salesman, reference, and
            delivery.
          </p>
        )}
      </section>

      <POSModal
        open={newOpen}
        title="New customer"
        onClose={() => setNewOpen(false)}
        size="md"
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </POSButton>
            <POSButton
              loading={creatingCustomer}
              disabled={!form.code.trim() || !form.name.trim()}
              onClick={() => void submitNew()}
            >
              Create & select
            </POSButton>
          </>
        }
      >
        {formFields}
      </POSModal>

      <POSModal
        open={editOpen}
        title="Edit customer"
        onClose={() => setEditOpen(false)}
        size="md"
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </POSButton>
            <POSButton
              loading={creatingCustomer}
              disabled={!form.name.trim()}
              onClick={() => void submitEdit()}
            >
              Save
            </POSButton>
          </>
        }
      >
        {formFields}
      </POSModal>

      <POSDrawer open={historyOpen} title="Customer history" onClose={() => setHistoryOpen(false)} side="right">
        {historyLoading ? (
          <p className="text-sm text-[var(--pos-muted)]">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-[var(--pos-muted)]">No recent ledger entries.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li
                key={h.id}
                className="rounded-[var(--pos-radius-sm)] border border-[var(--pos-border)] px-3 py-2"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium capitalize">{h.entryType}</span>
                  <span className="tabular-nums">{h.amount}</span>
                </div>
                <div className="text-xs text-[var(--pos-muted)]">
                  {new Date(h.occurredAt).toLocaleString()}
                </div>
                {h.description ? (
                  <div className="text-xs text-[var(--pos-muted)]">{h.description}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </POSDrawer>
    </>
  );
});
