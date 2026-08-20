# POS / Sales Architecture Audit (Phase 0)

**Date:** 2026-08-20  
**Scope:** Module **02. POS / Sales** — full domain audit only. **No application code was modified.**  
**Method:** Trace routes, ownership maps, domain packages, DB repositories/migrations, API routes, and existing POS docs. Live authenticated E2E was not re-run in this pass.

**Canonical target IA (product owner — exact names & order):**

1. POS Terminal · 2. Quick Sale · 3. Product Search · 4. Customer Selection · 5. Invoices · 6. Payments · 7. Credit / Udhaar · 8. Barcode Scanner · 9. Salesman / Reference · 10. Hold Sale · 11. Resume Sale · 12. Quotations · 13. Sales Orders · 14. Split Payment · 15. Installments · 16. Discounts · 17. Coupons · 18. Returns · 19. Exchange · 20. Refund · 21. Delivery Order · 22. Cash Drawer · 23. POS Shift · 24. Cash In / Cash Out · 25. Day Closing · 26. Offline POS

**Severity:** CRITICAL · HIGH · MEDIUM · LOW

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Is POS a separate app? | **No** — ERP `AppShell` + `POSShell` chrome on POS paths |
| Are the 26 canonical children registered today? | **No** — module 02 has **12** differently named children |
| Is there one money/math engine? | **Mostly yes** — `packages/domain` (`sale-totals` → cart/payment/posting) |
| Is checkout production-safe on happy path? | **Strong** (idempotent, fail-closed stock) with **HIGH** residual failure modes |
| Are “7/26 live” accurate? | **Understated for capability, overstated for IA** — more than 7 capabilities exist, but many are **bundled**, **aliased under other ERP parents**, or **not production-ready** |
| Fake “Coming soon” under module 02? | **No** `soon()` children inside module 02; gaps are missing / elsewhere / blocked |
| Ship as mature retail POS? | **Not yet** — IA mismatch + HIGH integrity/UX risks remain |

**STOP after this audit.** Do not begin Phase 1 until this document is explicitly approved.

---

## 1. Current POS architecture

```
ERP AppShell (auth, GlobalSidebar, branch)
  └── ModuleWorkspace
        ├── Generic ERP pages (non-POS paths)
        └── POSShell (when isPosEnvironmentPath)
              ├── POSHeader (branch / cashier / shift / held badge)
              ├── POSTerminalNav (7 operational links)
              ├── Route page (PosPage | HeldSalesPage | Returns | …)
              └── POSShortcutBar (F1–F8)
```

**Layers (actual):**

| Layer | Location |
|-------|----------|
| UI | `apps/web/src/features/pos/**` |
| Session state | `usePosSession`, `PosPage` local state |
| Domain math / validation | `packages/domain/src/pos-*.ts`, `sale-totals.ts`, `sale-transaction.ts` |
| HTTP | `apps/web/.../pos-api.ts` → `apps/api/src/routes/pos.ts` |
| Persistence | `packages/db/.../pos-repository.ts` (+ inventory, parties, hardware) |
| Database | Supabase/Postgres via repository clients |

**Principle already established:** UI must not invent paid/remaining/totals; domain + server re-validate on post.

---

## 2. Current route map

### Module 02 children today (`apps/web/src/app/modules.ts`)

| # | Title (today) | Path | Permission |
|---|---------------|------|------------|
| 1 | New Sale | `/pos` | `pos.sell` |
| 2 | Hold / Resume | `/held-sales` | `pos.hold` |
| 3 | Invoices | `/invoices` | `pos.view_invoices` |
| 4 | Register | `/sales-management` | `pos.view_invoices` |
| 5 | Returns | `/returns` | `pos.return` |
| 6 | Exchange | `/exchange` | `pos.return` |
| 7 | Payments | `/payments` | `payments.receive` |
| 8 | Discounts | `/discounts` | `pos.sell` |
| 9 | References | `/pos/references` | `hr.view` |
| 10 | Salesmen | `/pos/salesmen` | `hr.view` |
| 11 | Installments | `/pos/installments` | `installments.manage` |
| 12 | Settings | `/pos/settings` | `pos.configure` |

### Extra / related routes (not all module-02 children)

