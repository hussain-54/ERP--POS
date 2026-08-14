# ONLINE ARCHITECTURE PROTECTION (STEP 3)

**Created:** 2026-08-12
**Status:** Protection inventory only â€” **no code deleted, no new architecture created.**
**Companion docs:** `OFFLINE-CODE-DEPENDENCY-MAP.md`, `OFFLINE-CODE-CLASSIFICATION.md`

---

## 1. Protected target architecture (ALREADY EXISTS)

This is the **current production online path**. It must be preserved. Do not invent a parallel stack.

```
React (apps/web)
  â†“
POS / ERP UI  (features/pos/*, features/parties/*, â€¦)
  â†“
Session hooks + *Api clients  (usePosSession, posApi, partiesApi, â€¦)
  â†“
HTTP  /api/v1/*  (apps/api Express)
  â†“
Authz + route handlers
  â†“
Domain services  (packages/domain â€” SaleTransactionService, preparePosPayments, â€¦)
  â†“
Online repositories  (packages/db â€” PosRepository, PartiesRepository, â€¦)
  â†“
Supabase JS client  (user JWT via createUserClient)
  â†“
Supabase / PostgreSQL   â† ONLY production data source
```

**Electron (`apps/desktop`)** may host the same web UI / hardware bridges, but **must not** introduce a second business database. After offline removal, desktop is a shell around the same online API â†’ Supabase path.

---

## 2. Single source of truth

| Concern | Authority | Forbidden |
|---------|-----------|-----------|
| Persistent business data | **Supabase PostgreSQL** | Second SQLite â€œsource of truthâ€, dual-write of sales |
| Business rules (totals, discounts, tax, payments, holds, returns, commission) | **`packages/domain`** | Re-implementing math in React or a new â€œonline serviceâ€ package |
| Persistence / SQL access | **`packages/db` repositories** | New duplicate `*Repository`, direct Supabase from every React component for POS writes |
| API surface | **`apps/api` `/api/v1/*`** | Parallel GraphQL/BFF that re-posts sales |
| Contracts / Zod shapes | **`packages/contracts`** | Forked DTO packages for â€œonline v2â€ |
| Auth session | Supabase Auth + `AuthContext` / API JWT | Separate offline auth store as production identity |

---

## 3. Preserve â€” Online UI (React)

### 3.1 POS feature (keep)

| Component / module | Role |
|--------------------|------|
| `apps/web/src/features/pos/PosPage.tsx` | Terminal orchestration |
| `components/PosCartPanel`, `PosProductPanel`, `PosPaymentPanel`, `PosCustomerPanel`, `PosHoldsPanel` | POS panels |
| `ReceiptPreview`, `PosApprovalDialog` | Invoice preview / discount approval UI |
| `ReturnsPage`, `InvoicesPage`, `SalesManagementPage`, `SalesmanPage` | Sales satellite screens |
| `design-system/*` | POS chrome (tokens, layout, controls) |
| `pos-api.ts` | HTTP client to `/api/v1/pos` |
| `session/usePosSession.ts` | Cart/customer session â†’ **domain** helpers |
| `session/pos-customer-repository.ts` | Online customer via `partiesApi` (strip leftover offline concepts in Step C later) |
| `session/pos-repository.ts` | Alias to `posApi` â€” **keep**, do not replace with a new repo |
| `pos-types.ts`, `pos-tokens.css`, `hardware.ts` | Types / tokens / hardware adapters |

### 3.2 Related online ERP UI used by POS

| Module | Client | Backend |
|--------|--------|---------|
| Customers / payments / credit | `parties-api` | `/api/v1/parties` |
| Deliveries | `purchases-api` | `/api/v1/purchases` |
| Catalog search support | `catalog-api` | `/api/v1/catalog` |
| Auth | `auth-service`, `AuthContext` | `/api/v1/auth` + Supabase Auth |
| Reports | reporting APIs | `/api/v1/reports` |

### 3.3 App shell (keep; edit only for route cleanup later)

- `apps/web/src/app/router.tsx`
- `apps/web/src/app/modules.ts`
- `apps/web/src/app/shell/AppShell.tsx`
- `apps/web/src/lib/api.ts` (`apiFetch`)
- `apps/web/src/lib/env.ts`, `lib/supabase.ts` (browser Supabase for auth)

---

## 4. Preserve â€” Domain / business services

**Do not create a second domain layer.** Extend these files if needed; do not fork.

