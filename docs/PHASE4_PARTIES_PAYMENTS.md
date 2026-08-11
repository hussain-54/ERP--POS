# Phase 4 — Customers, Suppliers, Payments, Credit, Installments, Ledgers

## Delivered

- Customer master (EN/Urdu names, mobiles, CNIC, reference, retail/wholesale/dealer, credit limit/days, totals, outstanding, block)
- Supplier master (company, contact, NTN/STRN, bank details, payable balance)
- Configurable payment methods (cash, bank, card, JazzCash, Easypaisa, SadaPay, online, credit, installment + custom)
- Split payments with automatic ledger updates
- Credit evaluation, over-limit approval, overdue reminders, customer block
- Installment plans with full schedule + payment receipts
- Customer ledger: sale, payment, return, discount, adjustment
- Supplier ledger: purchase, payment
- Offline SQLite schema + `OfflinePaymentMutationStore` (idempotent sync via `enqueuePayment`)

## Migration

`supabase/migrations/20260810000004_parties_payments.sql`

## API

`/api/v1/parties/*`

## Web

`/customers`, `/suppliers`, `/payments`, `/credit`, `/installments`

## Verify

```bash
npm run build:packages
npm run test:phase4
```
