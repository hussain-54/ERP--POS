# POS Hold / Resume audit

Date: 2026-08-20  
Scope: Hold current sale → park snapshot → resume → checkout. No new UI system.

## Verdict

Hold / Resume is a first-class POS workflow on the existing POS design system (`HeldSalesPage`, `PosHoldsPanel`, `POS*` primitives).

A hold **parks a full transaction snapshot** (cart lines + discounts + tax + session payment state). It **never** posts stock. Resume **replaces** the New Sale cart (never concatenates) and restores the same totals fields. Checkout uses the normal `SaleTransactionService.postSale` path.

Duplicate resume is blocked by a CAS update (`status = held` → `resumed`). Concurrent cashiers cannot resume another cashier’s hold without `pos.resume_any`.

---

## Authoritative call chain

```
New Sale (PosPage)
  → add products / customer / discount
  → Hold (F2 / HoldSaleButton / PosHoldsPanel)
       buildHoldSnapshot(v1)     // exact transaction state
       POST /api/v1/pos/holds
       PosRepository.holdSale    // sales.status=held + held_sales row; no stock
       clearSale()
  → Hold / Resume page (HeldSalesPage) or drawer
       list holds (auto-expire due rows)
       Resume / Resume & Checkout
       POST /api/v1/pos/holds/:id/resume   // CAS held → resumed
       navigate /pos with resumeSnapshot
  → PosPage.applyHoldSnapshot → restoreHoldTransaction
  → PAY NOW → postSale (stock + payment + posted)
```

| Concern | Canonical code |
|---------|----------------|
| Snapshot build / restore | `buildHoldSnapshot` / `restoreHoldTransaction` — `packages/domain/src/pos-hold.ts` |
| Lifecycle / filters | `classifyHeldSale`, `filterHeldSales`, `assertHoldActionAllowed` |
| Server hold / resume | `PosRepository.holdSale` / `resumeHeldSale` |
| Hold / Resume page | `apps/web/src/features/pos/HeldSalesPage.tsx` (POS design system) |
| New Sale hold/resume | `PosPage.holdBill` / `applyHoldSnapshot` / `resume` |

---

## Snapshot fields (exact restore)

| Field | Held |
|-------|------|
| Hold number | `hold_label` (e.g. `Hold 3:15:02 PM` / `HOLD-…`) |
| Customer | `customer_id` + snapshot `customerId` / `customerName` |
| Cashier | `held_by` |
| Items / qty / prices / discounts / tax | Full cart lines in `cart_snapshot.cart` |
| Invoice discount | `invoiceDiscount`, `invoiceDiscountKind`, `invoiceDiscountPercent` |
| Total | Frozen `totals` at hold time (+ recomputed on resume for checkout) |
| Hold reason / notes | `hold_reason`, `notes` |
| Timestamp | `held_at`, `expires_at`, snapshot `heldAtClient` |
| Status | `held` \| `resumed` \| `expired` \| `cancelled` \| `discarded` |
| Payments / cash / installment / advance | Snapshot session fields |
| Locale / mode / price level / salesman / delivery | Snapshot session fields |

Resume restores every session field above via `restoreHoldTransaction`. Display prefers frozen `totals` when present so the Hold page shows the parked grand.

---

## Status matrix

| Status / bucket | Resume | Notes |
|-----------------|--------|-------|
| Active (`held`, not near expiry) | Yes (owner or `pos.resume_any`) | Default pending |
| Expiring (`held`, within 2h of expiry) | Yes | Warning badge |
| Expired (`held` past `expires_at` or status `expired`) | No | Discard / duplicate; list auto-flips via `expireDueHolds` |
| Cancelled | No | Closed |
| Resumed | No | Duplicate resume rejected |
| Discarded | No | Closed |

---

## Concurrency & duplicate resume

1. **CAS resume** — `UPDATE held_sales SET status='resumed' WHERE id=? AND status='held'`. Second caller gets “already closed”.
2. **Ownership** — `assertHoldActionAllowed` blocks other cashiers unless `pos.resume_any`.
3. **Client busy** — `HeldSalesPage` / `PosPage.resume` ignore re-entry while `busy`.
4. **Cart replace** — `cartLinesForResume` / `replaceCart`; never append.

Hold itself does not reduce inventory (`holdMustNotReduceInventory`).

---

## Workflow verified (automated)

File: `packages/domain/src/pos-hold-workflow.test.ts`

`New Sale → products → customer → discount → hold snapshot → resume restore → postSale`

- Restored unit price / line discount / tax / invoice discount / grand match hold-time totals  
- Stock posts **once** at checkout after resume  
- Second resume on `resumed` status throws  
- Expiring / expired / cancelled gates covered  

Also: `pos-hold.test.ts`, `held-sales.test.ts`, `held-sales-page.test.tsx` (POS design system chrome).

---

## What was hardened in this pass

1. **Full transaction snapshot (v1)** — discounts kind/%, cash tender, installment/advance, salesman/commission, locale/mode, frozen totals, customer name.  
2. **`restoreHoldTransaction`** — single restore path for New Sale.  
3. **Hold detail** — hold time + expiry on the POS detail pane.  
4. **Duplicate resume** — busy guards + existing CAS / status gates covered by tests.  
5. **Display totals** — prefer frozen snapshot totals on the Hold page.

---

## Remaining limitations

1. **List API** returns pending `held` / `expired` only — closed resumed/cancelled rows are not in the default register (by design).  
2. **Edit Hold** from the page updates label/reason/notes; cart re-park from New Sale edit uses prompts (drawer) — not a second editor UI.  
3. **TTL** defaults to 24h (`DEFAULT_HOLD_TTL_MS`); org-specific TTL is not yet a setting.  
4. **Resume & Checkout** still defers `checkout()` with `setTimeout(0)` so React state commits — same pattern as before.
