# PHASE 1 — POS / Sales Codebase Audit (Read-Only)

**Date:** 2026-08-11  
**Scope:** Audit only. No POS rebuild, no functional changes in this phase.  
**Source of truth for gaps:** Target requirement list (1–97) vs current monorepo code.

---

## 1. Current POS architecture

```
Web UI (apps/web)
  features/pos/*  →  pos-api.ts  →  Express /api/v1/pos
                                        ↓
                              PosRepository (packages/db)
                                        ↓
                         SaleTransactionService (packages/domain)
                                        ↓
              stock / ledger / payments / journal / commission / warranty / installment

Desktop (apps/desktop)
  OfflinePosEngine → SQLite outbox
  SyncCoordinator + HttpCloudTransport → POST /api/v1/sync/push|pull
  SyncRepository.push → PosRepository.postSale / postReturn (apply before ack)
```

**Principle:** UI must not duplicate sale side effects; cloud sales go through `SaleTransactionService` ports.

**AppShell:** `/pos` and `/held-sales` render full-bleed POS chrome (ERP sidebar hidden). Other Sales routes use standard ERP shell.

---

## 2. Existing POS routes

| Route | Implementation | Notes |
|-------|----------------|-------|
| `/pos` | `PosPage` | Main terminal |
| `/held-sales` | `PosPage` | Same page; hold list inside terminal |
| `/invoices` | `InvoicesPage` | History + receipt preview |
| `/returns` | `ReturnsPage` | Guided return/exchange |
| `/salesman` | `SalesmanPage` | Lists HR salesmen + commission summary |
| `/payments` | `PaymentsPage` | Parties split-payment UI (not POS tender) |
| `/credit`, `/installments` | `CreditInstallmentsPage` | UUID-heavy forms |
| `/deliveries` | `DeliveriesPage` | Delivery notes lifecycle |
| `/reports` | `ReportsHubPage` | Includes sales reports |
| `/offline-pos` | `OfflinePosStatusPage` | Electron sync status; thin on web |
| `/discounts` | Placeholder | Not implemented |
| `/quotations` | After-sales | Can convert to invoice via PosRepository |

**API (`/api/v1/pos`):** search, sales CRUD-ish, holds, returns, shifts (see §3).

---

## 3. Existing POS components

| File | Role |
|------|------|
| `PosPage.tsx` | Terminal orchestration |
| `PosSidebar.tsx` | POS IA + cash drawer summary |
| `PosHeader.tsx` | Branch, online, shift, mode, locale, shortcuts |
| `PosProductPanel.tsx` | Search/grid, recent, favorites, categories |
| `PosCustomerPanel.tsx` | Walk-in / search customer, price level, salesman, delivery |
| `PosCartPanel.tsx` | Lines, qty, price, discount, manual |
| `PosPaymentPanel.tsx` | Totals, splits, credit, installment, hold/pay |
| `PosApprovalDialog.tsx` | Manager override (session RBAC, no PIN) |
| `ReceiptPreview.tsx` | 80/58/A4 + WhatsApp/email/print |
| `InvoicesPage.tsx` | Sales list + preview |
| `ReturnsPage.tsx` | Invoice lookup → lines → return |
| `SalesmanPage.tsx` | Salesman list + commissions JSON |
| `pos-api.ts` / `pos-types.ts` / `pos-tokens.css` / `hardware.ts` | Client boundary, helpers, tokens, hardware adapters |

---

## 4. Existing business logic

| Area | Location | Status |
|------|----------|--------|
| Sale totals | `packages/domain/src/sale-totals.ts` | Working |
| Sale orchestration | `sale-transaction.ts` | Working; **not ACID** |
| Discount limits | `discount-policy.ts` | Cashier 5% / manager 15% / owner ∞ |
| API discount RBAC | `apps/api/src/routes/pos.ts` | Server rewrites `approverRole` |
| Split payment | `split-payment.ts` + parties repo | Working |
| Walk-in payments | sale-transaction (no customerId) | Working; must pay in full |
| Installments | domain + CreateSale `createInstallment` | Working when POS sends it |
| Holds | PosRepository held_sales | Working (cloud) |
| Returns | PosRepository.postReturn | Working |
| Commission | sale_commissions via ports | Working if salesman + % |
| Tax on cart | Default `tax_rates` in PosPage | Partial |
| Product search | PosRepository.searchProducts | Multi-field search |
| Cash shifts | PosRepository + `pos_cash_shifts` | Code ready; migration must be applied |

