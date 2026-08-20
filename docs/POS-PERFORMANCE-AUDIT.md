# POS Performance Audit

Date: 2026-08-20  
Scope: in-ERP POS (`/pos`, `/pos/new`) only — **no UI redesign**.  
Sources: `docs/POS-MATURITY-AUDIT.md`, static request inventory, cost-model unit tests, browser probe.

---

## Measurement method

| Layer | What was measured | How |
| --- | --- | --- |
| Backend search / invoice | Supabase-style round-trips vs result/line count | `pos-performance-model.ts` + Vitest (`pos-performance-model.test.ts`) |
| Mount / bootstrap | API calls fired from `PosPage` + `usePosShellStatus` | Code inventory + cost model |
| Browser | Live Network / TTFI | Attempted against `http://localhost:5173/pos` |
| Indexes | Migration presence | `supabase/migrations/20260820000001_pos_performance_indexes.sql` |

### Browser / environment notes (this session)

* Vite web: **reachable** (`GET http://localhost:5173/` → 200).
* Navigating `/pos` **redirects to `/login`** (auth gate) — no authenticated POS DOM to profile.
* API (`http://localhost:4000/health`): **unreachable** during the measurement window.
* Therefore wall-clock “initial load ms / TTFI ms / Network waterfall” could **not** be captured live. Before/after numbers below for search/invoice are **deterministic round-trip counts** (same method as maturity audit P0), not guessed timings. Mount request counts are from code paths that actually run.

Cost-model tests: **4/4 passed**.

---

## Executive summary

**Before:** POS product search was an N+1 Supabase storm (~177 round-trips for 24 warehouse-scoped hits). Shell `listHolds` also ran hold expiry on every header mount. Bootstrap APIs re-fetched on remount with no shared TTL.

**After:** Search and invoice hydration are batched/parallel; shell hold badge skips expiry; bootstrap uses in-session TTL + in-flight dedupe; search/scanner share a sequence guard; POS indexes migration added.

**Preserved:** full product/inventory/customer/pricing/payment behavior; real Supabase data; search remains limited (24→50), not a full catalog dump.

---

## Before measurements

### A. Product search (backend Supabase round-trips)

Model: `estimateSearchProductRoundTrips` — warehouse on, customer prices on.

| Result rows | Legacy N+1 | Notes |
| --- | ---: | --- |
| 1 | 17 | discovery + 7 hydrate + customer price |
| 12 | 94 | scales linearly with N |
| 24 | **178** | typical first page (`POS_PRODUCT_SEARCH_LIMIT`) |
| 50 | 360 | API max page |

Formula (legacy): ~9 discovery + N×(6 taxonomy/unit/spec + optional stock) + optional customer price query.

### B. Invoice load (`getInvoice`)

| Lines | Legacy | Notes |
| --- | ---: | --- |
| 40 | **88** | 8 header fetches + 2 per line (product + unit) |

### C. POS mount (HTTP APIs to Express)

| Call | Source | Notes |
| --- | --- | --- |
| `seedPaymentMethods` | PosPage | always |
| `listWarehouses` | PosPage | always |
| `listEmployees` | PosPage | always |
| `listReferences` | PosPage | always |
| `listTaxRates` | PosPage | always |
| `listTaxonomy(categories)` | PosPage | always |
| `listHolds` **with expiry** | shell status | mutated DB via `expireDueHolds` |
| `currentShift` / shift status | shell | always |
| `listBranches` | shell | always |
| `list devices` | shell | always |

**Budget:** ~9 bootstrap APIs; **1** hold list **with** expiry on every shell mount.

Products are **not** loaded as a full table on mount — only after search / category / scanner (good). Search limit default **24**, max **50**.

### D. Frontend (maturity audit + code)

* No React Query on POS — `useEffect` + setState fetch.
* Multiple search entry points (typed, category, Enter, scanner) could race.
* Recent/Favorites: `localStorage` full `ProductSearchResult` objects (stale stock risk).
* Cart totals: `useMemo` + `recalculateCart` on cart/tax changes (O(lines), fine for POS carts).
* Bundle (prior build warning): main web chunk ~1.9 MB minified — shared ERP+POS, not POS-only.

---

## Investigation checklist (1–29)

