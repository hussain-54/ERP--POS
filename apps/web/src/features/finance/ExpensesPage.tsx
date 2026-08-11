import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { financeApi } from "./finance-api";

function uuid() {
  return crypto.randomUUID();
}

const CATEGORIES = [
  "rent",
  "electricity",
  "salary",
  "internet",
  "transport",
  "petrol",
  "repair",
  "marketing",
  "office",
  "miscellaneous",
  "custom",
];

export function ExpensesPage() {
  const toast = useToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [periodReport, setPeriodReport] = useState<Array<Record<string, unknown>>>([]);
  const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [form, setForm] = useState({
    categoryKey: "rent",
    amount: "0",
    taxAmount: "0",
    payee: "",
    notes: "",
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const [exp, report] = await Promise.all([
      financeApi.listExpenses(),
      financeApi.report("expenses", `?period=${period}`) as Promise<{
        items: Array<Record<string, unknown>>;
      }>,
    ]);
    setItems(exp.items);
    setPeriodReport(report.items ?? []);
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
  }, [period]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await financeApi.createExpense({
        categoryKey: form.categoryKey,
        amount: Number(form.amount),
        taxAmount: Number(form.taxAmount),
        payee: form.payee || undefined,
        notes: form.notes || undefined,
        expenseDate: form.expenseDate,
        idempotencyKey: uuid(),
      });
      toast.push({ title: "Expense posted", tone: "success" });
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
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Expenses</h1>

      <Card title="Record expense">
        <Form onSubmit={onCreate}>
          <Select
            label="Category"
            value={form.categoryKey}
            onChange={(e) => setForm((p) => ({ ...p, categoryKey: e.target.value }))}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <Input
            label="Date"
            type="date"
            value={form.expenseDate}
            onChange={(e) => setForm((p) => ({ ...p, expenseDate: e.target.value }))}
          />
          <Input
            label="Amount"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
          />
          <Input
            label="Tax"
            value={form.taxAmount}
            onChange={(e) => setForm((p) => ({ ...p, taxAmount: e.target.value }))}
          />
          <Input
            label="Payee"
            value={form.payee}
            onChange={(e) => setForm((p) => ({ ...p, payee: e.target.value }))}
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Post expense</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Recent expenses">
        <div className="max-h-56 overflow-auto text-sm">
          {items.map((e) => (
            <div key={String(e.id)} className="flex justify-between border-b py-1">
              <span>
                {String(e.expense_number)} · {String(e.expense_date)} · {String(e.payee ?? "")}
              </span>
              <span>{String(e.amount)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Expense report">
        <Select
          label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as "daily" | "monthly" | "yearly")}
          options={[
            { value: "daily", label: "Daily" },
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
          ]}
        />
        <div className="mt-2 max-h-48 overflow-auto text-sm">
          {periodReport.map((r, i) => (
            <div key={i} className="flex justify-between border-b py-1">
              <span>
                {String(r.period)} · {String(r.category)}
              </span>
              <span>{String(r.total)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