### POS / sales domain (protected)

| File | Responsibility |
|------|----------------|
| `sale-transaction.ts` | **Canonical** sale post orchestration (draft â†’ stock â†’ pay â†’ finalize) |
| `sale-totals.ts` | Grand total math |
| `sale-finalization.ts` | Invoice document / print text |
| `sale-management.ts` | Sales management summary helpers |
| `pos-cart.ts` | Cart mutations + `calculatePosCartTotals` |
| `pos-pricing.ts` | Unit price resolution |
| `pos-discount.ts` | Discount apply / stack helpers |
| `discount-policy.ts` | Approval ladder |
| `pos-tax.ts` | Tax inclusive/exclusive |
| `pos-payment.ts` | Payment prep + `PaymentAttemptGate` |
| `pos-hold.ts` | Hold lifecycle (inventory invariant) |
| `pos-return.ts` | Return preparation |
| `pos-customer.ts` | Customer mode / credit helpers |
| `pos-commission.ts` | Commission accrual / pay / return adjust |
| `pos-validation.ts` | Checkout validation |
| `credit.ts` / split-payment helpers | Credit & splits |
| `delivery-lifecycle.ts` / `delivery-tracking.ts` | Delivery (Null adapter OK) |
| `money.ts` / `errors.ts` | Shared money + errors |

### Supporting domain used by online POS

- Accounting posting helpers used by sale transaction
- Authorization (`AuthorizationService`)
- Audit trail builders

**Rule:** UI must call domain (directly or via API that calls domain). Never copy total/tax/discount formulas into components again.

---

## 5. Preserve â€” Online repositories / Supabase access

### 5.1 Existing Supabase clients (keep; do not replace)

| Location | Function | Use |
|----------|----------|-----|
| `packages/db/src/client.ts` | `createBrowserSupabaseClient`, `createServiceSupabaseClient` | Shared client factory |
| `apps/api/src/lib/supabase.ts` | `createUserClient`, `createAnonClient`, `createServiceClient` | **API â†’ Supabase with user JWT** (primary online writes) |
| `apps/web/src/lib/supabase.ts` | Browser client wrapper | Auth/session in web |

### 5.2 Online repositories (keep â€” one per aggregate)

| Repository | Package path | Used by |
|------------|--------------|---------|
| `PosRepository` | `packages/db/.../pos-repository.ts` | `apps/api` pos routes |
| `PartiesRepository` | `parties-repository.ts` | parties routes |
| `CatalogRepository` | `catalog-repository.ts` | catalog |
| `InventoryRepository` | `inventory-repository.ts` | inventory |
| `PurchasesRepository` | `purchases-repository.ts` | purchases/deliveries |
| `ReportingRepository` | `reporting-repository.ts` | reports |
| `AccountingRepository` | `accounting-repository.ts` | journals from sales |
| `AdminRepository` | `admin-repository.ts` | RBAC/branches |
| `AfterSalesRepository` | `after-sales-repository.ts` | quotes/service |
| Others (commerce, AI, enterprise, hardware, infrastructure) | respective files | their routes |

**Do NOT:**

- Create `OnlinePosRepository` / `SupabasePosRepository2`
- Have React call Supabase for sale posting while API also posts
- Move POS writes into a new microservice package without retiring `PosRepository`

### 5.3 Explicitly NOT part of protected online POS write path

| Item | Note |
|------|------|
| `SyncRepository` | Offline sync only (Class A) â€” removable later; **not** the POS write path |
| `packages/offline` LocalDatabase | Not online |
| `OfflinePosEngine` | Not online |

---

## 6. Preserve â€” API routes (online)

| Router | Mount | Protect |
|--------|-------|---------|
| `auth.ts` | `/api/v1/auth` | Yes |
| `pos.ts` | `/api/v1/pos` | **Yes â€” primary POS** |
| `parties.ts` | `/api/v1/parties` | Yes |
| `catalog.ts` | `/api/v1/catalog` | Yes |
| `inventory.ts` | `/api/v1/inventory` | Yes |
| `purchases.ts` | `/api/v1/purchases` | Yes (incl. deliveries) |
| `reports.ts` | `/api/v1/reports` | Yes |
| `accounting.ts` | `/api/v1/accounting` | Yes |
| `admin.ts` | `/api/v1/admin` | Yes |
| `after-sales.ts` | `/api/v1/â€¦` | Yes |
| `hardware.ts` | hardware | Yes |
| `commerce`, `ai`, `enterprise`, `infrastructure` | respective | Yes |
| `health.ts` | health | Yes |
| **`sync.ts`** | `/api/v1/sync` | **Not required for online POS** â€” Class A; unmount later |

