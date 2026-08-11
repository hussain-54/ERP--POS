import { Button, Card, Input, Select } from "@electronic-erp/ui";
import type { PosCustomerSummary, PriceLevel } from "../pos-types";

interface Props {
  customer: PosCustomerSummary | null;
  walkIn: boolean;
  customers: Array<{ id: string; name: string; mobile?: string | null }>;
  customerQuery: string;
  onCustomerQuery: (q: string) => void;
  onSelectCustomer: (id: string) => void;
  onWalkIn: () => void;
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
  return (
    <Card className="border-[var(--pos-border)] bg-[var(--pos-card)] p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Customer</h3>
        <Button size="sm" variant={walkIn ? "primary" : "secondary"} className={walkIn ? "pos-cta border-0" : ""} onClick={onWalkIn}>
          Walk-in
        </Button>
      </div>

      <Input
        ref={customerRef as React.RefObject<HTMLInputElement>}
        label="Search customer (F3)"
        placeholder="Name or mobile…"
        value={customerQuery}
        onChange={(e) => onCustomerQuery(e.target.value)}
        disabled={walkIn}
      />

      {!walkIn && customers.length > 0 ? (
        <ul className="mt-2 max-h-28 overflow-auto rounded-lg border border-[var(--pos-border)] text-sm">
          {customers.slice(0, 8).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-slate-50"
                onClick={() => onSelectCustomer(c.id)}
              >
                <span>{c.name}</span>
                <span className="text-xs text-[var(--pos-muted)]">{c.mobile ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 rounded-lg bg-slate-50 px-2 py-2 text-xs">
        {walkIn ? (
          <div className="font-medium">Walk-in customer</div>
        ) : customer ? (
          <div className="space-y-0.5">
            <div className="font-medium">{customer.name}</div>
            <div className="text-[var(--pos-muted)]">{customer.mobile ?? "No mobile"}</div>
            {advanced ? (
              <div className="text-[var(--pos-muted)]">
                Type {customer.customerType ?? "retail"} · Limit {customer.creditLimit ?? "—"} · Due{" "}
                {customer.outstanding ?? "—"}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-[var(--pos-muted)]">Select a customer or use Walk-in</div>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Select
          label="Price level"
          value={priceLevel}
          onChange={(e) => onPriceLevel(e.target.value as PriceLevel)}
          options={[
            { value: "retail", label: "Retail" },
            { value: "wholesale", label: "Wholesale" },
            { value: "dealer", label: "Dealer" },
          ]}
        />
        <Select
          label="Salesman"
          value={salesmanId}
          onChange={(e) => onSalesman(e.target.value)}
          options={[
            { value: "", label: "None" },
            ...salesmen.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>

      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={delivery} onChange={(e) => onDelivery(e.target.checked)} />
        Delivery required
      </label>
    </Card>
  );
}