| Path | Page | Note |
|------|------|------|
| `/pos/new` | `PosPage` | Alias of `/pos` |
| `/pos/customers`, `/pos/products`, `/pos/reports` | `PosHubPages` | Stub gateways |
| `/quotations`, `/orders` | `QuotationsPage` | Module 16 B2B |
| `/credit`, `/installments` | `CreditInstallmentsPage` | Module 08 / 22 masters |
| `/deliveries` | `DeliveriesPage` | Module 07 |
| `/devices`, `/devices/drawer` | `DevicesPage` | Hardware drawer |
| `/offline` | Placeholder | Module 27 — not implemented |
| `/barcodes` | Catalog barcodes | Module 03 |

### Terminal nav (`POS_TERMINAL_NAV`)

POS · Hold / Resume · Customers · Products · Price & Discount · Reports · Settings — **different** from the 12 ERP children and from the 26 canonical names.

---

## 3. Current component map (high level)

| Area | Primary files |
|------|----------------|
| Terminal shell | `POSShell`, `POSHeader`, `POSTerminalNav`, `POSShortcutBar` |
| New Sale | `PosPage`, `PosSaleLayout`, `PosProductPanel`, `PosCustomerPanel`, `PosCart`, `PosPaymentPanel`, `PosTotals` |
| Session | `session/usePosSession.ts`, `usePosShellStatus.ts` |
| Hold UI | `HeldSalesPage`, `PosHoldsPanel`, `HoldSaleButton` |
| Registers | `InvoicesPage`/`SalesWorkspace`, `PaymentsPage`, `DiscountsPage`, `RegisterPage`, `ReturnsPage`, `ExchangePage` |
| Roster | `SalesmenPage`, `ReferencesPage`, `InstallmentsPage`, `SettingsPage` |
| UX helpers | `pos-ux.ts`, `pos-user-messages.ts`, `pos-payment-ux.ts`, `pos-bootstrap-cache.ts` |
| Design system | `features/pos/design-system/*` |

---

## 4. Current database map (POS-critical)

| Table / object | Role |
|----------------|------|
| `sales`, `sale_items`, `sale_discount_audits` | Posted/draft/held/void invoices |
| `held_sales` | Cart snapshots + lifecycle status |
| `sale_returns`, `sale_return_items` | Returns / exchange return leg |
| `payments` (+ splits) | Tenders / refunds / on-account |
| `customers`, ledgers, `installment_*` | Credit / plans |
| `stock_movements`, `stock_balances` | Inventory; RPC `apply_stock_movement_atomic` |
| `pos_cash_shifts` | Open/close shift totals |
| `quotations`, `quotation_items`, `sales_orders`, `sales_order_items` | Quotes / SO (not all wired from POS UI) |
| `delivery_*` | Delivery notes |
| `sale_references` | Salesman references |
| Legacy `sales.offline_transaction_id` / sync columns | Historical; offline queue removed |

Writers: `packages/db` repositories — web does not talk to Supabase directly.

---

## 5. Current sales transaction flow

```
PosPage / Quick-ish Easy mode
  → usePosSession cart mutations (domain pos-cart)
  → calculatePosCartTotals → calculateSaleTotals
  → preparePosPayments + validatePosCheckout (+ credit checks)
  → PaymentAttemptGate + payingRef
  → POST /api/v1/pos/sales
  → SaleTransactionService.postSale
       draft sale → items → stock out → AR → payments → posted
       post-commit: journal, commission, warranty, installment, analytics, audit
  → optional client delivery note (best-effort)
```

**Source of truth for money:** `packages/domain/src/sale-totals.ts` (documented in `POS-ARCHITECTURE-CONSOLIDATION.md`, `POS-CHECKOUT-AUDIT.md`).

---

## 6. Current payment flow

| Method | Behavior |
|--------|----------|
| Cash | Real tender; change not posted as payment |
| Bank | Real tender → bank settlement classification |
| Card / JazzCash / Easypaisa / SadaPay / Other / online | **Record-only receipts** (no PSP) |
| Credit / Udhaar | Informational tender; AR via ledger; remainder rules |
| Installment | Down payment tenders + **post-commit** plan create |
| Split | Multiple payment lines via `preparePosPayments` on New Sale |

Payments center (`/payments`) lists/receives on-account; does not replace sale posting.

---

