# CURRENT POS SYSTEM AUDIT

**Audit date:** 2026-08-12
**Scope:** Forensic read-only inspection of the Electronic ERP monorepo POS / Sales stack
**Rule followed:** No application code, schema, config, or business logic was modified for this phase.
**Source of truth:** Current codebase only (not prior phase claims).

> **Phase 1 update (2026-08-12):** Application converted to **ONLINE_ONLY** mode (`packages/contracts/src/runtime-mode.ts`). Offline SQLite POS posting, web customer offline cache, Sync Center / Offline POS product UI, desktop SyncCoordinator start, and `/api/v1/sync` push/pull are disabled at the product boundary. Supabase via API is the single runtime source of truth. Packages `offline` / `sync` remain in the monorepo for a future offline phase. Sections below describing dual online/offline runtime describe **preâ€“Phase 1** state unless noted.

---

# 1. Executive Summary

The application is a **npm workspaces monorepo** for an electrical-store ERP with a substantial POS subsystem.

**What it actually is today:**

| Layer | Reality |
|-------|---------|
| Frontend | React 18 + Vite + Tailwind (`apps/web`) |
| API | Express (`apps/api`) talking to Supabase with user JWT (and optional service role server-side) |
| Desktop offline | Electron (`apps/desktop`) + `better-sqlite3` (`packages/offline`) + sync (`packages/sync`) |
| Domain | Shared pure TypeScript business rules (`packages/domain`) |
| Contracts | Zod schemas (`packages/contracts`) |
| Persistence online | Supabase Postgres via `packages/db` repositories |
| State on POS | React hooks (`usePosSession`) â€” **not Zustand**; TanStack Query is a dependency but POS checkout path is mostly direct `posApi` + local state |
| Auth | Supabase Auth + `AuthContext` + permission assertions on API |

**POS maturity (honest):** Online POS counter â†’ checkout â†’ stock/payment/ledger orchestration is **real and relatively mature**. Offline is **real on Electron**, but **web POS cannot complete sales offline**. Many requirement items exist as **domain logic** or **seeded payment method labels** without full UI wiring or external gateway integration. Several ERP module routes remain **placeholders**. Delivery has lifecycle management but **no live GPS**. Invoice â€œPDF/WhatsApp/Emailâ€ are **browser text / wa.me / mailto** helpers, not full document services.

**Overall maturity score: 6.4 / 10** (see Â§16).

---

# 2. Current Architecture

## 2.1 Monorepo map

```
electronic-erp/
â”œâ”€â”€ apps/web          React POS + ERP UI
â”œâ”€â”€ apps/api          Express REST /api/v1/*
â”œâ”€â”€ apps/desktop      Electron + SQLite offline runtime
â”œâ”€â”€ packages/contracts
â”œâ”€â”€ packages/domain
â”œâ”€â”€ packages/db       Supabase repositories
â”œâ”€â”€ packages/offline  SQLite schemas + OfflinePosEngine
â”œâ”€â”€ packages/sync     SyncEngine, sale/stock/payment sync helpers
â”œâ”€â”€ packages/hardware Print / scanner adapters
â”œâ”€â”€ packages/ui       Shared Button/Card/Toast (ERP chrome)
â”œâ”€â”€ packages/ai
â”œâ”€â”€ supabase/migrations
â””â”€â”€ vercel.json
```

**Lint:** `npm run lint` â‰¡ `npm run typecheck` (no ESLint package).
**PWA / service worker:** Not present in `apps/web`.
**Zustand:** Not used.

## 2.2 Runtime data flow (actual)

### Online POS (browser)

```
React UI (PosPage + panels)
  â†’ usePosSession (domain cart/pricing/tax helpers)
  â†’ posApi / partiesApi / purchasesApi (HTTP)
  â†’ apps/api routes (/api/v1/pos/*, parties, purchases)
  â†’ authz(permission) middleware
  â†’ PosRepository / PartiesRepository / PurchasesRepository
  â†’ Supabase (anon key + user JWT; org RLS via current_organization_id())
```

### Offline POS (desktop only)

```
Electron IPC
  â†’ OfflinePosEngine (packages/offline)
  â†’ LocalDatabase (SQLite) + outbox
  â†’ SyncCoordinator / SyncEngine push when online
  â†’ API sync routes â†’ PosRepository / sale transaction (idempotent)
```

### Web â€œofflineâ€ (partial)

```
navigator.onLine false
  â†’ customer search/create: localStorage PosCustomerOfflineCache
  â†’ product search / hold / postSale: still call posApi â†’ FAILS without network
  â†’ cart remains in-memory only (lost on refresh unless held online)
```

## 2.3 Layer responsibilities

