# PHASE 1B â€” ONLINE LIVE VERIFICATION

**Date:** 2026-08-12
**Scope:** Verify the completed ONLINE-ONLY ERP/POS against the configured Supabase project and local API.
**Constraints honored:** No architecture redesign, no UI redesign, no offline implementation, no schema migrations, no POS feature work. Verification + report only.

**Environment under test**

| Item | Value (non-secret) |
|------|--------------------|
| API | `http://127.0.0.1:4000` (`npm run dev:api`) |
| Supabase host | `hgwwbngzkefzlgdvwhoh.supabase.co` |
| Auth identity | Bootstrap owner from `supabase/bootstrap_first_owner.sql` (password not recorded here) |
| Helper script | `scripts/phase1b-live-verify.cjs` + ad-hoc probes |
| Smoke | `npm run smoke:online` |

**Status vocabulary:** PASS / FAIL / PARTIAL / NOT TESTED â€” PASS only when actually verified live.

---

## 1. Environment verification â€” **PASS**

| Check | Result |
|-------|--------|
| Root `.env` has `VITE_SUPABASE_URL` / `SUPABASE_URL` | Present (len=40 URL) |
| Anon / publishable key (`VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`) | Present (`sb_` prefix, len=46) |
| `VITE_API_URL` | Present â†’ `localhost:4000` |
| Server loads same root `.env` via `apps/api/src/config.ts` | Confirmed |
| `SUPABASE_SERVICE_ROLE_KEY` | **Commented / unset** (`hasServiceRole=false` on `/health`) â€” server-only when set |
| Service role exposed to Vite / React / browser / localStorage | **No** â€” no `VITE_*SERVICE_ROLE*` in web env; no `SERVICE_ROLE` references under `apps/web/src` |
| Web `.env` | URL + anon + API only |

Notes:

- Local development runs without service role (acceptable for JWT+RLS POS path; staging/production config still requires it).
- Keys are publishable/`sb_` style, not legacy JWT anon strings.

---

## 2. Supabase health result â€” **PASS**

| Check | Result |
|-------|--------|
| `GET /health` | **PASS** â€” `ok: true`, `supabaseConfigured: true` |
| `GET /health/supabase` | **PASS** â€” client init OK against project host |
| `npm run smoke:online` | **PASS** â€” 5/5 (health, supabase, unauthorized ping/me, empty login rejected) |

---

## 3. Authentication result â€” **PASS**

| Check | Result |
|-------|--------|
| Login (`POST /api/v1/auth/login`) | **PASS** â€” returns `accessToken`, `refreshToken`, user, permissions, branches |
| Session (`GET /api/v1/auth/me` with Bearer) | **PASS** |
| JWT required (no token â†’ 401) | **PASS** |
| Logout (`POST /api/v1/auth/logout` â†’ 204) | **PASS** |
| Protected POS without token | **PASS** â€” `GET /api/v1/pos/sales` â†’ 401 |
| Browser localStorage session persistence | **NOT TESTED** (API-path verified; UI session storage not exercised in a browser) |

JWT from login successfully authorized subsequent POS/catalog/inventory calls.

---

## 4. POS sale result â€” **FAIL**

Live authenticated attempt:

1. Seeded units (`/catalog/units/seed-system`)
2. Used Phase1B warehouse + product + opening stock (+10 via `/inventory/movements`)
3. Product search `q=P1B` returned the product with `unitId` / `retailPrice`
4. `POST /api/v1/pos/sales` with cash payment â†’ **HTTP 500**

**Root cause (verified by calling `PosRepository.postSale` directly with user JWT):**

```text
code: 22P02
message: invalid input syntax for type uuid:
  "<idempotencyKey>-<productId>"
```

In `packages/domain/src/sale-transaction.ts`, stock line `operationId` is built as:

```ts
operationId: `${operationId}-${item.productId}`
```

That value is **not a valid UUID**, but `stock_movements.operation_id` expects a UUID. Draft sales are created then compensated to **`void`** (observed void invoices in sales list).

| Sub-check | Status |
|-----------|--------|
| Search product | **PASS** |
| Select / add to cart (API payload) | **PASS** (payload accepted until stock op) |
| Complete sale persisted as posted | **FAIL** |
| No offline/SQLite fallback on failure | **PASS** (void compensation; no local DB) |

**Phase 2 candidate fix (not applied in 1B):** use a fresh UUID (or UUID v5) per stock line `operation_id` instead of concatenating two UUIDs.

---

## 5. Stock result â€” **PARTIAL**

| Check | Status | Evidence |
|-------|--------|----------|
| Opening stock seed | **PASS** | `POST /inventory/movements` 201; balance `qtyOnHand=10` |
| Stock unchanged on hold | **PASS** | Before/after hold both `10` |
| Stock movement on posted sale | **FAIL** / blocked | Sale never posts (UUID bug) |
| Balance after sale | **NOT TESTED** | Depends on posted sale |
| No double deduction | **NOT TESTED** | Depends on posted sale |

---

## 6. Payment result â€” **FAIL** (blocked)

| Check | Status |
|-------|--------|
| Cash payment method available | **PASS** â€” `CASH` among seeded methods |
| Cash payment row on completed sale | **NOT TESTED** / **FAIL** path â€” sale never posts |
| Wallet / PSP verification | **NOT TESTED** â€” not claimed |

---

## 7. Hold / resume result â€” **PASS**

