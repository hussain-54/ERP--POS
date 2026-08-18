# POS rebuild plan — Phase 0 audit

**Status:** audit only. No implementation until this plan is approved.  
**Scope:** Point of Sale (module 05) only. Do not change Dashboard, Products, Inventory, Customers, Reports, System, or the other ERP masters.  
**Runtime:** online Supabase via the existing API. No SQLite, Dexie, IndexedDB POS store, offline sync, or new backend architecture.  
**Visual target:** industrial retail terminal — white/light workspace, strong blue primary, **dark navy POS sidebar**, compact controls, product discovery left, customer/cart/payment right, persistent bottom shortcut/action bar, dedicated POS header. Operational, not dashboard-like.

No POS screenshot files were found in the repository. The visual and structural benchmark used here is the specification in the Phase 0 brief.

---

## A. Current POS architecture

POS is already a **separate environment** inside the ERP app:

1. `AppShell` detects `isPosEnvironmentPath(pathname)` and renders `POSShell` instead of the 39-module ERP sidebar (`apps/web/src/app/shell/AppShell.tsx`).
2. `POSShell` provides a shared header (`POSTopbar`) + 12-item nav (`POSNav`) + page content.
3. Canonical entry is `/pos` (New Sale). Alias `/pos/new` stays registered and renders the same `PosPage`.
4. Sale math, stock, payments, holds, returns, and RBAC live in `@electronic-erp/domain` and `PosRepository`. The UI must keep calling `posApi` / parties APIs — never write Supabase from React.

```
AppShell
  └─ POSShell (.pos-terminal)
       ├─ POSTopbar  (ERP Home, clock, branch, cashier, holds, shift, user)
       ├─ POSNav     (12 locked children — currently light sidebar)
       └─ Outlet
            ├─ /pos, /pos/new     → PosPage (dense terminal)
            ├─ /held-sales        → HeldSalesPage
            ├─ /invoices          → InvoicesPage → SalesWorkspace
            ├─ /sales-management  → RegisterPage (re-exported as SalesManagementPage)
            ├─ /returns           → ReturnsPage
            ├─ /exchange          → ExchangePage
            ├─ /payments          → PaymentsPage
            ├─ /discounts         → DiscountsPage
            ├─ /pos/references    → ReferencesPage
            ├─ /pos/salesmen      → SalesmenPage
            ├─ /pos/installments  → InstallmentsPage
            └─ /pos/settings      → SettingsPage
```

**New Sale internals**

`PosPage.tsx` (~2,280 lines, ~55 `useState`s) is the register god-component. It owns:

- `usePosSession` — in-memory cart, customer, tax, price level, discounts
- Product search / barcode / AI camera / favorites / recents / categories
- Customer create/update/history, salesman, reference, delivery flag
- Payment splits, cash tender, installment, credit remainder, quotation
- Hold drawer (`PosHoldsPanel`) **in addition to** `/held-sales`
- Shift strip (`POSSidebar` — cash-drawer summary, not module nav)
- Checkout via `posApi.postSale` with `PaymentAttemptGate` + idempotency key
- Hardware: scanner, drawer, thermal print
- Global F-key handler

Layout: `POSLayout` + `PosSaleLayout` (desktop two-zone grid; tablet similar; mobile product list + dock + drawers).

**Must keep:** online-only write path, locked 12-child IA, aliases, master modules 20 (`/salesman`) and 22 (`/installments`) outside the POS shell.

---

## B. Current routes

Locked headings and order (`POS_IA_TITLES` / ERP nav children):

