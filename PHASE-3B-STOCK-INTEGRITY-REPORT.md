# PHASE 3B â€” POS STOCK INTEGRITY, UOM CONVERSION & IDEMPOTENT STOCK POSTING

**Date:** 2026-08-14
**Status vocabulary:** PASS / FAIL / PARTIAL / NOT TESTED â€” PASS only when verified.

**Regression gates:** Phase 1C PASS Â· Phase 2 PASS Â· Phase 3A PASS (re-verified this phase).

This phase did **not** change POS UI, pricing, camera/QR, voice search, `PosPage` structure, delivery, salesman/commission, or offline/SQLite/sync.

---

## 1. Root causes

| Risk | Cause |
|------|--------|
| Sale of converted units deducted **sale-unit qty** | `InventoryRepository.postMovement` wrote `qty_delta` as posted `unitId` qty. Cart `factorToBase` is UI-only. Domain `convertQuantity` / `applySaleInBaseUnit` existed but were not used at posting. 2 boxes Ã— 10 would deduct 2, not 20. |
| Exchange duplicate stock on retry | Exchange-out `operation_id` used `crypto.randomUUID()`. Retry posted a second sale movement. Return in/dmg already used stable seeds. |
| Movement vs balance split | Insert `stock_movements` and update `stock_balances` were **two sequential Supabase requests**. If insert succeeded and update failed, retry by `operation_id` returned the existing movement and **skipped** the balance write. |
| Invalid qty | No single gate for zero / NaN / negative (except type-specific ledger effects) at post time. |

---

## 2. Existing stock architecture

**Single writer for ledger + on-hand:** `InventoryRepository.postMovement`.

Callers:

| Source | Movement types | Notes |
|--------|----------------|--------|
| `SaleTransactionService` â†’ `postStockSale` | `sale` | Stable `saleStockMovementOperationId` (Phase 1C) |
| `PosRepository.postReturn` / settlement retry | `sale_return`, `damage`, exchange `sale` | Stable `saleReturnStockMovementOperationId` (this phase for `ex`) |
| Purchases repository | `purchase`, `purchase_return` | Still uses `randomUUID` for `operation_id` |
| Transfers / deliveries | `transfer_in` / `transfer_out` | Still uses `randomUUID` |
| Adjustments / counts / reservations | `adjustment`, `stock_count`, `reservation`, â€¦ | Opening seed in live used random `operation_id` (one-shot) |

Reads of `stock_balances` / `stock_movements` in reporting, AI, commerce, admin, POS availability checks **do not post**.

Tables: `stock_movements` (unique `(organization_id, operation_id)`), `stock_balances` (versioned), `unit_conversions`, `products.base_unit_id`, `warehouses.allow_negative_stock`.

---

## 3. Movement flow

```
SALE
  sale_items.qty in sale unit
  â†’ postMovement(type=sale, unitId=sale unit, qtyDelta=sale qty)
  â†’ qtyToBaseUnits â†’ qty_delta in BASE units, unit_id = base_unit_id
  â†’ applyMovementToBalance (on-hand decreases by base qty)

RETURN (good)
  sale_return_items.qty in return unit
  â†’ postMovement(type=sale_return)
  â†’ +base qty on-hand

RETURN (damaged)
  sale_return then damage (same converted magnitude)

EXCHANGE
  returned SKU: sale_return (+base)
  replacement SKU: sale (âˆ’base)
  both idempotent on stable operation_id

PURCHASE / TRANSFER / ADJUSTMENT
  same postMovement path (UOM + validation apply)
  purchase/transfer operation_id still random (not POS-hardened this phase)
```

Ledger `qty_delta` for sale-like types is a **positive magnitude**; `applyMovementToBalance` / `effectForMovement` apply the sign from `movement_type`.

---

## 4. Balance flow

1. Idempotent lookup by `operation_id` â€” if found, return that row (no second balance change).
2. Load product `base_unit_id`, warehouse, conversion rules, current `stock_balances` (create if missing).
3. Convert qty â†’ base; `assertStockMovementQty`; `applyMovementToBalance`.
4. Persist movement + balance:
   - **Preferred:** RPC `apply_stock_movement_atomic` (one Postgres transaction).
   - **Fallback if function missing:** insert movement, then update balance (NOT atomic).

