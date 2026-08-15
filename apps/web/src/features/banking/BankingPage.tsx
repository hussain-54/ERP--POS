import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { financeApi } from "@/features/accounts/finance-api";

export function BankingPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    name: "",
    accountKind: "bank",
    bankName: "",
    accountNumber: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const [importForm, setImportForm] = useState({
    label: "Import",
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
    const a = await financeApi.listBankAccounts();
    setAccounts(a.items);
    if (!selectedId && a.items[0]) setSelectedId(String(a.items[0].id));
  }

  async function loadLines(id: string) {
    if (!id) return;
    const res = await financeApi.listStatementLines(id);
    setLines(res.items);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadLines(selectedId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.push({ title: "Bank account created", tone: "success" });
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
      toast.push({ title: "Statement imported", tone: "success" });
      await loadLines(selectedId);
    } catch (err) {
      toast.push({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function ignoreLine(id: string) {
    try {
      await financeApi.matchLine({ statementLineId: id, ignore: true });
      await loadLines(selectedId);
    } catch (err) {
      toast.push({
        title: "Match failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onReconcile(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    try {
      const row = await financeApi.reconcile({
        bankAccountId: selectedId,
        periodStart: recon.periodStart,
        periodEnd: recon.periodEnd,
        statementBalance: Number(recon.statementBalance),
      });
      toast.push({
        title: "Reconciliation saved",
        description: `Difference: ${String((row as Record<string, unknown>).difference ?? 0)}`,
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Reconcile failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Banking</h1>

      <Card title="Add cash / bank / online account">
        <Form onSubmit={onCreate}>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Select
            label="Kind"
            value={form.accountKind}
            onChange={(e) => setForm((p) => ({ ...p, accountKind: e.target.value }))}
            options={[
              { value: "cash", label: "Cash" },
              { value: "bank", label: "Bank" },
              { value: "online", label: "Online" },
            ]}
          />
          <Input
            label="Bank name"
            value={form.bankName}
            onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
          />
          <Input
            label="Account number"
            value={form.accountNumber}
            onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Create</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Accounts">
        <Select
          label="Active account"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          options={accounts.map((a) => ({
            value: String(a.id),
            label: `${String(a.name)} (${String(a.account_kind)})`,
          }))}
        />
      </Card>

      <Card title="Import statement line">
        <Form onSubmit={onImport}>
          <Input
            label="Label"
            value={importForm.label}
            onChange={(e) => setImportForm((p) => ({ ...p, label: e.target.value }))}
          />
          <Input
            label="Date"
            type="date"
            value={importForm.date}
            onChange={(e) => setImportForm((p) => ({ ...p, date: e.target.value }))}
          />
          <Input
            label="Description"
            value={importForm.description}
            onChange={(e) => setImportForm((p) => ({ ...p, description: e.target.value }))}
          />
          <Input
            label="Amount (+in / -out)"
            value={importForm.amount}
            onChange={(e) => setImportForm((p) => ({ ...p, amount: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Import</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Statement lines">
        <div className="max-h-56 overflow-auto text-sm">
          {lines.map((l) => (
            <div key={String(l.id)} className="flex items-center justify-between gap-2 border-b py-1">
              <span>
                {String(l.statement_date)} · {String(l.description ?? "")} · {String(l.amount)} ·{" "}
                {String(l.match_status)}
              </span>
              {l.match_status === "unmatched" && (
                <Button type="button" onClick={() => void ignoreLine(String(l.id))}>
                  Ignore
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Reconcile">
        <Form onSubmit={onReconcile}>
          <Input
            label="Period start"
            type="date"
            value={recon.periodStart}
            onChange={(e) => setRecon((p) => ({ ...p, periodStart: e.target.value }))}
          />
          <Input
            label="Period end"
            type="date"
            value={recon.periodEnd}
            onChange={(e) => setRecon((p) => ({ ...p, periodEnd: e.target.value }))}
          />
          <Input
            label="Statement balance"
            value={recon.statementBalance}
            onChange={(e) => setRecon((p) => ({ ...p, statementBalance: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Run reconciliation</Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
