# STEP 18 â€” Supabase verification

## Goal

Verify critical online operations actually reach Supabase (queries, inserts, updates, deletes, RPCs, authentication, RLS, error handling).

**Do not** redesign schema. Document issues only unless blocking.

## Live probe (this environment)

API started briefly on port `4011` with local `.env`:

| Endpoint | Result |
|----------|--------|
| `GET /health` | `ok: true`, `supabaseConfigured: true`, `hasSupabaseUrl: true`, `hasAnonOrPublishable: true`, **`hasServiceRole: false`** |
| `GET /health/supabase` | `ok: true`, host `*.supabase.co`, message `Supabase client initialized` |

Conclusion: anon client can talk to the configured Supabase project. Service role is **not** set locally.

## Architecture (how ops reach Supabase)

```
Browser POS / ERP UI
  â†’ apiFetch (Bearer JWT)  OR  browser Supabase Auth (login only)
  â†’ Express /api/v1/*
  â†’ requireAuth â†’ createUserClient(JWT)
  â†’ packages/db repositories (.from / .rpc)
  â†’ Supabase PostgreSQL (+ RLS)
```

| Client | Used for |
|--------|----------|
| `createUserClient(accessToken)` | Nearly all business CRUD (POS, parties, inventory, catalog, â€¦) under RLS |
| `createAnonClient()` | Login password check, password-reset email, `/health/supabase` |
| `createServiceClient()` | Optional auth infra (lockout, audit, permission fallback) â€” **null if key missing** |
| Browser `createBrowserSupabaseClient` | Auth session + hydrate reads + permission RPC; product-media upload only (not sales) |

**POS sales do not write from the browser to Supabase.** They go through `/api/v1/pos/*`.

## Operation coverage

### Authentication

| Operation | Path | Supabase |
|-----------|------|----------|
| Login | Web `signInWithPassword` and/or `POST /auth/login` | Auth API |
| Session | `GET /auth/session` + `auth.getUser` | Auth + `user_profiles` |
| Permissions | `UserRepository.listPermissionKeys` | **RPC** `get_user_permission_keys` |
| Branches | `branch_memberships` select | Table query |
| Logout / password reset | Auth API | Auth |

### Queries / inserts / updates / deletes (repos)

| Area | Repository | Examples (tables) |
|------|------------|-------------------|
| Product search / catalog | `PosRepository` / `CatalogRepository` | `products`, barcodes, categories, brands, â€¦ |
| Customers | `PartiesRepository` | `customers` insert/select/update |
| Sales / items / holds / returns | `PosRepository` | `sales`, `sale_items`, `held_sales`, `sale_returns`, â€¦ |
| Payments / ledger / installments | `PartiesRepository` | `payments`, `payment_splits`, `party_ledger_entries`, installment tables |
| Stock | `InventoryRepository` | `stock_movements`, `stock_balances`, warehouses, â€¦ |
| Commission / salesman | `PosRepository` / `EnterpriseRepository` | `sale_commissions`, `employees`, references |
| Soft deletes | Catalog (and others) | Typically `deleted_at` update (not hard DELETE) |

Repo pattern: `if (error) throw error` â†’ Express `errorHandler` â†’ JSON to client.

Approximate repo surface (code scan): **~532** `.from(` usages in `packages/db` repositories; **1** `.rpc(` in repositories (`get_user_permission_keys`).

### RPCs

| RPC | Purpose |
|-----|---------|
| `get_user_permission_keys` | Permission keys for authenticated profile (SECURITY DEFINER helpers in migrations) |

### RLS

| Metric | Count in `supabase/migrations/*.sql` |
|--------|--------------------------------------|
| `ENABLE ROW LEVEL SECURITY` | **141** |
| `CREATE POLICY` | **154** |

Org tenancy pattern: `organization_id = public.current_organization_id()` (from `auth.uid()` â†’ `user_profiles`).

**User JWT path relies on RLS** for POS/catalog/inventory/parties writes. Service role is not used for those CRUD paths.

### Error handling

| Layer | Behavior |
|-------|----------|
| Repo | Throws PostgREST / domain errors |
| `errorHandler` | Zod â†’ 400; `DomainError` â†’ mapped status; else â†’ 500 with message |
| Auth middleware | 503 if Supabase not configured; 401 invalid JWT; 403 inactive profile |
| Online UI (Step 13) | Network failures â†’ â€œConnection Requiredâ€; no fake local success |
| `/health/supabase` | Proves client + Auth settings; **not** a full RLS/table smoke test |

## Issues documented (no schema redesign)

| ID | Severity | Issue |
|----|----------|-------|
| S18-1 | Medium (local) | **`SUPABASE_SERVICE_ROLE_KEY` unset** locally (`hasServiceRole: false`). Auth lockout/audit/permission fallback via service client is skipped. Staging/production `assertProductionConfig()` requires the key. |
| S18-2 | Low | Local anon key length (~46) is shorter than a typical Supabase JWT anon key â€” confirm the key in `.env` is the full project anon/publishable key if auth fails in the browser. |
| S18-3 | Info | `/health/supabase` only probes Auth client init â€” does not execute a table round-trip under RLS. |
| S18-4 | Info | Offline sync tables/policies may still exist in migrations (Class D); sync **API/route removed** â€” unused cloud sync schema leftover, not used by POS. |
| S18-5 | Info | Live end-to-end sale under RLS was **not** exercised in this step (would need authenticated cashier session). Architecture path is verified in code + health probe. |

## Schema changes

**None.** No migrations added or altered in Step 18.

## Verdict

**PASS (architecture + connectivity):** Critical online operations are wired to Supabase via JWT + RLS repositories; auth and health probe succeed against the configured project.

**Documented gaps:** missing local service-role key; health probe is Auth-only; full authenticated sale E2E under RLS remains a manual/live follow-up.
