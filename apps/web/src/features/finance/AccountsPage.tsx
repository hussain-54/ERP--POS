import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { financeApi } from "./finance-api";

function uuid() {
  return crypto.randomUUID();
}

export function AccountsPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [vouchers, setVouchers] = useState<Array<Record<string, unknown>>>([]);
  const [journals, setJournals] = useState<Array<Record<string, unknown>>>([]);
  const [voucher, setVoucher] = useState({
    voucherType: "journal",
    debitCode: "1000",
    creditCode: "4000",
    amount: "0",
    memo: "",
  });

  async function load() {
    const [a, v, j] = await Promise.all([
      financeApi.listAccounts(),
      financeApi.listVouchers(),
      financeApi.listJournals(),
    ]);
    setAccounts(a.items);
    setVouchers(v.items);
    setJournals(j.items);
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

  async function seed() {
    try {
      await financeApi.seedCoa();
      toast.push({ title: "Chart of accounts seeded", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Seed failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function onVoucher(e: FormEvent) {
    e.preventDefault();
    const amount = Number(voucher.amount);
    try {
      await financeApi.createVoucher({
        voucherType: voucher.voucherType,
        memo: voucher.memo || undefined,
        lines: [
          { accountCode: voucher.debitCode, debit: amount, credit: 0 },
          { accountCode: voucher.creditCode, debit: 0, credit: amount },
        ],
        idempotencyKey: uuid(),
      });
      toast.push({ title: "Voucher posted", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Voucher failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Accounts & Finance</h1>
        <Button type="button" onClick={() => void seed()}>
          Seed COA
        </Button>
      </div>

      <Card title="Chart of accounts">
        <div className="max-h-64 overflow-auto text-sm">
          {accounts.map((a) => (
            <div key={String(a.id)} className="flex justify-between border-b py-1">
              <span>
                {String(a.code)} — {String(a.name)}
              </span>
              <Badge>{String(a.account_type ?? a.accountType ?? "")}</Badge>
            </div>
          ))}
          {!accounts.length && <p className="text-sm opacity-70">No accounts — seed the COA.</p>}
        </div>
      </Card>

      <Card title="Post voucher">
        <Form onSubmit={onVoucher}>
          <Select
            label="Type"
            value={voucher.voucherType}
            onChange={(e) => setVoucher((p) => ({ ...p, voucherType: e.target.value }))}
            options={[
              { value: "receipt", label: "Receipt" },
              { value: "payment", label: "Payment" },
              { value: "expense", label: "Expense" },
              { value: "journal", label: "Journal" },
              { value: "transfer", label: "Transfer" },
            ]}
          />
          <Input
            label="Debit account code"
            value={voucher.debitCode}
            onChange={(e) => setVoucher((p) => ({ ...p, debitCode: e.target.value }))}
          />
          <Input
            label="Credit account code"
            value={voucher.creditCode}
            onChange={(e) => setVoucher((p) => ({ ...p, creditCode: e.target.value }))}
          />
          <Input
            label="Amount"
            value={voucher.amount}
            onChange={(e) => setVoucher((p) => ({ ...p, amount: e.target.value }))}
          />
          <Input
            label="Memo"
            value={voucher.memo}
            onChange={(e) => setVoucher((p) => ({ ...p, memo: e.target.value }))}
          />
          <FormActions>
            <Button type="submit">Post</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Recent vouchers">
        <div className="max-h-48 overflow-auto text-sm">
          {vouchers.map((v) => (
            <div key={String(v.id)} className="flex justify-between border-b py-1">
              <span>
                {String(v.voucher_number)} · {String(v.voucher_type)}
              </span>
              <span>{String(v.total_amount)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Journal entries">
        <div className="max-h-48 overflow-auto text-sm">
          {journals.map((j) => (
            <div key={String(j.id)} className="flex justify-between border-b py-1">
              <span>
                {String(j.entry_number)} · {String(j.source_type)}
              </span>
              <span>{String(j.entry_date)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
