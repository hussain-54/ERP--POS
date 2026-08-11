# Phase 5 — Complete POS / Sales Engine

## Architecture

Central `SaleTransactionService` orchestrates (UI never duplicates):

POS → Invoice → Stock → Customer Ledger → Payment → Cash/Bank/Credit → Accounts → Profit/COGS → Commission → Warranty → Installment → Analytics

## Features

- Easy / Advanced modes
- English / Urdu / Urdu+English
- Product search (name, Urdu, SKU, barcode, brand, company, category, model, specs)
- Manual items, decimal qty, discounts with role limits + audit
- Hold / resume (DB + offline mirror)
- Returns: refund / credit / exchange
- Invoice view
- Hardware ports: barcode scanner, camera recognition, thermal, A4, cash drawer
- Offline sales with device ID, offline transaction ID, operation ID, sync state

## Migration

`supabase/migrations/20260810000005_pos_sales.sql`

## API

`/api/v1/pos/*`

## Web

`/pos`, `/returns`, `/invoices`, `/held-sales`

## Verify

```bash
npm run build:packages
npm run test:phase5
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```

Verified green: packages build, phase5 tests, API/web typecheck, web production build.
