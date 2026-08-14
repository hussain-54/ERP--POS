# STEP 10 â€” Preserve business logic

## Goal

```
EXISTING BUSINESS LOGIC  +  SUPABASE ONLY
```

**Not** new business logic.
Only change the **data access path** when necessary (already done in Steps 4â€“9).

## Rule enforced

| Layer | Authority | Conversion allowed? |
|-------|-----------|---------------------|
| `packages/domain` | Business rules | **No rewrite** â€” preserve |
| `packages/db` repositories | Persistence to Supabase | Data access only |
| `apps/api` routes | HTTP + authz â†’ domain/repo | Wire only |
| `apps/web` POS UI | Orchestration + call domain/API | Strip offline paths only |

## Concern â†’ preserved domain module

| Concern | Module(s) | Status |
|---------|-----------|--------|
| Sale calculation / cart totals | `sale-totals.ts`, `pos-cart.ts` | **Preserved** |
| Tax calculation | `pos-tax.ts` | **Preserved** |
| Discount policy | `pos-discount.ts`, `discount-policy.ts` | **Preserved** |
| Pricing resolution | `pos-pricing.ts`, `pricing.ts`, `pos-cart.pickPriceLevel` | **Preserved** |
| Stock rules | `stock-ledger.ts`, `stock-balances.ts` (+ sale ports) | **Preserved** |
| Hold rules | `pos-hold.ts` | **Preserved** (also used by `PosRepository`) |
| Return rules | `pos-return.ts` | **Preserved** |
| Payment validation | `pos-payment.ts`, `split-payment.ts`, `credit.ts` | **Preserved** |
| Payment idempotency | `PaymentAttemptGate` + `SaleTransactionService` idempotency | **Preserved** |
| Commission calculations | `pos-commission.ts`, `enterprise.calculateSalesCommission` | **Preserved** |
| Installment calculations | `installments.ts` + payment prep | **Preserved** |
| Invoice logic | `sale-finalization.ts` | **Preserved** |
| Audit logic | `audit-trail.ts` + sale finalization audit helpers | **Preserved** |
| Permissions | `authz-service.ts`, `rbac-catalog.ts` + contracts authz | **Preserved** |
| Sale orchestration | `sale-transaction.ts` (`SaleTransactionService`) | **Preserved** (comment only: offline path wording) |

## Evidence â€” no domain rewrite

| Check | Result |
|-------|--------|
| `git diff` on `packages/domain` vs HEAD | **Only** `sale-transaction.ts` docstring (OfflinePosEngine â†’ online-only wording) |
| No new parallel domain package | Confirmed â€” still `@electronic-erp/domain` |
| No `OnlineSaleService` / forked totals | Confirmed |
| UI still imports domain for rules | `PosPage`, `usePosSession`, `PosPaymentPanel`, `ReturnsPage`, `ReceiptPreview`, â€¦ |
| API/repo still call domain | `PosRepository` â†’ `SaleTransactionService`, hold asserts, etc. |

## Evidence â€” data path only (Steps 4â€“9)

Changed for online-only conversion (not business math):

- Removed offline packages / sync / SQLite desktop DB
- Customer repository â†’ `partiesApi` only (domain helpers like `toPosCustomerProfile` kept)
- Routes/UI/flags for offline removed
- Persistence remains `PosRepository` â†’ Supabase

## Domain test gate (Step 10)

Ran focused suite covering the listed concerns:

```
sale-totals, pos-cart, pos-payment, pos-hold, pos-return,
pos-commission, discount-policy, pos-tax, sale-finalization, sale-transaction
```

**11 files Â· 77 tests Â· all passed**

## Final architecture

```
React POS UI
  â†’ domain helpers (totals, tax, discount, payment prep, â€¦)
  â†’ posApi / partiesApi / â€¦
  â†’ Express /api/v1/*
  â†’ SaleTransactionService + domain rules
  â†’ PosRepository / PartiesRepository / â€¦
  â†’ Supabase PostgreSQL
```

## Verdict

**PASS** â€” Existing business logic preserved. Supabase is the only persistence path. No new business-rule layer was introduced.