---

## 5. Existing database tables (POS-related)

| Table | Migration |
|-------|-----------|
| `sales`, `sale_items`, `sale_discount_audits` | `20260810000005_pos_sales.sql` |
| `held_sales` | same |
| `sale_returns`, `sale_return_items` | same |
| `sale_commissions`, `sale_warranties`, `sales_analytics_events` | same |
| `payment_methods`, `payments`, `payment_splits`, `payment_receipts` | `20260810000004_parties_payments.sql` |
| `price_levels`, `product_prices` | `20260810000002_product_master.sql` |
| `tax_rates`, `tax_profiles`, `tax_documents` | `20260810000015_…` |
| Loyalty tables | `20260810000013_…` (not POS-wired) |
| `pos_cash_shifts` | `20260812000001_pos_cash_shifts.sql` |
| Sync: devices, outbox acks, change_log, conflicts | `20260810000010_offline_sync_engine.sql` |
| Hardware print jobs / events | `20260810000011_hardware_printing.sql` |

---

## 6. Existing Supabase integration

- Auth + RLS org scoping for business tables  
- User JWT client for POS/API repositories (`createUserClient`)  
- Service role used for auth bootstrap / some auth fallbacks (not primary POS path)  
- POS writes are multi-statement Supabase calls (no single RPC transaction)

---

## 7. Existing SQLite integration

- `packages/offline` LocalDatabase + schemas (POS, parties, inventory, sync)  
- Desktop: `better-sqlite3` via `apps/desktop/src/db/bootstrap.ts`  
- Offline sales/returns/payments enqueue outbox with idempotency keys  

---

## 8. Existing offline architecture

- `OfflinePosEngine.postSale` → SQLite sale + stock events + outbox  
- Hold offline: schema/store present; **not** fully wired through desktop IPC as primary path  
- Web POS is **online-first** (API); Electron owns true offline  

---

## 9. Existing online architecture

- React/Vite web → Express API → Supabase Postgres  
- POS terminal uses same-origin / configured API  
- Related modules: parties (payments/credit), purchases (deliveries), enterprise (tax/HR), reporting  

---

## 10. Existing sync mechanism

| Piece | Path | Behavior |
|-------|------|----------|
| SyncCoordinator | `packages/offline/src/sync-coordinator.ts` | Push/pull batches |
| HttpCloudTransport | `packages/sync/src/http-cloud.ts` | Bearer push/pull |
| Desktop | `apps/desktop/src/sync-runtime.ts` | Starts after provision (`sync.apiUrl` + token) |
| SyncRepository.push | `packages/db/.../sync-repository.ts` | **Applies** `sales` / `sale_returns` via PosRepository **before** ack |
| Standalone payment outbox apply | — | **Not** applied in push (sale-embedded payments only) |

---

## 11–15. Missing / partial / broken / duplicates / conflicts

### Missing (selected)
Voice search, loyalty on POS, quantity breaks, promotion engine, customer-specific price picker, late fees, GPS delivery, dedicated advance deposit UI, `/discounts` module, manager PIN vault, true PDF library, atomic sale RPC, offline hold as first-class desktop path, sync apply for standalone payments.

### Partial
Tax (org default only), categories (N+1 name search), session-only manager approval, installment frequency/late fee fields, invoice payment lines empty in `getInvoice`, hardware Memory/Null adapters, `/held-sales` not a dedicated management page, reference person field thin, credit/installments standalone pages UUID-heavy.

### Broken / unsafe relative to enterprise claims
- **Non-atomic cloud sale chain** (sequential writes)  
- Claiming offline-first **production** without verifying Electron provision + sync round-trip  
- Cash shifts fail at runtime if migration not applied  

### Duplicates / conflicts
- Online `SaleTransactionService` vs offline `OfflinePosEngine` (intentional dual persistence)  
- Older in-memory `pos-store.ts` vs production engine  
- MemoryCloudTransport (tests) vs HttpCloudTransport (desktop)  
- `/pos` and `/held-sales` → same `PosPage`  

---

## 16–17. TypeScript / build errors

Quick `tsc --noEmit` for `apps/web` and `apps/api`: **no TypeScript errors reported** in this audit pass.  
Runtime/config risks ≠ compile errors (migration not applied, camera host not configured).

---

## 18–20. UI / responsive / performance

