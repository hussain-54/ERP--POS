# PHASE 4B — PRE-FLIGHT AUDIT & PUSH REPORT

**Date:** 2026-08-15  
**Scope:** Audit, fix, test, live-verify, commit, push. No Phase 4B feature work.

Status words: **PASS** / **FAIL** / **PARTIAL** / **MISSING** / **NOT TESTED** / **DUPLICATED**.

---

## 1. Executive Summary

Current POS remains online-only: Web → API → domain → repositories → Supabase.

Phase 4A pricing was uncommitted on `main`. This preflight inspected the live code, fixed real integrity bugs (customer create, opaque API 500s, line `%` permission gate, audit `deviceId`), re-ran typecheck/tests/build and live 1C/3A/3B/4A scripts, then committed and pushed.

Named-customer pricing now **PASS** live (was **NOT TESTED** in the Phase 4A report).

---

## 2. Git Status Before Changes

Branch: `main` (up to date with `origin/main` at `b591f7b`).

Uncommitted Phase 4A work already present:

- POS session/cart/pricing/sale-transaction/contracts/db search
- Untracked: `PHASE-4A-PRICING-AUDIT.md`, `PHASE-4A-PRICING-DISCOUNT-REPORT.md`, `packages/domain/src/pos-pricing-discount.test.ts`, `scripts/phase4a-pricing-verify.cjs`

No `.env` staged. Live JSON files are gitignored (`PHASE-*-LIVE-RESULT.json`).

---

## 3. Current Architecture

Web POS (`apps/web`) → Express (`apps/api` `/api/v1/pos/*`) → `SaleTransactionService` / return domain → `PosRepository` / `InventoryRepository` / `PartiesRepository` → Supabase Postgres.

Canonical pricing: `resolvePosUnitPrice` then `preparePosSaleLine` on post when `getProductPricing` is present.

---

## 4. Online-Only Verification

| Item | Classification |
|------|----------------|
| `better-sqlite3` in app code | **MISSING** (no matches) |
| Offline repository / sync queue in web/api/domain/db POS path | **UNWIRED** / historical (`offlineTransactionId` fields, `sync_state` columns, desktop `deviceId`) |
| Browser `offline` event | **ACTIVE** — blocks POS when the network is down (not a local DB) |
| SQLite fallback posting | **MISSING** in active path |

**PASS** — active POS runtime is online-only.

---

## 5. Phase 1C Sale Verification

Live `scripts/phase1c-steps-12-18.cjs` against rebuilt API:

| Step | Status |
|------|--------|
| Stock 10→8 after sell 2 | **PASS** |
| Cash payment recorded | **PASS** |
| Idempotency (stock/sales/moves/pays = 1) | **PASS** |
| Hold/resume stock unchanged | **PASS** |
| Partial return + over-return blocked | **PASS** |
| Walk-in ledger | NOT APPLICABLE |
| Cleanup | **PARTIAL** (intentional residue) |

Stock `operation_id` remains `saleStockMovementOperationId` / `uuidFromStableSeed`. Concat `${uuid}-${productId}` exists only in a **regression test** that asserts it is invalid.

---

## 6. Phase 3A Refund Verification

Live `scripts/phase3a-refund-verify.cjs`:

| Step | Status |
|------|--------|
| Sale then stock 10→8 | **PASS** |
| Over-return HTTP 400 | **PASS** |
| Return refund payment `direction=pay`, amount 100 | **PASS** |
| Idempotent retry (same id, pays=1, moves=1, journals=1) | **PASS** |

---

## 7. Phase 3B Stock Atomicity Verification

Live `scripts/phase3b-stock-verify.cjs`:

| Step | Status |
|------|--------|
| RPC callable | **PASS** |
| Converted sale/return/exchange | **PASS** |
| Ledger vs balance | **PASS** |
| RPC posting path | **PASS** |

`supabase db push` was **not** run. Remote migration history vs repo migrations remains a documented mismatch from Phase 3B.

---