| # | Topic | Finding (before → after) |
| --- | --- | --- |
| 1 | Initial POS load time | Could not wall-clock measure (login + API down). Mount work = ERP shell + ~9 POS bootstrap APIs. |
| 2 | Time to first usable interface | Same; usable sale UI waits for warehouses/tax/methods. Bootstrap now parallel + TTL so remount is cheaper. |
| 3 | Product query duration | Dominated by legacy N+1; batched to ≤~18 RTs independent of N (within page size). |
| 4 | Supabase requests on POS mount | Mount itself does **not** hit product search. Search path was N×7; now constant waves. |
| 5 | Repeated requests | Shell holds+expiry; remount bootstrap repeats; search races. Fixed: `applyExpiry=false` on badge; TTL/dedupe; search seq. |
| 6 | Product list size | Not full catalog; limit 24/50. Client “View More” pages 12 visible. |
| 7 | Customer queries | On demand via `pos-customer-repository` / parties API — not on every mount. Unchanged (correct). |
| 8 | Inventory queries | Stock via search `stock_balances` batch (was per-product). Warehouses listed once (cached). |
| 9 | Branch queries | Shell `listBranches` — now TTL-cached. |
| 10 | Warehouse queries | Mount `listWarehouses` — now TTL-cached; first warehouse auto-selected. |
| 11 | Price queries | Retail fields on product row; customer prices one `.in()` when `customerId` set. |
| 12 | Tax queries | Mount `listTaxRates` once (cached); cart uses selected rate in memory. |
| 13 | Re-render frequency | Search draft debounce 180ms; still large `PosPage` tree. No redesign this phase. |
| 14 | Expensive React components | `PosPage` monolith + product panel grid; panels already `memo` where present. |
| 15 | Expensive derived calculations | Cart totals memoized; category filter client-side on search hits. |
| 16 | useEffect dependency problems | Bootstrap `[]` intentional; holds effect keyed by `showHolds`. Search seq prevents stale setState. |
| 17 | Unnecessary state updates | Stale search responses dropped via `productSearchSeq` / `isLatestRequest`. |
| 18 | Duplicate fetching | Bootstrap TTL + in-flight promise share; shell devices/branches cached. |
| 19 | Unnecessary full-table queries | Search always `.limit`; taxonomy browse still uses search API (not `select *` products). |
| 20 | Missing pagination | Server limit + client slice; not cursor/offset pages beyond “View More” bumping limit to 50. |
| 21 | Missing indexes | Migration adds org/sku/code/stock/holds indexes (apply in Supabase). |
| 22 | Image loading | `productImageUrl` rarely populated; no image fan-out today — low impact. |
| 23 | Large component rendering | Entire sale layout in one page; remains a remaining bottleneck (UX phase). |
| 24 | Cart recalculation cost | Domain `calculatePosCartTotals` / `recalculateCart` — cheap for typical cart sizes. |
| 25 | localStorage/session | Terminal id + Recent/Favorites; still writes product snapshots (stale stock remains a correctness note). |
| 26 | Duplicate subscriptions | Online/offline + keydown + catalog-changed + shortcuts cleaned up on unmount. |
| 27 | Memory leaks | Listeners have remove handlers; bootstrap cache Map is session-scoped (intentional). |
| 28 | Stale queries | Search seq + catalog-changed clears bootstrap cache prefix when wired. |
| 29 | Sequential → parallel | Search discovery/hydrate `Promise.all`; category `mergeProductSearches` parallel; expire holds parallel updates. |

---

## Bottlenecks (ranked)

1. **P0 — `searchProducts` N+1** (fixed): per-row stock + taxonomy + unit awaits.
2. **P1 — `getInvoice` N+1** (fixed): per-line product/unit.
3. **P1 — Shell `listHolds` + expiry** (fixed for badge): write work on every POS chrome mount.
4. **P2 — Bootstrap remount refetch** (mitigated): TTL 60s + in-flight dedupe.
5. **P2 — Search races** (mitigated): shared sequence / latest-wins.
6. **P3 — Stacked chrome + large `PosPage`** (open): render cost, not data (out of scope for this pass).
7. **P3 — No React Query** (open): invalidation patterns are custom; TTL is real-data cache only.
8. **P3 — ilike search** (open): still multiple discovery queries; indexes help equality/prefix more than leading-wildcard `ilike`.

---

## Root causes

1. Repository hydration written as “for each product, await related tables” against PostgREST (each await ≈ 1 RTT).
2. Hold list API defaulted to mutating expiry for **all** callers, including a badge count.
3. POS avoided React Query; each `useEffect` owned its own fetch with no shared cache.
4. Multiple UX paths invoked `searchProducts` without a shared in-flight / generation token.

---

## Fixes implemented

### Backend — `packages/db/src/repositories/pos-repository.ts`

* **`searchProducts`**: Wave 1 parallel discovery; Wave 2 batched missing products / taxonomy products; Wave 3 batched brands/companies/categories/models/units/specs/`stock_balances`; optional customer prices one query.
* **`getInvoice`**: parallel header fetches; batched `.in()` for products and units.
* **`expireDueHolds`**: parallel updates instead of sequential loop.
* **`listHeldSales(..., { applyExpiry })`**: callers can skip expiry.

