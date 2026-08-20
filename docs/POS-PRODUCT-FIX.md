# POS Product Creation & Availability Fix

**Date:** 2026-08-20  
**Scope:** Product creation + POS availability only (no POS UI redesign)  
**Source audit:** `docs/POS-MATURITY-AUDIT.md`

---

## 1. Goal

A user/admin must be able to create a new product and immediately use it inside POS:

- Search finds the product (SKU / name / product code / barcode)
- Add to cart succeeds
- Quantity change / remove work
- Duplicate SKU / barcode are rejected with clear errors
- Missing required fields are rejected with clear errors
- No full-page reload required for POS search to see the new product

---

## 2. Exact root cause

### Failure chain (before fix)

```
ProductFormPage
  → catalogApi.createProduct
  → CatalogRepository.createProduct  (insert products + barcode; NO stock_balances)
  → POS search (warehouse selected)
  → PosRepository.searchProducts
       stockAvailable = balances[0]?.qtyAvailable ?? "0"   ← BUG
  → usePosSession.addProduct(stock: "0")
  → addOrIncrementProduct / assertStockAvailable
       throws "Product is out of stock"
```

### Why this is an architecture bug (not a UI bug)

1. **Missing `stock_balances` ≠ zero stock.**  
   New products have no inventory row until a purchase/opening movement. The search layer coerced “no row” to `"0"`, which the cart correctly treats as out of stock.

2. **Contract already said so.**  
   `ProductSearchResult.stockAvailable` is optional and documented as: omit when stock is unknown. The repository violated that contract.

3. **Secondary create-path issues**
   - Spec / barcode / QR inserts did not check Supabase errors (silent partial creates)
   - Unique violations often surfaced as opaque 500s
   - Client had loading state but weak local validation and swallowed barcode refresh errors on update
   - POS search did not include `product_code`, so code-based lookup could miss new products
   - No catalog change signal → open POS did not refetch after create in another route

---

## 3. Architecture fix (not a patch)

### A. Canonical product creation — `CatalogRepository.createProduct`

Single create path (API + CSV import already used this; no duplicate create implementations added).

Changes:

1. Validate required identity fields (org, code, SKU, name, base unit)
2. Pre-check SKU / product code / barcode uniqueness → `ConflictDomainError` (HTTP 409)
3. Insert product; require a returned ID
4. Insert specs / attributes / barcode / QR with **`throwIfDbError`** (no silent swallow)
5. Initialize `stock_balances` slots for every **active** warehouse (qty 0, `last_movement_at` null) via `InventoryRepository.getOrCreateBalance`
6. On related-row failure: delete children + product (no half-created orphan)
7. Map PostgREST unique / FK errors via `mapSupabaseError`

### B. Correct POS stock semantics — `resolvePosSearchStockAvailable`

| Balance state | POS `stockAvailable` | Cart behavior |
|---------------|----------------------|---------------|
| No row | omitted (`undefined`) | Add allowed |
| Row exists, never moved, qty 0 | omitted | Add allowed |
| Row exists after movements, qty > 0 | `"N"` | Add within stock |
| Row exists after movements, qty 0 | `"0"` | Blocked as out of stock |

Implemented in `packages/domain/src/pos-stock-availability.ts` and used by `PosRepository.searchProducts`.

### C. POS search discoverability

- Search also matches `product_code`
- Active products only (`is_active = true`)
- Newest first (`order updated_at desc`)
- Barcode / QR query errors are thrown (not ignored)

### D. Live invalidation without full reload

- `notifyCatalogChanged()` / `CATALOG_CHANGED_EVENT` after create/update
- `PosPage` bumps `catalogEpoch` → current search refetches
- `ProductsPage` reloads the current list page query  
- Does **not** download the entire product catalog

### E. Form / API error UX

- Client `validateProductForm` before submit
- Guard against double submit (`if (saving) return` + disabled button)
- Field-level errors on required inputs
- Zod errors formatted as readable field messages (not bare “Validation failed”)
- Duplicate SKU/barcode → clear conflict message
- Update barcode generation failures are shown (no longer swallowed)

---

## 4. Files changed

| File | Change |
|------|--------|
| `packages/domain/src/errors.ts` | `ConflictDomainError` |
| `packages/domain/src/pos-stock-availability.ts` | Stock unknown vs zero semantics |
| `packages/domain/src/pos-stock-availability.test.ts` | Unit tests |
| `packages/domain/src/pos-cart.engine.test.ts` | Unknown stock add allowed |
| `packages/domain/src/index.ts` | Export stock helper |
| `packages/contracts/src/catalog.ts` | Trim / blank UUID / clearer required messages |
| `packages/db/src/supabase-error.ts` | Map 23505/23503 → domain errors |
| `packages/db/src/supabase-error.test.ts` | Unit tests |
| `packages/db/src/repositories/catalog-repository.ts` | Canonical create + uniqueness + stock slots |
| `packages/db/src/repositories/pos-repository.ts` | Stock semantics + search improvements |
| `packages/db/src/index.ts` | Export supabase-error helpers |
| `apps/api/src/middleware/error-handler.ts` | Zod message + unique-violation fallback |
| `apps/web/src/features/product-management/product-form-validation.ts` | Client validation |
| `apps/web/src/features/product-management/product-form-validation.test.ts` | Unit tests |
| `apps/web/src/features/product-management/ProductFormPage.tsx` | Loading, errors, notify |
| `apps/web/src/features/product-management/catalog-api.ts` | Catalog change event |
| `apps/web/src/features/product-management/ProductsPage.tsx` | Listen / refetch |
| `apps/web/src/features/pos/PosPage.tsx` | Listen / refetch search |

