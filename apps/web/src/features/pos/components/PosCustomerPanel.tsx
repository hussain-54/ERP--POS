import { useState } from "react";
import type { PosCustomerSummary, PriceLevel } from "../pos-types";
import {
  POSBadge,
  POSButton,
  POSCard,
  POSInput,
  POSModal,
  POSSelect,
} from "../design-system";

interface Props {
  customer: PosCustomerSummary | null;
  walkIn: boolean;
  customers: Array<{ id: string; name: string; mobile?: string | null }>;
  customerQuery: string;
  onCustomerQuery: (q: string) => void;
  onSelectCustomer: (id: string) => void;
  onWalkIn: () => void;
  /** Real create via partiesApi — parent handles API */
  onCreateCustomer?: (input: {
    code: string;
    name: string;
    mobile?: string;
  }) => Promise<void>;
  creatingCustomer?: boolean;
  priceLevel: PriceLevel;
  onPriceLevel: (p: PriceLevel) => void;
  salesmanId: string;
  salesmen: Array<{ id: string; name: string }>;
  onSalesman: (id: string) => void;
  delivery: boolean;
  onDelivery: (v: boolean) => void;
  customerRef: React.RefObject<HTMLInputElement | null>;
  advanced: boolean;
}

export function PosCustomerPanel({
  customer,
  walkIn,
  customers,
  customerQuery,
  onCustomerQuery,
  onSelectCustomer,
  onWalkIn,
  onCreateCustomer,
  creatingCustomer,
  priceLevel,
  onPriceLevel,
  salesmanId,
  salesmen,
  onSalesman,
  delivery,
  onDelivery,
  customerRef,
  advanced,
}: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  async function submitNew() {
    if (!onCreateCustomer || !code.trim() || !name.trim()) return;
    await onCreateCustomer({
      code: code.trim(),
      name: name.trim(),
      mobile: mobile.trim() || undefined,
    });
    setNewOpen(false);
    setCode("");
    setName("");
    setMobile("");
  }

  return (
    <>
      <POSCard padding="sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--pos-ink)]">Customer</h3>
          <div className="flex flex-wrap gap-1">
            <POSButton
              size="sm"
              variant={walkIn ? "primary" : "ghost"}
              onClick={onWalkIn}
            >
              Walk-in
            </POSButton>
            <POSButton
              size="sm"
              variant="secondary"
              onClick={() => setNewOpen(true)}
              disabled={!onCreateCustomer}
              title={onCreateCustomer ? "Create customer" : "Create customer not wired"}
            >
              New
            </POSButton>
          </div>
        </div>

        <POSInput
          ref={customerRef as React.RefObject<HTMLInputElement>}
          label="Search customer (F3)"
          placeholder="Name or mobile…"
          value={customerQuery}
          onChange={(e) => onCustomerQuery(e.target.value)}
          disabled={walkIn}
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
                  <span>{c.name}</span>
                  <span className="text-xs text-[var(--pos-muted)]">{c.mobile ?? ""}</span>
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
              <div className="font-semibold text-[var(--pos-ink)]">{customer.name}</div>
              <div className="text-[var(--pos-muted)]">{customer.mobile ?? "No mobile"}</div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {customer.customerType ? (
                  <POSBadge tone="primary">{customer.customerType}</POSBadge>
                ) : null}
                <POSBadge tone="neutral">Limit {customer.creditLimit ?? "—"}</POSBadge>
                <POSBadge tone="warning">Due {customer.outstanding ?? "—"}</POSBadge>
              </div>
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
        size="sm"
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </POSButton>
            <POSButton
              loading={creatingCustomer}
              disabled={!code.trim() || !name.trim()}
              onClick={() => void submitNew()}
            >
              Create & select
            </POSButton>
          </>
        }
      >
        <div className="space-y-3">
          <POSInput label="Code" required value={code} onChange={(e) => setCode(e.target.value)} />
          <POSInput label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <POSInput label="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
      </POSModal>
    </>
  );
}
