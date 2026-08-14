# PHASE 3B-FINAL â€” STOCK MOVEMENT + BALANCE RPC ATOMICITY

**Date:** 2026-08-14
**Status vocabulary:** PASS / FAIL / PARTIAL / NOT TESTED â€” PASS only when verified.

No POS features, UI redesign, pricing, camera, voice, delivery, salesman, commission, or offline/SQLite work in this phase.

---

## 1. Supabase project verification

| Item | Value | Status |
|------|--------|--------|
| Env host (`SUPABASE_URL`, hostname only) | `hgwwbngzkefzlgdvwhoh.supabase.co` | Matches live API |
| CLI login | Present (projects list succeeded) | **PASS** |
| Repo `supabase/config.toml` `project_id` | Local name `electronic-erp` (not a cloud ref) | Informational |
| `supabase/.temp` link | Not required; `--project-ref` used | â€” |
| Cloud project name | Electronic ERP | **PASS** |
| Cloud ref | `hgwwbngzkefzlgdvwhoh` | Matches env host |
| Region | `ap-northeast-2` | â€” |
| Status | `ACTIVE_HEALTHY` | **PASS** |
| Other CLI projects | Diplomacy / FutureBridge / Nexpay â€” **not** targeted | â€” |
| `SUPABASE_SERVICE_ROLE_KEY` | unset locally | Not used |
| `SUPABASE_ACCESS_TOKEN` in `.env` | unset (CLI session used instead) | â€” |
| `DATABASE_URL` / DB password in `.env` | unset | Not used |

No keys, passwords, or tokens are recorded here.

---

## 2. Migration status

Inspected `supabase/migrations/20260814000001_post_stock_movement_atomic.sql`. **No SQL edits** (no defect found).

| Property | Present |
|----------|---------|
| `SECURITY INVOKER` | Yes (`prosecdef = false` on live) |
| `current_organization_id()` | Yes |
| Org mismatch reject | Yes |
| Insert `stock_movements` + update `stock_balances` in one function | Yes |
| Duplicate `operation_id` â†’ return existing row | Yes (`unique_violation`) |
| Concurrent balance version | Raises `Concurrent stock update conflict` (rolls back insert) |
| Negative stock | Enforced in **app** `applyMovementToBalance` before RPC; SQL writes computed qty |
| Grants | `authenticated`, `service_role`; revoke from `public` |

**How it was applied**

`npx supabase db push --dry-run --project-ref hgwwbngzkefzlgdvwhoh` listed **every** historical migration as pending (remote `schema_migrations` does not match the repo). A real `db push` would have tried to re-run foundation SQL against a live populated database.

That was **not** done.

Applied **only** this file via Management API:

```
npx supabase db query --linked --project-ref hgwwbngzkefzlgdvwhoh --file supabase/migrations/20260814000001_post_stock_movement_atomic.sql
```

`CREATE OR REPLACE FUNCTION` â€” no reset, no DROP, no other migrations.

| Check | Result |
|-------|--------|
| Isolated SQL apply | **PASS** |
| Full `db push` of history | **Not used** (unsafe given empty remote history) |

---

## 3. RPC existence

Live `pg_proc` row for `public.apply_stock_movement_atomic`: **PASS**.

Authenticated PostgREST probe (user JWT): function runs and returns `P0001 organization mismatch` for an empty `p_movement` (org id empty vs session org). That is **not** `PGRST202` / missing function.

---

## 4. RPC permissions

| Role | EXECUTE |
|------|---------|
| `authenticated` | **true** |
| `service_role` | **true** |
| `SECURITY DEFINER` | **false** (invoker / RLS of caller) |

---

## 5. RPC signature

Live identity arguments:

`p_movement jsonb, p_balance_id uuid, p_expected_version integer, p_qty_on_hand numeric, p_qty_reserved numeric, p_qty_damaged numeric, p_qty_in_transit numeric, p_average_unit_cost numeric, p_occurred_at timestamp with time zone`

