# GitHub deployment guide

Repository target: `https://github.com/hussain-54/ERP--POS`

This document never contains real secrets. Copy values from your secret store into local/host env files only.

## Package manager & Node

| Item | Value |
|------|--------|
| Package manager | **npm** (`package-lock.json`, `packageManager: npm@10.9.2`) |
| Node | **20.x** (`.nvmrc`, `engines.node`) |

Do not commit competing lockfiles (pnpm/yarn/bun).

## Important separation

| Target | Command | Notes |
|--------|---------|--------|
| **Vercel = Web only** | `npm ci` → `npm run build:web` | Output: `apps/web/dist` (`vercel.json`) |
| **API (separate host)** | `npm run build:packages` + `npm run build --prefix apps/api` | Not packaged by Vercel static output |
| **Windows installer = Electron** | `npm run build:desktop` / future electron-builder | Must **not** run on Vercel |

Vercel must never run Electron packaging or Windows-only scripts. `.npmrc` must **not** set `script-shell=cmd.exe` (breaks Linux `esbuild` install).

## 1. Repository structure

```text
apps/web          React + Vite + Tailwind frontend
apps/api          Node.js + Express API
apps/desktop      Electron scaffold (not production-ready)
packages/*        contracts, domain, db, sync, offline, hardware, ui, ai
supabase/migrations   Production schema (000001–000017)
supabase/seed.sql     Optional demo seed
scripts/          Workspace link + db verify helpers
docs/             Architecture, phase, readiness docs
vercel.json       Web install/build/output for Vercel
```

## 2. Required environment variables

### Frontend (Vite) — set in Vercel Project Settings for builds

| Variable | Notes |
|----------|--------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon / publishable key only |
| `VITE_API_URL` | Public API base URL |

### Backend (Node) — API host only

| Variable | Notes |
|----------|--------|
| `APP_ENV` | `development` \| `staging` \| `production` |
| `NODE_ENV` | Usually `production` on servers |
| `SUPABASE_URL` | Same project URL |
| `SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only — never in Vite** |
| `API_PORT` | e.g. `4000` |
| `API_CORS_ORIGIN` | Exact web origin (no localhost in production) |
| `LOG_LEVEL` | `info` / `debug` |

Templates: `.env.example`, `.env.development.example`, `.env.staging.example`, `.env.production.example`.

## 3. Local development commands

```bash
cp .env.example .env
# fill local values — do not commit .env
npm install
npm run build:packages
npm run db:verify
# apply migrations to your Supabase project (CLI):
#   npx supabase db push
npm run dev:api
npm run dev:web
```

Windows note: `scripts/link-workspaces.cjs` stubs packages (no symlinks).

## 4. Production build commands

### Web (Vercel)

```bash
npm ci
npm run build:web
# → apps/web/dist
```

### Full monorepo (API + web)

```bash
npm ci
npm run build:packages
npm run build --prefix apps/api
npm run build --prefix apps/web
npm run start --prefix apps/api   # serves apps/api/dist
```

### Desktop (local Windows only — not Vercel)

```bash
npm run build:desktop
```

## 5. Database migration process

1. Create a Supabase project per environment.
2. Apply all files in `supabase/migrations/` in order (or `npx supabase db push` / `db reset`).
3. Optionally run `supabase/seed.sql`.
4. Create Auth users and link `user_profiles`.

Fresh projects must not depend on dashboard-only tables — schema lives in migrations.

## 6. Frontend deployment requirements (Vercel)

- Root of the GitHub repo; uses `vercel.json`.
- Build `apps/web` with production `VITE_*` vars at **build time**.
- Output directory: `apps/web/dist`.
- Never inject `SUPABASE_SERVICE_ROLE_KEY` into the frontend build.

## 7. Backend deployment requirements

- Run Node 20.x on `apps/api` (`npm run start` after build), or use `Dockerfile.api` / `render.yaml`.
- Set server env vars (including service role) via the host secret store.
- Set `APP_ENV=production` and a non-localhost `API_CORS_ORIGIN` matching the Vercel web URL.
- Listen port: `API_PORT` or PaaS `PORT`.
- Health check: `GET /health` (also `GET /health/supabase`).
- Post-deploy smoke: `SMOKE_API_URL=… SMOKE_WEB_URL=… npm run smoke:online`

## 8. Electron build requirements

`apps/desktop` is a **scaffold only**. Do not ship Windows installers until native SQLite + Electron packaging are implemented (see `docs/PRODUCTION_READINESS.md`).

Validation today:

```bash
npm run desktop:prepare
# or
npm run build:desktop
```

## 9. Security rules

- Never commit `.env`, `.env.local`, `.env.production`, `.env.development`, or real keys.
- Never put service-role keys in React/Vite.
- Ignore SQLite `*.db` / WAL / SHM — create DBs at runtime.
- Rotate keys if a secret was ever committed or pasted into chat/logs.

## 10. Git workflow

- Default branch: `main`
- Remote: `origin` → `https://github.com/hussain-54/ERP--POS.git`
- Prefer PR reviews for production changes
- No force-push to `main`

## 11. Creating a production release

1. Ensure `docs/PRODUCTION_READINESS.md` CRITICAL items are closed for the target (web-only vs full POS).
2. Tag a release: `git tag -a vX.Y.Z -m "release vX.Y.Z"` and push tags.
3. Deploy API + web from that tag with environment-specific secrets.
4. Apply migrations to the production Supabase project before cutting traffic.

Phase 19 online deployment notes: see `docs/ONLINE_DEPLOYMENT_REPORT.md`.