| Layer | Tech | Key files | Responsibility | Problems |
|-------|------|-----------|----------------|----------|
| UI | React | `apps/web/src/features/pos/*` | Terminal UX | Dual chrome (POS DS + `@electronic-erp/ui`); some pages still Card/Button from ERP UI |
| Session | Hooks | `usePosSession.ts` | Cart/customer/tax level | No global store; hard to share across routes |
| Domain | TS | `packages/domain/src/pos-*.ts`, `sale-transaction.ts` | Totals, discounts, payments, holds, returns, commission | Some engines not fully wired from repo/UI |
| API | Express | `apps/api/src/routes/pos.ts` | Authz + orchestration entry | Depends on packages build (`dist`) |
| DB online | Supabase | `packages/db/.../pos-repository.ts` | CRUD + ports for SaleTransactionService | Sale finalization is multi-step writes, not one Postgres RPC |
| DB offline | SQLite | `packages/offline/*-schema.ts` | Local projection + outbox | Schema subset vs Supabase; web doesnâ€™t use it |
| Sync | SyncEngine | `packages/sync/*` | Push/pull, conflict strategy | Conflict resolver exists; transactional reconcile is policy, not full auto-merge UI |

---

# 3. Current POS Structure

## 3.1 Routes (from `router.tsx` + `modules.ts`)

| Route | Page | Status |
|-------|------|--------|
| `/pos` | `PosPage` | Active POS terminal |
| `/held-sales` | **Same `PosPage`** | Duplicate route â€” no dedicated hold page |
| `/returns` | `ReturnsPage` | Active |
| `/invoices` | `InvoicesPage` | Active (simpler register) |
| `/sales-management` | `SalesManagementPage` | Active (KPIs, filters, export) |
| `/salesman` | `SalesmanPage` | Active |
| `/deliveries` | `DeliveriesPage` (purchases feature) | Active lifecycle; tracking placeholder |
| `/payments` | `PaymentsPage` (parties) | Payment methods / receipts (not POS tender UI) |
| `/credit`, `/installments` | **Same `CreditInstallmentsPage`** | Duplicate paths |
| `/discounts` | `ModulePlaceholderPage` | **PLACEHOLDER** |
| `/offline-pos` | `OfflinePosStatusPage` | Status UI |
| `/sync` | `SyncCenterPage` | Sync center |
| `/ai-camera` | `AiCameraPage` | Separate catalog AI page â€” **not embedded in POS counter** |
| `/pricing` | `PricingPage` | Catalog pricing masters |
| `/printing`, `/devices` | Hardware pages | Related |

Parent layout: `ProtectedRoute` â†’ `AppShell` (ERP nav). POS also uses internal `POSLayout` / `POSSidebar` inside `PosPage`.

## 3.2 POS feature folders / components

```
apps/web/src/features/pos/
  PosPage.tsx
  ReturnsPage.tsx, InvoicesPage.tsx, SalesManagementPage.tsx, SalesmanPage.tsx
  pos-api.ts, pos-types.ts, hardware.ts, pos-tokens.css
  session/usePosSession.ts, pos-customer-repository.ts, pos-customer-runtime.ts
  components/ PosCartPanel, PosProductPanel, PosPaymentPanel, PosCustomerPanel,
              PosHoldsPanel, ReceiptPreview, PosApprovalDialog
  design-system/ POSLayout, POSSidebar, POSTopbar, POSButton, POSTable, â€¦
  components/PosSidebar.tsx, PosHeader.tsx  â†’ deprecated aliases to design-system
```

## 3.3 Permissions (POS-related keys observed)

From migrations / API usage patterns: `pos.sell`, `pos.hold`, `pos.return`, `pos.view_invoices`, `pos.configure`, discount ladder keys (`pos.discount_cashier|supervisor|manager|owner|special`), `salesman.manage`, `commissions.view|manage`, `deliveries.view`, `credit.approve`, `customers.read`, etc.

---

# 4. Feature Requirements Matrix

Legend: **OK** = Implemented correctly Â· **PART** = Partial Â· **UI** = UI only Â· **LOGIC** = Domain/API without full UI Â· **PH** = Placeholder Â· **MISS** = Missing Â· **DUP** = Duplicated Â· **CONF** = Conflicting Â· **UNK** = Unknown

## A. POS Main Screen

| Requirement | Status | Location / evidence |
|-------------|--------|---------------------|
| Search Product Name | OK | `PosRepository.searchProducts` ILIKE `name` |
| Urdu Name | OK | `name_ur` |
| SKU/ID | OK | `sku` |
| Barcode | OK | `barcodes` table join + sort prefer exact |
| QR | PART | Camera scanner adapter captures code into search; not a dedicated QR product index |
| Brand / Model / Category | OK | Taxonomy ID expansion in search |
| Voice Search | MISS | No SpeechRecognition usage in POS |
| Camera Recognition | PART | `/ai-camera` page exists; POS QR button â‰  full AI recognition workflow |
| Barcode Scanner | OK | Keyboard-wedge into search + hint |
| Manual Entry | OK | `createManualCartLine` / usePosSession |
| Recent Products | OK | `localStorage` recent lists |
| Favorites | OK | `localStorage` favorites |
| Categories tab / Product Grid | PART | Tabs recent/favorites/search; category browse is search-driven, not full category tree UX |
| Product Image | PART/MISS | Search result shape inspected does not emphasize image URL in POS grid (verify product image rendering â€” not strongly present) |
| Cart qty/unit/price/discount/line total/remove/recalc | OK | `PosCartPanel` + domain cart |
| Line tax display | PART | Tax via session tax rate + line tax in domain; UI density varies |
| Walk-in / existing customer / search / new customer | OK | `PosCustomerPanel` + `posCustomerRepository` |
| Customer history | PART | Ledger notes â€œonline onlyâ€ |
| CNIC / credit limit / outstanding / loyalty / price tier | PART | Fields exist in customer model; loyalty gated; price tier via `priceLevel` retail/wholesale/dealer |

