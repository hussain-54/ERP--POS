import { ValidationDomainError } from "./errors.js";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type JournalLineDraft = {
  code: string;
  name: string;
  accountType: AccountType;
  systemRole?: string;
  debit: number;
  credit: number;
  memo?: string;
};

/** Standard chart of accounts used by automatic posting. */
export const STANDARD_COA: Array<{
  code: string;
  name: string;
  accountType: AccountType;
  systemRole: string;
}> = [
  { code: "1000", name: "Cash", accountType: "asset", systemRole: "cash" },
  { code: "1010", name: "Bank", accountType: "asset", systemRole: "bank" },
  { code: "1020", name: "Online Payments", accountType: "asset", systemRole: "bank" },
  { code: "1100", name: "Accounts Receivable", accountType: "asset", systemRole: "customer_receivable" },
  { code: "1200", name: "Input Tax", accountType: "asset", systemRole: "tax_input" },
  { code: "1300", name: "Inventory Asset", accountType: "asset", systemRole: "inventory" },
  { code: "2000", name: "Accounts Payable", accountType: "liability", systemRole: "supplier_payable" },
  { code: "2100", name: "Output Tax", accountType: "liability", systemRole: "tax_output" },
  { code: "3000", name: "Owner Equity", accountType: "equity", systemRole: "equity" },
  { code: "4000", name: "Sales Revenue", accountType: "income", systemRole: "sales" },
  { code: "4100", name: "Sales Returns", accountType: "income", systemRole: "sales_returns" },
  { code: "4200", name: "Sales Discounts", accountType: "income", systemRole: "discounts" },
  { code: "4300", name: "Other Income", accountType: "income", systemRole: "income" },
  { code: "5000", name: "Cost of Goods Sold", accountType: "expense", systemRole: "cogs" },
  { code: "5100", name: "Purchase Returns", accountType: "expense", systemRole: "purchase_returns" },
  { code: "5200", name: "Purchases", accountType: "expense", systemRole: "purchases" },
  { code: "6000", name: "Expenses", accountType: "expense", systemRole: "expenses" },
  { code: "6100", name: "Rent Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6200", name: "Electricity Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6300", name: "Salary Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6400", name: "Internet Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6500", name: "Transport Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6600", name: "Petrol Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6700", name: "Repair Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6800", name: "Marketing Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6900", name: "Office Expense", accountType: "expense", systemRole: "expenses" },
  { code: "6999", name: "Miscellaneous Expense", accountType: "expense", systemRole: "expenses" },
];

export const EXPENSE_CATEGORY_CODES: Record<string, string> = {
  rent: "6100",
  electricity: "6200",
  salary: "6300",
  internet: "6400",
  transport: "6500",
  petrol: "6600",
  repair: "6700",
  marketing: "6800",
  office: "6900",
  miscellaneous: "6999",
  custom: "6000",
};

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function assertJournalBalanced(lines: JournalLineDraft[]): void {
  const debit = money(lines.reduce((s, l) => s + l.debit, 0));
  const credit = money(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(debit - credit) > 0.009) {
    throw new ValidationDomainError(
      `Journal must balance (debit ${debit} != credit ${credit})`,
    );
  }
  for (const line of lines) {
    if ((line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0)) {
      throw new ValidationDomainError(
        `Invalid journal line ${line.code}: each line needs debit XOR credit`,
      );
    }
  }
}

function pushIf(
  lines: JournalLineDraft[],
  condition: boolean,
  line: JournalLineDraft,
): void {
  if (condition && (line.debit > 0 || line.credit > 0)) lines.push(line);
}

/**
 * Sale posting:
 * DR AR (gross) / CR Sales (net of discount) / CR Tax / DR Discount
 * DR COGS / CR Inventory
 * Optional settlement: DR Cash/Bank / CR AR for paid portion
 */
