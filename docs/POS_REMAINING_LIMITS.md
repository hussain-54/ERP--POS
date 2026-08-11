# POS remaining limits (honesty)

**Date:** 2026-08-11

## Intentionally not faked
- **GPS delivery tracking** — delivery notes link to sales; no geolocation ports. Do not claim live tracking.
- **Atomic cloud sale** — `SaleTransactionService` still uses sequential writes. Idempotency helps; ACID RPC is future work.
- **True PDF engine** — receipt “PDF / Save” downloads text + browser print-to-PDF; no embedded PDF library yet.
- **Manager re-auth PIN** — override dialog uses the **current session** permissions (manager must be signed in). No separate PIN vault.

## Shipped in this pass
- Credit / partial pay when a customer is selected
- Favorites persistence + categories browse
- Default tax rate applied to cart lines
- Installment create on POS (advanced + customer)
- Manager approval gate for large discounts / price override
- WhatsApp / email / print-PDF share on receipts
- `pos_cash_shifts` migration + open/close + sidebar totals (apply migration in Supabase)

## Ops
1. Run migration `20260812000001_pos_cash_shifts.sql` (or full migrate).
2. Grant `pos.shift` to cashier/manager roles if using bootstrap older than this change.
3. Configure at least one active `tax_rates` row (`is_default`) for GST on POS.
