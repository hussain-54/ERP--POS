import { useEffect, useState, type FormEvent } from "react";
import type { PartyLedgerEntry, Supplier } from "@electronic-erp/contracts";
import { Breadcrumb, Button, Card, DataTable, Form, FormActions, Input, KpiCard, PageHeader, useToast } from "@electronic-erp/ui";
import { partiesApi } from "@/features/customers/parties-api";

export function SuppliersPage() {
  const toast = useToast();
  const [items, setItems] = useState<Supplier[]>([]);
  const [ledger, setLedger] = useState<PartyLedgerEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      const res = await partiesApi.listSuppliers();
      setItems(res.items);
    } catch (err) {
      toast.push({
        title: "Failed to load suppliers",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await partiesApi.createSupplier(form);
      toast.push({ title: "Supplier registered successfully", tone: "success" });
      setForm({
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
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function selectSupplier(id: string) {
    setSelectedId(id);
    try {
      const res = await partiesApi.supplierLedger(id);
      setLedger(res.items);
    } catch (err) {
      toast.push({
        title: "Failed to load ledger",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  const totalPayable = items.reduce((acc, s) => acc + Number(s.payableBalance || 0), 0);
  const selectedSupplier = items.find((s) => s.id === selectedId);

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Purchases & Inbound", href: "/suppliers" },
          { label: "Suppliers & Vendors" },
        ]}
      />

      <PageHeader
        moduleNumber="13"
        title="Supplier Directory & Vendor Accounts"
        description="Vendor directory, tax credentials (NTN/STRN), corporate bank settlement details, and real-time accounts payable ledger."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Registered Suppliers"
          value={items.length.toLocaleString()}
          tone="brand"
          icon={<i className="fa-solid fa-truck-field" />}
        />
        <KpiCard
          label="Total Accounts Payable"
          value={`Rs. ${totalPayable.toLocaleString()}`}
          tone={totalPayable > 0 ? "warning" : "success"}
          icon={<i className="fa-solid fa-file-invoice-dollar" />}
        />
        <KpiCard
          label="Active Payment Routes"
          value={items.filter((s) => s.bankAccountNumber).length.toLocaleString()}
          icon={<i className="fa-solid fa-building-columns" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card title="Add New Supplier / Vendor" description="Register a manufacturer or distributor account." divided>
          <Form onSubmit={onCreate} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Vendor Code"
                required
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="e.g. SUP-01"
              />
              <Input
                label="Contact Person"
                value={form.contactPerson}
                onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
                placeholder="Manager Name"
              />
            </div>

            <Input
              label="Company / Business Name"
              required
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              placeholder="e.g. Haier Pakistan Pvt Ltd"
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Mobile Phone"
                value={form.mobile}
                onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                placeholder="03001234567"
              />
              <Input
                label="Office Address"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="City / Address"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="NTN #"
                value={form.ntn}
                onChange={(e) => setForm((p) => ({ ...p, ntn: e.target.value }))}
                placeholder="Tax ID"
              />
              <Input
                label="STRN #"
                value={form.strn}
                onChange={(e) => setForm((p) => ({ ...p, strn: e.target.value }))}
                placeholder="Sales Tax ID"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
              <p className="text-[11px] font-bold uppercase text-slate-500">Bank Settlement Details</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Bank Name"
                  value={form.bankName}
                  onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="e.g. Meezan Bank"
                />
                <Input
                  label="Account Title"
                  value={form.bankAccountTitle}
                  onChange={(e) => setForm((p) => ({ ...p, bankAccountTitle: e.target.value }))}
                  placeholder="Official Account Name"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Account Number"
                  value={form.bankAccountNumber}
                  onChange={(e) => setForm((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                  placeholder="010101010101"
                />
                <Input
                  label="IBAN"
                  value={form.bankIban}
                  onChange={(e) => setForm((p) => ({ ...p, bankIban: e.target.value }))}
                  placeholder="PK00..."
                />
              </div>
            </div>

            <FormActions>
              <Button type="submit" className="w-full">
                Register Supplier
              </Button>
            </FormActions>
          </Form>
        </Card>

        <div className="space-y-4">
          <Card title={`Supplier Records (${items.length})`} description="Click a supplier to view account payable ledger." divided>
            <DataTable
              rows={items}
              rowKey={(s) => s.id}
              searchable
              searchPlaceholder="Search suppliers, company, code, mobile…"
              pageSize={10}
              loading={loading}
              columns={[
                {
                  key: "company",
                  header: "Company & Contact",
                  sortValue: (s) => s.companyName,
                  filterValue: (s) => `${s.companyName} ${s.code} ${s.contactPerson ?? ""}`,
                  cell: (s) => (
                    <div>
                      <button
                        type="button"
                        onClick={() => void selectSupplier(s.id)}
                        className="text-left font-bold text-slate-900 hover:text-blue-600 transition"
                      >
                        {s.companyName}
                      </button>
                      <p className="text-[11px] text-slate-400 font-mono">{s.code} · {s.contactPerson || "No contact"}</p>
                    </div>
                  ),
                },
                {
                  key: "mobile",
                  header: "Contact",
                  cell: (s) => <span className="text-xs text-slate-600">{s.mobile || "—"}</span>,
                },
                {
                  key: "payable",
                  header: "Payable Balance",
                  align: "right",
                  sortValue: (s) => Number(s.payableBalance || 0),
                  cell: (s) => (
                    <span className={`font-mono font-bold ${Number(s.payableBalance) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      Rs. {Number(s.payableBalance || 0).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: "action",
                  header: "Action",
                  cell: (s) => (
                    <Button variant="ghost" size="xs" onClick={() => void selectSupplier(s.id)}>
                      Ledger →
                    </Button>
                  ),
                },
              ]}
            />
          </Card>

          {selectedSupplier ? (
            <Card
              title={`Vendor Statement: ${selectedSupplier.companyName}`}
              description={`Payable: Rs. ${Number(selectedSupplier.payableBalance || 0).toLocaleString()} · Bank: ${selectedSupplier.bankName || "—"}`}
              actions={
                <Button variant="ghost" size="xs" onClick={() => setSelectedId(null)}>
                  Close Statement ✕
                </Button>
              }
              divided
            >
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {ledger.map((l) => (
                  <div key={l.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{l.entryType}</p>
                      <p className="text-[10px] text-slate-400">{l.occurredAt?.slice(0, 10)} · {l.description || l.sourceType}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-slate-900">
                        {Number(l.debit) > 0 ? `+Rs. ${Number(l.debit).toLocaleString()}` : `-Rs. ${Number(l.credit).toLocaleString()}`}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">Bal: Rs. {Number(l.balanceAfter).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {ledger.length === 0 ? <p className="text-xs text-slate-400 py-3 text-center">No ledger entries for this vendor yet.</p> : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
