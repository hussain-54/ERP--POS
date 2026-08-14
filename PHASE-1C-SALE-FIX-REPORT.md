# PHASE 1C â€” POS SALE UUID FIX REPORT

**Date:** 2026-08-13 / 2026-08-14
**Scope:** Fix verified Postgres `22P02` on POS sale stock `operation_id`, preserve idempotency, verify complete online sale flow against configured Supabase.
**Constraints honored:** No UI redesign, no offline/SQLite/sync implementation, no unrelated ERP module redesign.

**Status vocabulary:** PASS / FAIL / PARTIAL / NOT TESTED â€” PASS only when actually verified.

---

## 1. Root cause

Live Phase 1B failure on `POST /api/v1/pos/sales`:

```text
code: 22P02
message: invalid input syntax for type uuid: "<idempotencyKey>-<productId>"
```

In `packages/domain/src/sale-transaction.ts`, per-line stock `operationId` was built by concatenating two UUIDs:

```ts
operationId: `${operationId}-${item.productId}`
```

`stock_movements.operation_id` is type **uuid**. The concat string is not a UUID â†’ stock insert fails â†’ draft sale is compensated to **void**.

The same anti-pattern also existed on **POS return restock** movements in `PosRepository.postReturn` (`${idempotencyKey}-${saleItemId}-in`), which blocked Step 16 until fixed with the same strategy.

---

## 2. Files changed

| File | Role |
|------|------|
| `packages/domain/src/sale-transaction.ts` | Deterministic per-line stock UUIDs; reverse compensate UUIDs |
| `packages/domain/src/sha256.ts` | Pure-JS SHA-256 (browser-safe; replaces `node:crypto` for Vite) |
| `packages/domain/src/sale-transaction.test.ts` | Regression + idempotency tests |
| `packages/db/src/repositories/pos-repository.ts` | Return restock `operation_id` uses `uuidFromStableSeed` (same class of bug) |
| `scripts/phase1c-steps-12-18.cjs` | Live verification helper for Steps 12â€“18 |

Evidence artifacts (not product code): `PHASE-1C-STEP11-SALE-VERIFY.json`, `PHASE-1C-STEPS-12-18.json`, `PHASE-1C-LIVE-SALE-RESULT.json`.

---

## 3. Exact fix

**Sale path (`SaleTransactionService`):**

- Added `uuidFromStableSeed(seed)` â€” SHA-256 â†’ first 16 bytes â†’ RFC4122 v5-shaped UUID.
- Added `saleStockMovementOperationId(parent, productId, lineIndex, purpose)`.
- Forward stock lines use that helper (never string-concat UUIDs).
- Compensation reverse movements use `uuidFromStableSeed(\`electronic-erp:stock-movement:reverse-of:${line.operationId}\`)`.

**Return path (`PosRepository.postReturn`):**

- Restock / damage movement `operationId` values now use `uuidFromStableSeed(...)` with stable seeds including idempotency key + original sale item id + purpose (`in` / `dmg`).

**Build note:** Initial `node:crypto` implementation broke Vite web production build; replaced with pure-JS SHA-256 that matches Node `createHash("sha256")`.

---

## 4. UUID strategy

| ID | Purpose |
|----|---------|
| `sales.idempotency_key` | Sale-level duplicate gate |
| Sale `operationId` (`input.operationId ?? idempotencyKey`) | Sale / payment correlation |
| Stock `operation_id` | **Per-line** deterministic UUID via SHA-256 seed; unique `(organization_id, operation_id)` |
| `stock_movements.source_id` | Business link to sale / return id |
| Reverse / return ops | Distinct deterministic UUIDs derived from forward ids / return seeds |

UUID column types were **not** changed to text.

---

## 5. Idempotency verification â€” **PASS**

Live (Step 14), sale `275c15c2-5f44-4666-97bd-10d8dcd6d40e`:

| Check | Result |
|-------|--------|
| Repeat identical payload + same `idempotencyKey` | Returns same sale id |
| Stock after second submit | Unchanged (`8`) |
| Posted sales with that key | **1** |
| Stock movements for sale | **1** |
| Payments for sale | **1** |

Unit tests in `sale-transaction.test.ts` also cover posted-sale early return without extra stock writes.

---

## 6. Sale test result â€” **PASS**

| Check | Result |
|-------|--------|
| Login â†’ search â†’ cash sale | HTTP **201** |
| Status | **posted** |
| Payment status | **paid** |
| Example (Step 10/11) | `57263500-4d1a-41b1-8cc7-4e21ac4d868e` / `INV-B86A0E49F2-MSRXY065` |
| Exact stock run (Step 12) | Sale `275c15c2-5f44-4666-97bd-10d8dcd6d40e` HTTP **201** |

Not void / draft / failed on successful path.

---

## 7. Stock result â€” **PASS**

Exact quantity verification (Step 12):

| | Qty |
|--|-----|
| Before | **10** |
| Sell | **2** |
| After | **8** |
| Expected | **8** |

Exact match (not approximate).
After partial return of **1**: **8 â†’ 9** (Step 16).

---

## 8. Payment result â€” **PASS** (cash only)

| Check | Result |
|-------|--------|
| Cash method | Used (`CASH`) |
| Payment row | **1** (`3eb9e987-2431-49b6-be26-5ebf3a3c814a` on stock-exact run) |
| Cash split amount | **200** (= 2 Ã— 100) |
| Sale `payment_status` | **paid** |
| PSP / wallet verification | **NOT CLAIMED** / not tested |

