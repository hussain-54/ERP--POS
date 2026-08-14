# STEP 12 â€” Remove offline environment variables

## Goal

Remove offline-only environment variables that are confirmed unused.
**Keep** all online Supabase / API variables.
**Never** expose `SUPABASE_SERVICE_ROLE_KEY` (or any service-role secret) to frontend / Vite.

## Inventory

### Template / example files

| File | Offline-only vars | Online vars (kept) |
|------|-------------------|--------------------|
| `.env.example` | Had commented `OFFLINE_DATA_DIR`, unused `ELECTRON_DIST_CHANNEL` | `VITE_SUPABASE_*`, `VITE_API_URL`, `SUPABASE_*`, `API_*`, â€¦ |
| `.env.development.example` | None | Online only |
| `.env.staging.example` | None | Online only |
| `.env.production.example` | None | Online only (+ notes for `VITE_SUPABASE_PUBLISHABLE_KEY`) |

### Local env files (key names only; values not logged)

| File | Offline-only keys | Notes |
|------|-------------------|-------|
| `.env` | None | Online Supabase + API keys only |
| `apps/web/.env` | None | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |
| `apps/web/.env.production` | None | `VITE_API_URL` (same-origin on Vercel) |

### Vercel

| Source | Offline env refs |
|--------|------------------|
| `vercel.json` | **None** (build/install/rewrites only) |
| Runtime config (`apps/api/src/config.ts`, `apps/web/src/lib/env.ts`) | Reads online Supabase / API / CORS / Vercel platform vars only |

### Code usage check

| Variable | Used in source? | Disposition |
|----------|-----------------|-------------|
| `OFFLINE_DATA_DIR` | **No** | Remove from examples |
| `ELECTRON_DIST_CHANNEL` | **No** | Remove from examples |
| `ELECTRON_UPDATE_URL` | Yes â€” `apps/desktop/src/updater.ts` | **Keep** (document in `.env.example`) |
| `DESKTOP_REQUIRE_DIST` | Yes â€” `apps/desktop/src/readiness.ts` | **Keep** (document in `.env.example`) |
| `VITE_SUPABASE_URL` | Yes â€” web `env.ts` | **Keep** |
| `VITE_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes â€” web `env.ts` | **Keep** |
| `VITE_API_URL` | Yes | **Keep** |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Yes â€” API only | **Keep** (service role server-only) |
| `API_PORT` / `API_CORS_ORIGIN` / `APP_ENV` / `LOG_LEVEL` | Yes | **Keep** |

## Changes made

### `.env.example`

**Removed (unused / offline-only):**

- `OFFLINE_DATA_DIR`
- `ELECTRON_DIST_CHANNEL`

**Documented (online desktop, optional):**

- `ELECTRON_UPDATE_URL`
- `DESKTOP_REQUIRE_DIST`

## Explicitly preserved

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (optional alias)
- `VITE_API_URL`
- All server `SUPABASE_*` and API runtime vars

## Service-role safety

| Check | Result |
|-------|--------|
| `apps/web/src/vite-env.d.ts` | No `SERVICE_ROLE` |
| `apps/web/src/lib/env.ts` | No `SERVICE_ROLE` |
| API `createServiceClient` | Server-only; comment warns never expose to web |
| Phase 17 migration test | Asserts web must not ship service role |

## Verdict

**PASS** â€” Offline-only env placeholders removed from `.env.example`. No offline env vars were present in active `.env` / Vercel config. Online Supabase and API variables retained; service-role remains server-only.