| # | Title | Canonical | Aliases | Page | Permission (nav) |
|---|---|---|---|---|---|
| 1 | New Sale | `/pos` | `/pos/new` | `PosPage` | `pos.sell` |
| 2 | Hold / Resume | `/held-sales` | — | `HeldSalesPage` | `pos.hold` |
| 3 | Invoices | `/invoices` | — | `InvoicesPage` | `pos.view_invoices` |
| 4 | Register | `/sales-management` | — | `RegisterPage` | `pos.view_invoices` |
| 5 | Returns | `/returns` | — | `ReturnsPage` | `pos.return` |
| 6 | Exchange | `/exchange` | — | `ExchangePage` | `pos.return` |
| 7 | Payments | `/payments` | — | `PaymentsPage` | `payments.receive` |
| 8 | Discounts | `/discounts` | — | `DiscountsPage` | `pos.sell` |
| 9 | References | `/pos/references` | — | `ReferencesPage` | `hr.view` |
| 10 | Salesmen | `/pos/salesmen` | — | `SalesmenPage` | `hr.view` |
| 11 | Installments | `/pos/installments` | — | `InstallmentsPage` | `installments.manage` |
| 12 | Settings | `/pos/settings` | — | `SettingsPage` | `pos.configure` |

**Do not delete or redirect these.** `/pos/new` is a naming alias of New Sale. `/settings/pos` is System Administration “Coming Soon” and must stay out of the POS shell.

**Related masters (not POS environment):** `/salesman` (module 20), `/installments` and `/credit` (module 22 / customers). POS children are dedicated pages; do not merge them.

Environment path set: `POS_ENVIRONMENT_PATHS` in `pos-ownership.ts` (must stay in sync with `modules.ts`).

Dense terminal paths (`isPosTerminalPath`): `/pos`, `/pos/new`, `/held-sales` — content is `overflow-hidden` without the padded sub-page chrome.

---

## C. Current components

### Shell / design system (`features/pos/design-system/`)

Reusable primitives: `POSShell`, `POSNav`, `POSTopbar`, `POSLayout`, `POSSidebar` (cash-drawer strip), `POSPageHeader`, `POSSection`, `POSCard`, `POSButton`, `POSIconButton`, `POSInput`, `POSSearch`, `POSSelect`, `POSModal`, `POSDrawer`, `POSBadge`, `POSStatCard`, `POSTabs`, `POSTable*`, `POSEmptyState`, `POSLoadingState`, `POSConfirmDialog`, `POSStepper`, `POSActionBar`, `POSToast`, `useEscapeToClose`. Tokens: `pos-tokens.css` (inherits `--erp-brand` `#1877f2`).

### New Sale

- `PosPage.tsx` — orchestration
- `PosSaleLayout.tsx` — two-zone / mobile dock
- `PosProductPanel`, `PosCartPanel`, `PosCustomerPanel`, `PosPaymentPanel`
- `PosHoldsPanel` — hold drawer on the terminal
- `PosApprovalDialog`, `ReceiptPreview`
- Session: `usePosSession.ts`, `usePosLayoutMode.ts`, `usePosShellStatus.ts`
- Client repos: `pos-api.ts`, `session/pos-repository.ts`, `session/pos-customer-repository.ts`

### Sub-pages (each uses `POSPageHeader` + `POSCard`/`POSTable`/`POSStatCard`)

| Screen | Main files |
|---|---|
| Hold / Resume | `HeldSalesPage.tsx`, `held-sales.ts` |
| Invoices | `InvoicesPage.tsx` → `SalesWorkspace.tsx`, `sales-workspace.ts` |
| Register | `RegisterPage.tsx`, `register-shift.ts`; `SalesManagementPage.tsx` is a re-export |
| Returns | `ReturnsPage.tsx`, `returns-workspace.ts` |
| Exchange | `ExchangePage.tsx`, `returns-workspace.ts` |
| Payments | `PaymentsPage.tsx`, `payment-center.ts` |
| Discounts | `DiscountsPage.tsx`, `discounts-workspace.ts` |
| References | `ReferencesPage.tsx`, `references-workspace.ts` |
| Salesmen | `SalesmenPage.tsx`, `salesman-workspace.ts` |
| Installments | `InstallmentsPage.tsx`, `installments-workspace.ts` |
| Settings | `SettingsPage.tsx`, `pos-settings.ts` (read-only catalog) |

