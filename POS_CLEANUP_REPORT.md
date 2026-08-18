# POS Cleanup Report — Phase 10

Performance cleanup only. Sale math, payment posting, hold/resume, returns, and other ERP modules were not changed.

## Canonical sources (one of each)

| Workflow | Canonical implementation | Aliases (kept, render canonical) |
|---|---|---|
| Shell | `AppShell` → `POSShell` for `isPosEnvironmentPath` | — |
| Cart calculation | `usePosSession` → `calculatePosCartTotals` → `toPosTransactionSummary` | Dead `pos-types` `lineTotal` / `calcTotals` / `pickPrice` removed |
| Payment | `PosPaymentPanel` + `preparePosPayments` + `posApi.postSale` | — |
| Customer selection | `PosCustomerPanel` + `posCustomerRepository` | Hub `/pos/customers` still routes to `PosCustomersPage` (entry to New Sale) |
| Product search | `PosProductPanel` + `posApi.searchProducts` (paged, limit 24/50) | Hub `/pos/products` does not load the catalog |
| Hold / Resume | `/held-sales` → `HeldSalesPage` | New Sale holds drawer (`PosHoldsPanel`) kept — working in-sale resume |
| Sales register | `/invoices` → `InvoicesPage` → `SalesWorkspace` | `/sales-management` → `SalesManagementPage` → `RegisterPage` (cash shift, not a second sales list) |

Other kept aliases:

- `/pos/new` → `PosPage` (same as `/pos`)
- `POSTopbar` → `POSHeader`
- design-system `PosSidebar` / `PosHeader` exports from `POSSidebar` / `POSHeader`
- `session/pos-repository.ts` → `posApi` (documented client boundary)

## Components removed

### `design-system/POSLayout.tsx`

- **Reason:** Unused nested terminal frame. New Sale already fills `POSShell`. Zero runtime imports after tracing routes and barrels.
- **Dependency impact:** Removed barrel exports from `design-system/index.ts`. Dropped from `POS_COMPONENT_OWNERS.shell`.
- **API impact:** None.
- **Performance impact:** One fewer wrapper / overflow region on New Sale (already unused at runtime; prevents accidental reintroduction of a double `.pos-terminal`).

### `design-system/POSToast.tsx`

- **Reason:** Unused re-export of ERP `useToast`. Pages already import `@electronic-erp/ui` `useToast`.
- **Dependency impact:** Removed `POSToastProvider` / `usePOSToast` / `POSToastTone` from the design-system barrel.
- **API impact:** None. Single toast provider remains the ERP one.
- **Performance impact:** No second toast stack to mount.

### `components/PosCartPanel.tsx`

- **Reason:** Unused alias of `PosCart`. Canonical cart UI is `PosCart.tsx` + `PosCartRow.tsx` + `PosTotals.tsx`.
- **Dependency impact:** Dropped from `POS_COMPONENT_OWNERS.newSale`. No route imported it.
- **API impact:** None. Cart math stays in `usePosSession` / domain `pos-cart`.
- **Performance impact:** Removes a second cart table implementation that would have duplicated line-total work if wired back in.

### `components/PosHeader.tsx`

- **Reason:** Unused alias of `POSTopbar` / `POSHeader`. Canonical header is `POSHeader`.
- **Dependency impact:** No remaining imports.
- **API impact:** None.
- **Performance impact:** None at runtime (already unused); one fewer header duplicate.

### `components/PosSidebar.tsx`

- **Reason:** Unused 2-line re-export. Canonical sidebar is `design-system/POSSidebar.tsx` (already exported as `PosSidebar` from the barrel).
- **Dependency impact:** No remaining imports after tracing.
- **API impact:** None.
- **Performance impact:** None at runtime (already unused).

## Other dead code removed (not page components)

