# Phase 6 — Purchases + Warehouse + Transfer + Delivery

## Architecture

Central `PurchaseTransactionService` orchestrates:

Purchase → Stock increase → Supplier ledger / payable → Supplier price engine → Accounts

Purchase returns reverse stock, payable, and journals with audit.

Transfers and deliveries use explicit lifecycle state machines in domain.

## Features

- Purchase invoices (supplier, invoice #, date, lines, discount/tax, paid/remaining, due date)
- Supplier price engine (last / average / supplier price / history / comparison)
- Purchase returns
- Warehouse types: main, branch, store, transit
- Location hierarchy: Warehouse → Rack → Shelf → Bin
- Transfer lifecycle: Request → Approval → Dispatch → In Transit → Receiving
- Delivery lifecycle: Pending → Packed → Dispatched → Delivered (+ Cancelled / Returned)
- Offline warehouse ops + sync for POS-related replenishment

## Migration

`supabase/migrations/20260810000006_purchases_warehouse_ops.sql`

## API

`/api/v1/purchases/*`

## Web

`/purchases`, `/purchase-returns`, `/warehouses`, `/stock-transfers`, `/deliveries`

## Verify

```bash
npm run build:packages
npm run test:phase6
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