export function buildSaleJournalLines(input: {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  cogs: number;
  paidCash?: number;
  paidBank?: number;
}): JournalLineDraft[] {
  // Credit sales at subtotal; discount is contra (debit); tax credited separately.
  const lines: JournalLineDraft[] = [];

  pushIf(lines, true, {
    code: "1100",
    name: "Accounts Receivable",
    accountType: "asset",
    systemRole: "customer_receivable",
    debit: money(input.grandTotal),
    credit: 0,
  });
  pushIf(lines, input.subtotal > 0, {
    code: "4000",
    name: "Sales Revenue",
    accountType: "income",
    systemRole: "sales",
    debit: 0,
    credit: money(input.subtotal),
  });
  pushIf(lines, input.discountTotal > 0, {
    code: "4200",
    name: "Sales Discounts",
    accountType: "income",
    systemRole: "discounts",
    debit: money(input.discountTotal),
    credit: 0,
  });
  pushIf(lines, input.taxTotal > 0, {
    code: "2100",
    name: "Output Tax",
    accountType: "liability",
    systemRole: "tax_output",
    debit: 0,
    credit: money(input.taxTotal),
  });

  const cogs = money(input.cogs);
  pushIf(lines, cogs > 0, {
    code: "5000",
    name: "Cost of Goods Sold",
    accountType: "expense",
    systemRole: "cogs",
    debit: cogs,
    credit: 0,
  });
  pushIf(lines, cogs > 0, {
    code: "1300",
    name: "Inventory Asset",
    accountType: "asset",
    systemRole: "inventory",
    debit: 0,
    credit: cogs,
  });

  const paidCash = money(input.paidCash ?? 0);
  const paidBank = money(input.paidBank ?? 0);
  pushIf(lines, paidCash > 0, {
    code: "1000",
    name: "Cash",
    accountType: "asset",
    systemRole: "cash",
    debit: paidCash,
    credit: 0,
  });
  pushIf(lines, paidBank > 0, {
    code: "1010",
    name: "Bank",
    accountType: "asset",
    systemRole: "bank",
    debit: paidBank,
    credit: 0,
  });
  const settled = money(paidCash + paidBank);
  pushIf(lines, settled > 0, {
    code: "1100",
    name: "Accounts Receivable",
    accountType: "asset",
    systemRole: "customer_receivable",
    debit: 0,
    credit: settled,
  });

  // Collapse duplicate AR lines into net if both present
  const collapsed = collapseByCodeSide(lines);
  assertJournalBalanced(collapsed);
  return collapsed;
}

function collapseByCodeSide(lines: JournalLineDraft[]): JournalLineDraft[] {
  const map = new Map<string, JournalLineDraft>();
  for (const line of lines) {
    const key = `${line.code}|${line.debit > 0 ? "D" : "C"}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...line });
      continue;
    }
    existing.debit = money(existing.debit + line.debit);
    existing.credit = money(existing.credit + line.credit);
  }
  // Net AR if both debit and credit exist
  const arDebit = map.get("1100|D");
  const arCredit = map.get("1100|C");
  if (arDebit && arCredit) {
    const net = money(arDebit.debit - arCredit.credit);
    map.delete("1100|D");
    map.delete("1100|C");
    if (net > 0) {
      map.set("1100|D", { ...arDebit, debit: net, credit: 0 });
    } else if (net < 0) {
      map.set("1100|C", { ...arCredit, debit: 0, credit: money(-net) });
    }
  }
  return [...map.values()].filter((l) => l.debit > 0 || l.credit > 0);
}

export function buildSaleReturnJournalLines(input: {
  refundAmount: number;
  taxTotal?: number;
  cogs?: number;
}): JournalLineDraft[] {
  const refund = money(input.refundAmount);
  const tax = money(input.taxTotal ?? 0);
  const net = money(refund - tax);
  const lines: JournalLineDraft[] = [
    {
      code: "4100",
      name: "Sales Returns",
      accountType: "income",
      systemRole: "sales_returns",
      debit: net,
      credit: 0,
    },
    {
      code: "1100",
      name: "Accounts Receivable",
      accountType: "asset",
      systemRole: "customer_receivable",
      debit: 0,
      credit: refund,
    },
  ];
  if (tax > 0) {
    lines.push({
      code: "2100",
      name: "Output Tax",
      accountType: "liability",
      systemRole: "tax_output",
      debit: tax,
      credit: 0,
    });
  }
  const cogs = money(input.cogs ?? 0);
  if (cogs > 0) {
    lines.push(
      {
        code: "1300",
        name: "Inventory Asset",
        accountType: "asset",
        systemRole: "inventory",
        debit: cogs,
        credit: 0,
      },
      {
        code: "5000",
        name: "Cost of Goods Sold",
        accountType: "expense",
        systemRole: "cogs",
        debit: 0,
        credit: cogs,
      },
    );
  }
  assertJournalBalanced(lines);
  return lines;
}

/**
 * Purchase: DR Inventory (+ input tax) / CR AP
 * Optional: DR AP / CR Cash|Bank for paid portion
 */
export function buildPurchaseJournalLines(input: {
  inventoryAmount: number;
  taxTotal: number;
  grandTotal: number;
  paidCash?: number;
  paidBank?: number;
}): JournalLineDraft[] {
  const lines: JournalLineDraft[] = [];
  pushIf(lines, true, {
    code: "1300",
    name: "Inventory Asset",
    accountType: "asset",
    systemRole: "inventory",
    debit: money(input.inventoryAmount),
    credit: 0,
  });
  pushIf(lines, input.taxTotal > 0, {
    code: "1200",
    name: "Input Tax",
    accountType: "asset",
    systemRole: "tax_input",
    debit: money(input.taxTotal),
    credit: 0,
  });
  pushIf(lines, true, {
    code: "2000",
    name: "Accounts Payable",
    accountType: "liability",
    systemRole: "supplier_payable",
    debit: 0,
    credit: money(input.grandTotal),
  });

  const paidCash = money(input.paidCash ?? 0);
  const paidBank = money(input.paidBank ?? 0);
  const settled = money(paidCash + paidBank);
  pushIf(lines, settled > 0, {
    code: "2000",
    name: "Accounts Payable",
    accountType: "liability",
    systemRole: "supplier_payable",
    debit: settled,
    credit: 0,
  });
  pushIf(lines, paidCash > 0, {
    code: "1000",
    name: "Cash",
    accountType: "asset",
    systemRole: "cash",
    debit: 0,
    credit: paidCash,
  });
  pushIf(lines, paidBank > 0, {
    code: "1010",
    name: "Bank",
    accountType: "asset",
    systemRole: "bank",
    debit: 0,
    credit: paidBank,
  });

  const collapsed = collapseAp(lines);
  assertJournalBalanced(collapsed);
  return collapsed;
}

function collapseAp(lines: JournalLineDraft[]): JournalLineDraft[] {
  const map = new Map<string, JournalLineDraft>();
  for (const line of lines) {
    const key = `${line.code}|${line.debit > 0 ? "D" : "C"}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...line });
      continue;
    }
    existing.debit = money(existing.debit + line.debit);
    existing.credit = money(existing.credit + line.credit);
  }
  const apD = map.get("2000|D");
  const apC = map.get("2000|C");
  if (apD && apC) {
    const net = money(apC.credit - apD.debit);
    map.delete("2000|D");
    map.delete("2000|C");
    if (net > 0) map.set("2000|C", { ...apC, debit: 0, credit: net });
    else if (net < 0) map.set("2000|D", { ...apD, debit: money(-net), credit: 0 });
  }
  return [...map.values()].filter((l) => l.debit > 0 || l.credit > 0);
}