| Item | Reason | Dependency impact | API impact | Performance impact |
|---|---|---|---|---|
| `pos-types` `lineTotal`, `taxForLineNet`, `pickPrice`, `calcTotals` | Duplicate cart math. Domain `pos-cart` is the only totals path. | Callers already used `@electronic-erp/domain`. | None. | Avoids a second JS copy of money math. |
| Unused `PosTaxRate` / `PosCustomerSummary` re-exports in `pos-types` | Nothing imported them. | Types still live on domain. | None. | None. |
| Duplicate `isPosTerminalPath` on `pos-ownership.ts` | Unused copy. Canonical checker is `modules.ts`. | `POSShell` and smoke tests already import from `modules`. | None. | None. |
| Duplicate `POS_ENVIRONMENT_PATHS` list in `modules.ts` | Now `new Set(POS_ENVIRONMENT_PATH_LIST)` from ownership. | `pos-ownership.test` still asserts the Set matches the array. | None. | Single path list to maintain. |
| Duplicate `./hardware` import in `PosPage` | Same module imported twice. | Merged to `cameraScanner, posHardware`. | None. | None. |

## API / fetch cleanup (behavior preserved)

| Change | Reason | API impact | Performance impact |
|---|---|---|---|
| New Sale `refreshHolds` no longer calls `posApi.expireHolds` | `listHeldSales` already runs `expireDueHolds`. Held Sales page already dropped the extra expire. | One fewer `POST /pos/holds/expire` per hold-drawer refresh. `expireHolds` client method kept for explicit use. | Faster hold drawer; less write traffic. |
| Hold missing-name lookup uses `partiesApi.getCustomer(id)` in parallel | Previously `listCustomers()` loaded the full party list to fill a few names. | `GET /parties/customers/:id` for missing ids only. Failures skip that id (same as previous catch-all). | Avoids downloading the entire customer directory on Hold / Resume. |
| `usePosShellStatus` branch/device effect depends on `branchIds.join("\0")` | Array identity was retriggering `listBranches` + `devices` on every parent render. | Same endpoints, fewer repeats. | Shell chrome does not refetch branches/devices unless membership actually changes. |

## Render / calculation cleanup

| Change | Reason | Performance impact |
|---|---|---|
| `cartToQuotationItems(cart)` wrapped in `useMemo` on New Sale | Ran on every `PosPage` render even when the cart was unchanged. | Quotation eligibility only recomputes when cart identity/contents change. |
| Product card `sellingPrice` wrapped in `useMemo` | `resolvePosUnitPrice` ran per card per parent render. | Price resolve skipped when the product row and price level are unchanged. |
| `usePosDialogFocus` Tab handler reads a live panel ref | TypeScript did not keep the outer null-narrowing inside the keydown closure. | Same focus trap; no extra work. |

Product search was already paged (`POS_PRODUCT_SEARCH_LIMIT` 24, max 50, visible page 12). Category browse still uses paged `catalogApi.listProducts` + `mergeProductSearches` (existing POS-priced workaround). That data source was not changed.

## Not deleted (traced and in use, or working aliases)

| Item | Why it stays |
|---|---|
| `PosHoldsPanel` (New Sale drawer) | Working in-sale hold/resume. Canonical workspace is still `/held-sales`. |
| `PosHubPages` (`/pos/customers`, `/pos/products`, `/pos/reports`) | Routed live entry points. Products hub does not load the catalog. |
| `SalesManagementPage.tsx` | Router alias of `RegisterPage`. |
| `POSTopbar.tsx` | Barrel alias of `POSHeader`. |
| `session/pos-repository.ts` | Documented `posApi` client boundary. |
| `session/pos-customer-runtime.ts` | Imported by `pos-customer-repository`. |
| Sidebar `transition-transform duration-200` | Functional mobile nav, not decorative. |
| `animate-spin` on buttons | Loading indicator. |
| `partiesApi.seedPaymentMethods()` on New Sale mount | Required for `payments.configure`; not swapped to `listPaymentMethods`. |
| Sales Dashboard / Payments `listCustomers()` | Filter dropdowns on those screens; changing them would change UX. |
| `PosPage` not split | Children are already `memo` + callback refs. Extracting files would not reduce re-renders. |
| Offline / SQLite / sync | Not introduced. |

## Duplicate page implementations

None remaining that render different UIs for the same job.

- `/pos` and `/pos/new` both render `PosPage`.
- `/sales-management` renders `RegisterPage` via alias.
- `/invoices` is the only sales register list (`SalesWorkspace`).

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Integrity scenario 7 pins `now` before the fixture `expiresAt` so resume is not calendar-dependent. Hold expiry rules were not changed.
