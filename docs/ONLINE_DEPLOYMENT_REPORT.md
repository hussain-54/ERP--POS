# ONLINE DEPLOYMENT REPORT — Phase 19

**Date:** 2026-08-11  
**Repo:** https://github.com/hussain-54/ERP--POS  
**Verdict: PARTIAL — production builds + local smoke ready; public web/API URLs not cut over from this environment**

Electron / offline POS remains **CRITICAL** (see `docs/PRODUCTION_READINESS.md`). Do **not** start Electron release.

---

## 1. Deployment URL

| Surface | Status | URL |
|---------|--------|-----|
| Frontend (Vercel) | **Not deployed from this session** | *Pending* — Vercel CLI had no credentials (`vercel whoami` started device login). If GitHub↔Vercel auto-deploy is already linked, redeploy `main` after this Phase 19 push and paste the `*.vercel.app` URL here. |
| Backend / API | **Not hosted publicly** | Local smoke used `http://127.0.0.1:4000`. Packaging added: `render.yaml`, `Dockerfile.api`. |
| Supabase | **Project reachable** | Host configured in local `.env` (anon URL present). Auth endpoint responds (HTTP 401 without apikey = up). |

---

## 2. Build status

| Target | Command | Result |
|--------|---------|--------|
| Packages + API | `npm run build:api` | ✅ |
| Packages + Web | `npm run build:web` / `apps/web` Vite | ✅ → `apps/web/dist` |
| Migrations checklist | `npm run db:verify` | ✅ 17 migrations + `seed.sql` |
| Desktop | `npm run build:desktop` | Scaffold only (unchanged) |

---

## 3. Environment variables

### Frontend (Vercel Project → Environment Variables, **build-time**)

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | Yes | Production Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Anon / publishable only |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional alias | Accepted by `apps/web/src/lib/env.ts` |
| `VITE_API_URL` | Yes | Public API origin (https) |

**Security:** Web production bundle scanned — **0** matches for `service_role` / `SERVICE_ROLE_KEY`.

### Backend (Render / Docker / Node host)

| Variable | Required | Notes |
|----------|----------|--------|
| `APP_ENV` | Yes | `production` |
| `NODE_ENV` | Yes | `production` |
| `SUPABASE_URL` | Yes | Same project |
| `SUPABASE_ANON_KEY` | Yes | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server only** — missing from local `.env` (blocks true production `assertProductionConfig`) |
| `API_CORS_ORIGIN` | Yes | Exact Vercel origin (no localhost) |
| `API_PORT` / `PORT` | Optional | API now accepts PaaS `PORT` |

Templates: `.env.example`, `.env.production.example`.

---

## 4. API status

| Check | Result |
|-------|--------|
| Local `GET /health` | ✅ PASS |
| Local `GET /health/supabase` | ✅ PASS (API ↔ Supabase client OK with configured anon env) |
| Unauthorized `GET /api/v1/protected/ping` | ✅ 401/403 |
| Unauthorized `GET /api/v1/auth/me` | ✅ 401/403 |
| Empty login body | ✅ 4xx |
| Public production API URL | ❌ Not provisioned this session |

Packaging ready: `npm run build:api` → `npm run start --prefix apps/api`, or Render Blueprint / `Dockerfile.api`.

---

## 5. Supabase status

| Area | Status | Notes |
|------|--------|-------|
| Project reachability | ✅ | Remote host responds |
| Migrations in repo | ✅ | 000001–000017 via `db:verify` |
| Applied on production project | ⚠ **Unverified** | No `SUPABASE_ACCESS_TOKEN` / CLI link (`supabase/.temp` absent). Ops must run `npx supabase db push` (or dashboard SQL) on the production project. |
| RLS / functions / indexes | ✅ in migrations | Design READY; live apply unverified |
| Storage / Auth | ⚠ | Depends on project dashboard + migrations applied |
| Service role in local env | ❌ | Not set — required for production API boot |

---

## 6. Authentication status

