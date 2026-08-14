# STEP 14 â€” Remove misleading offline UI

## Goal

Remove UI that implies offline capabilities that no longer exist (`Offline ready`, `Offline POS`, `Pending sync`, `Sync complete`).
Show a simple connection state only. **Do not** add network polling.

## Already gone (prior steps)

| UI | Status |
|----|--------|
| Sync Center / Offline POS status pages | Deleted |
| `/sync`, `/offline-pos` routes / nav | Removed |
| â€œSync nowâ€, â€œSync completeâ€, â€œPending syncâ€ product UI | Removed with sync feature |

## Connection state (this step)

| Surface | Before | After |
|---------|--------|-------|
| POS topbar badge | `Online` / `Internet required` | `ðŸŸ¢ Connected` / `ðŸ”´ Connection Required` |
| Desktop shell pill | `Online` / `Offline` | `ðŸŸ¢ Connected` / `ðŸ”´ Connection Required` |
| Failure banners / toasts title | `Internet connection required` | `Connection Required` (aligned copy) |
| Customer history empty state | `â€¦ (online only)` | `No recent ledger entries.` |
| Desktop register CTA | `Register device (online)` | `Register device` + clear connection hint |

## How connection is detected

- Browser `navigator.onLine`
- `window` `online` / `offline` events only
- **No** periodic ping / polling of the API for status badges

## Intentionally unchanged

| Item | Why |
|------|-----|
| Sales â€œPendingâ€ amount / payment confirmation `pending` | Business payment state â€” not sync queue |
| Hold filter `all_pending` | Held sales filter â€” not offline sync |
| Hardware â€œscanner connectedâ€ | Device USB state â€” not ERP offline mode |

## Verdict

**PASS** â€” Misleading offline/sync capability UI is gone. Connection UI is a simple Connected / Connection Required indicator driven by browser connectivity events only.