## 8. Phase 4A Pricing Verification

Resolver order in current `pos-pricing.ts`:

**manual → promotion → quantity break → customer → retail/wholesale/dealer**

Live `scripts/phase4a-pricing-verify.cjs` (client sent `unitPrice: 1`):

| Step | Status |
|------|--------|
| Retail 1000 | **PASS** |
| Wholesale 900 | **PASS** |
| Dealer 800 | **PASS** |
| Named customer 850 | **PASS** (fixed this preflight) |
| Quantity DB | **MISSING** |
| Promotion | **MISSING** |
| Line 10% → 900 | **PASS** |
| Invoice 10% → 900 | **PASS** |
| Idempotent retry | **PASS** |

---

## 9. Discount Verification

Line fixed + percent: **PASS** (domain + live percent).  
Invoice fixed + percent: **PASS** (domain + live percent).  
Caps / negative reject: **PASS** domain.  
Role ladder cashier/supervisor/manager/owner/special: **PASS** domain.  
Second-actor approval: **MISSING** (intentionally not implemented).

Fix: `saleHasDiscount` now treats `discountPercent` as a discount so API permission rewrite cannot be skipped.

---

## 10. Tax Verification

`preparePosSaleLine`: price → line discount → `computeLineTax` → line total. **PASS** domain.  
Live tax-after-discount: **NOT TESTED** (scripts use tax 0).  
`calculateSaleTotals` still sums provided line tax; invoice discount does not reduce tax (existing rule).

---

## 11. Customer Pricing Investigation

**Problem:** `POST /parties/customers` returned HTTP 500 during Phase 4A live.  
**Root Cause:** `createCustomer` always inserted `email: null`. If `customers.email` is absent on the remote DB (migration `20260812000003` not in remote history), Postgres errors. Error handler also mapped non-`Error` PostgREST objects to generic `"Internal server error"`.  
**File:** `packages/db/src/repositories/parties-repository.ts`, `apps/api/src/middleware/error-handler.ts`  
**Fix:** Omit `email` unless provided; retry without email if the column is missing; surface PostgREST `message` on 500. Customer search `or()` no longer requires `email`.  
**Verification:** Live customer create + `product_prices` 850 + posted unit 850 **PASS**.

---

## 12. Device ID Investigation

`audit_logs.device_id` FKs to `devices`. POS previously sent a `localStorage` UUID that is not a `devices` row.

**Fix:** Stop sending `deviceId` from POS sale/hold/duplicate; audit row uses `deviceId: null`. `insertAuditLog` still retries FK 23503 with null. `sales.device_id` remains optional text.

**Verification:** Live sales posted without device FK failures **PASS**. Browser UI click-through **NOT TESTED**.

---

## 13. UUID Audit

POS sale/return/exchange stock ids use `uuidFromStableSeed`.  
Purchase module still has `${operationId}-${item.productId}` in `purchase-transaction.ts` — **DUPLICATED** anti-pattern, **out of POS sale path**; not changed in this preflight.

---

## 14. Idempotency Audit

| Flow | Status |
|------|--------|
| Sale | **PASS** live |
| Return | **PASS** live |
| Stock movement | **PASS** live |
| Payment | **PASS** live |
| Journal (return retry) | **PASS** live |

---

## 15. Duplication Audit

Not merged (per instructions):

| Pair | Status |
|------|--------|
| POS design-system vs ERP ui | **DUPLICATED** |
| `posApi` vs session repository | **DUPLICATED** |
| `CartLine` alias of `PosCartLine` | **DUPLICATED** (alias) |
| `/pos` vs held/invoices/sales-management routes | **DUPLICATED** surfaces |
| `calculatePosCartTotals` vs `calculateSaleTotals` | **PARTIAL** (cart delegates totals) |
| product columns vs `product_prices` | **DUPLICATED** storage |
| commerce `priceForCustomerType` vs POS resolver | **DUPLICATED** |

---

## 16. API Error Handling Audit