Serial number rows still update **after** the movement/balance write (not in the RPC).

---

## 5. UOM flow

**Source of truth:** `packages/domain/src/unit-conversion.ts` â€” `convertQuantity`, `qtyToBaseUnits`, `applySaleInBaseUnit`.

Posting conversion happens **only** in `postMovement` via `qtyToBaseUnits`. No second conversion implementation was added in the web app.

`pos-cart` `factorToBase` remains display/cart math. Posted stock uses `unit_conversions` + `products.base_unit_id`.

Example (live): 1 box = 10 pieces; sell 2 boxes â†’ movement `qty_delta=20`, balance 100â†’80.

Inverse conversion uses `divideDecimal` (contracts). `fromScaled` was fixed so `outScale === 6` does not drop the fractional part (`1/10` â†’ `0.1`, not `0`).

---

## 6. Idempotency strategy

| Write | Key |
|-------|-----|
| Sale header | `(organization_id, sales.idempotency_key)` |
| Sale stock line | `uuidFromStableSeed('electronic-erp:stock-movement:sale:â€¦')` â€” RFC4122-shaped UUID, **not** concatenated UUID strings |
| Return header | `(organization_id, sale_returns.idempotency_key)` |
| Return restock | seed `â€¦:sale_return:in:{key}:{saleItemId}` (unchanged from 1C/3A) |
| Return damage | seed `â€¦:sale_return:dmg:â€¦` |
| Exchange out | seed `â€¦:sale_return:ex:{key}:{saleItemId}:{exchangeProductId}` |

Retry: same key â†’ same UUID â†’ `postMovement` returns existing row.

---

## 7. Exchange strategy

Returned product: `sale_return` with converted **+** base qty.
Replacement: `sale` with converted **âˆ’** on-hand (positive `qty_delta` magnitude).

Settlement retry path uses the **same** `saleReturnStockMovementOperationId(..., "ex", exchangeProductId)`.

Live: after sale 2 boxes and return 1 box (A=90, B=100), exchange 1 box Aâ†’B: A 90â†’100, B 100â†’90; retry unchanged.

---

## 8. Transaction / atomicity status

| Question | Answer |
|----------|--------|
| Same database transaction? | **Only if** `apply_stock_movement_atomic` is deployed. |
| Separate Supabase requests? | **Yes** on fallback (insert then update). |
| Movement OK, balance fail? | Fallback: retry sees movement, **does not** repair balance. RPC: unique_violation returns existing row only after a **committed** txn (both writes). |
| Balance OK, movement fail? | Unlikely on fallback (movement first). RPC rolls back both. |
| Retry / network interrupt | Safe for **duplicate movements** when `operation_id` is stable. Not equivalent to a DB transaction on fallback. |
| Existing RPC? | Previously only unrelated helpers (e.g. permissions). This phase added a **narrow** invoker RPC. |

**Live RPC probe:** **NOT TESTED** â€” function not present on the connected Supabase project (`PGRST202` / function not found). Local `.env` has no `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL`, so the migration was **not** applied from this environment.

**Do not treat application retry as atomicity.** Fallback was used for all live stock writes this phase.

Migration file (apply on the project, then re-probe):

`supabase/migrations/20260814000001_post_stock_movement_atomic.sql`

- `SECURITY INVOKER`, org check vs `current_organization_id()`
- Grants: `authenticated`, `service_role`
- Qty conversion stays in the app; SQL stores precomputed base qty

---

## 9. Changes made

| Area | Change |
|------|--------|
| `packages/contracts/src/decimal.ts` | `divideDecimal`; `fromScaled` frac slice when `outScale === SCALE` |
| `packages/domain/src/unit-conversion.ts` | Stricter qty/factor checks; `qtyToBaseUnits` |
| `packages/domain/src/stock-ledger.ts` | `assertStockMovementQty` |
| `packages/domain/src/sale-transaction.ts` | `saleReturnStockMovementOperationId` including `ex` |
| `packages/db/.../inventory-repository.ts` | Convert to base; validate; RPC then sequential fallback |
| `packages/db/.../pos-repository.ts` | Exchange `operation_id` uses stable UUID helper |
| SQL | `apply_stock_movement_atomic` |
| Tests | UOM, invalid qty, exchange UUID, balance 100âˆ’20+10, migration presence, `divideDecimal` |
| `scripts/clean-package-dists.cjs` | Remove accidental `packages/*/src/*.js` so Vite does not bundle stale barrels |
| `scripts/phase3b-stock-verify.cjs` | Live UOM sale/return/exchange/ledger |