## B. Pricing

| Requirement | Status | Notes |
|-------------|--------|-------|
| Retail / Wholesale / Dealer | OK | `resolvePosUnitPrice` + product columns + POS price level |
| Customer-specific | LOGIC | Domain supports `customerPrice`; **searchProducts does not populate it** |
| Quantity Price | LOGIC | Domain `quantityBreaks`; **not returned by searchProducts** |
| Promotion Price | LOGIC | Domain `promotionPrice`; **not returned by searchProducts** |
| Manual Override | OK | Permission-gated in PosPage + domain `allowManualOverride` |
| Centralized engine | PART | Domain centralized; UI/repo incomplete for promo/qty/customer |

## C. Discounts

| Requirement | Status | Notes |
|-------------|--------|-------|
| Item % / fixed | PART | Line discount on cart; stacking helpers exist |
| Invoice % | PART | UI is primarily **fixed amount** invoice discount (`invoiceDiscount` string) |
| Invoice fixed | OK | PosPaymentPanel + approval |
| Customer / Promotion / Bulk | LOGIC | `applyCustomerDiscount`, `applyPromotionDiscount`, `applyBulkDiscount`, `computeStackedLineDiscount` â€” **not fully orchestrated in POS UI** |
| Approval &lt;5 / 5â€“10 / 10â€“20 / 20â€“50 / &gt;50 | OK (domain+UI) | `discount-policy.ts` matches ladder; `PosApprovalDialog` uses `evaluateDiscountApproval` |
| `/discounts` module | PH | Placeholder route |

## D. Tax

| Requirement | Status | Notes |
|-------------|--------|-------|
| Sales Tax / GST / Exempt | OK (domain) | `pos-tax.ts` kinds + inclusive/exclusive |
| Tax Invoice | PART | Receipt labels â€œTax Invoiceâ€; FBR page separate (`/tax`) |
| Rounding / discount interaction | OK | `roundMoney` + tax after line discount in cart totals |
| Return interaction | PART | Return uses prepared amounts; full tax recompute path depends on return posting |

## E. Payments

| Requirement | Status | Notes |
|-------------|--------|-------|
| Cash / Bank / Card | OK | Seeded methods + POS splits |
| JazzCash / Easypaisa / SadaPay | UI/LOGIC | Seeded as method kinds in `parties-repository`; **no external wallet API** â€” records tender only |
| Credit/Udhar | OK | Credit-like kinds + credit checks |
| Installment | PART | `createInstallment` on sale + CreditInstallments page |
| Full / Partial / Split / Advance | OK | `preparePosPayments` / `classifyPosPaymentType` |
| Duplicate prevention | OK | `PaymentAttemptGate` + sale idempotency |
| Offline payments | PART | Desktop offline engine has `postPayment`; web checkout always `posApi.postSale` |

## F. Reference / Salesman / Commission

| Requirement | Status | Notes |
|-------------|--------|-------|
| Reference person | OK | `sale_references` migration + SalesmanPage + checkout `referenceId` |
| Salesman + rate | OK | Employees/salesman UI + `commissionPercent` |
| Commission amount/status/payment/reports | OK | `pos-commission.ts` + SalesmanPage pay/report |

## G. Hold / Resume

| Requirement | Status | Notes |
|-------------|--------|-------|
| Hold / reason / notes / time / expiry | OK | Domain TTL 24h + API + PosHoldsPanel |
| Active / expired / resume / discard / duplicate / transfer / edit | OK | Domain action gates + API |
| Resume & checkout | OK | `resumeHold(..., andCheckout)` |
| Inventory impact | OK invariant | `holdMustNotReduceInventory` â€” hold parks snapshot only |
| Dedicated `/held-sales` page | DUP | Same `PosPage` |

## H. Sale Finalization

| Requirement | Status | Notes |
|-------------|--------|-------|
| Invoice #, datetime, branch, terminal, cashier, customer, lines, totals, payments | OK | Sale + invoice view |
| Salesman / commission / warranty / terms | PART | Wired when provided; warranty notes fields exist |
| Transaction safety | PART | Draftâ†’stockâ†’paymentâ†’finalize with compensation; **not single DB RPC** (documented in `sale-transaction.ts`) |
| Stock / payment / customer balance / commission / audit | OK (online path) | Via SaleTransactionService ports |

## I. Invoice

| Requirement | Status | Notes |
|-------------|--------|-------|
| A4 / 80mm / 58mm | PART | Text render + print hardware adapters |
| PDF | PART | **Downloads `.txt`**, labeled PDF |
| WhatsApp | PART | `wa.me` deep link with truncated text |
| Email | PART | `mailto:` |
| Save / Reprint | PART | Save = text download; reprint via Invoices / Sales Management |

## J. Sales Management

