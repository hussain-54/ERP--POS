import { useState } from "react";
import type { CustomerSearchHit } from "@electronic-erp/contracts";
import type { PosCustomerProfile } from "@electronic-erp/domain";
import type { PriceLevel } from "../pos-types";
import {
  POSBadge,
  POSButton,
  POSCard,
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
  delivery: boolean;
  onDelivery: (v: boolean) => void;
  customerRef: React.RefObject<HTMLInputElement | null>;
  advanced: boolean;
  creditHint?: string | null;
}

const emptyForm = (): PosCustomerFormInput => ({
  code: "",
  name: "",
  mobile: "",
  email: "",
  address: "",
  cnic: "",
  customerType: "retail",
});

export function PosCustomerPanel({
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
  delivery,
  onDelivery,
  customerRef,
  advanced,
  creditHint,
}: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState<PosCustomerFormInput>(emptyForm);
  const [history, setHistory] = useState<
    Array<{ id: string; entryType: string; amount: string; occurredAt: string; description?: string | null }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  return (
    <>
      <POSCard padding="sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--pos-ink)]">Customer</h3>
          <div className="flex flex-wrap gap-1">
            <POSButton size="sm" variant={walkIn ? "primary" : "ghost"} onClick={onWalkIn}>
              Walk-in
            </POSButton>
            <POSButton
              size="sm"
              variant="secondary"
              onClick={openNew}
              disabled={!canCreate || !onCreateCustomer}
              title={canCreate ? "Create customer" : "Requires customers.write"}
            >
              New
            </POSButton>
          </div>
        </div>

        <POSInput
          ref={customerRef as React.RefObject<HTMLInputElement>}
          label="Search customer (F3)"
          placeholder={canRead ? "Name, mobile, or code…" : "No customers.read permission"}
          value={customerQuery}
          onChange={(e) => onCustomerQuery(e.target.value)}
          disabled={walkIn || !canRead}
        />

        {!walkIn && customers.length > 0 ? (
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

        <div className="mt-2 rounded-[var(--pos-radius-sm)] bg-[var(--pos-muted-bg)] px-2.5 py-2 text-xs">
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
                  <div className="text-[var(--pos-muted)]">{customer.mobile ?? "No mobile"}</div>
                  {customer.email ? (
                    <div className="text-[var(--pos-muted)]">{customer.email}</div>
                  ) : null}
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
              {customer.address ? (
                <div className="text-[var(--pos-muted)]">{customer.address}</div>
              ) : null}
              {customer.cnicMasked ? (
                <div className="text-[var(--pos-muted)]">CNIC {customer.cnicMasked}</div>
              ) : null}
              <div className="flex flex-wrap gap-1 pt-0.5">
                <POSBadge tone="primary">{customer.customerType}</POSBadge>
                <POSBadge tone="neutral">Limit {customer.creditLimit}</POSBadge>
                <POSBadge tone="warning">Due {customer.outstanding}</POSBadge>
                {customer.loyaltyPoints != null ? (
                  <POSBadge tone="success">Pts {customer.loyaltyPoints}</POSBadge>
                ) : null}
                {customer.isBlocked ? <POSBadge tone="danger">Blocked</POSBadge> : null}
              </div>
              {creditHint ? (
                <p className="pt-1 text-[11px] text-[var(--pos-warning)]">{creditHint}</p>
              ) : null}
            </div>
          ) : (
            <div className="text-[var(--pos-muted)]">Select a customer or use Walk-in</div>
          )}
        </div>

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
        {advanced ? (
          <p className="mt-1 text-[11px] text-[var(--pos-muted)]">
            Advanced: credit / installments available after customer select
          </p>
        ) : null}
      </POSCard>

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
          <p className="text-sm text-[var(--pos-muted)]">No recent ledger entries (online only).</p>
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
}