## 7. Current inventory flow

- Pre-check stock before draft when warehouse-scoped.
- Per-line stock out via `InventoryRepository.postMovement` → `apply_stock_movement_atomic`.
- Stable UUID `operation_id` per line (`saleStockMovementOperationId`).
- Mid-failure: compensate reverse stock/AR/payments + void draft (best-effort).
- Hold **does not** move stock.

---

## 8. Current customer / ledger flow

- Walk-in default; existing/new customer on terminal panel.
- Credit limit / outstanding / blocked evaluated at checkout (`evaluatePosCustomerCredit`).
- Sale posts AR debit; payments post credits.
- Installment plans via parties repository after sale post.

---

## 9. Current invoice flow

- Invoice number / totals stored on `sales` at post.
- Register: `/invoices` (`InvoicesPage` / sales-management search).
- Reprint/PDF: thermal/print paths where hardware configured; do not assume full PDF suite is complete for every format.

---

## 10. Current discount flow

- Line + invoice; % or fixed.
- Caps by `pos.discount_*` roles via `discount-policy` / approvals dialog.
- Audited on sale (`sale_discount_audits`).
- **No coupons.**

---

## 11. Current hold / resume flow

- Hold: snapshot → `held_sales` + `sales.status=held`.
- List/resume/edit/transfer/cancel/discard on `/held-sales`.
- Resume CAS `held` → `resumed`; cart replace (no append); then normal checkout.
- Ownership: holder or `pos.resume_any`.

---

## 12. Current returns / refund flow

- Returns UI: `/returns` → `prepareSaleReturn` → `postReturn` → stock in/dmg + refund settlement plan.
- Exchange UI: `/exchange` → return leg + replacement `postSale`.
- Refund is a **disposition of return/exchange**, not a standalone route.

---

## 13. Current shift / cash flow

- Open/close shift: `pos_cash_shifts` + Register page `/sales-management`.
- Hardware cash drawer open: permission `cash_drawer.open` (devices), not a ledger module.
- **Cash In / Cash Out explicitly unavailable** (`POS_UNAVAILABLE_SENSITIVE_ACTIONS`).
- **No Day Closing** module — closest is shift close + cash count.

---

## 14. Current offline architecture

- **Online-only.** Offline sale queue removed (see historical removal docs / settings copy).
- `localStorage`: favorites/recent/terminal id only — **not** a posting queue.
- Offline event: warn/block critical writes (`online-required.ts`).
- Module `/offline` is a registry **placeholder**, not POS Offline POS.

---

## 15. Existing duplicated logic

| Topic | Assessment |
|-------|------------|
| Totals / tax / discount | **Consolidated** in domain; client preview + server recompute |
| Payment prep | Shared `preparePosPayments` |
| Exchange cart | **Intentional local cart** so New Sale session is not clobbered |
| Installments UI | POS page + Customers/credit master — related, different screens |
| Salesman | `/pos/salesmen` vs HR `/salesman` |
| Quotations | Create from POS; manage under B2B `/quotations` |

**Risk:** IA fragmentation makes operators think features are “missing” when they live elsewhere.

---

## 16. Broken logic (traced)

| Sev | Issue |
|-----|--------|
| HIGH | Hardware scanner falls back to **first fuzzy hit** (`PosPage` scanner path) — wrong SKU risk |
| HIGH | New Sale `editHold` can overwrite hold with **stale React cart** |
| HIGH | Compensation / void best-effort → stuck drafts or stock-out without posted sale |
| HIGH | Hold insert not one DB transaction → orphan `sales` held row |
| HIGH | Installment plan post-commit can fail after posted sale |
| MEDIUM | Clear cart ≠ cancel sale (payment/discount residue) |
| MEDIUM | Multi-unit options not populated from POS search |
| MEDIUM | Shift cash totals not tender-pure; `expense_total` unused without cash in/out |

---

## 17. Missing logic (vs 26-module vision)

| Canonical module | Gap |
|------------------|-----|
| Quick Sale | No dedicated route; only Easy/Advanced mode on terminal |
| Product Search / Customer Selection | No dedicated screens; panel + hub stubs |
| Coupons | **Absent** (checklist: “coupon later”) |
| Cash In / Cash Out | **Blocked** by design flags |
| Day Closing | **No** day-close workflow beyond shift close |
| Offline POS | **Not implemented** (online-only) |
| Refund (standalone) | Only as return disposition |
| Sales Orders from POS | Tables/lifecycle exist; POS does not own SO UI |
| Dedicated Barcode Scanner module | Capability bundled; no management screen |
| Split Payment module | Capability on terminal; no dedicated child |