export function buildPurchaseReturnJournalLines(input: {
  refundAmount: number;
  taxTotal?: number;
}): JournalLineDraft[] {
  const refund = money(input.refundAmount);
  const tax = money(input.taxTotal ?? 0);
  const inventory = money(refund - tax);
  const lines: JournalLineDraft[] = [
    {
      code: "2000",
      name: "Accounts Payable",
      accountType: "liability",
      systemRole: "supplier_payable",
      debit: refund,
      credit: 0,
    },
    {
      code: "1300",
      name: "Inventory Asset",
      accountType: "asset",
      systemRole: "inventory",
      debit: 0,
      credit: inventory,
    },
  ];
  if (tax > 0) {
    lines.push({
      code: "1200",
      name: "Input Tax",
      accountType: "asset",
      systemRole: "tax_input",
      debit: 0,
      credit: tax,
    });
  }
  assertJournalBalanced(lines);
  return lines;
}

export function buildExpenseJournalLines(input: {
  amount: number;
  taxAmount?: number;
  expenseCode: string;
  expenseName: string;
  payFromCode?: string;
}): JournalLineDraft[] {
  const amount = money(input.amount);
  const tax = money(input.taxAmount ?? 0);
  const payCode = input.payFromCode ?? "1000";
  const payName = payCode === "1010" ? "Bank" : payCode === "1020" ? "Online Payments" : "Cash";
  const lines: JournalLineDraft[] = [
    {
      code: input.expenseCode,
      name: input.expenseName,
      accountType: "expense",
      systemRole: "expenses",
      debit: amount,
      credit: 0,
    },
  ];
  if (tax > 0) {
    lines.push({
      code: "1200",
      name: "Input Tax",
      accountType: "asset",
      systemRole: "tax_input",
      debit: tax,
      credit: 0,
    });
  }
  lines.push({
    code: payCode,
    name: payName,
    accountType: "asset",
    systemRole: payCode === "1000" ? "cash" : "bank",
    debit: 0,
    credit: money(amount + tax),
  });
  assertJournalBalanced(lines);
  return lines;
}

export function buildTransferJournalLines(input: {
  fromCode: string;
  toCode: string;
  amount: number;
}): JournalLineDraft[] {
  const amount = money(input.amount);
  const lines: JournalLineDraft[] = [
    {
      code: input.toCode,
      name: input.toCode,
      accountType: "asset",
      debit: amount,
      credit: 0,
    },
    {
      code: input.fromCode,
      name: input.fromCode,
      accountType: "asset",
      debit: 0,
      credit: amount,
    },
  ];
  assertJournalBalanced(lines);
  return lines;
}

export function voucherNeedsBalancedLines(
  lines: Array<{ debit?: number; credit?: number }>,
): void {
  assertJournalBalanced(
    lines.map((l, i) => ({
      code: `L${i}`,
      name: `L${i}`,
      accountType: "asset" as const,
      debit: money(l.debit ?? 0),
      credit: money(l.credit ?? 0),
    })),
  );
}
