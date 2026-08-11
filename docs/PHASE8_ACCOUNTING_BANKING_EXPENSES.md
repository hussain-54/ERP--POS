# Phase 8 — Accounting + Banking + Expense Engine

## Chart of accounts

Standard COA in `STANDARD_COA` (`packages/domain/src/accounting-posting.ts`) covers cash, bank, AR, AP, sales, purchases, expenses, income, discounts, returns, tax, inventory, COGS.

Seed via `POST /api/v1/accounting/coa/seed`.

## Double-entry

All journals must balance. Automatic builders:

- `buildSaleJournalLines` — sales, AR/cash, tax, discount, inventory, COGS
- `buildPurchaseJournalLines` — inventory, AP/cash, tax
- `buildSaleReturnJournalLines` / `buildPurchaseReturnJournalLines` — reverse entries
- `buildExpenseJournalLines` — expense + cash/bank

Sale / purchase / return transaction services post through these builders (no silent operational writes without financial treatment).

## Vouchers

Types: receipt, payment, expense, journal, transfer → `vouchers` + `voucher_lines` + linked `journal_entries`.

## Banking

- Multiple cash / bank / online accounts (`bank_accounts` → GL)
- Statement import + match / ignore
- Reconciliation (statement vs book balance)
- Cash book / bank book reports

## Expenses

Categories: rent, electricity, salary, internet, transport, petrol, repair, marketing, office, miscellaneous, custom.

Daily / monthly / yearly expense reporting.

## Reports

Trial balance, P&L, cash book, bank book, receivables, payables, customer/supplier ledger, expenses.

## Migration

`supabase/migrations/20260810000008_accounting_banking_expenses.sql`

## API

`/api/v1/accounting/*`

## Web

`/accounts`, `/banking`, `/expenses`, `/reports`

## Verify

```bash
npm run build:packages
npm run test:phase8
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