---

## 18. Performance problems

| Sev | Finding |
|-----|---------|
| MEDIUM (mitigated) | Product search was N+1 (~178 RTs); batched to ≤~18 — verify migration applied in all envs |
| MEDIUM | Main web bundle ~2 MB (ERP+POS shared) |
| MEDIUM | Favorites/recent localStorage can show **stale stock** |
| LOW | Large `PosPage` monolith — render cost |
| LOW | No React Query on POS — custom TTL cache |

Evidence: `docs/POS-PERFORMANCE-AUDIT.md`, `pos-performance-model.ts`.

---

## 19. UX problems

| Sev | Finding |
|-----|---------|
| HIGH | Canonical 26 names ≠ registered 12 titles — navigation redesign required before claiming maturity |
| HIGH | Walk-in default disables customer search until F3 / walk-in off |
| HIGH | Many IA screens not on `POSTerminalNav` (discoverability) |
| MEDIUM | Hub pages are stubs (“Open POS”), not real Product/Customer search desks |
| MEDIUM | Create product leaves POS for Product Management |
| LOW | Dense industrial chrome is good; still not pixel-matched to owner reference |

Cashier copy hardening exists (`pos-user-messages.ts`) — improves understandability vs raw DB errors.

---

## 20. Data-integrity risks

| Sev | Risk |
|-----|------|
| CRITICAL | None confirmed for happy-path “posted sale without stock” / double stock on same idempotency key |
| HIGH | Best-effort compensate/void; stuck draft keys |
| HIGH | Post-commit installment orphan |
| HIGH | Non-atomic hold write |
| HIGH | Scanner wrong-product add |
| MEDIUM | Delivery note client best-effort after sale |
| MEDIUM | Whole sale not one Postgres TX (by design + compensate) |
| MEDIUM | Record-only wallet payments (ops honesty) |

---

## 21. Security / RBAC risks

| Sev | Finding |
|-----|---------|
| MEDIUM | UI hides unavailable cash in/out — good; keep backend blocked |
| MEDIUM | Discount/price override need API enforcement everywhere (mostly present via policy) |
| LOW | Tab-local `PaymentAttemptGate` — server idempotency is authority |
| — | Core permissions exist: `pos.sell`, `pos.hold`, `pos.resume_any`, `pos.return`, `pos.shift`, `pos.configure`, discount ladder, `credit.approve`, `installments.manage`, `cash_drawer.open` |

---

## 22. Recommended architecture

### A. Information architecture (decision required)

**Option 1 — Adopt the 26 names literally**  
Rename/reorder module 02 children to the exact canonical list; map each to:

- a dedicated page, **or**
- a deep-link into terminal focus mode (e.g. Product Search → `/pos?focus=search`) **without** duplicating engines.

**Option 2 — Keep 12 operational children** and treat the 26 as **capability checklist** (product docs) — **rejected by this brief** (“DO NOT rename… MUST remain…”).

→ **Phase 1 must include IA remapping** to the 26 names before feature build-out.

### B. Transaction architecture (keep / harden)

```
POS Session (UI state)
  → Domain cart / pricing / tax / discount / payment prep
  → SaleTransactionService (idempotent draft→posted)
  → Inventory RPC + payments + AR
  → Post-commit side effects (explicit success/failure UX for installment)
```

Rules:

- One totals engine (`calculateSaleTotals`).
- One posting path (`SaleTransactionService`).
- One hold snapshot model (`pos-hold`).
- No second offline queue until real sync design approved.
- No fake coupon/cash-in buttons.

### C. Module implementation pattern

| Pattern | Use for |
|---------|---------|
| Terminal-embedded capability | Barcode, split pay, customer select, product search, quick sale mode |
| Dedicated management page | Invoices, Payments, Holds list, Returns, Exchange, Installments register, Discounts policy, Shift, Day Closing |
| Cross-module deep link | Quotations/SO (commerce), Delivery (purchases), Credit master (customers), Drawer hardware (devices) — still appear under 02 as named children that route correctly |

