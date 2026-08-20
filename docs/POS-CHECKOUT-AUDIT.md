# POS checkout & payment posting audit

Date: 2026-08-20  
Scope: PAY NOW → payment posting → sale/stock/AR/invoice. No UI redesign.

## Verdict

Checkout is **sale-level idempotent** and **fail-closed on the critical path**. The sale is inserted as **draft**, then items → stock → customer ledger → payments → payment state → **posted**. A mid-chain failure compensates (void payments, reverse AR, reverse stock) and voids the draft. A duplicate checkout with the same client UUID returns the posted sale and does **not** write stock twice.

This is **not** one Postgres transaction wrapping the whole sale. Each stock line uses `apply_stock_movement_atomic`. Compensation is best-effort. Journal / commission / warranty / installment / analytics / audit run **after** posted and must not fail HTTP checkout or void the invoice.

Card, JazzCash, Easypaisa, SadaPay, Other Wallet, and `online` are **record-only receipts**. There is no payment-gateway integration.

---

## Authoritative call chain

```
PayNowButton
  → PosPaymentPanel.requestPay          (opens confirm modal; does not post)
  → PaymentConfirmModal Cancel          (no sale)
  → PaymentConfirmModal PAY NOW
  → PosPage.checkout
       payingRef + busy + confirmation=pending   (duplicate click)
       preparePosPayments                        (change, remaining, splits)
       validatePosCheckout                       (cart, walk-in full pay)
       PaymentAttemptGate.begin(idempotencyKey)  (in-memory duplicate gate)
  → POST /api/v1/pos/sales
  → PosRepository.postSale
  → SaleTransactionService.postSale
       findSaleByIdempotency
       resolvePostedSaleItems / calculateSaleTotals / preparePosPayments
       insert sale status=draft
       items + discount audits
       stock out per line (UUID operation_id)
       customer sale ledger (full grand)
       split payments (non-credit kinds)
       update payment fields on draft
       finalize → posted
       post-commit: journal, commission, warranties, installment, analytics, audit
  → success: gate.succeed, rotate checkout UUID, clear cart, receipt
```

| Step | Canonical code |
|------|----------------|
| Payment selection / labels | `apps/web/src/features/pos/pos-payment-ux.ts` |
| Tender math | `preparePosPayments` — `packages/domain/src/pos-payment.ts` |
| Cart / walk-in gate | `validatePosCheckout` — `packages/domain/src/pos-validation.ts` |
| Client duplicate click | `PaymentAttemptGate` + `payingRef` |
| Checkout UUID on fail/retry | `resolveCheckoutIdempotencyKey` — keep on `failed` / `retry` |
| Server post | `SaleTransactionService.postSale` |
| Stock write | `InventoryRepository.postMovement` → RPC `apply_stock_movement_atomic` |
| Stock operation id | `saleStockMovementOperationId` → `uuidFromStableSeed(SHA-256)` |
| Invoice | Stored sale totals + `PosRepository.getInvoice` |
| Customer balance | `postCustomerSaleLedger` (sale debit) + payment credits |
| Accounting | `buildSaleJournalLines` via `classifySaleSettlement` |

UI maps results. It must not invent a second paid/remaining figure.

---

## Atomicity (what “atomic” means here)

**Critical path (must succeed together or the sale is not completed):**

1. Draft sale row  
2. Sale items  
3. Stock out (`sale` movement per catalog line)  
4. Customer AR debit for grand (when a customer is attached)  
5. Payment rows (tenders only)  
6. `finalizeSaleStatus` draft → **posted**

On any throw in that try block: `compensateFailedFinalization`

1. Void sale-sourced payments and free their idempotency UUIDs  
2. Reverse AR with a `return` ledger entry  
3. Reverse each applied stock line with a **distinct** UUID (`uuidFromStableSeed("electronic-erp:stock-movement:reverse-of:"+forwardOpId)`)  
4. Void the draft and **replace** `sales.idempotency_key` with a new UUID so the cashier can retry with the **same client key**

**Not on the critical path:** journal, commission, warranties, installment plan, analytics, audit, delivery note. Failures are swallowed (`runPostedSideEffect`) so a posted invoice is not rolled back.

**Stock line atomicity:** `postMovement` parses `operationId` with `UuidSchema`, then calls `apply_stock_movement_atomic`. If that RPC is missing (`PGRST202` / `42883`), posting **fails closed**. Sequential insert+balance fallback is not used.

A failed stock movement therefore cannot leave a **posted** sale. A failed payment posting cannot leave a **posted** sale. Either can leave a **void** draft plus compensating stock/AR if those writes already happened.

---

## Idempotency

IDs (do not conflate):

| ID | Column / use |
|----|----------------|
| Client `idempotencyKey` | `sales.idempotency_key` — sale-level duplicate gate |
| Sale `operationId` | `input.operationId ?? idempotencyKey` → `sales.operation_id` / payment `operation_id` |
| Stock `operation_id` | Per-line UUID from `saleStockMovementOperationId(parent, productId, lineIndex, "sale")` |
| Sale id | `stock_movements.source_id` / payment `source_id` |

Server:

- **posted** + same key → return existing sale; skip stock/payments  
- **draft** + same key → reject (“already in progress”)  
- **void** row keeps a *new* key so the original client key can retry  

Client (hardened this pass):

- Duplicate PAY NOW: `payingRef`, `confirmation === "pending"`, `PaymentAttemptGate`  
- Network / HTTP failure: **keep** `checkoutIdempotencyKey` (`event: "failed"`)  
- Retry payment: **keep** the same key (`event: "retry"`)  
- Confirmed posted sale / new sale: **rotate** to a fresh UUID  

