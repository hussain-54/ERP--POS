# Phase 18 — Production Deployment Readiness Audit

No new business features. Focus: environments, security, logging, migrations, Electron preparation, build verify, readiness report.

## Deliverables

- Env templates: `.env.development.example`, `.env.staging.example`, `.env.production.example`
- `supabase/seed.sql` + `npm run db:verify`
- Structured API logging + redaction
- Production config fail-fast (`APP_ENV=staging|production`)
- Electron scaffold: `apps/desktop`
- Report: `docs/PRODUCTION_READINESS.md`

## Verify

```bash
npm run db:verify
npm run build:packages
npm run test:phase18
npm run typecheck --prefix apps/api
npm run build --prefix apps/api
npm run build --prefix apps/web
npm run desktop:prepare
```

**STOP** after the readiness report. Do not deploy while CRITICAL issues remain.
