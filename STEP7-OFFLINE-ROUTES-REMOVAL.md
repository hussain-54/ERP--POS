# STEP 7 â€” Offline routes removal

## Goal

Find routes that exist **only** for offline functionality, verify they are offline-only, then remove registration, navigation, imports, pages, breadcrumbs, sidebar, and menu entries.

## Inventory (verified offline-only)

| Route | Surface | Offline-only? | Disposition |
|-------|---------|---------------|-------------|
| `/offline-pos` | Web | Yes â€” Offline POS status | Already removed (Step 5/6) |
| `/sync` | Web | Yes â€” Sync Center / conflicts / Sync now | Already removed (Step 5/6) |
| `/offline`, `/offline-status`, `/sync-center`, `/offline-database` | Web | N/A â€” never present as registered routes | None to remove |
| `/api/v1/sync/*` (`devices/register`, `push`, `pull`, `conflicts`, `status`) | API | Yes â€” outbox push/pull/conflict API | Source removed (Step 5); **stale Vercel bundle cleared in this step** |

## Not offline-only (kept)

| Route / nav | Why kept |
|-------------|----------|
| `/pos`, `/held-sales`, `/returns`, `/invoices`, â€¦ | Online POS / sales |
| `/devices` | Online device support page |
| `/backup`, `/integrations`, `/security` | Online infrastructure |
| AppShell sidebar / breadcrumbs / command palette | Driven by `ERP_MODULES` â€” no offline entries |

## Source state (before this step)

Already absent on disk:

- `apps/web/src/features/sync/**` (pages + `sync-api`)
- `apps/web` `router.tsx` / `modules.ts` entries for `/sync`, `/offline-pos`
- `apps/api/src/routes/sync.ts`
- `app.use("/api/v1/sync", â€¦)` in `apps/api/src/app.ts`

Nav, breadcrumbs, and command-palette items come only from `ERP_MODULES` â€” no separate offline menu hardcoding.

## Action taken in Step 7

| Item | Action |
|------|--------|
| Stale `api/handler.cjs` still containing `syncRouter` + `app.use("/api/v1/sync", â€¦)` | Rebuilt via `node scripts/bundle-vercel-api.cjs` |
| Post-rebuild check for `api/v1/sync` / `syncRouter` in handler | **None found** |

## Intentionally not removed

| Item | Why |
|------|-----|
| `syncState` / related contract fields | Shared online schema columns, not routes |
| Authz permission strings `sync.*` | RBAC catalog leftovers; not route registration |
| Migration test referencing `â€¦010_offline_sync_engine.sql` | Schema Class D; not a runtime route |
| Historical docs mentioning `/sync` | Documentation only |

## Validation

- `ERP_MODULES` / `router.tsx`: no `/sync`, `/offline-pos`, or other offline-only paths
- `apps/api/src/app.ts`: no sync mount
- Source scan under `apps/web/src` + `apps/api/src`: no `offline-pos` / `SyncCenter` / `api/v1/sync` route wiring
- `api/handler.cjs`: no `/api/v1/sync` registration after rebuild
