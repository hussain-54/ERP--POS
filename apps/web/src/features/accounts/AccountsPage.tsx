import { useEffect, useState, type FormEvent } from "react";
import { Badge, Breadcrumb, Button, Card, DataTable, Form, FormActions, Input, KpiCard, PageHeader, Select, useToast } from "@electronic-erp/ui";
import { financeApi } from "./finance-api";

function uuid() {
  return crypto.randomUUID();
}

export function AccountsPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([]);
  const [vouchers, setVouchers] = useState<Array<Record<string, unknown>>>([]);
  const [journals, setJournals] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState({
    voucherType: "journal",
    debitCode: "1000",
    creditCode: "4000",
    amount: "0",
    memo: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [a, v, j] = await Promise.all([
        financeApi.listAccounts(),
        financeApi.listVouchers(),
        financeApi.listJournals(),
      ]);
      setAccounts(a.items);
      setVouchers(v.items);
      setJournals(j.items);
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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function seed() {
    try {
      await financeApi.seedCoa();
      toast.push({ title: "Chart of Accounts seeded successfully", tone: "success" });
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
    if (!amount || amount <= 0) {
      toast.push({ title: "Enter a valid amount", tone: "warning" });
      return;
    }
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
      toast.push({ title: "Voucher posted successfully", tone: "success" });
      setVoucher((p) => ({ ...p, amount: "0", memo: "" }));
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
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Finance & Accounts", href: "/accounts" },
          { label: "Chart of Accounts & Vouchers" },
        ]}
      />

      <PageHeader
        moduleNumber="16"
        title="Chart of Accounts & General Ledger"
        description="Double-entry financial accounting: Chart of accounts, journal entries, payment/receipt vouchers, trial balance, and automatic ledger synchronization."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void seed()}
            leftIcon={<i className="fa-solid fa-seedling text-emerald-600" />}
          >
            Seed Standard COA
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Active Accounts (COA)"
          value={accounts.length.toLocaleString()}
          tone="brand"
          icon={<i className="fa-solid fa-book-bookmark" />}
        />
        <KpiCard
          label="Posted Vouchers"
          value={vouchers.length.toLocaleString()}
          icon={<i className="fa-solid fa-receipt" />}
        />
        <KpiCard
          label="Journal Transactions"
          value={journals.length.toLocaleString()}
          tone="success"
          icon={<i className="fa-solid fa-scale-balanced" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Post Voucher Form Card */}
        <Card title="Post Accounting Voucher" description="Record a double-entry debit/credit transaction." divided className="lg:col-span-1">
          <Form onSubmit={onVoucher} className="space-y-3">
            <Select
              label="Voucher Type"
              value={voucher.voucherType}
              onChange={(e) => setVoucher((p) => ({ ...p, voucherType: e.target.value }))}
              options={[
                { value: "journal", label: "Journal Voucher (JV)" },
                { value: "receipt", label: "Cash/Bank Receipt (CR/BR)" },
                { value: "payment", label: "Cash/Bank Payment (CP/BP)" },
                { value: "expense", label: "Expense Voucher" },
                { value: "transfer", label: "Account Transfer" },
              ]}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Debit Account Code"
                value={voucher.debitCode}
                onChange={(e) => setVoucher((p) => ({ ...p, debitCode: e.target.value }))}
                placeholder="1000"
                required
              />
              <Input
                label="Credit Account Code"
                value={voucher.creditCode}
                onChange={(e) => setVoucher((p) => ({ ...p, creditCode: e.target.value }))}
                placeholder="4000"
                required
              />
            </div>

            <Input
              label="Transaction Amount (Rs.)"
              type="number"
              value={voucher.amount}
              onChange={(e) => setVoucher((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              required
            />

            <Input
              label="Memo / Description"
              value={voucher.memo}
              onChange={(e) => setVoucher((p) => ({ ...p, memo: e.target.value }))}
              placeholder="e.g. Monthly electricity bill payment"
            />

            <FormActions>
              <Button type="submit" className="w-full">
                Post Voucher & Update Ledger
              </Button>
            </FormActions>
          </Form>
        </Card>

        {/* Chart of Accounts & Recent Vouchers */}
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Chart of Accounts (${accounts.length})`} description="Configured accounting hierarchy." divided>
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {accounts.map((a) => (
                <div key={String(a.id)} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {String(a.code)}
                    </span>
                    <span className="font-bold text-slate-800">{String(a.name)}</span>
                  </div>
                  <Badge tone="brand" size="sm">{String(a.account_type ?? a.accountType ?? "Account")}</Badge>
                </div>
              ))}
              {!accounts.length && !loading ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No accounts loaded. Click "Seed Standard COA" to initialize standard chart of accounts.
                </div>
              ) : null}
            </div>
          </Card>

          {vouchers.length ? (
            <Card title="Recent Posted Vouchers" description="Audit list of posted financial vouchers." divided>
              <DataTable
                rows={vouchers.slice(0, 10)}
                rowKey={(v) => String(v.id)}
                columns={[
                  {
                    key: "num",
                    header: "Voucher #",
                    cell: (v) => <span className="font-mono font-bold text-slate-900">{String(v.voucher_number || v.voucherNumber || v.id).slice(0, 12)}</span>,
                  },
                  {
                    key: "type",
                    header: "Type",
                    cell: (v) => <Badge tone="neutral" size="sm">{String(v.voucher_type || v.voucherType)}</Badge>,
                  },
                  {
                    key: "memo",
                    header: "Memo",
                    cell: (v) => <span className="text-xs text-slate-600 truncate max-w-xs">{String(v.memo || "—")}</span>,
                  },
                  {
                    key: "amount",
                    header: "Amount (Rs.)",
                    align: "right",
                    cell: (v) => <span className="font-mono font-bold text-slate-900">{Number(v.total_debit || v.amount || 0).toLocaleString()}</span>,
                  },
                ]}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
