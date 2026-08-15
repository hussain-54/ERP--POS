# PHASE 4 — POS / SALES MODULE STRUCTURE REPORT

**Date:** 2026-08-15  
**Scope:** Navigation and route grouping only. No POS terminal redesign. No Phase 4B/4C features.  
**Runtime:** Online-only. Sale posting, stock RPC, payments, returns, idempotency, Supabase, and the pricing resolver were not changed.

---

## Objective

Organize existing sales screens under one **POS / Sales** parent so cashiers and back-office staff see the same child list in ERP nav and in the POS terminal sidebar.

Target tree (implemented as navigation children):

```
POS / SALES
├── New Sale
├── Hold / Resume
├── Invoices
├── Sales Management
├── Returns
├── Exchange
├── Payments
├── Discounts
├── References
├── Salesmen
├── Installments
└── Customer / Checkout helpers
```

---

## Inspection — existing sales pages

| Concern | Page | Folder (Phase 3) | URL(s) before Phase 4 |
|---------|------|------------------|------------------------|
| POS terminal | `PosPage` | `features/pos/` | `/pos`, `/held-sales` (same page) |
| Held sales | Holds drawer on `PosPage` (`PosHoldsPanel`) | `features/pos/` | `/held-sales` did **not** open the drawer |
| Invoices | `InvoicesPage` | `features/pos/` | `/invoices` |
| Sales management | `SalesManagementPage` | `features/pos/` | `/sales-management` |
| Returns | `ReturnsPage` | `features/pos/` | `/returns` |
| Exchange | `ReturnsPage` (same wizard) | `features/pos/` | `/exchange` |
| Payments | `PaymentsPage` | `features/customers/` | `/payments` |
| Credit | `CreditInstallmentsPage` | `features/installments/` | `/credit` (Customers child) |
| Installments | `CreditInstallmentsPage` | `features/installments/` | `/installments` (module 22) |
| Salesman | `SalesmanPage` | `features/salesman/` | `/salesman` (module 20) |
| Discounts | Placeholder | — | `/discounts` (caps already in POS) |
| References | Section on `SalesmanPage` | `features/salesman/` | Same `/salesman` (no dedicated URL) |

Conceptual split (unchanged screens, clearer grouping):

| Layer | Screens | Chrome |
|-------|---------|--------|
| POS terminal | New Sale, Hold/Resume, Customer/Checkout helpers | POS navy shell |
| Invoice management | Invoices | ERP shell |
| Sales operations | Sales Management | ERP shell |
| Returns | Returns, Exchange | ERP shell |
| Payments | Payments | ERP shell |
| Related masters | Salesmen, References, Installments | ERP shell (also modules 20 and 22) |

---

## Mapping to POS / Sales children

| Child | Route | Component | Notes |
|-------|-------|-----------|--------|
| New Sale | `/pos` | `PosPage` | Canonical terminal |
| Hold / Resume | `/held-sales` | `PosPage entry="holds"` | Same terminal; **opens the holds drawer** |
| Invoices | `/invoices` | `InvoicesPage` | Unchanged |
| Sales Management | `/sales-management` | `SalesManagementPage` | Nav label was “Sales Register”; page heading was already “Sales Management” |
| Returns | `/returns` | `ReturnsPage` | Heading “Returns” when on this URL |
| Exchange | `/exchange` | `ReturnsPage` | Same wizard; heading “Exchange” |
| Payments | `/payments` | `PaymentsPage` | File stays in `features/customers/` (shared party payments) |
| Discounts | `/discounts` | Placeholder | Real discount caps remain on the POS terminal |
| References | `/pos/references` | `SalesmanPage` | **New alias.** `/salesman` kept (module 20) |
| Salesmen | `/pos/salesmen` | `SalesmanPage` | **New alias.** `/salesman` kept (module 20) |
| Installments | `/pos/installments` | `CreditInstallmentsPage` | **New alias.** `/installments` kept (module 22) |
| Customer / Checkout helpers | `/pos` | `PosPage` | Same URL as New Sale; helpers already live on the terminal (`PosCustomerPanel`, `PosPaymentPanel`) |

Naming alias (not a sidebar child): `/pos/new` → `PosPage` (same terminal as `/pos`).

---

## Duplicate routes (preserved, not deleted)