### Keyboard shortcuts (implemented on New Sale)

Defined in `pos-types.ts` `POS_SHORTCUTS`, handled in `PosPage.handlePosShortcut`:

| Key | Label (legend) | Actual behavior |
|---|---|---|
| Alt+F1 | New sale | Cancel/clear flow + focus search (not a dedicated “new ticket” if cart empty) |
| F2 | Hold / resume | Hold current cart, or open holds drawer |
| Alt+F3 | Customers | Walk-in off, focus customer |
| F4 | Price override | Permission-gated |
| Alt+F5 | Discount | Focus invoice discount |
| Alt+F6 | Recalculate | Recalc cart |
| F7 | Clear cart | Confirm clear |
| F8 | Cancel sale | Confirm cancel |
| Enter | Add scanned / highlighted | In product search (`PosProductPanel`) |
| Escape | Close dialog / clear search | Receipt + search |
| + / − | Last line qty | When not typing |

Shortcuts are **not** registered on Hold/Invoices/Register/etc. The bottom bar on New Sale is a **legend**, plus extra Hold/Resume buttons — not a true F-key command strip.

---

## D. Current APIs

### POS router — `apps/api/src/routes/pos.ts`

| Method | Path | Role |
|---|---|---|
| GET | `/api/v1/pos/products/search` | Catalog search |
| POST | `/api/v1/pos/sales` | Post sale (`pos.sell`; discount/credit/installment gates) |
| GET | `/api/v1/pos/sales` | Sale list |
| GET | `/api/v1/pos/sales/management` | Invoice register + filters |
| GET | `/api/v1/pos/sales/management/export` | CSV |
| GET | `/api/v1/pos/sales/:id/invoice` | Invoice preview |
| POST/GET | `/api/v1/pos/holds*` | Hold, list, expire, resume, edit, duplicate, transfer, cancel, discard |
| GET/POST | `/api/v1/pos/returns*` | Search, list, report, returnable sale, post return |
| GET/POST | `/api/v1/pos/shifts*` | Current, open, close |

Web client: `apps/web/src/features/pos/pos-api.ts`.

### Adjacent APIs the POS already uses (do not replace)

- `POST/GET /api/v1/parties/payments`, payment-methods — Payments page + checkout splits
- `GET/POST /api/v1/parties/installments*` — POS Installments
- `GET/POST /api/v1/admin/approvals` — Discounts inbox
- `GET/POST /api/v1/references` — References
- Enterprise employees/commissions — Salesmen
- Catalog taxonomy, tax rates, hardware statuses — Settings / New Sale
- Quotations create from cart — `pos-quotation.ts`
- Purchases delivery note after sale (optional flag)

Repository: `packages/db/src/repositories/pos-repository.ts` (`postSale` → `SaleTransactionService`).

---

## E. Current business logic

**Do not rewrite these unless a POS UI bug forces a call-site change.**

| Concern | Domain / service |
|---|---|
| Sale finalization, stock UUID, idempotency, draft→posted, compensation | `sale-transaction.ts` |
| Cart qty / money | `pos-cart.ts` |
| Unit price / qty breaks | `pos-pricing.ts` |
| Line/invoice discount | `pos-discount.ts`, `discount-policy.ts` |
| Tax | `pos-tax.ts` |
| Tender, split, credit remainder, installment flag, `PaymentAttemptGate` | `pos-payment.ts` |
| Hold snapshot (no stock) | `pos-hold.ts` |
| Return qty cap, restock, refund | `pos-return.ts` |
| Exchange = return + replacement sale | `pos-exchange.ts` |
| Commission accrual | `pos-commission.ts` |
| Customer credit profile | `pos-customer.ts`, `credit.ts` |
| RBAC helpers | `pos-security.ts` |
| Totals | `sale-totals.ts` |

Integrity constraints that the rebuild must preserve: catalog re-price on post (client unit price not trusted), discount `approverRole` overwritten from authz, insufficient stock reject, same idempotency key does not double-stock, hold does not move inventory, exchange two-step (return then sale).

