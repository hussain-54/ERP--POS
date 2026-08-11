export type LedgerLine = {
  accountCode: string;
  accountName: string;
  accountType: "asset" | "liability" | "equity" | "income" | "expense";
  debit: number;
  credit: number;
};

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function buildTrialBalance(lines: LedgerLine[]): Array<{
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}> {
  const map = new Map<
    string,
    { accountCode: string; accountName: string; accountType: string; debit: number; credit: number }
  >();
  for (const line of lines) {
    const row = map.get(line.accountCode) ?? {
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountType: line.accountType,
      debit: 0,
      credit: 0,
    };
    row.debit = money(row.debit + line.debit);
    row.credit = money(row.credit + line.credit);
    map.set(line.accountCode, row);
  }
  return [...map.values()]
    .map((r) => {
      const net = money(r.debit - r.credit);
      if (net >= 0) return { ...r, debit: net, credit: 0 };
      return { ...r, debit: 0, credit: money(-net) };
    })
    .filter((r) => r.debit > 0 || r.credit > 0)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

export function buildProfitAndLoss(lines: LedgerLine[]): {
  income: number;
  expenses: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
  rows: Array<{ accountCode: string; accountName: string; amount: number; section: string }>;
} {
  let income = 0;
  let expenses = 0;
  let cogs = 0;
  const rows: Array<{ accountCode: string; accountName: string; amount: number; section: string }> =
    [];

  const byCode = new Map<string, LedgerLine & { net: number }>();
  for (const line of lines) {
    const existing = byCode.get(line.accountCode);
    const debit = money((existing?.debit ?? 0) + line.debit);
    const credit = money((existing?.credit ?? 0) + line.credit);
    byCode.set(line.accountCode, {
      ...line,
      debit,
      credit,
      net: money(credit - debit), // income natural credit
    });
  }

  for (const row of byCode.values()) {
    if (row.accountType === "income") {
      const amount = money(row.credit - row.debit);
      income = money(income + amount);
      rows.push({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount,
        section: "income",
      });
    } else if (row.accountType === "expense") {
      const amount = money(row.debit - row.credit);
      if (row.accountCode === "5000") cogs = money(cogs + amount);
      else expenses = money(expenses + amount);
      rows.push({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount,
        section: row.accountCode === "5000" ? "cogs" : "expense",
      });
    }
  }

  const grossProfit = money(income - cogs);
  const netProfit = money(grossProfit - expenses);
  return { income, expenses, cogs, grossProfit, netProfit, rows };
}

export function buildCashBook(
  lines: Array<{ date: string; memo?: string | null; debit: number; credit: number }>,
  opening = 0,
): { opening: number; closing: number; entries: Array<{ date: string; memo: string; debit: number; credit: number; balance: number }> } {
  let balance = money(opening);
  const entries = lines.map((l) => {
    balance = money(balance + l.debit - l.credit);
    return {
      date: l.date,
      memo: l.memo ?? "",
      debit: money(l.debit),
      credit: money(l.credit),
      balance,
    };
  });
  return { opening: money(opening), closing: balance, entries };
}

export function expenseReportByPeriod(
  expenses: Array<{ date: string; amount: number; category: string }>,
  period: "daily" | "monthly" | "yearly",
): Array<{ period: string; category: string; total: number }> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const d = e.date.slice(0, 10);
    let key: string;
    if (period === "yearly") key = d.slice(0, 4);
    else if (period === "monthly") key = d.slice(0, 7);
    else key = d;
    const mk = `${key}|${e.category}`;
    map.set(mk, money((map.get(mk) ?? 0) + e.amount));
  }
  return [...map.entries()]
    .map(([k, total]) => {
      const [p, category] = k.split("|");
      return { period: p!, category: category!, total };
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.category.localeCompare(b.category));
}
