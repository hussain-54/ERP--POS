# Phase 3 — Inventory Engine

## Design

- **Ledger is truth:** every quantity change inserts an immutable `stock_movements` row.
- **Balances are projections:** `stock_balances` updated with optimistic `version` checks.
- **Negative stock** blocked unless warehouse `allow_negative_stock` (or movement override) is set.
- **Costing is pluggable:** `inventory_costing_settings.costing_method` supports moving_average / fifo / lifo / specific / standard. Cost layers table prepared for FIFO/LIFO.

## Movement types

opening, purchase, sale, sale_return, purchase_return, damage, adjustment, transfer_out, transfer_in, stock_count, reservation, release_reservation, warranty_replacement, repair_consumption

## Calculated metrics

available, reserved, damaged, in transit, total, low stock, out of stock, overstock

## API

`/api/v1/inventory/*`

## Offline

SQLite schema in `packages/offline` + `OfflineStockMutationStore` records:

canonical entity ID, device ID, offline transaction ID, operation ID, timestamp, version, sync state

Mutations sync through `enqueueStockMovement` (sync abstraction).

## Migration

Apply `supabase/migrations/20260810000003_inventory_engine.sql`

## Web routes

- `/inventory`
- `/warehouses`
- `/stock-transfers` (adjust / count / reserve / post movements)
- `/batches-serials`

## Not in this phase

POS terminal UI, purchase/sales document posting automation.
