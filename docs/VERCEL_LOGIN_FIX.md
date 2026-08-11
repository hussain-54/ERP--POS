# Vercel login / API (same deployment)

## What was broken

The Vercel site is a static SPA. Login calls `POST /api/v1/auth/login`.  
If `VITE_API_URL` pointed at `http://localhost:4000`, the browser on Vercel could not reach your PC → login failed.

## Fix

1. Express API is deployed as a **Vercel serverless function** (`api/index.mjs`).
2. Production web uses **same-origin** API (`VITE_API_URL` empty / ignores localhost).
3. SPA rewrite no longer swallows `/api/*`.

## Vercel Environment Variables

Set these for **Production** (Project → Settings → Environment Variables):

| Variable | Value |
|----------|--------|
| `VITE_SUPABASE_URL` | your Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_URL` | same as above |
| `SUPABASE_ANON_KEY` | same anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | **service role** (server only) |
| `APP_ENV` | `production` |
| `NODE_ENV` | `production` |

**Remove or clear** `VITE_API_URL` if it is `http://localhost:4000`.

Optional: `API_CORS_ORIGIN=https://<your-app>.vercel.app` (auto-allowed for `*.vercel.app`).

## After changing env

Redeploy (Deployments → … → Redeploy) so Vite rebuilds with the new `VITE_*` values.

## Smoke check

1. `https://<your-app>.vercel.app/health` → JSON ok  
2. `https://<your-app>.vercel.app/login` → sign in with owner account  