| Area | Finding |
|------|---------|
| UI consistency | POS navy/blue tokens scoped; rest of ERP teal — intentional |
| Responsive | Terminal grid stacks on smaller widths; sidebar hamburger on mobile |
| Performance | Category browse can N+1 search; invoice getInvoice resolves product names per line; no virtualized huge grids |

---

# POS REQUIREMENTS MATRIX (1–97)

Legend: **E** = Existing/working · **P** = Partial · **M** = Missing · **B** = Broken/unsafe

| # | Requirement | Status | File / Location |
|---|-------------|--------|-----------------|
| 1 | POS Main Screen | E | `PosPage.tsx` + components; AppShell POS mode |
| 2 | Global product search | E | `PosRepository.searchProducts`; PosProductPanel |
| 3 | Product name search | E | searchProducts |
| 4 | Urdu name search | E | searchProducts (`name_ur`) |
| 5 | SKU/ID search | E | searchProducts |
| 6 | Barcode/QR search | E | searchProducts + barcodes; scanner sets `q` |
| 7 | Brand/model search | E | searchProducts fields |
| 8 | Category search | P | Taxonomy browse + weak N+1 name search; not first-class category filter API on POS search |
| 9 | Voice search | M | No speech recognition wiring |
| 10 | Camera recognition | P | AI recognize + hardware camera ports; often unconfigured on web |
| 11 | Barcode scanner | P | USB wedge memory adapter works; dedicated hardware incomplete |
| 12 | QR scanner | P | Same search path; camera QR host-dependent |
| 13 | Manual entry | E | PosCartPanel / addManualQuick |
| 14 | Recent products | E | localStorage recent |
| 15 | Favorites | E | ★ + localStorage |
| 16 | Categories | P | Category chips; product load fragile |
| 17 | Cart | E | PosCartPanel |
| 18 | Quantity management | E | Cart qty inputs |
| 19 | Unit selection | P | Unit from product; no mid-cart unit switcher |
| 20 | Price display | E | Grid + cart |
| 21 | Item discount | E | Cart line discount + API RBAC |
| 22 | Invoice discount | E | Payment panel + approval gate |
| 23 | Customer discount | M | No auto customer discount policy on POS |
| 24 | Promotion discount | P | Schema kind `promotion`; no promo engine UI |
| 25 | Bulk discount | M | No bulk/qty-break discount UI |
| 26 | Tax calculation | P | Default tax_rates exclusive/inclusive on lines |
| 27 | Customer selection | E | PosCustomerPanel search |
| 28 | Walk-in customer | E | Walk-in mode + payment rules |
| 29 | Existing customer | E | parties list/get |
| 30 | New customer | M | No create-customer dialog on POS (use /customers) |
| 31 | Customer history | M | Not on POS terminal (customers module) |
| 32 | Credit limit | P | Shown in advanced panel; not hard-blocked in UI beyond payment credit path |
| 33 | Outstanding | P | Displayed when loaded |
| 34 | Loyalty points | M | Loyalty module exists; not POS-wired |
| 35 | Price tier | E | retail/wholesale/dealer select |
| 36 | Retail price | E | pickPrice |
| 37 | Wholesale price | E | pickPrice |
| 38 | Dealer price | E | pickPrice |
| 39 | Customer-specific price | P | DB supports; POS does not apply |
| 40 | Quantity pricing | M | No qty breaks |
| 41 | Promotion pricing | M | No promo price engine |
| 42 | Manual price override | E | Cart + approval dialog |
| 43 | Discount approval | P | Session RBAC dialog; no PIN/re-auth |
| 44 | Tax exemption | P | tax_rates.is_exempt if default exempt; not per-customer UI |
| 45 | Tax invoice | P | Receipt/invoice layouts; FBR not live |
| 46 | Cash payment | E | payment_methods cash |
| 47 | Bank transfer | E | bank method seed |
| 48 | Card payment | E | card |
| 49 | JazzCash | E | jazzcash kind |
| 50 | Easypaisa | E | easypaisa |
| 51 | SadaPay | E | sadapay |
| 52 | Credit/Udhar | E | allowCreditDue + credit method |
| 53 | Installment | E | createInstallment on sale (advanced) |
| 54 | Full payment | E | quick pay = grand |
| 55 | Partial payment | E | with customer |
| 56 | Split payment | E | PosPaymentPanel |
| 57 | Advance payment | P | Installment down payment only; no deposit wallet |
| 58 | Installment schedule | P | Domain creates schedule; POS does not preview schedule grid |
| 59 | Down payment | E | Payment panel field |
| 60 | Installment count | E | Payment panel field |
| 61 | Frequency | M | Not exposed on POS (defaults in domain/API) |
| 62 | Due dates | P | Domain startDate; no full schedule editor on POS |
| 63 | Monthly amount | M | Not calculated/displayed on POS |
| 64 | Late fee | M | No late-fee model on POS |
| 65 | Payment confirmation | P | Toast + receipt; no dedicated verify workflow |
| 66 | Receipt printing | P | Thermal/A4 via Memory/Null adapters |
| 67 | Digital receipt | E | On-screen ReceiptPreview |
| 68 | Payment verification | M | No bank ref verification UI |
| 69 | Reference person | P | notes/reference fields historically; thin on new UI |
| 70 | Salesman | E | HR salesmen select |
| 71 | Commission | E | commissionPercent on postSale |
| 72 | Hold sale | E | posApi.hold |
| 73 | Resume sale | E | resumeHold |
| 74 | Cancel sale | E | Clear sale / F8 (pre-post); no void posted invoice on POS |
| 75 | Manager approval | P | PosApprovalDialog session perms |
| 76 | Price override | E | Cart + approval |
| 77 | Duplicate invoice | P | Idempotent re-post; no clone-prior-invoice UI |
| 78 | Recalculate | P | Live cart totals; no posted-invoice recalc |
| 79 | Clear cart | E | F7 / Clear |
| 80 | Invoice generation | E | postSale invoice number |
| 81 | A4 invoice | E | ReceiptPreview a4 |
| 82 | 80mm receipt | E | receipt_80 |
| 83 | 58mm receipt | E | receipt_58 |
| 84 | WhatsApp invoice | E | wa.me share |
| 85 | Email invoice | E | mailto body |
| 86 | PDF invoice | P | Text download + browser print-to-PDF (no PDF lib) |
| 87 | Save invoice | E | Persisted sale row |
| 88 | Sales history | E | InvoicesPage listSales |
| 89 | Sales search | E | Invoice # filter on InvoicesPage |
| 90 | Sales reports | E | Reports hub (separate module) |
| 91 | Sales return | E | ReturnsPage + postReturn |
| 92 | Sales exchange | E | returnType exchange |
| 93 | Return stock update | E | Return service restocks via domain/repo |
| 94 | Hold/resume management | P | List in POS; no dedicated hold reports page |
| 95 | Salesman/reference management | P | SalesmanPage list; CRUD in HR; reference thin |
| 96 | Commission management | P | Summary via HR commissions API; no full commission admin on POS |
| 97 | Delivery management | P | Create note from POS; manage on /deliveries; **no GPS** |