No PosPage/UI redesign. No offline code.

---

## 10. Tests

| Case | Result |
|------|--------|
| Base-unit conversion (same unit) | **PASS** (unit-conversion) |
| Converted-unit (2 boxes â†’ 20) | **PASS** (unit-conversion + stock-balances) |
| Invalid qty / factor / missing rule | **PASS** |
| Sale/return operation_id determinism + exchange UUID | **PASS** (sale-transaction) |
| Duplicate sale/return (domain + live) | **PASS** |
| Duplicate exchange (live) | **PASS** |
| Stock balance consistency (unit + live ledger sum) | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run test` (foundation; contracts 12 after divideDecimal test) | **PASS** (re-run contracts+domain after `fromScaled` fix: 12 + 201) |
| `npm run build` | **PASS** (web Vite; later `fromScaled` is a small contracts fix â€” rebuild packages before next deploy) |

API + web test files were **PASS** on the full `npm run test` run before the `fromScaled` slice fix. That fix does not change API/web tests.

---

## 11. Live verification

API used for this run: `http://127.0.0.1:4001` (port 4000 already held an older `tsx` process). Evidence: `PHASE-3B-LIVE-RESULT.json`.

| Scenario | Result |
|----------|--------|
| Opening 100 pcs, 1 box = 10 pcs | **PASS** |
| Sale 2 boxes â†’ 100â†’80, movement qty 20 | **PASS** |
| Repeat same sale â†’ still 80 | **PASS** |
| Return 1 box â†’ 80â†’90, movement qty 10, 1 refund payment | **PASS** |
| Repeat same return â†’ 90, same return id | **PASS** |
| Exchange 1 box A in / B out, retry no extra stock | **PASS** |
| Movement ledger sum vs `stock_balances` for product A | **PASS** (100 = 100) |
| RPC `apply_stock_movement_atomic` deployed | **NOT TESTED** |

### Phase 3A / 1C regression (same API)

| Flow | Result |
|------|--------|
| Cash sale + stock deduction (base units) | **PASS** |
| Sale idempotency | **PASS** |
| Hold / resume (stock unchanged) | **PASS** |
| Partial return + cash refund payment | **PASS** |
| Return idempotency | **PASS** |
| Over-return protection | **PASS** |
| Walk-in customer ledger | **NOT APPLICABLE** |
| Cleanup of test products | **PARTIAL** (same as 1C: no unsafe deletes) |

---

## 12. Remaining limitations

1. **Atomicity not live-verified.** Apply `20260814000001_post_stock_movement_atomic.sql` on Supabase, restart API, re-run `scripts/phase3b-stock-verify.cjs`. Until then, fallback is two HTTP writes.
2. Fallback still has the **orphaned movement / missed balance** window if the second request fails.
3. Serial + balance are **not** in the same RPC.
4. Purchase / transfer / after-sales stock `operation_id` still **randomUUID** â€” retry can double-post those paths.
5. `sale_items` / return lines remain in **sale/return units**; only the stock ledger is base units. Reports that sum `qty_delta` assuming sale units would be wrong after this phase (ledger is base).
6. Missing conversion rule **rejects** the post (`No unit conversion rule found`).
7. Cart `factorToBase` can still disagree with `unit_conversions` if the UI factor is stale; posting trusts the database rules.
8. True multi-statement sale (items + payments + stock) is still **not** one Postgres transaction.

**Recommendation for a future DB-RPC phase:** deploy this movement RPC first; optionally wrap full sale/return posting in a later, still-narrow function. Do not replace inventory architecture.

---

## Verdict

POS converted-unit posting, exchange idempotency, invalid qty/UOM validation, and live 100â†’80â†’90â†’90 (plus exchange) are **PASS**.

Database-level movement+balance atomicity is **NOT TESTED** on the live project.

**STOP.** Do not continue to pricing, discounts, invoice/POS UI redesign, camera, voice search, delivery, salesman, or commission.