---

## 23. Implementation dependency graph

```
IA remap (26 children) ─────────────────────────────────┐
        │                                               │
Canonical session + totals (already mostly done) ───────┤
        │                                               │
Checkout harden (compensate/void/installment/hold TX) ──┤
        │                                               │
┌───────┴────────┬──────────────┬───────────────────────┘
│                │              │
Terminal UX      Payments/AR    Inventory RPC (exists)
│                │              │
Hold/Resume      Credit         Delivery link
│                │
Returns/Exchange/Refund
│
Shift + Cash In/Out schema + Day Closing
│
Coupons (schema + engine)     ← new
│
Offline POS (new sync design) ← blocked until online path is solid
```

---

## Canonical 26 — status matrix

| # | Canonical name | Status | Today | Sev of gap |
|---|----------------|--------|-------|------------|
| 1 | POS Terminal | **live / not fully mature** | `/pos` `PosPage` | HIGH (scanner, UX, density polish) |
| 2 | Quick Sale | **partial** | Easy mode on `/pos` only | MEDIUM |
| 3 | Product Search | **partial** | Panel + hub stub | MEDIUM |
| 4 | Customer Selection | **partial** | Panel + hub stub; Walk-in friction | HIGH |
| 5 | Invoices | **live** | `/invoices` | MEDIUM (PDF/print completeness TBD) |
| 6 | Payments | **live** | `/payments` + terminal tenders | MEDIUM (PSP absent by design) |
| 7 | Credit / Udhaar | **partial / aliased** | Tender on POS; master `/credit` | HIGH (IA + ledger clarity) |
| 8 | Barcode Scanner | **partial** | Bundled scan tools | HIGH (fuzzy add bug) |
| 9 | Salesman / Reference | **live (split)** | `/pos/salesmen`, `/pos/references` + assignment | MEDIUM (merge naming) |
| 10 | Hold Sale | **partial** | Action on terminal | HIGH (atomic hold, editHold) |
| 11 | Resume Sale | **live (combined)** | `/held-sales` | MEDIUM |
| 12 | Quotations | **aliased** | Create from POS; manage `/quotations` | MEDIUM |
| 13 | Sales Orders | **missing from POS** | Tables exist; UI under B2B | HIGH for POS ownership |
| 14 | Split Payment | **partial** | Terminal multi-tender | MEDIUM |
| 15 | Installments | **live / fragile side-effect** | `/pos/installments` + post-commit | HIGH |
| 16 | Discounts | **live** | `/discounts` + cart | MEDIUM |
| 17 | Coupons | **missing** | — | HIGH (new work) |
| 18 | Returns | **live** | `/returns` | MEDIUM |
| 19 | Exchange | **live** | `/exchange` | MEDIUM |
| 20 | Refund | **partial** | Disposition only | MEDIUM |
| 21 | Delivery Order | **partial / aliased** | Flag + best-effort note; `/deliveries` | MEDIUM |
| 22 | Cash Drawer | **partial** | Hardware kick + devices | MEDIUM |
| 23 | POS Shift | **live** | Register `/sales-management` | MEDIUM |
| 24 | Cash In / Cash Out | **missing (blocked)** | Explicitly unavailable | HIGH |
| 25 | Day Closing | **missing** | Shift close only | HIGH |
| 26 | Offline POS | **missing** | Online-only | CRITICAL if required for go-live without connectivity |

---

## What already works (capability)

- Dense POS terminal inside ERP shell (search → cart → pay → post).
- Domain totals / cart / payment prep / checkout validation.
- Idempotent sale post with stock RPC + compensate design.
- Hold park without stock; resume CAS; held sales workspace.
- Returns + exchange workflows with domain prep.
- Payments register; discount policy UI; salesman/reference registers.
- Installments register + create-from-sale path.
- Shift open/close; online connection gates; cashier error sanitization.
- Search batching / bootstrap cache (perf mitigations).

---

## What is partially implemented

- Quick Sale, Product Search, Customer Selection as **named modules**.
- Barcode (works with HIGH wrong-hit risk).
- Split payment (in terminal, not a child page).
- Credit (tender + master elsewhere).
- Refund (not standalone).
- Delivery (flag + best-effort).
- Cash drawer (hardware, not full drawer ledger).
- Day closing (shift close only).
- Quotations create-from-cart (management elsewhere).