| Requirement | Status | Notes |
|-------------|--------|-------|
| History filters / search | OK | `SalesManagementPage` + API |
| KPIs (sales, discount, tax, net, pending) | OK | Posted-sales summary |
| Profit KPI | MISS/PART | Pending amount yes; **total profit not confirmed as KPI** |
| Reports by dimension | OK | Reuses `/api/v1/reports/sales/:dimension` |
| Overlap with `/invoices` | DUP | Two registers |

## K. Returns / Exchange

| Requirement | Status | Notes |
|-------------|--------|-------|
| Search invoice / select / qty / reasons | OK | `ReturnsPage` + `pos-return.ts` |
| Full / partial / refund / credit / exchange | OK | Domain dispositions |
| Inspection fields | OK | Condition, packaging, accessories, notes |
| Stock increase | OK (online) | Restock targets in domain + repo |
| Duplicate return prevention | OK | Max returnable qty + tests |
| Offline return | PART | OfflinePosEngine `postReturn` exists; web ReturnsPage uses API |

## L. Delivery

| Requirement | Status | Notes |
|-------------|--------|-------|
| Create / assign / status lifecycle | OK | DeliveriesPage + migration statuses incl. `in_transit` |
| Cancel rules | OK | Domain lifecycle |
| Live tracking / GPS | PH | `NullDeliveryTrackingAdapter` â€” explicitly not configured |
| Reports | PART | API reports exist; depth varies |
| POS checkbox create delivery | PART | Best-effort after sale; failure leaves sale without delivery |

---

# 5. UI Audit

Reference direction: modern enterprise POS â€” navy sidebar, light workspace, blue primary, green/red/orange/purple status, compact cards/tables.

## POS Counter (`/pos`)

1. **Exists:** Yes â€” primary terminal.
2. **Workflow:** Search â†’ cart â†’ customer â†’ payment â†’ finalize â€” matches cashier flow.
3. **Visual consistency:** Strong inside `.pos-terminal` tokens (`pos-tokens.css`: navy, primary `#3b5bdb`, success/warning/danger).
4. **Hierarchy:** Generally clear; payment + cart dense.
5. **Actions:** Shortcuts defined (`POS_SHORTCUTS`); some Alt+F keys.
6. **Crowded:** Payment panel + installment + discount + holds can feel dense on small screens.
7. **Missing:** Voice search; true AI camera in-panel; product images; promo/qty pricing surfacing.
8. **Duplication:** `/held-sales` opens same screen.
9. **Responsive:** Improved in later phases; still table-heavy.
10. **Enterprise feel:** Closest of all screens to target.
11. **Reference match:** Directionally aligned (navy/light/blue); not pixel-matched to any external screenshot set in-repo.

**CURRENT STATE:** Production-capable online terminal with dedicated design system.
**PROBLEMS:** Dual AppShell ERP nav + POS sidebar; density; offline gap on web.
**MISSING:** Voice, wired promo/qty/customer prices, real PDF.
**DUPLICATION:** Hold route.
**RECOMMENDED FUTURE STRUCTURE:** Single fullscreen POS shell (hide ERP chrome on `/pos`); keep panels but extract payment wizard steps.

## Sales Management

**CURRENT STATE:** Functional register + KPIs + export.
**PROBLEMS:** Uses ERP `Button`/`Card` more than POS DS â€” visual drift from POS Counter.
**MISSING:** Profit KPI if required.
**DUPLICATION:** Overlaps Invoices.
**RECOMMENDED:** One Sales Register with tabs (All / Invoices / Credit / Export).

## Sales Return/Exchange

**CURRENT STATE:** Wizard stepper; domain-aligned.
**PROBLEMS:** ERP Card UI vs POS tokens.
**MISSING:** Offline path on web.
**RECOMMENDED:** Adopt POS DS; keep stepper.

## Hold/Resume

**CURRENT STATE:** Panel inside PosPage â€” not standalone.
**PROBLEMS:** Nav item `/held-sales` misleading.
**RECOMMENDED:** Either dedicated page or remove nav duplicate.

## Payments

**CURRENT STATE:** Parties PaymentsPage for methods/ledger â€” not the POS tender panel.
**PROBLEMS:** Naming collision with POS payments.
**RECOMMENDED:** Rename nav â€œPayment Methods / Receiptsâ€.

## Salesman/Reference

**CURRENT STATE:** Dedicated page with commission pay/report.
**PROBLEMS:** Visual consistency vs POS DS.
**RECOMMENDED:** Keep module; restyle to POS/ERP shared tokens.

## Invoice

**CURRENT STATE:** ReceiptPreview multimodal actions.
**PROBLEMS:** PDF mislabeled; WhatsApp/email are OS handoffs.
**RECOMMENDED:** Real PDF generator; optional Twilio/WhatsApp Business later.

## Delivery

**CURRENT STATE:** Purchases DeliveriesPage with status machine.
**PROBLEMS:** Tracking UI will show not_configured; GPS absent (correctly).
**RECOMMENDED:** Keep lifecycle; integrate real tracker only when provider exists.

---

# 6. Component Duplication

