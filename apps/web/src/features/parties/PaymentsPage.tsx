import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { partiesApi } from "./parties-api";
import { useAuth } from "@/features/auth/AuthContext";

function uuid() {
  return crypto.randomUUID();
}

export function PaymentsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [methods, setMethods] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    customerId: "",
    cash: "20000",
    bank: "20000",
    credit: "10000",
    billTotal: "50000",
  });

  useEffect(() => {
    void partiesApi
      .seedPaymentMethods()
      .then((res) => setMethods(res.items))
      .catch(() =>
        partiesApi.listPaymentMethods().then((res) => setMethods(res.items)),
      );
  }, []);

  function methodId(kind: string): string {
    const found = methods.find((m) => String(m.kind) === kind);
    return found ? String(found.id) : "";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) {
      toast.push({ title: "Select a branch", tone: "danger" });
      return;
    }
    try {
      const splits = [
        { paymentMethodId: methodId("cash"), amount: form.cash },
        { paymentMethodId: methodId("bank"), amount: form.bank },
        { paymentMethodId: methodId("credit"), amount: form.credit },
      ].filter((s) => s.paymentMethodId && Number(s.amount) > 0);

      const payment = await partiesApi.postPayment({
        branchId,
        direction: "receive",
        partyType: "customer",
        customerId: form.customerId,
        splits,
        billTotal: form.billTotal,
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      toast.push({
        title: "Split payment posted",
        description: `Receipt ${payment.receiptNumber ?? payment.id}`,
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Configurable methods (cash, bank, card, JazzCash, Easypaisa, SadaPay, online, credit,
        installment). Split example: 50,000 = 20k cash + 20k bank + 10k credit.
      </p>

      <Card title="Payment methods">
        <ul className="flex flex-wrap gap-2 text-sm">
          {methods.map((m) => (
            <li key={String(m.id)} className="rounded-lg border px-2 py-1">
              {String(m.name)} ({String(m.kind)})
            </li>
          ))}
        </ul>
        <Button className="mt-3" variant="secondary" onClick={() => void partiesApi.seedPaymentMethods().then((r) => setMethods(r.items))}>
          Seed system methods
        </Button>
      </Card>

      <Card title="Split payment">
        <Form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Customer ID" required value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))} />
            <Input label="Bill total" required value={form.billTotal} onChange={(e) => setForm((p) => ({ ...p, billTotal: e.target.value }))} />
            <Input label="Cash" value={form.cash} onChange={(e) => setForm((p) => ({ ...p, cash: e.target.value }))} />
            <Input label="Bank" value={form.bank} onChange={(e) => setForm((p) => ({ ...p, bank: e.target.value }))} />
            <Input label="Credit" value={form.credit} onChange={(e) => setForm((p) => ({ ...p, credit: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Post split payment</Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
