# PHASE 3A â€” POS RETURN REFUND PAYMENT INTEGRITY

**Date:** 2026-08-14
**Status vocabulary:** PASS / FAIL / PARTIAL / NOT TESTED â€” PASS only when verified.

---

## 1. Root cause

`PosRepository.postReturn` stored `sale_returns.refund_amount` and `refund_method`, posted a journal, and (for **named** customers only) a `party_ledger_entries` row with `entry_type=return`.

It **never inserted** into `payments` / `payment_splits`.

Walk-in cash refunds therefore had a return header with an amount and **no settlement payment**. Phase 1C live: `refundPayments=0`.

`payments` already supports this: `direction` includes `pay`, amounts must be **positive**, walk-in `customer_id` may be null (`payments_party_check` from `20260812000004_pos_payments.sql`).

---

## 2. Existing architecture (unchanged tables)

| Object | Role |
|--------|------|
| `sale_returns` | Header: `refund_amount`, `refund_method` (`cash`/`bank`/`customer_credit`), `idempotency_key` unique per org |
| `sale_return_items` | Lines + restock flags |
| `payments` | Settlement header (`direction`, `source_type`, `source_id`, `idempotency_key`) |
| `payment_splits` | Tender line (`amount > 0`, method FK) |
| `party_ledger_entries` | Customer AR (`entry_type` includes `return`) |
| `journal_entries` | GL; keyed by return `idempotency_key` |
| `stock_movements` | Restock; `operation_id` unique per org |

Refund methods in DB check: **cash, bank, customer_credit** only. No JazzCash/card/wallet on `sale_returns`. Those are not claimed as PSP refunds.

No new payment table. No column type changes.

---

## 3. Changes made

| File | Change |
|------|--------|
| `packages/domain/src/pos-return.ts` | `assertRefundAmount`, `refundSettlementPlan`; reject negative line prices |
| `packages/domain/src/pos-return.test.ts` | Cash full/partial, credit, zero, invalid, amount consistency |
| `packages/contracts/src/payment.ts` | Walk-in `customerId` optional when `sourceType` is `sale` **or** `sale_return` |
| `packages/db/.../parties-repository.ts` | Skip credit-limit check on `direction=pay`; skip customer **payment** ledger when `sourceType=sale_return` (avoid double AR) |
| `packages/db/.../pos-repository.ts` | Post `payments` `direction=pay` for cash/bank; ledger-only for customer credit; retry repairs stock/payment/journal via existing idempotency keys |
| `apps/web/.../ReturnsPage.tsx` | Show refund **method** next to amount (no layout redesign) |
| `packages/domain/src/pos-hold.test.ts` | Freeze `now` so hold expiry tests are not clock-dependent (suite must pass) |

---

## 4. Database objects used

Existing: `sale_returns`, `sale_return_items`, `payments`, `payment_splits`, `payment_methods`, `party_ledger_entries`, `journal_entries`, `stock_movements`, `stock_balances`.

---

## 5. Refund flow

```
prepareSaleReturn â†’ refundSettlementPlan
  none (exchange or amount 0): no payment, no credit ledger
  customer_credit: party_ledger_entries.return only (named customer required)
  cash_out (cash|bank): payments.direction=pay + payment_splits
                         source_type=sale_return, source_id=return id
                         NO extra customer payment-ledger row
```

Cash/bank amount = `refund_amount` = returned line totals.

Bank is a **recorded** tender (existing method kind), not a bank confirmation API.

---

## 6. Idempotency strategy

| Record | Key |
|--------|-----|
| Return header | `(organization_id, idempotency_key)` â€” retry returns same row |
| Stock | Stable `uuidFromStableSeed` `operation_id` â€” `postMovement` no-ops if exists |
| Payment | Same return `idempotency_key` on `payments` â€” `postSplitPayment` returns existing |
| Journal | Same key via `ensureAndPostJournal` |
| Credit ledger | Lookup `source_type=sale_return` + `source_id` before insert |

Retry after a partial commit **repairs** missing stock/payment/journal; it does not duplicate those. Commission/audit still only on first header insert.

**Transaction limitation:** There is still **no** multi-statement Postgres transaction (Supabase client, no new RPC). Documented, not pretended solved. Idempotent repair is the mitigation.

---

## 7. Tests

| Case | Result |
|------|--------|
| Full cash refund plan | PASS (domain) |
| Partial cash refund plan + amount = lines | PASS (domain) |
| Customer credit plan (no payment kind) | PASS (domain) |
| Zero refund / exchange â†’ none | PASS (domain) |
| Invalid refund amount (negative / NaN / negative price) | PASS (domain) |
| Over-return | PASS (domain + live HTTP 400) |
| Walk-in refund payment schema | PASS (contracts) |
| Duplicate return / refund (same key) | PASS (live) |
| Stock restoration | PASS (live 8â†’9) |
| Refund/payment consistency | PASS (live amount 100, `direction=pay`) |

---

## 8. Live Supabase verification

Script: `scripts/phase3a-refund-verify.cjs` â†’ `PHASE-3A-LIVE-RESULT.json`

Walk-in cash sale **2 Ã— 100**, return **1** unit, cash refund.

| Check | Status |
|-------|--------|
| Sale exists, stock 10â†’8 | **PASS** |
| Over-return HTTP 400 | **PASS** |
| Return + return item exist | **PASS** |
| Stock 8â†’9 | **PASS** |
| `refund_amount=100` | **PASS** |
| One `payments` row `direction=pay` amount 100 | **PASS** |
| Same return request: same id, 1 payment, 1 movement, 1 journal, stock 9 | **PASS** |
| Named-customer credit return | **NOT TESTED** (live was walk-in) |
| Bank refund row | **NOT TESTED** (same `cash_out` path as cash) |

---

## 9. Before / after

| | Before | After |
|--|--------|--------|
| Cash refund | `refund_amount` only | `payments` + split, `direction=pay` |
| Walk-in cash refund | No payment, no ledger | Payment, no ledger (no customer) |
| Customer credit | Ledger if named | Unchanged (ledger only, no fake cash payment) |
| Duplicate return | Returned header, skipped settlement | Same header + idempotent settlement repair |
| Phase 1C gap | `refundPayments=0` | Live `pays=1` |

---

## 10. Remaining limitations

- Not a single DB transaction (repair-on-retry instead).
- Return journal still credits AR (`buildSaleReturnJournalLines`); cash payout is the **payment** row, not a redesigned GL. Journal-by-tender is a later phase.
- Named cash customer: **no** extra `return` ledger (avoids driving outstanding negative after a paid sale). Credit sales that choose cash refund do not auto-reduce AR via ledger; they get a cash-out payment. Prefer `customer_credit` for unpaid AR.
- Exchange stock `operation_id` still `randomUUID` (not this phase).
- Card/JazzCash/Easypaisa/SadaPay are **not** `sale_returns.refund_method` values â€” not recorded as refunds here (no PSP).
- Hold unit tests now pass a frozen `now`; product hold behaviour unchanged.

---

## Regression

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm run test` | **PASS** (contracts 11, domain 196, api 31, web 5) |
| `npm run build` | **PASS** |

Phase 1C behaviours re-checked in this live run: cash sale, stock deduction, over-return block, return stock restore, return idempotency.

---

**STOP.** No UI redesign, pricing, stock engine rewrite, camera, or other Phase 4/5 work.
