import { useEffect, useState, type FormEvent } from "react";
import type { Customer, PartyLedgerEntry, Payment } from "@electronic-erp/contracts";
import { Badge, Breadcrumb, Button, Card, DataTable, Form, FormActions, Input, KpiCard, PageHeader, Select, useToast } from "@electronic-erp/ui";
import { partiesApi } from "./parties-api";

export function CustomersPage() {
  const toast = useToast();
  const [items, setItems] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<PartyLedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      const res = await partiesApi.listCustomers();
      setItems(res.items);
    } catch (err) {
      toast.push({
        title: "Failed to load customers",
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

  async function selectCustomer(c: Customer) {
    setSelected(c);
    try {
      const [l, p] = await Promise.all([
        partiesApi.customerLedger(c.id),
        partiesApi.customerPayments(c.id),
      ]);
      setLedger(l.items);
      setPayments(p.items);
    } catch (err) {
      toast.push({
        title: "Could not load ledger",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await partiesApi.createCustomer({
        ...form,
        creditDays: Number(form.creditDays || 0),
      });
      toast.push({ title: "Customer created successfully", tone: "success" });
      setForm({
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
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  const totalOutstanding = items.reduce((acc, c) => acc + Number(c.outstanding || 0), 0);
  const totalCreditLimit = items.reduce((acc, c) => acc + Number(c.creditLimit || 0), 0);
  const blockedCount = items.filter((c) => c.isBlocked).length;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "CRM & Parties", href: "/customers" },
          { label: "Customer Directory" },
        ]}
      />

      <PageHeader
        moduleNumber="12"
        title="Customer Directory & Credit Accounts"
        description="Comprehensive customer profile management: retail, wholesale, dealer pricing tiers, CNIC verification, credit limits, and real-time Udhaar ledger."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Registered Customers"
          value={items.length.toLocaleString()}
          tone="brand"
          icon={<i className="fa-solid fa-users" />}
        />
        <KpiCard
          label="Total Udhaar Outstanding"
          value={`Rs. ${totalOutstanding.toLocaleString()}`}
          tone={totalOutstanding > 0 ? "warning" : "success"}
          icon={<i className="fa-solid fa-hand-holding-dollar" />}
        />
        <KpiCard
          label="Total Credit Extended"
          value={`Rs. ${totalCreditLimit.toLocaleString()}`}
          icon={<i className="fa-solid fa-credit-card" />}
        />
        <KpiCard
          label="Blocked Accounts"
          value={blockedCount.toLocaleString()}
          tone={blockedCount > 0 ? "danger" : "neutral"}
          icon={<i className="fa-solid fa-ban" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Create Customer Form Card */}
        <Card title="Add New Customer" description="Register a retail, wholesale, or dealer account." divided>
          <Form onSubmit={onCreate} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Account Code"
                required
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="e.g. CUST-012"
              />
              <Select
                label="Customer Type"
                options={[
                  { value: "retail", label: "Retail" },
                  { value: "wholesale", label: "Wholesale" },
                  { value: "dealer", label: "Dealer" },
                ]}
                value={form.customerType}
                onChange={(e) => setForm((p) => ({ ...p, customerType: e.target.value }))}
              />
            </div>

            <Input
              label="Full Name / Business Title"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Tariq Electronics"
            />
            <Input
              label="Urdu Title (Optional)"
              value={form.nameUr}
              onChange={(e) => setForm((p) => ({ ...p, nameUr: e.target.value }))}
              placeholder="طارق الیکٹرانکس"
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Primary Mobile"
                value={form.mobile}
                onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                placeholder="03001234567"
              />
              <Input
                label="Alternate Phone"
                value={form.alternateMobile}
                onChange={(e) => setForm((p) => ({ ...p, alternateMobile: e.target.value }))}
                placeholder="03211234567"
              />
            </div>

            <Input
              label="Shop / Shipping Address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="e.g. Shop #4, Electronics Market, Lahore"
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="CNIC (National ID)"
                value={form.cnic}
                onChange={(e) => setForm((p) => ({ ...p, cnic: e.target.value }))}
                placeholder="35202-xxxxxxx-x"
              />
              <Input
                label="Guarantor / Ref"
                value={form.referenceName}
                onChange={(e) => setForm((p) => ({ ...p, referenceName: e.target.value }))}
                placeholder="Reference person"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Credit Limit (Rs.)"
                type="number"
                value={form.creditLimit}
                onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))}
                placeholder="0.00"
              />
              <Input
                label="Credit Days (Terms)"
                type="number"
                value={form.creditDays}
                onChange={(e) => setForm((p) => ({ ...p, creditDays: e.target.value }))}
                placeholder="30"
              />
            </div>

            <FormActions>
              <Button type="submit" className="w-full">
                Create Customer Account
              </Button>
            </FormActions>
          </Form>
        </Card>

        {/* Customers Directory & Ledger Inspection */}
        <div className="space-y-4">
          <Card title={`Customer Records (${items.length})`} description="Click a customer to view ledger and payment history." divided>
            <DataTable
              rows={items}
              rowKey={(c) => c.id}
              searchable
              searchPlaceholder="Search by name, mobile, code, CNIC…"
              pageSize={10}
              loading={loading}
              columns={[
                {
                  key: "name",
                  header: "Customer Name",
                  sortValue: (c) => c.name,
                  filterValue: (c) => `${c.name} ${c.mobile ?? ""} ${c.code}`,
                  cell: (c) => (
                    <div>
                      <button
                        type="button"
                        onClick={() => void selectCustomer(c)}
                        className="text-left font-bold text-slate-900 hover:text-blue-600 transition"
                      >
                        {c.name}
                      </button>
                      <p className="text-[11px] text-slate-400 font-mono">{c.code} · {c.mobile || "No phone"}</p>
                    </div>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  cell: (c) => <Badge tone="brand" size="sm">{c.customerType}</Badge>,
                },
                {
                  key: "outstanding",
                  header: "Outstanding Udhaar",
                  align: "right",
                  sortValue: (c) => Number(c.outstanding || 0),
                  cell: (c) => (
                    <span className={`font-mono font-bold ${Number(c.outstanding) > 0 ? "text-amber-700" : "text-slate-600"}`}>
                      Rs. {Number(c.outstanding).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: "limit",
                  header: "Credit Limit",
                  align: "right",
                  sortValue: (c) => Number(c.creditLimit || 0),
                  cell: (c) => <span className="font-mono text-xs text-slate-600">Rs. {Number(c.creditLimit).toLocaleString()}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (c) => (
                    c.isBlocked ? (
                      <Badge tone="danger" size="sm">Blocked</Badge>
                    ) : (
                      <Badge tone="success" size="sm">Active</Badge>
                    )
                  ),
                },
                {
                  key: "action",
                  header: "Action",
                  cell: (c) => (
                    <Button variant="ghost" size="xs" onClick={() => void selectCustomer(c)}>
                      View Ledger →
                    </Button>
                  ),
                },
              ]}
            />
          </Card>

          {/* Selected Customer Statement & Ledger Drawer/Card */}
          {selected ? (
            <Card
              title={`Account Statement: ${selected.name}`}
              description={`Account #${selected.code} · ${selected.customerType} · Outstanding: Rs. ${Number(selected.outstanding).toLocaleString()}`}
              actions={
                <Button variant="ghost" size="xs" onClick={() => setSelected(null)}>
                  Close Statement ✕
                </Button>
              }
              divided
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ledger Entries */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Ledger Transactions</h4>
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
                    {ledger.length === 0 ? <p className="text-xs text-slate-400 py-3 text-center">No ledger transactions posted.</p> : null}
                  </div>
                </div>

                {/* Payments History */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Payments Received</h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-200 text-xs">
                        <div>
                          <p className="font-bold text-emerald-900">{p.receiptNumber || "Payment Receipt"}</p>
                          <p className="text-[10px] text-slate-400">{p.occurredAt?.slice(0, 10)} · {p.reference || "Direct Settlement"}</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-700">Rs. {Number(p.totalAmount).toLocaleString()}</span>
                      </div>
                    ))}
                    {payments.length === 0 ? <p className="text-xs text-slate-400 py-3 text-center">No payment receipts recorded.</p> : null}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
