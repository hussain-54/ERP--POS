# PHASE 2 â€” POS REQUIREMENTS vs CODEBASE AUDIT (Part 1)

**Mode:** AUDIT ONLY â€” no code/schema/UI changes.
**Scope:** Requirement **01. POS MAIN SCREEN** vs current online POS codebase.
**Phase 1C foundation:** Treated as complete and unchanged.

**Status vocabulary**

| Status | Meaning |
|--------|---------|
| IMPLEMENTED | UI + usable domain/API path |
| PARTIAL | Present but incomplete / stubbed / missing a major facet |
| MISSING | Not found in POS main path |
| BACKEND-ONLY | Contracts/domain support without POS data feed or UI |
| UI-ONLY | Control without working hardware/backend |

---

## Executive summary

The POS main screen (`PosPage` + panels + session + `PosRepository`) is a working online terminal for **search â†’ cart â†’ customer â†’ pay â†’ hold â†’ invoice preview**.

**Strong:** name/Urdu/SKU/barcode/brand search, cart totals, walk-in/named customers, retail/wholesale/dealer pricing, cash/split/credit/installment, hold lifecycle, salesman commission accrual, A4/80mm/58mm preview.

**Weak vs requirements:** voice search; real camera/QR; customer/qty/promo prices not returned by search; item % discount UI; remote multi-user approval; real PDF; loyalty earn/redeem on sale.

Interactive matrix: canvas `phase2-pos-main-screen-audit.canvas.tsx`.

---

## Coverage snapshot (Part 1 scored rows)

| Bucket | Count (approx.) |
|--------|-----------------|
| IMPLEMENTED | ~48 |
| PARTIAL | ~28 |
| MISSING | ~2 |
| BACKEND-ONLY | ~3 |
| UI-ONLY | ~1 |

---

## 01. POS MAIN SCREEN â€” matrix

### Global Search

| Requirement | Status | Evidence | Gap |
|-------------|--------|----------|-----|
| Product Name | IMPLEMENTED | `PosProductPanel` + `PosRepository.searchProducts` `name.ilike` | â€” |
| Urdu Name | IMPLEMENTED | `name_ur.ilike` + locale display | Single free-text field |
| SKU/ID | IMPLEMENTED | `sku.ilike` | â€” |
| Barcode/QR | PARTIAL | barcodes/qr_codes + USB wedge | Camera QR stub |
| Brand/Model | IMPLEMENTED | brands taxonomy filter | Model not first-class facet |
| Category | PARTIAL | Taxonomy browse + name re-search | No direct `categoryId` POS search |
| Voice Search | MISSING | â€” | No SpeechRecognition path |

### Quick Actions

| Requirement | Status | Evidence | Gap |
|-------------|--------|----------|-----|
| Camera Recognition | PARTIAL | `recognizeCamera` / AI + NullCamera | Fills search; often null camera |
| Barcode Scanner | IMPLEMENTED | `hardware.ts` USB wedge | Focus-dependent |
| Manual Entry | PARTIAL | `addManualQuick` | Needs existing line `unitId` |
| Recent Products | IMPLEMENTED | localStorage recent tab | Client-only |

### Cart / Summary

| Requirement | Status | Notes |
|-------------|--------|-------|
| Product list, qty, line total, subtotal/discount/tax/grand/item count | IMPLEMENTED | `PosCartPanel`, `calculatePosCartTotals` |
| Unit selection | PARTIAL | Only when multiple `unitOptions` |
| Line discount | PARTIAL | Fixed money only; no % UI |
| Line tax | PARTIAL | Calculated, read-only; no tax picker |

### Customer

| Requirement | Status | Notes |
|-------------|--------|-------|
| Walk-in, search, create, name/mobile/email/address, price tier | IMPLEMENTED | `PosCustomerPanel` |
| Credit limit / outstanding | IMPLEMENTED | `evaluatePosCustomerCredit` |
| History | PARTIAL | Ledger drawer, not full sales UI |
| CNIC | PARTIAL | Create + masked display; edit blank = keep |
| Loyalty | PARTIAL | Points badge only; no redeem/earn on sale |

### Pricing

| Requirement | Status | Notes |
|-------------|--------|-------|
| Retail / Wholesale / Dealer | IMPLEMENTED | Price level select |
| Manual override | IMPLEMENTED | RBAC dialog |
| Customer / Qty / Promo price | BACKEND-ONLY | Domain fields; search does not enrich |

### Discount + Approval

| Requirement | Status | Notes |
|-------------|--------|-------|
| Item fixed; invoice %/fixed | IMPLEMENTED / PARTIAL | Invoice via payment panel |
| Item % | MISSING | No cart % control |
| Customer/promo/bulk kinds | PARTIAL | In contracts/domain, not cart tools |
| Ladder &lt;5% / 5â€“10% / 10â€“20% / 20â€“50% / &gt;50% | IMPLEMENTED | `discount-policy.ts` limits | Local RBAC, not remote approver workflow |

### Tax

| Requirement | Status | Notes |
|-------------|--------|-------|
| Sales tax / GST / exemption / tax invoice | PARTIAL | Default enterprise tax rate; GST heuristic; A4 â€œTax Invoiceâ€ label |

### Payments / Installment / Confirmation

| Requirement | Status | Notes |
|-------------|--------|-------|
| Cash, bank, card, JazzCash, Easypaisa, SadaPay, credit | IMPLEMENTED | Seeded methods + chips |
| Full / partial / split / advance | IMPLEMENTED | Split advanced-mode |
| Installment fields | IMPLEMENTED | Advanced + nonâ€“walk-in |
| Print / digital / PSP verify | PARTIAL | Thermal/print + UX; no gateway OTP |

### Reference / Salesman / Controls / Invoice

| Area | Status | Notes |
|------|--------|-------|
| Reference person select | IMPLEMENTED | `referenceId` on sale |
| Reference name/mobile/code/type on POS | PARTIAL | Types managed on SalesmanPage |
| Salesman + commission rate/amount | IMPLEMENTED / PARTIAL | Accrual on sale; pay UI elsewhere |
| Hold/resume/discard/clear/cancel | IMPLEMENTED | Verified in Phase 1C |
| Remote approval / duplicate posted / full audit viewer / recalc prices | PARTIAL | Local dialogs; hold duplicate only |
| A4 / 80mm / 58mm | IMPLEMENTED | `ReceiptPreview` |
| WhatsApp / Email | PARTIAL | Deep-links |
| PDF / Save | PARTIAL | `.txt` download, not real PDF / not server save |

---

## Priority gaps (Part 1 only)

1. **P0** â€” Voice search missing
2. **P0** â€” Camera QR / recognition incomplete
3. **P1** â€” Customer / qty / promo prices not fed from search
4. **P1** â€” Item % discount UI missing
5. **P1** â€” Remote multi-user discount approval workflow
6. **P2** â€” PDF is text download
7. **P2** â€” Loyalty earn/redeem on POS

---

## Main entry evidence paths

- `apps/web/src/features/pos/PosPage.tsx`
- `apps/web/src/features/pos/components/*`
- `apps/web/src/features/pos/session/*`
- `packages/contracts/src/sale.ts`
- `packages/domain/src/pos-*.ts`, `discount-policy.ts`
- `packages/db/src/repositories/pos-repository.ts`
- `apps/api/src/routes/pos.ts`

---

**STOP for Part 1.** Send the next requirement sections (Part 2+) to continue the audit-only comparison. No implementation in this phase.