Unrelated ERP modules were not redesigned.

---

## 5. What was intentionally NOT done

- POS visual redesign
- Rewriting N+1 POS search joins (performance phase)
- Fake / mock product data
- Auto-posting opening stock qty > 0 (would invent inventory)
- Allowing checkout of never-received stock (sale still requires available qty at post time; cart add is unblocked)

**Note on checkout:** Completing a sale still enforces real warehouse availability. Brand-new products can be searched, added, qty-changed, and removed. Receiving stock (purchase / opening) is still required before a posted sale deducts inventory successfully when warehouses disallow negative stock. That is correct inventory integrity — not a create-path bug.

---

## 6. Verification commands

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run lint` (= typecheck) | **PASS** (exit 0) |
| `npm run build --prefix apps/api` | **PASS** |
| `npm run build --prefix apps/web` | **PASS** (Vite production build) |
| Domain unit tests (cart + stock semantics) | **19 passed** |
| DB unit tests (supabase error mapping) | **5 passed** |
| Web unit tests (product form validation) | **3 passed** |

---

## 7. Manual test matrix (TEST 1–12)

These require a running API + authenticated ERP session against the real Supabase project. Do **not** use mock products.

| # | Test | How to verify | Expected |
|---|------|---------------|----------|
| 1 | Create product | Products → New product → fill Product Code, SKU, Name, Base Unit → Create | Toast “Product created”; redirects to `/products/{uuid}`; UUID present |
| 2 | Refresh POS | Open POS terminal (same session; no forced hard reload needed if catalog event fired) | POS loads; warehouse selected |
| 3 | Search product | Type new SKU / name / product code / barcode | Product appears in results; stock shows `—` until received |
| 4 | Add to cart | Click product / Enter | Line added; no “out of stock” |
| 5 | Change quantity | +/- or qty edit | Qty updates |
| 6 | Remove product | Remove line | Line gone |
| 7 | Create another unique SKU | New product with different SKU/code | Succeeds |
| 8 | Duplicate SKU | Create with existing SKU | 409 / toast “A product with this SKU already exists” |
| 9 | Duplicate barcode | Create with existing primary barcode | 409 / toast “A product with this barcode already exists” |
| 10 | Missing required fields | Clear Name / SKU / Unit and submit | Client validation toast + field errors; no API write |
| 11 | Verify Supabase data | Check `products`, `barcodes`, `stock_balances` for new `product_id` | Product row + primary barcode; balance slots per active warehouse with qty 0 / null `last_movement_at` |
| 12 | POS can use new product | Search → add → qty → remove (and optionally hold) | Full cart path works without reload |

---

## 8. Requirements checklist

| # | Requirement | Status |
|---|-------------|--------|
| 1 | One canonical create service/repository | Done — `CatalogRepository.createProduct` |
| 2 | Remove/consolidate duplicates | Confirmed single path (API + import) |
| 3 | Correct TypeScript types | Done |
| 4 | Validate required fields | Client + Zod + repository |
| 5 | SKU uniqueness | Pre-check + DB unique → 409 |
| 6 | Barcode uniqueness | Pre-check + DB unique → 409 |
| 7 | Org / branch / warehouse / category / brand | Org required; category/brand optional FKs; warehouse slots initialized |
| 8 | Returned product has valid ID | Asserted after insert |
| 9 | Available without full-page reload | Catalog event + POS refetch |
| 10 | Search finds new product | product_code + barcode + active filter |
| 11 | Inventory relationships valid | `stock_balances` slots created |
| 12 | Explicit Supabase errors | `throwIfDbError` / `mapSupabaseError` |
| 13 | Never silently swallow DB errors | Specs/barcode/QR/stock checked; update barcode toast |
| 14 | Meaningful user errors | Conflict + validation messages |
| 15 | Prevent duplicate submission | `saving` guard + disabled button |
| 16 | Loading state | Existing Button `loading` retained |
| 17 | Invalidate/refetch product queries | `CATALOG_CHANGED_EVENT` |
| 18 | Do not fetch entire product DB | Search-limited refetch only |
| 19 | Do not modify unrelated ERP modules | Scoped to catalog/POS product availability |

---

## 9. Summary

The “Add New Product then use in POS” failure was caused by **treating missing inventory as zero stock**. The fix restores the intended contract: unknown stock is omitted, zero stock after real movements still blocks, product creation is a single hard-failing repository path with uniqueness and explicit Supabase errors, and POS/list UIs refetch on catalog change without a full reload.
