# STEP 8 â€” Offline flags removal

## Goal

Find `if (offline)` / `if (!online)` / `navigator.onLine` (and similar) branches.
**Do not blindly delete.** Only remove branches that exist to select a SQLite/offline implementation vs Supabase. Leave no dead dual paths.

## Classification

| Location | Pattern | Selects SQLite/offline impl? | Action |
|----------|---------|------------------------------|--------|
| `packages/contracts/src/runtime-mode.ts` (`ONLINE_ONLY`, `assertOnlineOnlyAllowsOfflineOps`, `ONLINE_ONLY_DISABLED_MESSAGE`) | Kill-switch flag for removed offline product | Yes (legacy gate for offline ops) | **Deleted** + unexported from contracts index |
| `pos-customer-repository` `online` param + `requireConnectivity` | Former dual path: offline cache vs API | Yes (param only existed for offline selection; body already API-only) | **Removed** â€” always `partiesApi` / commerce API |
| `PosPage` `navigator.onLine` + `requireOnlineForPos` | Blocks checkout/hold/resume/search when no network | **No** â€” connectivity gate for online API | **Kept** (message de-coupled from `ONLINE_ONLY_*`) |
| `PosPage` product/customer search `if (!online)` | Skip API search when disconnected | **No** | **Kept** |
| `POSTopbar` Online / Offline â€” blocked badge | UX for connectivity | **No** | **Kept** |
| Desktop `if (!getOnline())` on provision | Require internet to register terminal | **No** | **Kept** |
| Desktop Online/Offline pill | Status display | **No** | **Kept** |
| Domain/DB `offlineTransactionId ? "pending" : "synced"` | Schema field mapping for optional column | **No** (not a repository fork) | **Kept** (shared schema Class B) |
| `sync_state` / `offline_transaction_id` columns | Persistence fields | N/A | **Kept** |

## No dual-repository branches found

There were **no** remaining patterns of the form:

```ts
if (offline) return sqliteRepositoryâ€¦;
return supabaseRepositoryâ€¦;
```

Offline packages and sync UI were already removed in Steps 4â€“7. Step 8 cleaned leftover **flags** and **online-param plumbing**.

## Changes made

| File | Change |
|------|--------|
| `packages/contracts/src/runtime-mode.ts` | Deleted |
| `packages/contracts/src/index.ts` | Stop exporting runtime-mode |
| `apps/web/.../pos-customer-repository.ts` | Drop `online` / connectivity dual-path param; API only |
| `apps/web/.../PosPage.tsx` | Stop passing `online` into customer repo; keep network gate with plain message |
| `apps/web/.../pos-repository.ts` | Comment cleanup (no SQLite mention) |

## Validation

- `npm run typecheck --prefix packages/contracts` â€” pass
- `npm run typecheck --prefix apps/web` â€” pass
- `npm run build --prefix packages/contracts` â€” rebuilt dist without runtime-mode export