Middleware to preserve: `requireAuth`, authz asserts, error handler.

Config to preserve: `apps/api/src/config.ts` Supabase URL/anon/service role (service role **server-only**).

---

## 7. Preserve â€” Contracts (online schemas)

Keep Zod contracts used by online POS/API:

- `packages/contracts/src/sale.ts` (incl. `idempotencyKey` â€” **critical**)
- `payment.ts`, `party.ts`, `product.ts`, `catalog.ts`, `stock.ts`, `purchase.ts`
- `authz.ts`, `audit.ts`, reporting/commerce as used

Optional offline-oriented fields (`offlineTransactionId`, `syncState`) may remain on shared schemas harmlessly until a careful schema cleanup; **do not delete whole contract modules** to â€œremove offline.â€

`packages/contracts/src/sync.ts` â€” sync-API only (review in Class D/A later); **not** required for online POS sale path.

---

## 8. Preserve â€” PostgreSQL / migrations (online business)

**Do not replace** the existing Supabase schema with a greenfield design.

Protected migration families (business data):

- Foundation / orgs / branches / users
- Product master, inventory, parties/payments
- **POS sales** (`â€¦005_pos_sales.sql` and follow-ons: cash shifts, pricing/discount perms, holds, returns, payments, commission, â€¦)
- Purchases / warehouse / deliveries
- Accounting, RBAC, reporting, etc.

**Schema caution:** Columns like `sync_state` / `offline_transaction_id` are written by the **online** `SaleTransactionService` as `'synced'`. They are Class B shared columns â€” leave in place unless a dedicated migration + code update is planned.

---

## 9. Anti-duplication checklist (enforced for later steps)

When removing offline or â€œsimplifyingâ€ online:

| Temptation | Required response |
|------------|-------------------|
| New `services/online-pos.ts` that posts sales | **No** â€” use `SaleTransactionService` + `PosRepository` |
| React â†’ Supabase direct insert into `sales` | **No** â€” keep `posApi.postSale` â†’ API â†’ repository |
| Copy `calculateSaleTotals` into UI | **No** â€” use domain |
| Second payment preparer | **No** â€” `preparePosPayments` |
| Second hold table writer | **No** â€” existing hold APIs on `PosRepository` |
| New sync-less â€œlocal repositoryâ€ for web | **No** â€” online only via API |
| Rebuild Electron with embedded Postgres | **No** â€” Electron uses same API/Supabase |

---

## 10. Connectivity vs data source

| Mechanism | Role after online-only | Protected? |
|-----------|------------------------|------------|
| `navigator.onLine` on PosPage | UX gate so cashiers donâ€™t attempt API calls offline | Optional UX â€” **not** a data source |
| Supabase | **Data source** | **Yes** |
| SQLite / outbox | Must not remain a production data source | Not protected |

---

## 11. Protected online POS call chain (canonical)

```
PosPage.checkout()
  â†’ preparePosPayments / validatePosCheckout / PaymentAttemptGate   [domain]
  â†’ posApi.postSale(...)                                            [web client]
  â†’ POST /api/v1/pos/sales                                          [api]
  â†’ authz.assert("pos.sell")
  â†’ PosRepository.postSale â†’ SaleTransactionService.postSale        [db + domain]
  â†’ Supabase tables: sales, sale_items, stock_*, payments, â€¦        [PostgreSQL]
  â†’ optional purchasesApi.createDelivery                            [same pattern]
```

Any future change must keep this chain intact (or intentionally migrate **all** callers in one step â€” never dual stacks).

---

## 12. What Step 3 does **not** do

- Does not delete offline packages
- Does not unmount sync routes yet
- Does not create new repositories or services
- Does not redesign POS UI
- Does not change Supabase project structure
- Does not drop database columns

---

## 13. Step 3 status

- [x] Target online architecture documented as **existing** path
- [x] Online UI / domain / repos / API / contracts / schema listed for preservation
- [x] Anti-duplication rules recorded
- [x] Sync/offline explicitly excluded from protected POS write path
- [ ] Ready for Step 4 (convert C / remove A) when instructed

---

*End of online architecture protection.*
