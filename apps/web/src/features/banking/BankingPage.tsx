import { useEffect, useState, type FormEvent } from "react";
import { Badge, Breadcrumb, Button, Card, DataTable, Form, FormActions, Input, KpiCard, PageHeader, Select, useToast } from "@electronic-erp/ui";
import { financeApi } from "@/features/accounts/finance-api";

export function BankingPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    accountKind: "bank",
    bankName: "",
    accountNumber: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [importForm, setImportForm] = useState({
    label: "Bank Statement Import",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "0",
  });
  const [recon, setRecon] = useState({
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    statementBalance: "0",
  });

  async function load() {
    setLoading(true);
    try {
      const a = await financeApi.listBankAccounts();
      setAccounts(a.items);
      if (!selectedId && a.items[0]) setSelectedId(String(a.items[0].id));
    } catch (err) {
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadLines(id: string) {
    if (!id) return;
    try {
      const res = await financeApi.listStatementLines(id);
      setLines(res.items);
    } catch {
      setLines([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadLines(selectedId);
  }, [selectedId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await financeApi.createBankAccount({
        name: form.name,
        accountKind: form.accountKind,
        bankName: form.bankName || undefined,
        accountNumber: form.accountNumber || undefined,
      });
      toast.push({ title: "Bank account created successfully", tone: "success" });
      setForm({ name: "", accountKind: "bank", bankName: "", accountNumber: "" });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await financeApi.importStatement({
        bankAccountId: selectedId,
        importLabel: importForm.label,
        lines: [
          {
            statementDate: importForm.date,
            description: importForm.description || undefined,
            amount: Number(importForm.amount),
          },
        ],
      });
      toast.push({ title: "Statement line imported", tone: "success" });
      setImportForm((p) => ({ ...p, amount: "0", description: "" }));
      await loadLines(selectedId);
    } catch (err) {
      toast.push({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onReconcile(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    try {
      const result = await financeApi.reconcile({
        bankAccountId: selectedId,
        periodStart: recon.periodStart,
        periodEnd: recon.periodEnd,
        statementEndingBalance: Number(recon.statementBalance),
      }) as { isReconciled?: boolean; glEndingBalance?: number; difference?: number };
      toast.push({
        title: result.isReconciled ? "Bank reconciled (Exact Match)" : "Reconciliation difference detected",
        description: `GL balance: Rs. ${Number(result.glEndingBalance || 0).toLocaleString()} · Difference: Rs. ${Number(result.difference || 0).toLocaleString()}`,
        tone: result.isReconciled ? "success" : "warning",
      });
    } catch (err) {
      toast.push({
        title: "Reconciliation failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  const selectedAccount = accounts.find((a) => String(a.id) === selectedId);

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Finance & Accounts", href: "/banking" },
          { label: "Bank Accounts & Reconciliation" },
        ]}
      />

      <PageHeader
        moduleNumber="17"
        title="Banking & Bank Reconciliation"
        description="Manage corporate bank accounts, cash registers, electronic statement imports, and automated statement vs General Ledger reconciliation."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Registered Bank Accounts"
          value={accounts.length.toLocaleString()}
          tone="brand"
          icon={<i className="fa-solid fa-building-columns" />}
        />
        <KpiCard
          label="Statement Lines"
          value={lines.length.toLocaleString()}
          icon={<i className="fa-solid fa-list-check" />}
        />
        <KpiCard
          label="Active Selected Account"
          value={selectedAccount ? String(selectedAccount.name) : "None"}
          tone="success"
          icon={<i className="fa-solid fa-landmark" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account Creation & Reconciliation forms */}
        <div className="space-y-4 lg:col-span-1">
          <Card title="Add Bank / Cash Account" description="Register a business bank account or branch cash drawer." divided>
            <Form onSubmit={onCreate} className="space-y-2.5">
              <Input
                label="Account Title"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Meezan Main Operational"
              />
              <Select
                label="Account Kind"
                value={form.accountKind}
                onChange={(e) => setForm((p) => ({ ...p, accountKind: e.target.value }))}
                options={[
                  { value: "bank", label: "Bank Account" },
                  { value: "cash", label: "Cash in Hand / Drawer" },
                  { value: "wallet", label: "Mobile Wallet (JazzCash/Easypaisa)" },
                ]}
              />
              <Input
                label="Bank Name"
                value={form.bankName}
                onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                placeholder="e.g. Meezan Bank Ltd"
              />
              <Input
                label="Account / IBAN #"
                value={form.accountNumber}
                onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))}
                placeholder="PK00MEZN..."
              />
              <FormActions>
                <Button type="submit" className="w-full">
                  Create Bank Account
                </Button>
              </FormActions>
            </Form>
          </Card>

          <Card title="Automated Bank Reconciliation" description="Match bank statement ending balance against GL ledger." divided>
            <Form onSubmit={onReconcile} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Period Start"
                  type="date"
                  value={recon.periodStart}
                  onChange={(e) => setRecon((p) => ({ ...p, periodStart: e.target.value }))}
                  required
                />
                <Input
                  label="Period End"
                  type="date"
                  value={recon.periodEnd}
                  onChange={(e) => setRecon((p) => ({ ...p, periodEnd: e.target.value }))}
                  required
                />
              </div>
              <Input
                label="Bank Statement Ending Balance (Rs.)"
                type="number"
                value={recon.statementBalance}
                onChange={(e) => setRecon((p) => ({ ...p, statementBalance: e.target.value }))}
                placeholder="0.00"
                required
              />
              <FormActions>
                <Button type="submit" className="w-full">
                  Run Reconciliation Audit
                </Button>
              </FormActions>
            </Form>
          </Card>
        </div>

        {/* Bank Account Selection & Statement Lines */}
        <div className="space-y-4 lg:col-span-2">
          <Card title="Select Bank Account" description="View account details and statement transactions." divided>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {accounts.map((acc) => {
                const isSelected = String(acc.id) === selectedId;
                return (
                  <button
                    key={String(acc.id)}
                    type="button"
                    onClick={() => setSelectedId(String(acc.id))}
                    className={`flex items-start justify-between p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{String(acc.name)}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{String(acc.bank_name || acc.bankName || "Cash")} · {String(acc.account_number || acc.accountNumber || "—")}</p>
                    </div>
                    <Badge tone={isSelected ? "brand" : "neutral"} size="sm">
                      {String(acc.account_kind || acc.accountKind || "bank")}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Import Statement Line Form */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4 space-y-2">
              <p className="text-xs font-bold text-slate-800">Quick Statement Entry / Import</p>
              <Form onSubmit={onImport} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <Input
                  label="Date"
                  type="date"
                  value={importForm.date}
                  onChange={(e) => setImportForm((p) => ({ ...p, date: e.target.value }))}
                  required
                />
                <Input
                  label="Description"
                  value={importForm.description}
                  onChange={(e) => setImportForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Customer Transfer"
                />
                <Input
                  label="Amount (Rs.)"
                  type="number"
                  value={importForm.amount}
                  onChange={(e) => setImportForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
                <Button type="submit">Add Line</Button>
              </Form>
            </div>

            {/* Statement Lines Table */}
            <DataTable
              rows={lines}
              rowKey={(l) => String(l.id)}
              pageSize={10}
              loading={loading}
              emptyTitle="No statement lines recorded"
              emptyDescription="Import or add bank statement lines to perform reconciliation."
              columns={[
                {
                  key: "date",
                  header: "Statement Date",
                  cell: (l) => <span className="text-xs text-slate-600">{String(l.statement_date || l.statementDate || "").slice(0, 10)}</span>,
                },
                {
                  key: "desc",
                  header: "Transaction Description",
                  cell: (l) => <span className="font-medium text-slate-900 text-xs">{String(l.description || "—")}</span>,
                },
                {
                  key: "amount",
                  header: "Amount (Rs.)",
                  align: "right",
                  cell: (l) => (
                    <span className={`font-mono font-bold ${Number(l.amount) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {Number(l.amount || 0).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Reconciled Status",
                  cell: (l) => (
                    l.reconciled_at ? (
                      <Badge tone="success" size="sm">Reconciled</Badge>
                    ) : (
                      <Badge tone="warning" size="sm">Unmatched</Badge>
                    )
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
