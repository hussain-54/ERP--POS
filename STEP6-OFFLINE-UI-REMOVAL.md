# STEP 6 â€” Offline UI removal

## Goal

Remove or disable UI that exists **only** for offline functionality. Keep online screens and online portions of mixed screens.

## Already removed (Step 5)

| Item | Status |
|------|--------|
| `apps/web/src/features/sync/**` (Sync Center, Offline POS status, sync-api) | Deleted |
| Routes `/sync`, `/offline-pos` | Removed from `router.tsx` / `modules.ts` |
| Nav entries for Sync / Offline POS | Removed |

## Removed / cleaned in Step 6

### Desktop renderer (offline-only panels)

| UI | Action |
|----|--------|
| â€œSimulate offlineâ€ toggle | Removed |
| â€œOffline POSâ€ panel (smoke sale, pending sales) | Removed entire section |
| Database path + integrity (SQLite management) | Replaced with Config path only |
| First-run copy about offline sales after provision | Updated to online-only |

Kept: first-run provisioning, hardware, updates, **network Online/Offline pill** (real connectivity for online gate â€” not an offline mode product).

### Desktop IPC / preload

| Item | Action |
|------|--------|
| `desktop:setConnectivity` | Removed (only powered the simulate-offline toggle) |
| Status fields `sync`, `offlineDatabase`, SQLite integrity | Removed from `getStatus` |
| Deprecated `databaseFile` / `databaseDir` in `getPaths` | Removed |

### Web POS (mixed screen â€” edit, donâ€™t delete)

| Item | Action |
|------|--------|
| â€œCloud onlyâ€ badge | Removed (offline-architecture messaging) |
| Unused `syncing` prop on `POSTopbar` | Removed |
| Online / â€œOffline â€” blockedâ€ badge | **Kept** â€” connectivity gate for online API sales |
| `navigator.onLine` listeners on `PosPage` | **Kept** â€” blocks checkout when offline |

### Copy / docs

- `apps/desktop/README.md` â€” no SQLite / offline smoke language
- First-run provisioned message â€” no â€œsync outboxâ€ wording
- Customer repository comment â€” online API only

## Intentionally kept

- Online POS (`PosPage`), returns, invoices, salesman, sales management
- Hardware / Devices / Printing pages (online + local print bridges)
- Network connectivity indicators that protect the online sale path

## Validation

- No remaining app matches for: `setConnectivity`, `Cloud only`, `Simulate offline`, Sync Center routes, pending-sales UI
- `npm run typecheck --prefix apps/desktop`
- `npm run typecheck --prefix apps/web`