| Check | Status | Evidence |
|-------|--------|----------|
| Hold create | **PASS** | `POST /api/v1/pos/holds` â†’ 201 (`sale` + `held`) |
| Held exists | **PASS** | `held.id` present; sales list shows `held` |
| Resume | **PASS** | `POST .../resume` â†’ 200, `cart` lines = 1 |
| No duplicate lines on resume | **PASS** | Single line restored |
| No stock deduction on hold | **PASS** | Balance unchanged |

Cart snapshot must use `{ cart: [...] }` (not `lines`) â€” matches `assertHoldCartNonEmpty` / `buildHoldSnapshot`.

---

## 8. Return result â€” **NOT TESTED**

No posted sale succeeded, so returnable invoice â†’ return create was not executed.

---

## 9. Sales management result â€” **PARTIAL**

| Check | Status |
|-------|--------|
| Sales list | **PASS** â€” 200 (includes held + void drafts from failed attempts) |
| Sales management search/list | **PASS** â€” 200 |
| Sale detail / invoice on posted sale | **NOT TESTED** (no posted sale); hold/void rows visible in list |
| Export | **PARTIAL** â€” `GET .../management/export` returned **400** (validation; query params incomplete vs schema) |

All exercised routes are online API â†’ Supabase (no offline store).

---

## 10. RLS / authorization result â€” **PARTIAL**

| Check | Status |
|-------|--------|
| Invalid JWT blocked | **PASS** â€” 401 on admin/users and auth/me |
| Unauthenticated POS blocked | **PASS** â€” 401 |
| Authenticated org data via JWT + `createUserClient` | **PASS** (warehouses, products, holds for owner org) |
| Cross-organization isolation | **NOT TESTED** â€” no second tenant user available |
| Permission-gated ops | **PARTIAL** â€” owner has broad permissions; negative permission cases not probed |

Service role was **not** used to bypass RLS for POS writes.

---

## 11. Network-disconnect behavior â€” **PASS** (with scope note)

| Check | Status |
|-------|--------|
| API unreachable (port 3999) | **PASS** â€” fetch fails; no success response |
| `packages/offline` absent | **PASS** |
| Connection Required helper present | **PASS** â€” `apps/web/src/lib/online-required.ts` |
| Failed sale does not write SQLite / queue offline | **PASS** â€” SQLite stack removed; failed sales voided in Supabase only |
| Full browser offline badge E2E | **NOT TESTED** (no headed browser automation in this run) |

---

## 12. Typecheck â€” **PASS**

`npm run typecheck` â†’ **exit 0**

---

## 13. Lint â€” **PASS**

`npm run lint` (= typecheck) â†’ **exit 0**

---

## 14. Tests â€” **PASS**

`npm run test` (`test:foundation`) â†’ **exit 0**

Observed: contracts/domain/api/web vitest suites green (api 31 tests; web 5 tests in this runâ€™s tail).

---

## 15. Build â€” **PASS**

`npm run build` â†’ **exit 0** (packages + api + web Vite production build).
Advisory only: main JS chunk > 500 kB (pre-existing warning).

---

## 16. Remaining issues

| ID | Severity | Issue | Suggested Phase 2 action |
|----|----------|-------|---------------------------|
| P1B-1 | **High** | Sale stock `operation_id` = `uuid-uuid` invalid â†’ sale 500 / void drafts | Fix domain stock line operation id to a real UUID |
| P1B-2 | Medium | API error handler logs PostgREST errors as `[object Object]` | Serialize `error.message` / `code` from non-Error throws |
| P1B-3 | Medium | Sales management export 400 with current query | Align export query with `SaleListFilterSchema` |
| P1B-4 | Low | `SUPABASE_SERVICE_ROLE_KEY` unset locally | Set for staging/prod; keep off frontend |
| P1B-5 | Low | Empty catalog before seed | Demo seed or first-run catalog pack |
| P1B-6 | Low | Test residue: Phase1B warehouse/product, void sales, held rows | Optional cleanup in Supabase |
| P1B-7 | Info | Customer create via API returned 500 in one probe; direct table insert worked | Re-test after P1B-1; inspect `createCustomer` mapping |
| P1B-8 | Info | Cross-tenant RLS not dual-user tested | Add second org user for negative tests |
| P1B-9 | Info | Return / payment persistence / ledger AR not live-verified | Re-run after sale fix |

---

## Scoreboard (requested sections)

| # | Area | Status |
|---|------|--------|
| 1 | Environment verification | **PASS** |
| 2 | Supabase health | **PASS** |
| 3 | Authentication | **PASS** |
| 4 | POS sale | **FAIL** |
| 5 | Stock | **PARTIAL** |
| 6 | Payment | **FAIL** (blocked by sale) |
| 7 | Hold / resume | **PASS** |
| 8 | Return | **NOT TESTED** |
| 9 | Sales management | **PARTIAL** |
| 10 | RLS | **PARTIAL** |
| 11 | Network-disconnect behavior | **PASS** |
| 12 | Typecheck | **PASS** |
| 13 | Lint | **PASS** |
| 14 | Tests | **PASS** |
| 15 | Build | **PASS** |
| 16 | Remaining issues | Listed above |

---

## Verdict for Phase 2 planning

Online-only wiring is **confirmed live** (auth, health, catalog/inventory reads, holds, sales list, JWT/RLS gate, no SQLite fallback).

**Blocking for end-to-end cashier sale:** domain stock `operation_id` UUID bug (**P1B-1**). Fix that before treating POS checkout as production-verified.

**STOP.** No UI/POS redesign or offline work started from this phase.
