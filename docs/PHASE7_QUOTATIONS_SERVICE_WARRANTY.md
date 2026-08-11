# Phase 7 — Quotations + Orders + Service + Warranty

## Lifecycle

Quotation → Sales Order → Invoice (invoice posts through `SaleTransactionService` / POS engine)

## Service & repair

Job card statuses: Received → Diagnosis → Repairing → Ready → Delivered (+ Cancelled)

Parts consumption uses inventory `repair_consumption`. Service charges / repair cost compute billable vs warranty-covered totals.

## Warranty

`sale_warranties` from original POS sale → claims (repair / replacement) → replacement history with stock issue.

Lookup by serial, invoice number, sale id, or product.

## Migration

`supabase/migrations/20260810000007_quotations_service_warranty.sql`

## API

`/api/v1/after-sales/*`

## Web

`/quotations`, `/service`, `/warranty`

## Verify

```bash
npm run build:packages
npm run test:phase7
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