| A | B | Purpose | Active | Notes |
|---|---|---|---|---|
| `POSSidebar` | `PosSidebar` | POS nav | A via alias | Deprecated re-export â€” merge later |
| `POSTopbar` | `PosHeader` | Header | Alias | Same |
| `POSButton` / `POSCard` | `@electronic-erp/ui` Button/Card | Controls | Both | POS uses DS; Returns/Sales Mgmt/Invoices often use UI package |
| `InvoicesPage` | `SalesManagementPage` | Sale register | Both | Overlapping list/invoice open |
| `/pos` | `/held-sales` | Terminal | Same component | Dead-end duplication |
| `/credit` | `/installments` | Credit plans | Same page | Duplicate routes |
| `calcTotals` (`pos-types`) | `calculatePosCartTotals` | Totals | Thin alias | OK â€” not conflicting |
| AppShell sidebar | POSSidebar | Navigation | Both on POS | Double chrome |

**Should eventually merge:** aliases (trivial), invoice registers (product decision), payment naming, hide ERP chrome on POS.

---

# 7. Business Logic Duplication

| Concern | Locations | Conflict? |
|---------|-----------|-----------|
| Cart totals | `calculatePosCartTotals` â†’ calls `calculateSaleTotals` | **No** â€” layered correctly |
| Offline sale totals | `OfflinePosEngine` uses `calculateSaleTotals` | Aligned |
| Online post | `SaleTransactionService` uses `calculateSaleTotals` | Aligned |
| Discount apply | `pos-discount.ts` + UI `applyDiscount` for invoice | Aligned if UI always uses domain |
| Tax | `pos-tax.ts` in cart; line tax also stored on items | Risk if UI tax and posted item.tax diverge â€” mitigated by recalculateCart |
| Commission | `pos-commission.ts` only accrual builder | OK |
| Payment prep | `pos-payment.ts` + PaymentAttemptGate | OK |
| Invoice numbering | Server on post; offline `OFF-{timestamp}-â€¦` | Different schemes by design |

**Main conflict risk:** Domain pricing/discount stacking features **exist** but POS search/repo **do not supply** promotion/qty/customer prices â†’ UI appears to support â€œsmart pricingâ€ while runtime mostly uses retail/wholesale/dealer + manual.

---

# 8. Database Audit

## 8.1 Supabase (POS-related)

Key migrations: foundation, product master, inventory, parties/payments, `20260810000005_pos_sales`, pricing/discount/tax perms, cash shifts, customers email, payments, holds, returns, salesman commission, delivery management, offline sync engine, RBAC/audit.

| Table / area | Purpose | Usage | Notes |
|--------------|---------|-------|-------|
| `sales` / `sale_items` | Invoices & lines | Core | statuses draft/held/posted/void/returned/exchanged |
| `sale_discount_audits` | Discount trail | Used | |
| `held_sales` | Parked carts | Used | snapshot only |
| `sale_returns` / `sale_return_items` | Returns | Used | |
| `sale_commissions` | Commission | Used | unique org+sale |
| `sale_references` | Reference persons | Used | |
| `sale_warranties` | Warranty rows | Used on finalize | |
| `payments` / `payment_splits` / `payment_methods` | Tenders | Used | **no `sale_payments` table** |
| `customers` | Parties | Used | |
| `products` + barcodes + taxonomy | Catalog | Used | |
| `stock_balances` / `stock_movements` | Inventory | Used | |
| `deliveries` + `delivery_status_history` | Delivery | Used | tracking fields nullable |
| `cash_shifts` | Shift open/close | Used | |
| `audit_logs` | Audit | Used | |
| Installment tables (parties) | Plans | Used when createInstallment | |
| Tax rates | Catalog/enterprise | PART for POS session rate | |

**RLS:** Org-scoped policies (`organization_id = current_organization_id()`) on sales family and inventory â€” present.
**Suspicious / gaps:** Multi-step sale finalization without DB transaction RPC; permission description history (manager 15%â†’20%) cleaned in later migration.

## 8.2 SQLite (`packages/offline`)

Schemas: foundation, catalog, inventory, parties, pos (`sales`, `held_sales`, `sale_returns`, `offline_sale_mutations`), warehouse-ops, sync.

| Gap vs Supabase | Impact |
|-----------------|--------|
| Not full mirror of all POS tables (commissions, deliveries, etc.) | Offline feature subset |
| Web app does not open SQLite | Browser offline â‰  desktop offline |
| Outbox-driven sync | Depends on device provisioning |

---

# 9. Online/Offline Audit

| Capability | Online (web) | Offline (web) | Offline (desktop) |
|------------|--------------|---------------|-------------------|
| Login | Supabase Auth | Fail / cached session UNK | Provisioning requires first online |
| Product search | API | **Fails** (API) | Local catalog if synced |
| Customer search/create | API + cache fill | **localStorage cache** | SQLite parties store |
| Cart | Memory | Memory only | Memory + can persist via hold/sale local |
| Post sale | `posApi` â†’ SaleTransactionService | **Fails** | OfflinePosEngine + outbox |
| Hold | API | **Fails** | Local held_sales schema exists |
| Returns | API | **Fails** | Engine `postReturn` |
| Payments with sale | In sale transaction | N/A | Engine payment outbox |
| Invoice fetch/print | API + hardware | Limited | Local + later sync |
| Sync | N/A | N/A | SyncEngine + coordinator |