### API — `apps/api/src/routes/pos.ts`

* `GET /holds?applyExpiry=false` respected.

### Frontend

* `pos-bootstrap-cache.ts` — 60s TTL + in-flight dedupe for bootstrap keys (real responses only).
* `PosPage` / `usePosShellStatus` use `cachedPosFetch`; shell holds use `applyExpiry: false`.
* Shared `productSearchSeq` across typed search, category, Enter, and scanner.
* Cost model + tests: `pos-performance-model.ts`, `pos-bootstrap-cache.test.ts`.

### Database

* `20260820000001_pos_performance_indexes.sql` — products/barcodes/stock_balances/held_sales indexes.

### Not done (by design)

* No UI redesign / chrome collapse.
* No mock data / fake empty catalogs.
* No removal of inventory, customers, pricing, or payments.
* No loading entire product catalog into the client.

---

## After measurements

### A. Product search round-trips

| Result rows | Legacy | Batched | Reduction |
| --- | ---: | ---: | ---: |
| 1 | 17 | 18 | ~flat at N=1 (wave overhead) |
| 12 | 94 | **18** | ~5× |
| 24 | 178 | **18** | **~10×** |
| 50 | 360 | **18** | **~20×** |

Batched budget ≈ 8 discovery + ≤2 follow-ups + ≤7 hydrate + ≤1 customer price (**≤18**, independent of N within the page).

Wall-clock latency scales with slowest query in each wave, not N×RTT — expected large drop once API/db package is rebuilt and deployed.

### B. Invoice

| Lines | Legacy | Batched |
| --- | ---: | ---: |
| 40 | 88 | **10** |

### C. Mount budget

| Metric | Before | After |
| --- | --- | --- |
| Bootstrap API kinds | 9 | 9 (same required data) |
| Hold list with expiry (shell) | 1 | **0** |
| Hold list without expiry (shell) | 0 | **1** |
| Remount within 60s | full refetch | **cache hit / shared in-flight** |

### D. Product list

* Still search-scoped: default **24**, max **50**, client page size **12**.
* Inventory still returned on search when warehouse selected (batched, not removed).

### E. Verification commands

Recorded after this change set:

* Cost-model + bootstrap tests → **pass** (4 tests)
* `npm run typecheck` → **pass**
* `npm run lint` (alias of typecheck) → **pass**
* `npm run build` → **pass** (web chunk 1,947.91 kB / 408.41 kB gzip; Rollup size warning unchanged)

---

## Remaining bottlenecks

1. **Authenticated browser timing** still needed once API + login are available (TTFI, Network count, search ms).
2. **Leading-wildcard `ilike`** discovery remains multiple queries; consider trigram/`fts` later without changing UX.
3. **`PosPage` size / stacked ERP+POS chrome** — render and layout cost (visual phase).
4. **No React Query** — broader cache/invalidation story still custom.
5. **Recent/Favorites localStorage stock** — still can go stale (correctness more than raw speed).
6. **Category browse** may still fire several parallel searches (`mergeProductSearches`); each search is now cheap, but count can be >1.
7. **Indexes migration** must be applied to the live Supabase project to realize DB-side gains.
8. **Main web bundle size** (~1.9 MB) — code-splitting POS route would help first paint globally.

---

## Target architecture compliance

| Goal | Status |
| --- | --- |
| Initially load only what POS needs | Yes — no full product dump on mount |
| Searchable products | Yes — existing search API |
| Paginated / limited | Yes — 24/50 + client View More |
| Server-side filter where possible | Yes — q / warehouse / customerId |
| Caching with real data + invalidation | Yes — TTL bootstrap; catalog-changed clears; no mocks |
| Avoid fetch→setState loops | Mitigated — seq guards + stable bootstrap deps |
| Avoid duplicate identical fetches | Mitigated — `cachedPosFetch` |

---

## Verification

| Command | Result |
| --- | --- |
| Cost-model + bootstrap tests | Pass (4 tests) |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |

---

## File map

| Path | Role |
| --- | --- |
| `packages/db/src/repositories/pos-repository.ts` | Batched search / invoice / expire |
| `apps/api/src/routes/pos.ts` | `applyExpiry` query |
| `apps/web/src/features/pos/pos-bootstrap-cache.ts` | TTL + dedupe |
| `apps/web/src/features/pos/pos-performance-model.ts` | Round-trip cost model |
| `apps/web/src/features/pos/PosPage.tsx` | Cached bootstrap + search seq |
| `apps/web/src/features/pos/session/usePosShellStatus.ts` | Cached branches/devices; holds without expiry |
| `supabase/migrations/20260820000001_pos_performance_indexes.sql` | Indexes |