---

## What is broken / high-risk

- Scanner fuzzy fallback; hold edit stale snapshot; compensate/void/installment edges; non-atomic hold insert.
- IA title mismatch vs product owner 26-list.
- Customer search friction under Walk-in.
- CI drift risk on New Sale UI tests after copy changes (verify before ship).

---

## What is duplicated

- Related screens across ERP parents (installments, salesman, quotations/orders).
- Client vs server recalculation (acceptable).
- Terminal vs Payments vs Register for overlapping operational concerns (acceptable if IA is clear).

---

## What must be refactored (before / during Phase 1)

1. **Module 02 children → exact 26 names/order** (routes + ownership tests + terminal nav).
2. Harden checkout compensate/void + installment side-effect UX.
3. Fix scanner exact-match-only; fix `editHold`.
4. Atomic hold write.
5. Decide embedding vs dedicated pages for search/customer/quick/split/barcode.
6. Do **not** invent coupon/cash-in/offline until schema + domain exist.

---

## Backend / DB support that already exists

- Sales, items, payments, holds, returns, shifts, stock RPC, customers/credit, installments, quotations/SO tables, delivery tables, discount audits, salesman references, RBAC `pos.*`.

---

## Backend / DB support that is missing or incomplete

| Need | Status |
|------|--------|
| Coupons | No schema/engine |
| Cash in / cash out ledger | Blocked; shift `expense_total` unused |
| Day closing record | No dedicated table/workflow |
| Offline sync queue | Removed; columns legacy only |
| PSP / card capture | Out of scope today (record-only) |
| Hold multi-row atomicity | App-level sequential writes |
| Whole-sale single Postgres TX | Not present (compensate pattern) |

---

## Performance bottlenecks (summary)

1. Ensure POS index migration applied in every environment.  
2. Bundle size / PosPage size.  
3. Stale local favorites stock.  
4. Measure wall-clock after auth (prior audits blocked by login).

---

## Data-integrity risks (summary)

Happy-path posting is strong. Residual HIGH risks: compensate/void, installment post-commit, hold atomicity, scanner mis-add. Offline not safe to claim.

---

## Recommended implementation order (aligned with owner phases)

After audit approval only:

| Phase | Focus |
|-------|--------|
| **A / Phase 1** | IA remap to 26 names; confirm one transaction SoT; fix CRITICAL/HIGH posting/hold/scanner |
| **B** | POS Terminal, Quick Sale, Product Search, Customer Selection |
| **C** | Invoices, Payments, Credit / Udhaar |
| **D** | Barcode Scanner, Salesman / Reference |
| **E** | Hold Sale, Resume Sale |
| **F** | Quotations, Sales Orders |
| **G** | Split Payment, Installments |
| **H** | Discounts, Coupons |
| **I** | Returns, Exchange, Refund |
| **J** | Delivery Order |
| **K** | Cash Drawer, POS Shift, Cash In/Out, Day Closing |
| **L** | Offline POS (design first — no fake localStorage) |
| **M–N** | Performance + full QA |

After **each** phase: typecheck, lint, build, workflow test, concise report — then stop for approval.

---

## Evidence index

| Artifact | Path |
|----------|------|
| Module registry | `apps/web/src/app/modules.ts` |
| Ownership lock | `apps/web/src/features/pos/pos-ownership.ts` |
| Router | `apps/web/src/app/router.tsx` |
| Checkout audit | `docs/POS-CHECKOUT-AUDIT.md` |
| Hold audit | `docs/POS-HOLD-RESUME-AUDIT.md` |
| Final QA | `docs/POS-FINAL-QA-REPORT.md` |
| Consolidation | `docs/POS-ARCHITECTURE-CONSOLIDATION.md` |
| Performance | `docs/POS-PERFORMANCE-AUDIT.md` |
| Sale posting | `packages/domain/src/sale-transaction.ts` |
| Security unavailable actions | `packages/domain/src/pos-security.ts` |

---

## Phase 0 complete — STOP

**No Phase 1 work started.** Awaiting explicit approval of this audit (especially the **26-name IA remapping** decision) before any implementation.