---

# 10. Synchronization Audit

| Mechanism | Present? | Notes |
|-----------|----------|-------|
| Offline outbox | Yes (desktop SQLite) | `enqueueOutbox` |
| SyncEngine online gate | Yes | Defers when offline |
| Sale/stock/payment/customer/product sync modules | Yes | `packages/sync/src/*` |
| Conflict resolver | Yes | Transactional entities â†’ `transaction_reconcile` policy |
| Retry | PART | Outbox model; UI Sync Center â€” depth not fully audited for backoff |
| Duplicate prevention | Yes | Idempotency keys on sales |
| Last-write-wins | Available strategy | Avoided for financial entities |
| Reconciliation UI | PART | Sync conflicts tables + Sync Center |
| Web POS â†’ SQLite sync | **No** | Architecture split |

---

# 11. Payment Audit

- **Methods seeded:** cash, bank, card, JazzCash, Easypaisa, SadaPay, online, credit, installment (names from parties repository seed).
- **POS behavior:** Cashier selects methods, amounts, cash tendered/change; `preparePosPayments` validates; splits posted in sale transaction.
- **Gateways:** None implemented for JazzCash/Easypaisa/SadaPay â€” **recording only**.
- **Statuses:** unpaid/partial/paid (+ refunded on sales).
- **Installment:** Optional `createInstallment` payload on post.
- **Advance:** `isAdvancePayment` flag supported.
- **Duplicate:** Client `PaymentAttemptGate` + server idempotency.

---

# 12. Sales Audit (lifecycle)

```
Cart (domain) â†’ prepare payments â†’ PaymentAttemptGate
  â†’ POST /pos/sales
  â†’ SaleTransactionService:
       idempotency check
       â†’ insert draft sale
       â†’ items â†’ stock deduct â†’ customer ledger â†’ payments
       â†’ on failure: reverse stock + void draft
       â†’ finalize posted
       â†’ journal / commission / warranties / installment / analytics / audit
  â†’ optional delivery create (separate call; can fail independently)
  â†’ receipt preview + thermal print attempt
```

**Idempotent retries** return posted sale without double stock (tested in domain).

---

# 13. Return/Exchange Audit

```
Search invoices â†’ select sale â†’ choose lines/qty/condition
  â†’ prepareSaleReturn (domain caps qty, reasons, disposition)
  â†’ API post return â†’ stock restock / refund or credit / exchange
```

Duplicate over-return blocked by `previouslyReturnedQty` + max returnable.
Web path online-only.

---

# 14. Hold/Resume Audit

```
assert non-empty cart â†’ insert held sale + cart_snapshot (no stock)
  â†’ expire job/API
  â†’ resume replaces cart (never append â€” prevents duplicate lines)
  â†’ discard/cancel/transfer/duplicate/edit per action gates
```

Inventory correctly **not** reduced on hold.

---

# 15. Security Audit

| Area | Finding |
|------|---------|
| Web secrets | `VITE_SUPABASE_URL` + anon/publishable only â€” **no SERVICE_ROLE in web** (asserted by api migrations test) |
| Service role | API server only (`apps/api/src/lib/supabase.ts`) |
| Auth | Protected routes + JWT on API |
| Authz | Permission asserts per route (`pos.sell`, discounts, returns, â€¦) |
| Discount approval | Role ladder enforced in domain; UI approval dialog â€” **client-side role selection can be weaker than server if server doesnâ€™t re-check identically** (verify server assertDiscountAllowed on post â€” sale-transaction imports it) |
| RLS | Org isolation policies on sales/inventory |
| Cashier vs owner | Permission keys exist; correct assignment depends on seeded roles |
| Sale cancellation / return approval | Return permission `pos.return`; cancel hold vs void sale paths differ |

**Risk:** Multi-write finalization without DB transaction = window for inconsistency under hard failure mid-chain (mitigated by draft/void/compensation, still P0 hardening candidate).

---

# 16. Error Audit

Commands run 2026-08-12 (audit machine):

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** (exit 0) â€” all packages + apps |
| `npm run lint` | Alias of typecheck â€” **PASS** |
| `npm run test` (`test:foundation`) | **PASS** â€” contracts/domain/offline/api/web vitest suites |
| `npm run build` | Started during audit; treat as **VERIFY ON CI** if not finished in report window |

**Runtime notes from tests:** React Router v7 future flag warnings in web smoke test.
**No ESLint** â€” style/hook bugs wonâ€™t be caught by `lint`.
**Stale `packages/*/dist`:** Historical risk â€” typecheck can fail with TS6305 if packages not built; current run passed.

---

# 17. Performance Audit

| Risk | Evidence |
|------|----------|
| N+1 enrichment in product search | Per-result brand/company/category/model/unit queries in `searchProducts` |
| Sales management | Batched enrichment claimed in prior work â€” still watch large date ranges |
| PosPage size | Very large single component â€” re-render cost |
| localStorage favorites/recent | Fine for small sets |
| No PWA cache | Web offline product search cannot work |

---

# 18. Data Consistency Risks