---

## Summary counts (approx.)

| Status | Count (of 97) |
|--------|----------------|
| E Existing | ~52 |
| P Partial | ~32 |
| M Missing | ~12 |
| B Broken/unsafe claim | 1 primary (non-atomic sale) + ops risks |

---

## Recommended implementation order (do not start until Phase 1 approved)

1. **Ops harden** — Apply `pos_cash_shifts` migration; verify tax_rates default; Electron re-provision for sync.apiUrl.  
2. **Honesty / risk** — Atomic sale RPC (or documented acceptance); void/cancel posted sale policy.  
3. **POS search UX** — True category filter API; fix N+1; optional voice later.  
4. **Customer on POS** — New customer dialog; history drawer; enforce credit limit UX.  
5. **Pricing** — Customer-specific + qty breaks + promotions (domain first).  
6. **Installment UX** — Schedule preview (frequency, monthly, due dates); late fee only if schema added.  
7. **Loyalty** — Wire points earn/redeem to sale ports (do not duplicate).  
8. **Hold management** — Dedicated hold board/reports; offline hold IPC.  
9. **Printing** — Real ESC/POS adapters; proper PDF if required.  
10. **Delivery** — Assign rider UX; **STOP** on GPS until hardware/ports exist.  
11. **Discounts module** — `/discounts` policies UI bound to existing audit keys.  
12. **Tests** — API e2e sale/hold/return/sync apply; desktop sync round-trip.

---

## STOP rules for next phases

- Do **not** rewrite `SaleTransactionService` blindly.  
- Do **not** create a second POS sale writer.  
- Do **not** fake GPS, FBR live filing, or ACID without an RPC/txn.  
- Preserve contracts, RBAC keys, offline outbox model.

**Phase 1 complete. Stop here — awaiting approval before rebuild/implementation.**
