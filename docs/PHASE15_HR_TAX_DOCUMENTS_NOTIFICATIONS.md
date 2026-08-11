# Phase 15 — HR + Tax + Documents + Notifications

Remaining enterprise modules on the shared ERP stack.

## HR

Employees, attendance, salary runs, incentives, performance scoring.

Salesman commission integrates with POS `sale_commissions` (`GET /api/v1/hr/commissions`).

UI: `/hr`

## Tax (architecture-ready)

NTN / STRN profile, tax rates, exemptions, tax invoices, tax reports, inclusive & exclusive pricing.

`fbr_integration_enabled` defaults to **false**. This build does **not** claim live FBR integration.

UI: `/tax` · APIs: `/api/v1/tax/*`

## Document management

Attach metadata (secure storage path policy) for customers, suppliers, products, transactions.

Kinds: CNIC, agreements, supplier docs, purchase bills, warranty cards, tax docs, quotations, delivery/repair documents.

Sensitive documents require `documents.manage`.

UI: `/documents` · API: `/api/v1/documents`

## Notifications

In-app feed types: low/out/overstock, installment/payment dues, supplier payment due, customer outstanding, stock received, online order, quotation, warranty expiry, repair ready, approval request, daily sales, sync failure.

External channels use adapters (`email` / `sms` / `push`); null adapters skip until configured.

UI: `/notifications` · API: `/api/v1/notifications/*` (+ `/scan`)

## Permissions

`hr.*`, `tax.*`, `documents.*`, `notifications.*`

## Verify

```bash
npm run build:packages
npm run test:phase15
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