Known product gaps (do **not** “fix” in a visual rebuild unless called out later): authorized price override stripped at post; exchange not one DB transaction; refresh mints a new checkout key; posted void / cash-in-out / payment reversal do not exist.

---

## F. Reusable components

Keep and restyle; do not replace with a new design-system library.

**Must reuse**

- `POSShell` / `POSTopbar` / `POSNav` structure (change look, not IA)
- All `design-system` primitives (button, table, modal, drawer, tabs, badge, search, select)
- `usePosSession` + domain cart/payment/pricing
- `posApi` and existing route handlers
- Workspace helpers (`sales-workspace.ts`, `held-sales.ts`, `returns-workspace.ts`, `payment-center.ts`, `register-shift.ts`, `discounts-workspace.ts`, etc.)
- `PosSaleLayout` breakpoint contract (`pos-layout.ts`)
- `PosProductPanel` search/Enter/favorites/categories behavior (visual rebuild of the tiles)
- `PosCartPanel` line operations (qty, unit, discount, override, remove)
- `PosPaymentPanel` tender math (restyle into a dock)
- `PosCustomerPanel` walk-in / credit / salesman / reference
- Hardware + quotation + receipt preview
- RBAC flags in `pos-security.ts`

**Reuse with light composition**

- Sub-pages already share `POSPageHeader` + `POSTable` + `POSStatCard`. Tighten density and chrome; keep data loading and mutation functions.

---

## G. Components requiring rebuild

Visual/structural rebuild only — same props and API calls.

| Piece | Why |
|---|---|
| `pos-tokens.css` + `POSNav` | Sidebar is **light ERP chrome**, not dark navy. `--pos-navy` currently aliases `--erp-ink` on a white nav. |
| `POSTopbar` | Functional but generic; needs a dedicated terminal header (register identity, ticket, shift, clock) without looking like ERP. |
| `PosPage` chrome | Warehouse / Easy / EN chips and badges eat the product zone. Too much empty space; not barcode-first. |
| Product tiles | Large “No photo” / initial cards. Weak industrial discovery; should be dense list + optional compact tile, SKU/stock/price first. |
| `PosCartPanel` | Table inside a titled card — feels like an ERP grid, not a register tape (line no, SKU, qty stepper, line total, running grand always visible). |
| `PosPaymentPanel` | Stacked cards and long installment forms. Need a compact tender dock: method, tendered, change, due, Pay. Advanced options collapsed. |
| `POSActionBar` | Shortcut **legend** plus extra ghost buttons. Target: persistent operational bar (Hold, Pay, Qty, Customer, Discount) with keys. |
| `POSLayout` nested in `POSShell` | Double `.pos-terminal` wrapper. New Sale should fill the shell content pane, not wrap another terminal. |
| `POSCard` / `POSStatCard` on sub-pages | Same generic card language as ERP dashboards. Sub-pages need denser toolbars + tables, fewer padded metric islands. |
| `POSSidebar` name vs `POSNav` | Cash-drawer strip is named “sidebar”. Confusing; rebuild as a register status strip. |
| `PosHoldsPanel` drawer | Duplicates Hold / Resume. Keep F2 hold + resume-into-cart; do not ship two hold UIs that look like two products. |

`PosPage.tsx` itself should be **split by layout regions** during rebuild (product / cart / pay / session remain), not rewritten as a new state library.

---

## H. Performance problems