| Check | Result |
|-------|--------|
| API auth middleware + unit tests | ✅ `app.test.ts` / `config.test.ts` (6 tests) |
| Live login → dashboard (browser) | ❌ Not run — no public web URL + no production test user provided |
| Password reset / session restore | ❌ Not exercised online |

---

## 7. Database status

| Check | Result |
|-------|--------|
| Schema files | ✅ 17 migrations |
| Seed | ✅ `supabase/seed.sql` present |
| Live migration apply | ⚠ Manual ops required |
| Indexes (incl. Phase 17) | ✅ in repo |

---

## 8. Smoke test matrix

Automated local API smoke (`npm run smoke:online`): **5/5 PASS** (web URL skipped).

| Flow | Result | Notes |
|------|--------|-------|
| Landing / login page | SKIP | Needs `SMOKE_WEB_URL` after Vercel deploy |
| Authentication | FAIL / blocked | Needs deployed web+API + test user |
| Dashboard | FAIL / blocked | Same |
| Product / customer / supplier create | FAIL / blocked | Same |
| Purchase → stock increase | FAIL / blocked | Same |
| Sale → stock decrease | FAIL / blocked | Same |
| Payment / invoice / return | FAIL / blocked | Same |
| Reports | FAIL / blocked | Same |
| Logout | FAIL / blocked | Same |

Re-run after cutover:

```bash
SMOKE_API_URL=https://YOUR-API SMOKE_WEB_URL=https://YOUR-VERCEL-APP npm run smoke:online
```

Then complete the business flows manually (or with a future Playwright suite).

---

## 9. Security verification

| Check | Result |
|-------|--------|
| Unauthorized API routes blocked | ✅ (local smoke) |
| Service-role not in frontend bundle | ✅ |
| Production CORS rejects localhost | ✅ enforced by `assertProductionConfig` when `APP_ENV=production` |
| Branch / org isolation | ✅ implemented in API/RBAC (unit/integration coverage from prior phases); **not** re-proven on a live multi-tenant production tenant this session |
| Admin permissions | ✅ code path present; live admin user not tested online |

---

## 10. Failed / incomplete items

1. **No Vercel login / token** in this environment → cannot publish web URL from CLI.  
2. **No public API host** provisioned (Render/Railway/Fly account + secrets).  
3. **`SUPABASE_SERVICE_ROLE_KEY` missing** locally → cannot boot API with `APP_ENV=production`.  
4. **Migrations apply to remote project unverified** (no Supabase CLI link).  
5. **End-to-end business smoke** (product→purchase→sale→reports) not executed online.  
6. **`VITE_API_URL` still points at localhost** in local env — must be the public API URL at **Vercel build time**.

---

## 11. Remaining issues / go-live checklist

1. Log in to Vercel (or set `VERCEL_TOKEN`) → set `VITE_*` → deploy / confirm GitHub integration URL.  
2. Create Render (or Docker) API service from `render.yaml` / `Dockerfile.api` with production secrets.  
3. Set `API_CORS_ORIGIN` to the exact Vercel origin; set `VITE_API_URL` to the API HTTPS URL; rebuild web.  
4. Add `SUPABASE_SERVICE_ROLE_KEY` only on the API host.  
5. `npx supabase db push` against the production project; confirm Auth users + `user_profiles`.  
6. Run `npm run smoke:online` against public URLs; then manual business smoke.  
7. Do **not** ship Electron until CRITICAL SQLite/packaging gaps are closed.

---

## 12. Phase 19 packaging delivered in repo

| Artifact | Purpose |
|----------|---------|
| `vercel.json` | SPA rewrites for client routes |
| `Dockerfile.api` | Containerized API |
| `render.yaml` | Render Blueprint for API |
| `scripts/smoke-online.cjs` | Health + auth-negative smoke |
| `npm run build:api` / `smoke:online` | Scripts |
| API `PORT` fallback | PaaS listen port |
| `VITE_SUPABASE_PUBLISHABLE_KEY` alias | Frontend env flexibility |

---

**STOP.** Do not proceed to Electron release while public cutover and CRITICAL desktop gaps remain.
