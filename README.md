# README

Electrical Store ERP monorepo (Phases 0–17 complete; Phase 18 = production readiness audit).

## Stack

- Web: React + TypeScript + Vite + Tailwind (`apps/web`)
- API: Node.js + Express + TypeScript (`apps/api`)
- Desktop: Electron scaffold only (`apps/desktop`) — **not production-ready**
- Shared: contracts, domain, db, sync, hardware, offline, ui, ai
- Database: Supabase PostgreSQL migrations (000001–000017) + RLS + `supabase/seed.sql`

## Environments

| Env | Template | Local file (gitignored) |
|-----|----------|-------------------------|
| Development | `.env.development.example` | `.env.development` / `.env` |
| Staging | `.env.staging.example` | `.env.staging` |
| Production | `.env.production.example` | `.env.production` |

Never hardcode Supabase URLs, keys, payment secrets, or encryption keys in source.

API loads `.env` then `.env.$APP_ENV` and **fails fast** in staging/production if required secrets are missing.

## Quick start (development)

```bash
cp .env.development.example .env
cp .env.development.example .env.development
# fill real keys locally — do not commit
npm install
npm run build:packages
npm run db:verify
# Apply migrations to your Supabase project:
#   npx supabase db push
#   or: npx supabase db reset   (local — runs migrations + seed.sql)
npm run dev:api
npm run dev:web
```

> **Windows note:** npm workspace symlinks are blocked here. `postinstall` / `build:packages` runs `scripts/link-workspaces.cjs` to stub packages under `node_modules/@electronic-erp/*`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev:web` / `dev:api` | Local servers |
| `npm run build` | Packages + API + web production builds |
| `npm run typecheck` / `lint` | TypeScript across workspaces |
| `npm run test:phase17` | Integration QA suite |
| `npm run test:phase18` | Readiness-focused tests + desktop prepare check |
| `npm run db:verify` | Migration + seed presence / RLS smoke checks |
| `npm run desktop:prepare` | Electron scaffold readiness (reports blockers) |

## Supabase

1. Create separate projects for development / staging / production
2. Copy URL + anon key into the matching env files; service role **API only**
3. Apply **all** migrations in `supabase/migrations/` (not only foundation)
4. Run `supabase/seed.sql` (or `supabase db reset` locally)
5. Create an Auth user and link `user_profiles`

## Production readiness

See **`docs/PRODUCTION_READINESS.md`**. Do not deploy store-floor POS while CRITICAL issues remain (Electron + native SQLite).
