# Vercel Build Fix Report

**Date:** 2026-08-11  
**Repo:** https://github.com/hussain-54/ERP--POS  
**Phase:** Pre-Phase 19 — fix Linux/`cmd.exe` install failure only

---

## 1. Root cause

Committed `.npmrc` contained:

```ini
script-shell=cmd.exe
```

On Vercel (Linux), `npm install` runs package lifecycle scripts (including **esbuild**’s install) through that shell. Linux has no `cmd.exe` →:

`ENOENT spawn cmd.exe` under `node_modules/esbuild` → `npm install` exit 254.

This was **not** caused by missing Supabase credentials, Electron packaging, or a corrupt esbuild version in the lockfile. Optional `@esbuild/linux-*` packages were already present in `package-lock.json`.

---

## 2. Files changed

| File | Change |
|------|--------|
| `.npmrc` | Removed `script-shell=cmd.exe`; documented why |
| `.nvmrc` | Added `20` |
| `package.json` | `engines.node` → `20.x`; added `build:web`, `build:desktop` |
| `vercel.json` | `npm ci` → `npm run build:web` → `apps/web/dist` |
| `docs/GITHUB_DEPLOYMENT.md` | Vercel vs Electron separation, Node/npm |
| `docs/VERCEL_BUILD_FIX_REPORT.md` | This report |

---

## 3. Dependency changes

None. No esbuild/Vite/Electron version bumps.

---

## 4. Lockfile changes

None required. Existing `package-lock.json` already lists platform optional `@esbuild/*` packages including Linux.

---

## 5. Build command (Vercel)

```text
install: npm ci
build:   npm run build:web
output:  apps/web/dist
```

(`vercel.json`)

`build:web` = `build:packages` + `apps/web` Vite production build. Does **not** run Electron.

---

## 6. Node version

`20.x` (`.nvmrc` + `engines`)

---

## 7. Package manager

**npm** only (`package-lock.json`, `packageManager: npm@10.9.2`)

---

## 8. Web build result

Clean local verification after deleting `node_modules`:

- `npm ci` ✅ (postinstall `link-workspaces.cjs` via **node**, not cmd.exe)
- `npm run build:web` ✅ → `apps/web/dist/index.html`
- No Windows-only commands in the web path

Local machine Node was v22 (EBADENGINE warning only; `engine-strict=false`). Vercel should select 20.x from `engines`.

---

## 9. Electron build validation

- `npm run build:desktop` / `desktop:prepare` ✅ (scaffold intact)
- No Electron deps removed
- Desktop packaging still **not** invoked by Vercel

---

## 10. Git commit

Message: `fix: make web build compatible with Vercel`  
Commit: `bb4f6d4dff3b6ffca48f3376a731551b089c5383`.
Pushed to `origin/main` (no force).

---

## 11. Remaining warnings

- Vite chunk size > 500 kB (pre-existing; not a install failure)
- `npm audit` reports 2 moderate vulnerabilities (pre-existing)
- Electron/native SQLite still CRITICAL for store POS (`docs/PRODUCTION_READINESS.md`)
- Redeploy on Vercel after this push; set `VITE_*` in Vercel env when ready for a real app (not required to fix install)

---

## 12. Follow-up: TS6305 on Vercel (`build:web`)

**Symptom:** After the `cmd.exe` fix, `npm run build:web` failed with many:

`TS6305: Output file '.../packages/contracts/dist/index.d.ts' has not been built from source file '.../packages/contracts/src/index.ts'`

plus cascading `implicitly has an 'any' type` in `@electronic-erp/domain`.

**Cause:** `packages/*/tsconfig.tsbuildinfo` was committed while `dist/` is gitignored. On a clean Vercel checkout, TypeScript project references trusted stale incremental state that claimed `.d.ts` outputs existed; they did not → TS6305.

**Fix:**

| File | Change |
|------|--------|
| `packages/*/tsconfig.tsbuildinfo` | Removed from git index (stop tracking) |
| `.gitignore` | Explicitly ignore `**/tsconfig.tsbuildinfo` / `packages/*/tsconfig.tsbuildinfo` |
| `scripts/clean-package-dists.cjs` | Wipe `packages/*/dist` + tsbuildinfo before package builds |
| `package.json` `build:packages` | Run clean script first |

Verified locally: `npm run build:web` ✅ and `npm run build:desktop` ✅ after a clean package wipe.

---

**STOP.** Do not start Phase 19 until instructed.