Previous bug: the client rotated the checkout UUID on every failure, so a lost `201` after a posted sale could create a **second** sale on retry.

---

## UUID / `stock_movements.operation_id`

Historical bug: `parentUUID + "-" + productUUID` is not a UUID (Postgres `22P02`).

Current rule:

- Never concatenate UUID strings into `operation_id`  
- `saleStockMovementOperationId` / reverse-of seed → RFC4122-shaped UUID via SHA-256  
- `InventoryRepository.postMovement` calls `UuidSchema.parse(input.operationId)` before write  
- Unique `(organization_id, operation_id)` is a second line of defense for movement retries  

Regression tests live in `packages/domain/src/sale-transaction.test.ts`.

---

## Payment methods

Configured kinds only. Unsupported wallets are not invented in the pad (`PaymentMethodGrid` empty state).

| Method | Kind | Posted payment row? | Settlement |
|--------|------|---------------------|------------|
| Cash | `cash` | Yes (applied amount; change never posts) | Cash (1000) |
| Card | `card` | Yes — **record-only** | Bank (1010) |
| Bank Transfer | `bank` | Yes | Bank (1010) |
| JazzCash | `jazzcash` | Yes — **record-only** | Bank (1010) |
| Easypaisa | `easypaisa` | Yes — **record-only** | Bank (1010) |
| SadaPay | `sadapay` | Yes — **record-only** | Bank (1010) |
| Other Wallet | `other` / `online` | Yes — **record-only** | Bank (1010) |
| Credit / Udhar | `credit` | **No** — informational; AR remains | Remaining on sale |
| Installment | `installment` | **No** as a tender; down-payment cash/bank still posts; plan is a **post-commit** side effect | Remaining on sale |

Record-only UI copy: `paymentMethodSettlementNote` → “Recorded locally — no gateway settlement”. Confirm modal repeats that card/wallet tenders are receipts unless a gateway is configured.

Missing `methodKind` on a split defaults to **cash** for the journal (`classifySaleSettlement`).

Credit / installment method amounts do **not** reduce `paidTowardBill`.

---

## Case results

| Case | Behavior |
|------|----------|
| Full payment | Splits sum to grand; `paymentStatus=paid`; remaining 0 |
| Partial | Customer required; remaining = grand − paid; `paymentStatus=partial` |
| Credit / Udhar | Paid 0 (or mixed remainder); AR debit = grand; no credit payment row |
| Mixed / split | Multiple tender rows; journal Cash vs Bank split |
| Insufficient | Walk-in rejected; customer without `allowRemaining` rejected |
| Excess cash / change | `resolveCashTender`; change is metadata, not a payment |
| Cancelled confirm | Modal Cancel; `onPay` never runs |
| Duplicate click | Gate + `payingRef`; in-flight second `begin` throws |
| Network failure | Client keeps UUID; server voids draft if critical path failed |
| Retry after void | Same client key; voided row no longer holds that key |
| Retry after posted (lost 201) | Same key returns existing posted sale; no second stock write |
| Failed stock | Draft voided; no payments; no posted sale |
| Later stock line fail | Prior stock reversed; ledger/payments never written |
| Failed payment posting | Stock + AR reversed; payments not left posted; sale void |
| Failed finalize | Payments + AR + stock reversed; sale void |
| Failed journal after posted | Sale stays posted; HTTP still succeeds |
| Stock + sale together | Draft until stock+payments succeed; posted only at finalize |

Automated coverage:

- `packages/domain/src/pos-payment.test.ts`  
- `packages/domain/src/sale-transaction.test.ts`  
- `packages/domain/src/pos-integrity.test.ts`  
- `packages/domain/src/payment-register.test.ts`  
- `apps/web/src/features/pos/pos-payment-ux.test.ts`  
- `apps/web/src/features/pos/pos-new-sale.test.tsx`  

---

## What was hardened in this pass

1. **Checkout UUID** — keep on fail/retry; rotate only after posted or new sale.  
2. **Post-commit side effects** — journal/commission/etc. cannot fail checkout or void a posted sale.  
3. **Compensation** — reverse payments (and free payment keys) then AR then stock then void draft.  
4. **Journal settlement** — `classifySaleSettlement`: cash → 1000, bank + record-only wallets → 1010. Previously all `paidTotal` could book as Cash.  
5. **Stock RPC fail-closed** — no non-atomic sequential fallback; `operationId` must be a UUID.  
6. **`other` wallet** — record-only in `RECORD_ONLY_PAYMENT_KINDS` and settlement notes.  

---

## Remaining limitations

1. **No single sale RPC** wrapping draft + items + stock + payments + finalize. Draft + compensate is the safety net.  
2. **Compensation is best-effort.** If reverse-stock fails, the sale is still voided; stock may need an inventory correction.  
3. **In-flight draft** (first request still running): retry with the same key is rejected until void or post.  
4. **If void fails after a partial write**, the draft still holds the key; retry is blocked until that row is resolved.  
5. **Record-only wallets are not settlements.** No JazzCash / Easypaisa / card / SadaPay PSP.  
6. **Installment plan is post-commit.** A posted sale can exist briefly without a plan if `createInstallment` throws.  
7. **Purchase stock `operation_id` concat** (`packages/domain/src/purchase-transaction.ts`) is outside this POS checkout path and was not changed here.