| Canonical | Duplicate | Shared page | Why both exist |
|-----------|-----------|-------------|----------------|
| `/pos` | `/held-sales` | `PosPage` | Hold/Resume entry vs New Sale |
| `/pos` | `/pos/new` | `PosPage` | Consistent `/pos/...` naming; original `/pos` kept |
| `/pos` | `/pos` (Checkout helpers) | `PosPage` | Helpers are on the terminal, not a second page |
| `/salesman` | `/pos/salesmen` | `SalesmanPage` | Module 20 + POS child |
| `/salesman` | `/pos/references` | `SalesmanPage` | References are a section of the same screen |
| `/installments` | `/credit` | `CreditInstallmentsPage` | Credit stays under **Customers**; installments stay under module 22 **and** POS |
| `/installments` | `/pos/installments` | `CreditInstallmentsPage` | POS child alias; module 22 kept |
| `/returns` | `/exchange` | `ReturnsPage` | Returns vs Exchange entry; same wizard |

`/credit` is **not** a POS child. It remains under Customers. Overlap with `/installments` is unchanged and documented.

---

## Route naming (existing URLs not broken)

- Original URLs still work: `/pos`, `/held-sales`, `/invoices`, `/sales-management`, `/returns`, `/exchange`, `/payments`, `/discounts`, `/salesman`, `/installments`, `/credit`.
- Added aliases only: `/pos/new`, `/pos/references`, `/pos/salesmen`, `/pos/installments`.
- POS terminal chrome is **exact-path only** (`/pos`, `/held-sales`, `/pos/new`). It no longer uses `pathname.startsWith("/pos/")`, so `/pos/salesmen` and `/pos/installments` keep the ERP sidebar.

---

## Hold / Resume entry point

`/held-sales` still renders `PosPage` (sale logic unchanged).

- Router: `<PosPage entry="holds" />`
- `PosPage` also treats `pathname === "/held-sales"` as a hold entry.
- Effect: `showHolds` starts `true` and is set `true` when the hold entry is active, so the existing holds drawer opens.
- Hold, resume, checkout, and posting functions were not edited.

---

## Visual consistency

- ERP sidebar POS children now match the target tree (same labels and order).
- POS terminal sidebar (`POSSidebar`) reads those children from `ERP_NAV_SECTIONS` id `05`, plus **ERP Home** and **Settings**.
- Sales operations pages (invoices, returns, payments, salesman, installments) use the ERP shell, not the navy terminal.

---

## What was not changed

- `SaleTransactionService`, stock RPC, payment posting, return/refund integrity, idempotency, Supabase, pricing resolver
- POS terminal layout, cart UI, payment panel, product search UI
- Phase 4B/4C (pricing engine UI, camera, PSP, loyalty, voice search)
- APIs and permission checks
- Duplicate routes (none deleted)
- Page files were not moved (salesman stays module 20; installments stay module 22; payments stay under customers)

---

## Changed files

| File | Change |
|------|--------|
| `apps/web/src/app/modules.ts` | Full POS child tree; aliases; `POS_TERMINAL_PATHS` / `isPosTerminalPath`; duplicate-route notes |
| `apps/web/src/app/router.tsx` | Hold entry prop; `/pos/new`, `/pos/salesmen`, `/pos/references`, `/pos/installments` |
| `apps/web/src/app/shell/AppShell.tsx` | Terminal chrome uses exact POS paths only |
| `apps/web/src/features/pos/PosPage.tsx` | Optional `entry="holds"`; opens holds drawer. No checkout/posting edits |
| `apps/web/src/features/pos/design-system/POSSidebar.tsx` | Nav sourced from POS module children |
| `apps/web/src/features/pos/ReturnsPage.tsx` | Heading from `/returns` vs `/exchange` only |
| `apps/web/src/app/smoke.test.tsx` | Asserts POS children and terminal-path helper |
| `PHASE-4-POS-MODULE-STRUCTURE-REPORT.md` | This report |

---

## Workflow validation (logic unchanged)

Structural work did not alter sale/return engines. Existing tests still cover:

| Flow | Evidence |
|------|----------|
| New sale / search / add / cart | `pos-main-screen.test.ts`, `pos-cart.engine.test.ts` |
| Cash payment / post sale | `pos-payment.test.ts`, domain sale posting tests |
| Invoice | Invoices page + existing POS receipt path (unchanged) |
| Hold / resume | `pos-hold.test.ts`; `/held-sales` now opens `PosHoldsPanel` |
| Return / refund / exchange | `pos-return.test.ts`; `/returns` and `/exchange` still `ReturnsPage` |

Live posting against Supabase was not re-run in this phase (no transaction code changed).

---

## Command validation

Ran from repo root after the structural edits. All **PASS**.

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (alias of typecheck) |
| `npm test` | PASS — 271 tests (contracts 12, domain 222, api 32, web 5) |
| `npm run build` | PASS (Vite chunk-size warning only; unchanged) |
