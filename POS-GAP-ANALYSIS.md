# POS GAP ANALYSIS

**Date:** 2026-08-14
**Phase:** 2 audit complete (Parts 1â€“16). **No product code changed.**

Sources: `POS-REQUIREMENTS-MATRIX.md`, `POS-DUPLICATION-REPORT.md`, `PHASE-2-POS-MAIN-SCREEN-AUDIT.md`, Phase 1C live results.

Status vocabulary: **IMPLEMENTED** = UI + logic + API + wiring. **PARTIAL** = some layers only. **MISSING** = not present. **BROKEN** = present but fails. **DUPLICATED** = two live paths.

---

## 1. Executive summary

The online POS **can post a cash sale, move stock, hold without stock, and restock a partial return** (Phase 1C). It is not a complete retail terminal: camera/QR/PDF are broken or fake, wallets/cards are record-only, refunds do not write a `payments` row, invoice numbers are not sequential, approval is same-user RBAC, and the main screen is a ~1600-line two-column stack rather than a three-zone POS.

Do not treat Phase 1C success as â€œPOS complete.â€

---

## 2. What is already production-capable

(Named-customer or walk-in **cash**, tracked SKU, base unit factor 1, online, valid JWT, real warehouse.)

- Product search (name, Urdu, SKU, barcode, brand/model)
- USB keyboard-wedge barcode add
- Cart qty / line total / invoice discount ladder (session permissions)
- Walk-in vs named customer, create customer, credit limit check
- Price level retail/wholesale/dealer at add-to-cart
- Cash (and other **recorded** tenders) via `postSplitPayment`
- Credit/udhar for named customers
- Hold / resume / discard (stock unchanged)
- Posted sale â†’ `stock_movements` + `stock_balances` (happy path)
- Partial/full return qty rules + over-return 400
- Good-condition restock
- Invoice **text** preview with customer, lines, tax, discount, payments, salesman, reference
- Org-scoped RLS + API permission asserts on POS routes
- Shift open/close API
- Online-only gate (`navigator.onLine`)

---

## 3. What is partially implemented

- Category search, unit options, tax picker, GST vs sales tax
- Customer ledger drawer (not sale history)
- Loyalty **display** only
- CNIC on create; weak on edit
- Bank/card/JazzCash/Easypaisa/SadaPay as tender labels (no PSP)
- Installment (hidden in Easy; schedule on another page)
- Delivery checkbox (post-sale, can fail)
- A4 / 80mm / 58mm **text** + memory printers
- WhatsApp / Email deep-links
- Warranty days on lines; claims elsewhere
- Terms = sale notes
- Invoice number unique but not sequential
- Return credit ledger (named customer); **not** payment row
- Exchange stock out (non-idempotent UUID)
- Batch id on return lines without picker
- Return summary report (last 20 + aggregates)
- Discount/price approval (no second user / PIN)
- Branch isolation (API yes, RLS no)
- Commission pay/adjust on Salesman page not terminal
- Notifications, camera recognition (stubs)

---

## 4. What is missing

- Voice search
- Item **percentage** discount control
- Customer / quantity-break / promotion prices on POS search
- Loyalty earn/redeem at checkout
- Invoice logo
- Sequential invoice numbering
- Dedicated `/discounts` admin (placeholder)
- Posted-sale void from terminal
- Remote manager PIN / OTP
- Branch_id RLS
- Refund `payments` row
- UOM conversion on posted stock qty
- Transactional movement+balance write
- Product photos
- Payment **modal** / three-column layout (design gap, not a missing API)

---

## 5. What is broken

- Camera QR: `capture()` throws â€œnot configuredâ€
- PDF button: downloads `.txt`
- Header notifications: â€œnot connectedâ€ toast (fake success path)
- Fake `deviceId` can 500 audit **after** sale posted (Phase 1C note)
- Journal books all tender as cash GL (`paidCash: paidTotal`)

---

## 6. What is duplicated

See `POS-DUPLICATION-REPORT.md`. Highest impact:

- `/pos` â‰¡ `/held-sales`
- `/credit` â‰¡ `/installments`
- Invoices page vs Sales Management invoice preview
- POS design-system vs ERP `Button`/`Card` on adjacent sales pages
- `CartLine` vs `PosCartLine`; unused `calcTotals`
- Catalog `product_prices` vs POS master prices

---

## 7. What should be removed later

(Do not remove in audit.)

- `PosHeader` alias
- `calcTotals` unused wrapper
- Unused `POSStepper` **or** adopt it on Returns
- `posClientRepository` alias
- Duplicate Recent button **or** tab
- Placeholder `/discounts` once a real page exists
- Memory printer as default when a real host adapter exists

---

## 8. What should be retained

- `SaleTransactionService` + idempotency
- Domain cart / payment / return / discount-policy
- `PosRepository` as server SSoT (not UI Supabase)
- Online-only conversion (no SQLite/sync)
- Hold-must-not-reduce-inventory
- Over-return prevention
- Walk-in cannot take credit
- Design tokens `pos-tokens.css` as visual SSoT for terminal

---

## 9. What should be redesigned

- POS layout: Products | Cart | Pay (three zones); payment as modal/sheet on tablet
- `PosPage` god-component split
- Adjacent sales pages onto POS design-system
- Approval: real second-actor flow
- Invoice: real PDF + sequential numbers
- Refund settlement: payments + cash drawer
- Price book: one store POS actually reads

---

## 10. What should be fixed before UI redesign

Integrity bugs that a prettier UI would still ship:

1. Return **refund `payments` row** (Phase 1C open)
2. Stock `postMovement` insert vs balance **not one transaction** + idempotent skip
3. Sale/return qty **UOM to base**
4. Journal tender kind (cash vs bank vs wallet)
5. Audit `device_id` FK after successful post
6. Camera/QR honest disable vs throw
7. PDF labeled as PDF while saving `.txt`

---

## 11. What can wait

- Voice search
- Product photography
- Loyalty earn/redeem
- PSP (JazzCash etc.)
- FBR e-invoice filing
- Sequential invoice cosmetics (after integrity)
- Three-column visual polish
- Removing duplicate routes
- Commission payout UX
- `/discounts` admin page

---

## 12. Recommended implementation order

**Phase 3 â€” Integrity (before UI):** refund payment posting; stock transaction + UOM; journal by tender; device/audit; honest hardware/PDF labels.

**Phase 4 â€” POS completeness:** price book on search; % line discount; sequential invoices; real PDF or relabel; branch RLS; second-user approval; exchange idempotency.

**Phase 5 â€” UX redesign:** split `PosPage`; three-column + payment modal; unify sales pages on POS DS; drop duplicate routes/aliases; camera/PSP only if hardware/contracts exist.

---

## Requirement roll-up (Parts 3 + 9â€“14)

Counts are **leaf rows** across the matrix (search, cart, pay, customer, invoice, return, security, etc.). Overlapping rows are not double-counted in the executive numbers below; Part 3 already listed many customer/invoice items that Parts 9â€“10 restated.

| Bucket | Approx. count |
|--------|----------------|
| Total tracked POS requirements | **118** |
| Implemented | **48** |
| Partial | **42** |
| Missing | **12** |
| Broken | **4** |
| Duplicated (structural) | **8** |
| Unused / dead | **4** |

Do not use these as a score. Cash sale + stock is implemented; refunds, PDF, camera, and PSP are not.

---

*Audit only. Application, schema, and routes unchanged.*