1. **`PosPage` re-renders broadly.** ~55 `useState`s in one component. Panels are `memo`’d and search is flushed at 180ms (`POS_SEARCH_FLUSH_MS`), but mode/locale/warehouse/last-invoice live above the product panel and still churn the tree.
2. **Duplicate network on every POS route.** `usePosShellStatus` lists holds + current shift for the header. New Sale **also** loads shift and (when the drawer opens) holds. Register loads shift again.
3. **Category browse** still resolves via up to 8 parallel `searchProducts` by name (`mergeProductSearches`). No `categoryId` product index on the POS search API.
4. **Product grid is not virtualized.** Card grid (`grid-cols-2…5`) with images/placeholders will lag on large result sets.
5. **`POSClock` ticks every 1s** on every POS page (header). Cheap, but it re-renders the whole topbar.
6. **Held Sales / Invoices** load management-sized lists (sales management up to thousands for summary). Fine for register counts; keep filters server-side; do not add extra `listSales` calls.
7. **Cart is not persisted.** Refresh loses the ticket (known). Rebuild must not add IndexedDB/SQLite; optional `sessionStorage` for the **open ticket + idempotency key** is a later integrity/UX choice, not Phase 0.
8. **Nested overflow wrappers** (`POSShell` + `POSLayout` + `PosSaleLayout`) make scroll regions hard to fill, which reads as empty space and can cause extra layout passes.

Do **not** introduce React Query / new global stores in this rebuild unless a measured lag remains after layout split. Existing debounce and memo work stays.

---

## I. UX problems (vs industrial terminal)

1. **Looks like ERP.** Light sidebar, padded cards, page titles + subtitles, stat cards — dashboard language.
2. **Sidebar is not dark navy.** Spec requires a dedicated POS nav column.
3. **Product discovery is weak.** Placeholder photos, sparse tiles, search not visually dominant, warehouse/mode/locale competing with the scan box.
4. **Cart is not a register.** No always-on running total in a tape; line editing is spread out; clear/manual are card actions.
5. **Payment is not operational.** Pay is buried in a card with notes, installment, advance, quotation. Change/due not docked to the bottom of the right column.
6. **Two hold experiences.** F2 drawer vs `/held-sales` workspace — cashiers will not know which is canonical.
7. **Action bar is documentation**, not commands. F-keys work on New Sale only; other POS pages have no terminal bar.
8. **Sub-pages are inconsistent.** Shared primitives, but each page invents its own header/stats/filter density. Register nav permission (`pos.view_invoices`) does not match mutation permission (`pos.shift`).
9. **Shortcut legend vs behavior.** Alt+F1 labeled “New sale” but runs cancel + focus search.
10. **Mobile dock is closer to the target** (Cart / Customer / Pay) than desktop — desktop should feel at least that operational.
11. **ERP Home + user menu** in the POS header is correct (escape hatch) but currently the strongest visual element besides the clock.
12. **Empty space** from `p-4 md:p-5` on non-terminal POS pages and large card padding.

---

## J. Exact target architecture

Keep the **same** routes, APIs, domain, and shell split. Change **layout, tokens, and density**.

```
POSShell  (full viewport, no ERP sidebar)
  POSTopbar     white/light, blue accent bar, clock, branch, cashier, shift, holds, ERP Home
  POSNav        DARK NAVY column, 12 items, compact, active = blue pill/bar
  content
    New Sale (desktop ≥1024)
      ┌─────────────────────────────┬──────────────────────────┐
      │ Product discovery           │ Customer strip           │
      │  - large scan/search        │ Cart tape (dense table)  │
      │  - recent/fav/cat/results   │ Totals (tax/disc/grand)  │
      │  - compact SKU rows/tiles   │ Payment dock (tender)    │
      └─────────────────────────────┴──────────────────────────┘
      POSActionBar  Hold · Customer · Discount · Qty · Pay · Cancel   + key hints
    Other POS pages
      compact page toolbar (not dashboard hero)
      dense table / stepper workspace
      same navy nav + topbar
```

**Rules for the rebuild**

- White/light workspace; primary `#1877f2` (already `--erp-brand`).
- Navy sidebar only inside `.pos-terminal` — do not restyle the 39-module ERP nav.
- Desktop primary. Tablet two-zone when width ≥ 1024 (`posShowsTwoZoneTerminal`). Mobile dock + drawers stay.
- One POS header. Do not nest `POSLayout` as a second terminal.
- Hold: F2 parks/resumes into New Sale; `/held-sales` remains the management workspace.
- Pay stays `posApi.postSale`. Payments page stays `parties` receive. No second writer.
- No new backend, no offline DB, no deleted aliases.

