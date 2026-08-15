import { useEffect, useState, type FormEvent } from "react";
import type { Customer, PartyLedgerEntry, Payment } from "@electronic-erp/contracts";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { partiesApi } from "./parties-api";

export function CustomersPage() {
  const toast = useToast();
  const [items, setItems] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<PartyLedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    nameUr: "",
    mobile: "",
    alternateMobile: "",
    address: "",
    cnic: "",
    referenceName: "",
    customerType: "retail",
    creditLimit: "0",
    creditDays: "0",
  });

  async function load() {
    const res = await partiesApi.listCustomers();
    setItems(res.items);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
  }, [toast]);

  async function selectCustomer(c: Customer) {
    setSelected(c);
    const [l, p] = await Promise.all([
      partiesApi.customerLedger(c.id),
      partiesApi.customerPayments(c.id),
    ]);
    setLedger(l.items);
    setPayments(p.items);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await partiesApi.createCustomer({
        ...form,
        creditDays: Number(form.creditDays || 0),
      });
      toast.push({ title: "Customer created", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="New customer">
          <Form onSubmit={onCreate}>
            <Input label="Code" required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
            <Input label="Name" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <Input label="Urdu Name" value={form.nameUr} onChange={(e) => setForm((p) => ({ ...p, nameUr: e.target.value }))} />
            <Input label="Mobile" value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} />
            <Input label="Alternate Mobile" value={form.alternateMobile} onChange={(e) => setForm((p) => ({ ...p, alternateMobile: e.target.value }))} />
            <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            <Input label="CNIC (optional)" value={form.cnic} onChange={(e) => setForm((p) => ({ ...p, cnic: e.target.value }))} />
            <Input label="Reference" value={form.referenceName} onChange={(e) => setForm((p) => ({ ...p, referenceName: e.target.value }))} />
            <Select
              label="Type"
              options={[
                { value: "retail", label: "Retail" },
                { value: "wholesale", label: "Wholesale" },
                { value: "dealer", label: "Dealer" },
              ]}
              value={form.customerType}
              onChange={(e) => setForm((p) => ({ ...p, customerType: e.target.value }))}
            />
            <Input label="Credit Limit" value={form.creditLimit} onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))} />
            <Input label="Credit Days" value={form.creditDays} onChange={(e) => setForm((p) => ({ ...p, creditDays: e.target.value }))} />
            <FormActions>
              <Button type="submit">Create</Button>
            </FormActions>
          </Form>
        </Card>

        <div className="space-y-4">
          <Card title="Customers">
            <ul className="divide-y text-sm">
              {items.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <button className="text-left" type="button" onClick={() => void selectCustomer(c)}>
                    <strong>{c.name}</strong>
                    <div className="text-[var(--erp-muted)]">
                      {c.customerType} · outstanding {c.outstanding} · limit {c.creditLimit}
                      {c.isBlocked ? " · BLOCKED" : ""}
                    </div>
                  </button>
                  <span className="font-mono text-xs text-[var(--erp-muted)]">{c.id.slice(0, 8)}</span>
                </li>
              ))}
            </ul>
          </Card>

          {selected ? (
            <>
              <Card title={`${selected.name} — ledger & payments`}>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void partiesApi.blockCustomer(selected.id).then(() => selectCustomer(selected))}
                  >
                    Block
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void partiesApi.unblockCustomer(selected.id).then(() => selectCustomer(selected))}
                  >
                    Unblock
                  </Button>
                </div>
                <p className="mb-2 text-sm text-[var(--erp-muted)]">
                  Purchases {selected.totalPurchases} · Paid {selected.totalPaid} · Outstanding {selected.outstanding}
                </p>
                <h3 className="mb-1 font-medium">Ledger</h3>
                <ul className="mb-4 space-y-1 text-sm">
                  {ledger.map((e) => (
                    <li key={e.id}>
                      {e.entryType} · Dr {e.debit} Cr {e.credit} · bal {e.balanceAfter}
                    </li>
                  ))}
                  {!ledger.length ? <li className="text-[var(--erp-muted)]">No ledger entries</li> : null}
                </ul>
                <h3 className="mb-1 font-medium">Payment history</h3>
                <ul className="space-y-1 text-sm">
                  {payments.map((p) => (
                    <li key={p.id}>
                      {p.receiptNumber} · {p.totalAmount} · {p.occurredAt}
                    </li>
                  ))}
                  {!payments.length ? <li className="text-[var(--erp-muted)]">No payments</li> : null}
                </ul>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
