# STEP 11 â€” Remove offline dependencies

## Goal

Inspect package manifests and workspace packages. Remove dependencies used **exclusively** for SQLite / offline DB / sync / offline storage â€” only when confirmed unused. Then `npm install` and clean the lock/tree.

## Inventory

### Workspace packages on disk

| Package | Role | Offline-only? |
|---------|------|---------------|
| `packages/contracts` | DTOs / Zod | No â€” keep |
| `packages/domain` | Business rules | No â€” keep |
| `packages/db` | Supabase repositories | No â€” keep |
| `packages/hardware` | Print / drawer | No â€” keep |
| `packages/ai` | AI features | No â€” keep |
| `packages/ui` | Shared UI | No â€” keep |
| `packages/offline` | SQLite offline | **Already deleted** (Step 4) |
| `packages/sync` | Sync engine | **Already deleted** (Step 5) |

### Declared dependencies (`package.json`)

| Location | Offline/SQLite/sync deps found? |
|----------|----------------------------------|
| Root `package.json` | **None** (`better-sqlite3` already removed in Step 4) |
| `apps/desktop/package.json` | **None** |
| `apps/web/package.json` | **None** |
| `apps/api/package.json` | **None** |
| Package workspace `package.json`s | **None** |
| `scripts/link-workspaces.cjs` | No offline/sync stubs |
| Root `typecheck` / `build:packages` / `test:foundation` | No offline/sync prefixes |
| Vite / tsconfig path aliases | No `@electronic-erp/offline` or sync |

### Intentionally **not** removed

| Item | Why |
|------|-----|
| `@supabase/supabase-js` | Online source of truth |
| `electron` / `electron-builder` / `electron-updater` | Desktop shell (online), not SQLite |
| `zod`, `express`, `react`, â€¦ | Core online stack |
| Supabase migration `â€¦010_offline_sync_engine.sql` listed in `verify-db-readiness.cjs` | Schema Class D â€” not an npm dependency |

## Action taken this step

| Finding | Action |
|---------|--------|
| `better-sqlite3@11.10.0` **extraneous** in `node_modules` (not in lockfile) | `npm uninstall better-sqlite3 @types/better-sqlite3` |
| `@types/better-sqlite3@7.6.13` **extraneous** | Removed with uninstall |
| Fresh install | `npm prune` + `npm install` |
| Workspace stubs | `node scripts/link-workspaces.cjs` after install |

## Post-clean verification

| Check | Result |
|-------|--------|
| `npm ls better-sqlite3` | empty (not installed) |
| `node_modules/better-sqlite3` | **Absent** |
| `node_modules/@types/better-sqlite3` | **Absent** |
| `node_modules/@electronic-erp/offline` | **Absent** |
| `node_modules/@electronic-erp/sync` | **Absent** |
| `package-lock.json` matches for better-sqlite / offline / sync packages | **0** |
| Declared deps in all `package.json` files for sqlite/offline/sync | **None** |

## Verdict

**PASS** â€” No offline/SQLite/sync packages remain as declared dependencies. Extraneous `better-sqlite3` / `@types/better-sqlite3` leftovers were removed from `node_modules` and the tree was reinstalled cleanly.