Matches `InventoryRepository.applyMovementAtomic` `.rpc("apply_stock_movement_atomic", { ... })`. **PASS**. No application signature change.

---

## 6. API integration

Unchanged from Phase 3B:

1. Try `apply_stock_movement_atomic`.
2. Sequential insert+update **only** if the error is missing-function (`PGRST202` / `42883` / name in message).
3. Any other RPC error is thrown (no silent fallback).

API restarted on port **4002** (`API_PORT=4002`, `tsx watch`). Live scripts used `SMOKE_API_URL=http://127.0.0.1:4002`.

---

## 7. Whether live API used RPC

**PASS.**

Evidence:

- Probe with the same JWT the API uses: function **executes** (`organization mismatch`, code `P0001`) â€” not missing.
- Fallback in code is **only** for missing-function errors.
- Opening adjustment, converted sale, return, and exchange all returned HTTP 201 through `postMovement`.
- Therefore those writes used the Postgres function (one transaction), not insert-then-update.

Recorded in `PHASE-3B-LIVE-RESULT.json` step `rpc_posting_path`.

---

## 8. Sale test

| Expectation | Result |
|-------------|--------|
| 100 pcs, 1 box = 10, sell 2 boxes | 100 â†’ **80**, movement qty **20** |
| Repeat identical sale | **80 â†’ 80** |

**PASS**

---

## 9. Return test

| Expectation | Result |
|-------------|--------|
| Return 1 box | **80 â†’ 90**, movement qty **10**, 1 refund payment |
| Repeat identical return | **90 â†’ 90**, same return id |

**PASS**

---

## 10. Exchange test

| Expectation | Result |
|-------------|--------|
| 1 box A â†’ B | A **+10**, B **âˆ’10** (90â†’100 / 100â†’90) |
| Repeat exchange | Same ids, no extra stock |

**PASS**

---

## 11. Idempotency test

Sale, return, and exchange retries: same document ids, unchanged balances, ledger sum = balance (100). **PASS**

---

## 12. Regression tests

| Suite | Result |
|-------|--------|
| Phase 3A live (`phase3a-refund-verify.cjs`) | **PASS** (sale, over-return, refund payment, retry) |
| Phase 1C live (`phase1c-steps-12-18.cjs`) | **PASS** (stock, cash, sale idempotency, hold/resume, partial return, over-return). Cleanup still **PARTIAL** (no unsafe deletes). Walk-in ledger **NOT APPLICABLE**. |
| Phase 3B live (this run) | **PASS** including `rpc_posting_path` |

---

## 13. Typecheck

`npm run typecheck` â€” **PASS**

---

## 14. Build / unit tests

| Command | Result |
|---------|--------|
| `npm run test` | **PASS** (12 + 201 + 32 + 5). First parallel run failed because `build` cleared `packages/*/dist` mid-test; re-run after build **PASS**. |
| `npm run build` | **PASS** |

---

## 15. Remaining limitations

1. Remote **migration history table** still does not list repo files. Do **not** run a blanket `supabase db push` until history is repaired (`migration repair` / mark applied) by an operator. Function is live via `CREATE OR REPLACE`.
2. Serial number rows still update **after** the RPC (not in the same function).
3. Full sale/return (header + items + payments + stock) is still **not** one Postgres transaction â€” only movement+balance is.
4. Purchase / transfer `operation_id` still `randomUUID` (unchanged).
5. Fallback sequential path remains in code if the function is dropped later.

---

## This-phase file changes

- `scripts/phase3b-stock-verify.cjs` â€” record `rpc_posting_path` (verification only).
- This report.
- Migration SQL **not** modified.

Git working tree still contains earlier online-only / Phase 1Câ€“3B application work. This phase did not add UI, pricing, or offline code.

No secret files committed.

---

## Verdict

| Atomicity (live stock write through RPC) | **PASS** |
| Sale / return / exchange / idempotency | **PASS** |
| 1C / 3A regression | **PASS** |
| Typecheck / test / build | **PASS** |

**STOP.** Do not start Phase 4.