POS routes still `next(err)`. Domain errors → 400/403. Zod → 400.  
Generic 500 now includes PostgREST messages.  
No fake 200-after-failure found on sale/return/hold.

---

## 17. Automated Test Results

| Command | Status |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** |
| `npm run build` | **PASS** |
| `npm run lint` | **PASS** (alias of typecheck) |

---

## 18. Live Verification Results

API: rebuilt `apps/api/dist` on port **4005**. No `db push`. No DB reset.

| Suite | Status |
|-------|--------|
| Sale + stock + cash | **PASS** |
| Sale retry | **PASS** |
| Return + refund pay | **PASS** |
| Return retry | **PASS** |
| Price security `unitPrice=1` → 1000/900/800/850 | **PASS** |
| Stock RPC | **PASS** |

---

## 19. Frontend Runtime Verification

Vite (`5173`) was not running. Browser console / React / 401/403/404 UI path: **NOT TESTED**.

Web **build** (tsc + vite) **PASS**.

---

## 20. Files Changed

Phase 4A implementation plus preflight fixes:

- `packages/domain` pricing, cart, totals, sale-transaction + tests
- `packages/contracts/src/sale.ts` (`priceLevel`)
- `packages/db` POS pricing port + customer insert
- `apps/api` POS discount gate + error handler
- `apps/web` POS session/cart/payment/page (no redesign)
- `scripts/phase4a-pricing-verify.cjs`
- `PHASE-4A-PRICING-AUDIT.md`, `PHASE-4A-PRICING-DISCOUNT-REPORT.md`, this report

Not committed: `.env`, live JSON, `dist/`, `node_modules`.

---

## 21. Problems Found

**Problem:** Customer create 500 blocked named-customer live pricing.  
**Root Cause:** Unconditional `email` insert + opaque 500.  
**File:** `parties-repository.ts`, `error-handler.ts`  
**Fix:** Omit/retry email; extract error message.  
**Verification:** Live customer sale 850 **PASS**.

**Problem:** Line `%` could skip discount permission rewrite.  
**Root Cause:** `saleHasDiscount` ignored `discountPercent`.  
**File:** `apps/api/src/routes/pos.ts`  
**Fix:** Include `discountPercent`.  
**Verification:** typecheck/tests **PASS**.

**Problem:** Fake POS `deviceId` could FK-fail `audit_logs` after post.  
**Root Cause:** localStorage UUID ≠ `devices.id`.  
**File:** `PosPage.tsx`, `sale-transaction.ts`  
**Fix:** Omit device from POS API; audit `deviceId` null.  
**Verification:** Live posts **PASS**.

---

## 22. Remaining Issues

- Quantity-break and promotion **persistence** **MISSING**.
- Second-actor discount approval **MISSING** (later phase).
- Tax-after-discount **live** **NOT TESTED**.
- Browser UI runtime **NOT TESTED**.
- Purchase `operationId` concat still present (non-POS).
- Remote Supabase migration history still empty vs repo (do not `db push` blindly).
- `getProductPricing` optional for non-POS callers.
- UI/component duplications remain by design this phase.

---

## 23. Git Diff Safety Review

No secrets, service-role keys, or `.env` in the commit. No accidental migrations. No offline stack. No POS redesign.

---

## 24. Commit

Message: `chore(pos): finalize phase 4a preflight fixes`  
Hash: `872f310`

---

## 25. Push Result

Pushed `main` to `https://github.com/hussain-54/ERP--POS.git` (`b591f7b..872f310`).  
Branch is up to date with `origin/main`.  
Vercel/GitHub Actions deployment: **NOT TESTED** (not queried).

---

## 26. Final Verdict

**PASS** for online POS integrity required to leave Phase 4A: sale, refund, stock RPC, server pricing, named customer price, automated tests, and push.

**PARTIAL** overall because browser runtime was not exercised and promotion/qty tables remain absent.

Ready for the **next phase** only as a pricing-complete online POS; not ready if that phase assumes promotions, quantity-break DB, or second-actor approval.
