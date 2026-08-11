import { z } from "zod";
import { AuditedFieldsSchema, MoneySchema, SignedMoneySchema, UuidSchema } from "./common.js";

export const AccountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const AccountSystemRoleSchema = z.enum([
  "cash",
  "bank",
  "customer_receivable",
  "supplier_payable",
  "sales",
  "purchases",
  "expenses",
  "income",
  "discounts",
  "sales_returns",
  "purchase_returns",
  "tax_input",
  "tax_output",
  "inventory",
  "cogs",
  "equity",
]);

export const AccountingAccountSchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  accountType: AccountTypeSchema,
  systemRole: AccountSystemRoleSchema.nullable().optional(),
  parentId: UuidSchema.nullable().optional(),
  isActive: z.boolean().default(true),
  isPostable: z.boolean().default(true),
});
export type AccountingAccount = z.infer<typeof AccountingAccountSchema>;

export const CreateAccountSchema = z.object({
  organizationId: UuidSchema,
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  accountType: AccountTypeSchema,
  systemRole: AccountSystemRoleSchema.optional(),
  parentId: UuidSchema.optional(),
  isPostable: z.boolean().default(true),
});
export type CreateAccountInput = z.input<typeof CreateAccountSchema>;

export const JournalEntryLineInputSchema = z.object({
  accountId: UuidSchema.optional(),
  accountCode: z.string().max(32).optional(),
  debit: MoneySchema.default(0),
  credit: MoneySchema.default(0),
  branchId: UuidSchema.optional(),
  memo: z.string().max(500).optional(),
});

export const CreateJournalEntrySchema = z
  .object({
    organizationId: UuidSchema,
    branchId: UuidSchema.optional(),
    entryDate: z.string().optional(),
    memo: z.string().max(500).optional(),
    sourceType: z.string().min(1).max(64),
    sourceId: UuidSchema,
    lines: z.array(JournalEntryLineInputSchema).min(2),
    idempotencyKey: UuidSchema,
  })
  .superRefine((value, ctx) => {
    const debit = value.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const credit = value.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(debit - credit) > 0.009) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Journal entry must balance (debits = credits)",
        path: ["lines"],
      });
    }
  });
export type CreateJournalEntryInput = z.input<typeof CreateJournalEntrySchema>;

export const JournalEntrySchema = AuditedFieldsSchema.extend({
  id: UuidSchema,
  organizationId: UuidSchema,
  branchId: UuidSchema.nullable().optional(),
  entryNumber: z.string().min(1).max(64),
  entryDate: z.string(),
  memo: z.string().max(500).nullable().optional(),
  sourceType: z.string(),
  sourceId: UuidSchema,
  status: z.enum(["posted", "void"]),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const VoucherTypeSchema = z.enum([
  "receipt",
  "payment",
  "expense",
  "journal",
  "transfer",
]);
export type VoucherType = z.infer<typeof VoucherTypeSchema>;

export const CreateVoucherSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  voucherType: VoucherTypeSchema,
  voucherDate: z.string().optional(),
  memo: z.string().max(500).optional(),
  partyType: z.enum(["customer", "supplier", "other"]).optional(),
  customerId: UuidSchema.optional(),
  supplierId: UuidSchema.optional(),
  lines: z
    .array(
      z.object({
        accountId: UuidSchema.optional(),
        accountCode: z.string().optional(),
        debit: MoneySchema.default(0),
        credit: MoneySchema.default(0),
        memo: z.string().max(500).optional(),
      }),
    )
    .min(2),
  idempotencyKey: UuidSchema,
});
export type CreateVoucherInput = z.input<typeof CreateVoucherSchema>;

export const CreateBankAccountSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  glAccountId: UuidSchema.optional(),
  accountKind: z.enum(["cash", "bank", "online"]),
  name: z.string().min(1).max(200),
  bankName: z.string().max(200).optional(),
  accountNumber: z.string().max(64).optional(),
  iban: z.string().max(64).optional(),
  openingBalance: MoneySchema.default(0),
});
export type CreateBankAccountInput = z.input<typeof CreateBankAccountSchema>;

export const ImportBankStatementSchema = z.object({
  organizationId: UuidSchema,
  bankAccountId: UuidSchema,
  importLabel: z.string().min(1).max(200),
  lines: z
    .array(
      z.object({
        statementDate: z.string(),
        description: z.string().max(500).optional(),
        reference: z.string().max(120).optional(),
        amount: SignedMoneySchema,
        balanceAfter: SignedMoneySchema.optional(),
      }),
    )
    .min(1),
});
export type ImportBankStatementInput = z.input<typeof ImportBankStatementSchema>;

export const MatchBankLineSchema = z.object({
  organizationId: UuidSchema,
  statementLineId: UuidSchema,
  journalEntryId: UuidSchema.optional(),
  voucherId: UuidSchema.optional(),
  ignore: z.boolean().optional(),
});
export type MatchBankLineInput = z.input<typeof MatchBankLineSchema>;

export const CreateReconciliationSchema = z.object({
  organizationId: UuidSchema,
  bankAccountId: UuidSchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  statementBalance: SignedMoneySchema,
});
export type CreateReconciliationInput = z.input<typeof CreateReconciliationSchema>;

export const ExpenseCategoryKeySchema = z.enum([
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
]);

export const CreateExpenseSchema = z.object({
  organizationId: UuidSchema,
  branchId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  categoryKey: ExpenseCategoryKeySchema.optional(),
  expenseDate: z.string().optional(),
  amount: MoneySchema,
  taxAmount: MoneySchema.default(0),
  paymentAccountId: UuidSchema.optional(),
  payee: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: UuidSchema,
});
export type CreateExpenseInput = z.input<typeof CreateExpenseSchema>;

export const FinanceReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: UuidSchema.optional(),
  bankAccountId: UuidSchema.optional(),
  partyId: UuidSchema.optional(),
});

export const LedgerAmountSchema = SignedMoneySchema;