| Risk | Severity | Detail |
|------|----------|--------|
| Partial sale finalization | **P0** | Sequential writes; compensation path exists but not ACID single transaction |
| Sale OK / delivery fail | **P1** | POS continues; delivery orphan gap |
| Web offline illusion | **P0** | Online badge flips; checkout still needs API â†’ cashier may believe offline POS works in browser |
| Offline desktop totals vs online tax/commission | **P1** | Offline engine posts via `calculateSaleTotals`; full commission/tax session features may differ until sync |
| Invoice PDF vs totals | Low | Text render from same invoice payload |
| Pricing engine vs search payload | **P1** | Promo/qty/customer prices never loaded â†’ wrong price vs policy expectation |
| JazzCash â€œpaidâ€ without gateway | **P1** | Method recorded as paid without PSP confirmation |
| Hold vs stock | OK | Holds donâ€™t move stock |
| Return double-claim | Mitigated | Domain caps |

---

# 19. Current Screens Inventory

1. POS Counter â€” `PosPage`
2. Hold panel (embedded) â€” `PosHoldsPanel`
3. Returns / Exchange â€” `ReturnsPage`
4. Invoices â€” `InvoicesPage`
5. Sales Management â€” `SalesManagementPage`
6. Salesman / References / Commission â€” `SalesmanPage`
7. Deliveries â€” `DeliveriesPage`
8. Payments (methods) â€” `PaymentsPage`
9. Credit / Installments â€” `CreditInstallmentsPage`
10. Offline POS status â€” `OfflinePosStatusPage`
11. Sync Center â€” `SyncCenterPage`
12. AI Camera (adjacent) â€” `AiCameraPage`
13. Catalog Pricing â€” `PricingPage`
14. Discounts module â€” **Placeholder**
15. Printing / Devices â€” hardware
16. Tax / FBR â€” enterprise page (not POS calc UI)

---

# 20. Recommended Future Architecture

**Do not implement now.**

```
POS UI (fullscreen shell)
  â†’ thin hooks
  â†’ domain services only
  â†’ repository ports
       â”œâ”€ OnlineAdapter (APIâ†’Supabase)
       â””â”€ OfflineAdapter (SQLite)  // same operations interface
  â†’ SyncCoordinator (outbox, idempotency, conflict UI)
```

- One `PosRepositoryPort` for search/cart-post/hold/return.
- Web offline either: Electron-only policy **or** WASM/SQLite/OPFS adapter â€” donâ€™t pretend `navigator.onLine` alone is enough.
- Harden `postSale` as single Postgres RPC / stored procedure for draftâ†’posted.

---

# 21. Recommended UI Structure

**Do not implement now.**

- Fullscreen POS mode (no ERP AppShell).
- Three columns: Products | Cart | Pay/Customer.
- Secondary routes (Returns, Sales Mgmt, Salesman) share POS tokens.
- Merge Invoices into Sales Management tabs.
- Delivery stay under Logistics but linked from sale detail.

---

# 22. Recommended POS Module Structure

```
features/pos/
  terminal/          PosPage + panels
  returns/
  sales-register/    merge invoices + management
  commission/
  session/           hooks + adapters
  design-system/     keep
domain pos-*         keep as single calculation authority
```

Remove placeholder `/discounts` or implement policy admin against existing domain.

---

# 23. Priority Classification

### P0 â€” Critical / integrity
1. Web POS cannot sell/hold/search products offline despite offline messaging/cache for customers.
2. Sale finalization not single DB transaction (orphan/partial write risk under crash).
3. Payment methods for wallets record success without PSP verification.

### P1 â€” Major functionality
4. Promotion / quantity / customer prices in domain but not loaded by `searchProducts`.
5. Discount stacking (customer/promo/bulk) mostly unused by POS UI.
6. Invoice PDF/WhatsApp/Email are stubs/handoffs.
7. Delivery create after sale can fail independently; GPS tracking absent (honest) but UI may imply more.
8. `/discounts` placeholder; `/held-sales` duplicate route.

### P2 â€” Major UX/UI
9. Dual navigation chrome on POS.
10. Returns/Sales Mgmt/Invoices not on POS design system.
11. Crowded payment panel; missing voice search & product imagery.
12. Invoices vs Sales Management overlap.

### P3 â€” Minor
13. Deprecated PosSidebar/PosHeader aliases.
14. React Router future warnings.
15. lint â‰¡ typecheck only.

---

# 24. Recommended Restructure Order

**Do not implement now.**

1. **Phase A â€” Integrity:** DB transactional sale finalize; clarify web offline policy (disable checkout offline or add real offline adapter).
2. **Phase B â€” Wire pricing/discounts:** Repo returns promo/qty/customer; UI stacking; server-side approval enforcement review.
3. **Phase C â€” Register UX:** Merge invoices into sales management; fix held-sales route; POS fullscreen shell.
4. **Phase D â€” Documents:** Real PDF; keep wa.me/mailto until integrations exist.
5. **Phase E â€” Payments honesty:** Label wallet methods as â€œrecord onlyâ€ or integrate PSPs.
6. **Phase F â€” Delivery tracking:** Only when provider chosen.
7. **Phase G â€” Deduplicate chrome/components.**

---

# 25. "DO NOT TOUCH" LIST

Stable pieces that should **not** be casually rewritten:

1. **`SaleTransactionService`** draftâ†’finalizeâ†’compensate model (extend with RPC; donâ€™t fork a second poster).
2. **`calculateSaleTotals` / `calculatePosCartTotals` layering** â€” already centralized.
3. **`discount-policy.ts` approval ladder** â€” matches required thresholds.
4. **`resolvePosUnitPrice` priority rules** â€” wire inputs; donâ€™t invent second pricing engine.
5. **Hold inventory invariant** (`holdMustNotReduceInventory`).
6. **`PaymentAttemptGate` + idempotency keys**.
7. **`pos-commission.ts` accrual/return/void/payment rules**.
8. **`NullDeliveryTrackingAdapter` honesty** â€” do not fake GPS.
9. **RLS org policies + keeping SERVICE_ROLE off the web client**.
10. **POS design tokens / design-system** as the visual base for terminal (extend, donâ€™t replace with purple-gradient AI defaults).
11. **OfflinePosEngine outbox approach on desktop** â€” improve sync; donâ€™t dual-write business rules in UI.
12. **Domain return preparation / reason codes** â€” already aligned with requirements.

---

# Appendix A â€” Online/Offline Feature Matrix

| Feature | Online | Offline (web) | Offline (desktop) | Sync | Conflict handling | Status |
|---------|--------|---------------|-------------------|------|-------------------|--------|
| Login | Yes | Limited | First-run needs online | â€” | â€” | PART |
| Product search | Yes | No | Yes if catalog synced | Pull | Version/reconcile | PART |
| Customer search | Yes | Cache | SQLite | Push/pull | â€” | PART |
| Add product / cart | Yes | Memory only | Memory | â€” | â€” | PART |
| Pricing | Tier+manual | Same memory | Same | â€” | â€” | PART |
| Discounts | Yes | Memory | Memory | On sale sync | â€” | PART |
| Tax | Session rate | Memory | Memory | On sale | â€” | PART |
| Hold | Yes | No | Schema/engine support | Pending | â€” | PART |
| Resume | Yes | No | PART | â€” | â€” | PART |
| Sale | Yes | No | Yes + outbox | Idempotent | transaction_reconcile | PART |
| Payment | With sale | No | Outbox payment | Yes | reconcile | PART |
| Invoice | Yes | No | Local OFF-# | On sync | â€” | PART |
| Stock update | Yes | No | Movement events | Yes | reconcile | PART |
| Customer balance | Yes | No | Via sync sale | Yes | â€” | PART |
| Returns | Yes | No | Engine postReturn | Yes | reconcile | PART |
| Exchanges | Yes | No | PART | â€” | â€” | PART |
| Reports | Yes | No | No | â€” | â€” | Online only |
| Delivery | Yes | No | No | â€” | â€” | Online |
| Commission | Yes | No | Likely on sync post | â€” | â€” | Online primary |

---

# Appendix B â€” Offline failure behaviors (web POS)

| Event during outage | Actual behavior |
|---------------------|-----------------|
| Product search | API error / empty â€” does not use SQLite |
| Add product | Only if already in memory/recent/favorites |
| Create customer | Can save to localStorage cache |
| Hold sale | API fail |
| Complete sale | API fail; PaymentAttemptGate may mark failure |
| Payment | Same as sale |
| Invoice generation | Fail (needs posted sale) |
| Return / exchange | API fail |
| Stock update | Does not run locally on web |

Desktop: outage after provisioning â†’ OfflinePosEngine queues; sync later with idempotency.

---

# Appendix C â€” Maturity scores (/10)

| Area | Score | Why |
|------|-------|-----|
| Architecture | 7 | Clear monorepo + domain ports; web/desktop offline split incomplete |
| UI | 6 | POS terminal good; other sales screens drift |
| POS Workflow | 7 | Solid online cashier path |
| Cart | 8 | Domain-driven, tested |
| Pricing | 5 | Engine yes; repo/UI wiring incomplete |
| Discounts | 6 | Ladder OK; stacking/admin incomplete |
| Tax | 6 | Domain solid; FBR/enterprise separate |
| Customers | 7 | Online strong; offline cache limited |
| Payments | 6 | Split/credit good; wallets record-only |
| Invoices | 5 | Preview OK; PDF/share stubs |
| Returns | 7 | Strong domain + UI wizard |
| Hold/Resume | 8 | Lifecycle + inventory invariant |
| Sales Management | 7 | Real KPIs/filters/export |
| Commission | 7 | Domain + page + migration |
| Delivery | 5 | Lifecycle yes; tracking placeholder |
| Offline | 4 | Desktop yes; web mostly no |
| Online | 8 | Primary path mature |
| Synchronization | 5 | Engine exists; ops maturity uneven |
| Database | 7 | Rich schema + RLS; need transactional finalize |
| Security | 7 | Good secret hygiene; multi-step write risk |
| Testing | 6 | Domain tests strong; thin UI E2E |
| Deployment readiness | 6 | Vercel/Electron scripts exist; env-sensitive |
| **Overall** | **6.4** | Capable online POS ERP module; not yet a complete online/offline parity product |

---

*End of audit. No application code was modified. Only this report file was created/updated.*
