# STEP 16 â€” Dead code check (offline conversion phase)

## Goal

After offline removal, find and fix **phase-caused** dead/broken code only:

- unused / broken imports
- dead routes / components / services
- references to deleted files
- SQLite / sync / offline leftovers that break the build

Do **not** do unrelated refactoring. Keep shared schema fields (`sync_state`, `offline_transaction_id`) and authz `sync.*` permission strings.

## Scan results (source)

| Check | Result |
|-------|--------|
| Imports of `@electronic-erp/offline` / `@electronic-erp/sync` / `better-sqlite3` | **None** in live source |
| `apps/web/src/features/sync` | Absent |
| `apps/api/src/routes/sync.ts` | Absent |
| `packages/db/.../sync-repository.ts` | Absent |
| `packages/contracts/src/sync.ts` / `runtime-mode.ts` | Absent |
| Web routes `/sync`, `/offline-pos` | Absent from `modules.ts` / `router.tsx` |
| Full monorepo `npm run typecheck` | **PASS** |

## Issues found (phase-caused) â€” fixed

Stale **compiled** artifacts still referenced deleted sync modules:

| Artifact | Problem | Fix |
|----------|---------|-----|
| `apps/api/dist/app.js` | Still `import { syncRouter } from "./routes/sync.js"` | Rebuilt `apps/api` |
| `apps/api/dist/routes/sync.*` | Orphan dist for deleted route | Deleted + rebuild |
| `packages/db/dist/repositories/sync-repository.*` | Orphan dist | Deleted + rebuild |
| `packages/contracts/dist/sync.*` | Orphan dist | Deleted + rebuild |
| `apps/desktop/dist/db/bootstrap.*` | Orphan SQLite bootstrap dist | Removed `dist/db` + rebuilt desktop |
| `api/handler.cjs` | Rebundled to match current API (no `/api/v1/sync`) | `node scripts/bundle-vercel-api.cjs` |

## Intentionally left (not dead code)

| Item | Why |
|------|-----|
| `sync_state` / `offline_transaction_id` columns & fields | Shared online schema (Class B) |
| Authz keys `sync.manage` / `sync.push` / â€¦ | RBAC catalog strings; harmless |
| Migration file `â€¦010_offline_sync_engine.sql` | Class D â€” no DROP in this phase |
| Historical docs (`OFFLINE-*.md`, audits) | Documentation, not runtime |
| Cursor index ghosts for deleted files | Not on disk; ignored |

## Validation

- `npm run typecheck` â€” pass (pre-fix)
- Rebuild contracts / db / api / desktop â€” pass
- `apps/api/dist/app.js` â€” no `syncRouter`
- `apps/desktop/dist` â€” no bootstrap/sync offline artifacts
- `api/handler.cjs` â€” no `/api/v1/sync`

## Verdict

**PASS** â€” Live source had no broken offline imports. Phase-caused **stale dist** dead code was removed and rebuilt so runtime artifacts match the online-only source.
