# STEP 13 â€” Online failure behavior

## Goal

Application is **online-only**. When connectivity / Supabase is unavailable:

- Communicate clearly: **â€œInternet connection requiredâ€** (or equivalent)
- Do **not** write SQLite, queue fake offline sales, or pretend payment/stock/invoice succeeded
- Critical ops must show failure â€” do not silently lose data

## Guarantees

| Behavior | Status |
|----------|--------|
| No SQLite write on failure | Confirmed â€” offline DB removed |
| No offline sale queue | Confirmed â€” sync/outbox removed |
| No fake payment success | Checkout failure â†’ `PaymentAttemptGate.fail` + danger toast |
| No fake stock / invoice local save | Persistence only via API â†’ Supabase |

## Changes

### Shared helper â€” `apps/web/src/lib/online-required.ts`

- `INTERNET_REQUIRED_TITLE` / `INTERNET_REQUIRED_MESSAGE`
- `requireInternetConnection()` â€” pre-flight gate
- `formatOnlineFailure()` â€” maps network / offline errors to cashier-facing copy
- Explicit: *â€œNothing was saved locally.â€*

### `apiFetch` (`apps/web/src/lib/api.ts`)

- Catches `fetch` network failures â†’ `ApiError` with internet-required message (status `0`)
- Prevents raw â€œFailed to fetchâ€ as the only signal

### POS (`PosPage.tsx`)

- Offline **alert banner** when `navigator.onLine` is false
- Checkout / hold / resume use formatted online failures
- Payment failure still marks confirmation `failure` (never success)
- Topbar badge: **â€œInternet requiredâ€** when offline

### Returns / Exchange (`ReturnsPage.tsx`)

- Online listener + banner
- `requireInternetConnection` before search and `postReturn`
- Failure toast uses `formatOnlineFailure` (`return` / `exchange`)

### Stock (`StockOpsPage.tsx`)

- Gate + formatted failure on ledger movement post

## Critical operations

| Operation | Pre-flight | On unreachable API |
|-----------|------------|--------------------|
| Sale / Payment | `requireOnlineForPos` | Danger toast; payment confirmation = failure; new idempotency key |
| Return / Exchange | `requireInternetConnection` | Danger toast; no posted id |
| Stock update | `requireInternetConnection` | Danger toast; no movement |
| Hold | Online gate | Danger toast |

## What success still means

Success toasts (**Payment accepted**, **Return posted**, **Movement posted**) only run **after** a successful API response â€” never after a local write.

## Validation

- `npm run typecheck --prefix apps/web` â€” **pass**

## Verdict

**PASS** â€” Offline is not pretended. Critical ops fail visibly with â€œInternet connection requiredâ€ when the network / API cannot be reached; no silent local persistence.