**Token direction (implementation, after approval)**

- `--pos-nav-bg` dark navy; `--pos-nav-ink` light; `--pos-nav-active` blue.
- `--pos-workspace` white; tighter `--pos-control-height`; smaller card radius already 6px — keep.
- Action bar sticky in the shell content footer on New Sale; optional compact bar on other POS pages (page title + primary action only).

---

## K. Phase-by-phase implementation plan

Each phase is UI/integration only. After each phase: typecheck, lint, POS-related tests. Do not touch `SaleTransactionService` stock/payment writers, schemas, or other ERP modules.

### Phase 1 — POS chrome (tokens, nav, header)

- Dark navy `POSNav`; keep 12 titles/order/paths.
- Restyle `POSTopbar` as terminal header (blue bottom border stays).
- Remove nested `POSLayout` double-wrap; New Sale fills shell content.
- Rename/repurpose cash-drawer `POSSidebar` as a status strip, not a second nav.
- Do not change routes or `POS_IA_TITLES`.

### Phase 2 — New Sale workspace density

- Left: scan-first search, compact results (SKU, name, stock, price). Keep Enter / ↑↓ / barcode / AI / favorites / categories.
- Right: customer strip → cart tape → payment dock.
- Persistent operational `POSActionBar` wired to existing handlers (Hold, Pay, Customer, Discount, Clear, Cancel).
- Align shortcut labels with behavior (or keep behavior and fix labels).
- Collapse Easy/Advanced, locale, warehouse into header/settings overflow — not a row above search.

### Phase 3 — Cart + payment as register

- Cart: dense table, sticky grand, qty +/−, permission-gated price/discount.
- Payment: method, amount, cash received, change, due, Pay. Installment/credit/quotation behind advanced disclosure (same flags/API).
- Keep `preparePosPayments`, idempotency, `PaymentAttemptGate`, online gate.

### Phase 4 — Hold / Resume integration

- F2 still holds/resumes into New Sale.
- `/held-sales` remains the full table (tabs, transfer, discard).
- Restyle both to the same terminal language; do not delete the drawer until resume-from-page is proven.
- No change to hold APIs or “hold does not reduce stock”.

### Phase 5 — Sub-pages to one POS language

Order: Invoices → Register → Returns → Exchange → Payments → Discounts → References → Salesmen → Installments → Settings.

- Same header density, table, filters, empty states.
- Keep each page’s backend and locked headings/columns from existing page tests.
- Fix Register nav vs `pos.shift` only if it is a permission-display bug (do not invent cash-in/out).

### Phase 6 — Performance pass (measured, no new stack)

- Dedupe shell vs page shift/hold fetches (share `usePosShellStatus` or lift once).
- Virtualize long product result lists if still laggy.
- Keep 180ms search flush; do not search on every parent keystroke.
- Leave category API as-is unless lag remains; then a **POS search query param** is a later, explicit API change — not assumed here.

### Phase 7 — Regression lock

- Existing POS page tests (headings, columns, nav order) must stay green.
- `pos-new-sale`, `pos-shell`, `pos-ownership`, domain integrity tests.
- Manual desktop pass: cash sale, customer, discount, hold/resume, pay, return — against live API, no production junk data.

---

## Constraints (non-negotiable)

- Do not modify the other 39 ERP modules.
- Do not delete POS routes, aliases, or APIs.
- Do not introduce SQLite / offline / sync.
- Do not change sale/stock/payment/tax/discount math unless a UI integration bug is proven.
- Do not claim the POS is production-ready from this visual rebuild alone (exchange atomicity, refresh idempotency, live E2E remain separate).

---

## Approval gate

This document is the Phase 0 deliverable. **Stop here.** No chrome, token, or layout code until the plan is approved (or explicitly amended).