---

## 9. Hold / resume result â€” **PASS**

| Check | Result |
|-------|--------|
| Create hold | HTTP **201** |
| Stock during hold | **8 â†’ 8 â†’ 8** (unchanged) |
| Resume | HTTP **200**, cart lines **1** |
| UUID sale fix impact on hold | None (hold uses `cartSnapshot.cart`; no stock `operation_id`) |

Hold behavior was **not** redesigned. First failed attempt used wrong snapshot key (`lines` vs `cart`); corrected test payload only.

---

## 10. Return result â€” **PASS** (with note)

| Check | Result |
|-------|--------|
| Partial return qty 1 | HTTP **201**, return `fe8de5ee-bb80-4549-9b61-27773d0a18d5` |
| Return stock movement | **1** (`sale_return`) |
| Stock | **8 â†’ 9** |
| Over-return qty 3 | **Blocked** HTTP 400: exceeds returnable 2 |
| Separate cash refund `payments` row | **Not observed** (`refundPayments=0`) â€” return stores `refund_amount`; dedicated refund payment posting **PARTIAL / not fully evidenced** |

Return restock originally failed with the same `22P02` concat pattern; fixed with `uuidFromStableSeed` before re-verification.

---

## 11. Customer ledger result â€” **NOT APPLICABLE**

Verification sales were **cash walk-in** (no `customerId`).
Customer ledger entry was **not** expected and **not** claimed as PASS.
`party_ledger_entries` for the sale source id: none required.

---

## 12. Cleanup result â€” **PARTIAL**

| Action | Result |
|--------|--------|
| Discard Phase1 hold labels | Discarded remaining held Phase1 holds via API |
| Delete products / warehouse / void sales / returns | **Not deleted** â€” unsafe under FKs / audit history with anon JWT |

**Documented residue (do not treat as production catalog):**

- Products: `P1B-MSQ7GIVM`, `P1C-V-*` Phase1C Verify Cable rows
- Warehouse: `P1B` / Phase1B WH
- Recent void invoices from Phase 1B failure era
- Phase1C returns with reason containing `phase1c`
- Orphan return from first failed return attempt (return row without restock movement) before return UUID fix

No production non-test data was deleted.

---

## 13. Typecheck â€” **PASS**

`npm run typecheck` â€” exit 0 (all packages). Verified after sale UUID / SHA-256 change.

---

## 14. Lint â€” **PASS**

`npm run lint` aliases to typecheck in this repo â€” exit 0.

---

## 15. Tests â€” **PASS**

`npm run test` â€” contracts / domain / api / web all passed after fix (including sale-transaction regression suite).

---

## 16. Build â€” **PASS**

`npm run build` â€” packages + api + web Vite production build succeeded after replacing `node:crypto` with pure-JS SHA-256.

---

## 17. Remaining issues

1. **`deviceId` â†’ `audit_logs.device_id` FK** â€” Passing a non-existent device UUID (or non-UUID string) can make post-commit audit fail with HTTP 500 **after** the sale is already **posted**. Omit `deviceId` or register a real `devices` row for clean HTTP success.
2. **Return refund payment row** â€” Return posts with `refund_amount`, but a separate cash refund `payments` row was **not** observed in live verify; treat refund settlement evidence as incomplete.
3. **Purchase module** â€” Similar UUID-concat risk may still exist in purchase stock paths (out of Phase 1C sale scope; **NOT TESTED** here).
4. **Test residue** â€” Phase1B/1C products, warehouse, void sales remain in Supabase (documented; not purged).
5. **Orphan files on disk** â€” Some historical offline UI / desktop SQLite source files may still exist as untracked leftovers; **active** router/API/desktop entrypoints and root deps do **not** wire `@electronic-erp/offline` / `better-sqlite3` / sync packages (`packages/offline` and `packages/sync` absent). Active POS path is Supabase.

---

## Step 19 â€” Final online-only check â€” **PASS** (active path)

| Claim | Status |
|-------|--------|
| No SQLite in active API/web POS path | **PASS** â€” no `better-sqlite3` in root/`apps` runtime wiring used for POS |
| No offline repository package | **PASS** â€” `packages/offline` absent |
| No sync queue package | **PASS** â€” `packages/sync` absent; API has no `/sync` router |
| No offline fallback on sale failure | **PASS** â€” failures void/compensate online; no local DB fallback |
| Sale â†’ Supabase | **PASS** â€” live posted `sales` / `sale_items` |
| Stock â†’ Supabase | **PASS** â€” live `stock_movements` / `stock_balances` |
| Payment â†’ Supabase | **PASS** â€” live `payments` + splits |
| Return â†’ Supabase | **PASS** â€” live `sale_returns` + restock movement |

---

## Summary scorecard

| Area | Status |
|------|--------|
| Sale UUID root cause fixed | **PASS** |
| Exact stock 10â†’8 on sell 2 | **PASS** |
| Cash payment | **PASS** |
| Idempotency | **PASS** |
| Hold/resume | **PASS** |
| Partial return + over-qty guard | **PASS** |
| Customer ledger | **NOT APPLICABLE** |
| Cleanup | **PARTIAL** |
| Online-only active path | **PASS** |
| Typecheck / lint / test / build | **PASS** |

**Phase 1C objective (posted online sale with valid stock UUIDs) is achieved.**
