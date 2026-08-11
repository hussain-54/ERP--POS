import { useEffect, useState, type FormEvent } from "react";
import type { PartyLedgerEntry, Supplier } from "@electronic-erp/contracts";
import { Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { partiesApi } from "./parties-api";

export function SuppliersPage() {
  const toast = useToast();
  const [items, setItems] = useState<Supplier[]>([]);
  const [ledger, setLedger] = useState<PartyLedgerEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    companyName: "",
    contactPerson: "",
    mobile: "",
    address: "",
    ntn: "",
    strn: "",
    bankName: "",
    bankAccountTitle: "",
    bankAccountNumber: "",
    bankIban: "",
  });

  async function load() {
    setItems((await partiesApi.listSuppliers()).items);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await partiesApi.createSupplier(form);
      toast.push({ title: "Supplier created", tone: "success" });
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
      <h1 className="text-2xl font-semibold">Suppliers</h1>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="New supplier">
          <Form onSubmit={onCreate}>
            <Input label="Supplier ID / Code" required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
            <Input label="Company" required value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
            <Input label="Contact person" value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} />
            <Input label="Mobile" value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} />
            <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            <Input label="NTN" value={form.ntn} onChange={(e) => setForm((p) => ({ ...p, ntn: e.target.value }))} />
            <Input label="STRN" value={form.strn} onChange={(e) => setForm((p) => ({ ...p, strn: e.target.value }))} />
            <Input label="Bank name" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
            <Input label="Account title" value={form.bankAccountTitle} onChange={(e) => setForm((p) => ({ ...p, bankAccountTitle: e.target.value }))} />
            <Input label="Account number" value={form.bankAccountNumber} onChange={(e) => setForm((p) => ({ ...p, bankAccountNumber: e.target.value }))} />
            <Input label="IBAN" value={form.bankIban} onChange={(e) => setForm((p) => ({ ...p, bankIban: e.target.value }))} />
            <FormActions>
              <Button type="submit">Create</Button>
            </FormActions>
          </Form>
        </Card>
        <div className="space-y-4">
          <Card title="Suppliers">
            <ul className="divide-y text-sm">
              {items.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 py-2">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() =>
                      void partiesApi.supplierLedger(s.id).then((res) => {
                        setSelectedId(s.id);
                        setLedger(res.items);
                      })
                    }
                  >
                    <strong>{s.companyName}</strong>
                    <div className="text-[var(--erp-muted)]">
                      payable {s.payableBalance} · {s.contactPerson ?? "—"}
                    </div>
                  </button>
                  <span className="font-mono text-xs text-[var(--erp-muted)]">{s.code}</span>
                </li>
              ))}
            </ul>
          </Card>
          {selectedId ? (
            <Card title="Supplier ledger">
              <ul className="space-y-1 text-sm">
                {ledger.map((e) => (
                  <li key={e.id}>
                    {e.entryType} · Dr {e.debit} Cr {e.credit} · bal {e.balanceAfter}
                  </li>
                ))}
                {!ledger.length ? <li className="text-[var(--erp-muted)]">No ledger entries</li> : null}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
