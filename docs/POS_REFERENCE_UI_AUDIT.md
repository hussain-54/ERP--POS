# POS Phase 0 — Reference UI Architecture Audit

**Date:** 2026-08-21  
**Status:** Read-only. **No application code was modified.**  
**Reference (source of truth):** `c:\Users\Black Scorpion\Downloads\pos-dashboard.html`  
**Rule:** POS remains inside the 39-module ERP shell (`AppShell` → `ModuleWorkspace` → `POSShell`). Do not create a standalone POS app.

---

## Executive verdict

The live NEW POS already implements the reference **zones** (dark terminal nav, status header, product discovery, cart/checkout, F1–F8) with a real domain sale engine. It does **not** yet match the reference **visual density, geometry, or chrome nesting**.

Largest gaps:

1. **Dual chrome** — ERP `GlobalSidebar` + POS navy rail (reference has one rail).
2. **Terminal nav labels** — live uses Resume Sale / Invoices / Shift; reference uses Hold / Resume / Reports / Settings.
3. **Right column** — not fixed ~500px; totals not 2-column; payment grid not 5-col with icon tiles.
4. **Hold UX** — terminal Hold button vs navigating to `HeldSalesPage` for “Resume Sale”.

Domain math (`pos-cart` → `sale-totals` → `SaleTransactionService`) must stay the single source of truth during any UI alignment.

---

## 1. Current POS architecture

```
AppShell
  ├── GlobalSidebar          (always present; 280px or 72px collapsed)
  ├── GlobalHeader           (hidden on POS paths)
  └── ModuleWorkspace
        └── POSShell         (when isPosEnvironmentPath)
              ├── POSHeader
              ├── POSTerminalNav
              ├── POSWorkspace → route page
              └── POSShortcutBar
```

Evidence: `apps/web/src/app/shell/AppShell.tsx`, `ModuleWorkspace.tsx`, `features/pos/design-system/POSShell.tsx`.

---

## 2. Current POS entry route

| Role | Path | Component |
|------|------|-----------|
| Canonical terminal | `/pos` | `PosPage` |
| Alias | `/pos/new` | `PosPage` |
| Focus aliases | `/pos/quick-sale`, `product-search`, `customer-selection`, `barcode-scanner`, `split-payment` | `PosTerminalFocusPage` → `/pos?focus=…` |

Module **02 POS / SALES** owns 26 IA children in `modules.ts` / `POS_IA_TITLES`. Terminal operational nav is separate (`POS_TERMINAL_NAV`, 7 links).

---

## 3. Current POS components (zone map)

| Reference zone | Live files |
|----------------|------------|
| Dark sidebar + cash drawer | `POSTerminalNav.tsx`, `pos-ownership.ts` (`POS_TERMINAL_NAV`) |
| Top header | `POSHeader.tsx` |
| Product search / tools / tabs / grid | `PosProductPanel.tsx`, `PosDiscoveryTools.tsx` |
| Right cart / customer / pay | `PosSaleLayout.tsx`, `PosCustomerPanel`, `PosCart`, `PosPaymentPanel` |
| Totals | `PosTotals.tsx` |
| PAY / HOLD / QUOTATION | `PayNowButton`, `HoldSaleButton`, `QuotationButton` |
| F1–F8 footer | `POSShortcutBar.tsx`, `pos-types.ts` |
| Orchestration | `PosPage.tsx` |

---

## 4. Current POS state management

- Cart / customer / discounts / tax: `usePosSession` → domain `pos-cart` / `calculatePosCartTotals`.
- Terminal UI: large local state in `PosPage`.
- Shell status (holds, shift, drawer summary): `usePosShellStatus`.
- Favorites / recent: `localStorage`.
- No Redux/Zustand.

---

## 5. Current API integration

`pos-api.ts` → `apps/api/src/routes/pos.ts` (`/api/v1/pos/*`): product search, sales post, holds lifecycle, invoices, returns, shifts, coupons, cash movements, day close. Also parties, inventory, catalog, enterprise, after-sales, hardware clients.

---

## 6. Current database integration

`packages/db/.../pos-repository.ts` → Supabase (`sales`, `held_sales`, products, shifts, coupons, cash movements, etc.). Posting: `SaleTransactionService`. Holds store `cartSnapshot`.

---

## 7. Existing POS functionality (works)

- Product search / add / recent / favorites / categories / View More  
- Exact barcode/SKU add (no fuzzy first-hit)  
- Walk-in + customer search/create; price tier; salesman/reference; delivery flag  
- Line + invoice discounts with RBAC / approvals  
- Coupons (validate → invoice discount; server re-checks)  
- Multi-tender, credit, installment gates  
- Hold create + resume (`replaceCart`, no append)  
- Quotation from cart  
- Shift / cash in-out / day closing pages  
- Receipt preview; online-required; F1–F8  

---

## 8. Missing vs reference

| Reference | Live gap |
|-----------|----------|
| Single full-viewport POS chrome | Extra ERP GlobalSidebar |
| Nav: Hold / Resume, Reports, Settings | Resume Sale, Invoices, Shift |
| Full-bleed blue POS brand bar | Compact brand mark |
| Fixed 500px cart column | Fluid grid column |
| Payment grid 5 columns + FA icons | 3 columns + emoji |
| Totals 2-column matrix + blue grand box | Single-column stack |
| Editable Delivery / Round Off pens | Delivery flag; round-off posts 0 |
| Loyalty points chip | Incomplete / permission-gated |
| Bell badge count | Link only |
| Profile photo | Initials |
| Live QR / Camera | Disabled (honest) |
| Offline | Staged only |

---

## 9. Broken / HIGH risk

1. Dual sidebars compress the register on 1366×768.  
2. `posSidebarCollapsedByDefault` exists but terminal nav does not collapse on tablet.  
3. “Resume Sale” navigates off the sale canvas to `HeldSalesPage`.  
4. Close Shift may land on `/sales-management` alias vs `/pos/shift`.  
5. Branch chip shows UUID slice, not branch display name.  
6. Sticky payment dock can crush cart scroll when installment/split expands.  
7. `PosPage` is a large regression surface (~2.4k lines).  
8. `docs/POS_ARCHITECTURE_AUDIT.md` is partially stale vs live 26-child IA.

---

## 10. Duplicate / legacy POS

**No second POS application.** Aliases only: `/pos/new`, `/held-sales`, `/sales-management`, focus redirects, hub stubs. One cart/posting engine for terminal + Quick Sale focus.

---

## 11. UI differences from reference (detail)

| Area | Reference | Live | Sev |
|------|-----------|------|-----|
| Sidebar | `w-48`, `#0d1527`, blue brand, 7 links | `--pos-navy #0f1b33`, 14rem, different labels | HIGH |
| Header | `h-16`, gray chips | 3.25rem, primary underline | MEDIUM |
| Product grid | Always 3-col icon tiles, `rounded-xl` | 2–4 cols, photo/initial, tighter radius | MEDIUM |
| Cart rows | Card grid columns | HTML table + Total column | MEDIUM |
| Totals | 2-col + blue grand box | Stack + blue grand text | MEDIUM |
| Payment | 5-col FA icons | 3-col emoji | MEDIUM |
| Footer | Split F1–4 / F5–8 | Wrapped bar, same F-keys | LOW |
| Colors | Tailwind blue-600 / gray-100 | `pos-tokens.css` close but denser | MEDIUM |

---

## 12. Scroll / layout problems

- Outer `overflow-hidden` on POS paths — aligned with reference intent.  
- Product + cart internal scroll — present.  
- Reference: one right panel `overflow-y-auto`; live: customer / cart / payment split, payment `shrink-0`.  
- Header can horizontal-scroll on narrow widths.  
- Mobile sheets + shortcut bar compete for height.  
- **ERP + POS sidebars** = largest structural layout delta.

---

## 13. Performance problems

- ~9 bootstrap APIs on mount (cached/deduped).  
- Shell holds list + PosPage holds when drawer open.  
- Heavy `PosPage` re-render surface.  
- Favorites/recent localStorage writes.  
- Search is multi-wave but batched (better than legacy N+1).

---

## 14. Product-add problems

- Domain stock gates work; failures via `lastCartError` / catalog feedback.  
- Exact barcode match — good; misses need clear UX.  
- QR/Camera disabled.  
- Unit options depend on search payload completeness.

---

## 15. Discount problems

- Line + invoice + coupon with RBAC — live.  
- Reference “Apply Discount” is a simple affordance; live uses amount/`10%` input + approvals.  
- Payment panel invoice-discount props largely unused (`void`).

---

## 16. Hold / resume problems

- Snapshot hold/resume integrity is strong.  
- Reference treats Hold/Resume as same-environment nav; live Resume Sale route leaves terminal.  
- Two UIs: in-terminal drawer vs full Held Sales page.

---

## 17. Payment problems

- Methods from DB seed — empty if not seeded (reference hardcodes 9 tiles).  
- Fail-closed credit/installment — correct.  
- Split/installment expand payment dock — layout pressure.  
- Confirm modal + idempotency present.

---

## 18. Responsive / mobile problems

- Sheets &lt;768; stack 768–1023; split ≥1024.  
- Terminal nav does not auto-collapse on tablet.  
- Unit/Tax columns hide ≤1023px.  
- Two navigation models (ERP Menu + POS nav).

---

## 19. Recommended final POS architecture

```
AppShell
  GlobalSidebar     ← collapsed-by-default on POS paths; Menu expands
  ModuleWorkspace
    POSShell
      POSHeader           ← reference chips
      POSTerminalNav      ← exactly 7 reference links → live routes
      POSWorkspace
        PosPage           ← sole sale canvas
        sibling pages     ← holds register, shift, invoices… (26 IA)
      POSShortcutBar
```

Principles:

- Stay inside 39-module ERP.  
- One `SaleTransactionService`.  
- 26 IA children in ERP nav; 7 operational links in POS terminal nav.  
- Prefer in-terminal hold drawer for F2 / HOLD; keep Held Sales page for management.  
- Match reference layout hierarchy/spacing/colors without inventing fake data or second engines.

---

## 20. Files that should be modified (after approval)

**Shell / IA**

- `apps/web/src/app/shell/AppShell.tsx`
- `apps/web/src/features/pos/pos-ownership.ts` (`POS_TERMINAL_NAV`)
- `apps/web/src/app/modules.ts` (Close Shift target consistency only if needed)

**Visual / layout**

- `pos-tokens.css`, `POSShell`, `POSHeader`, `POSTerminalNav`, `POSShortcutBar`, `POSWorkspace`
- `PosSaleLayout.tsx`, `pos-layout.ts`, `usePosLayoutMode.ts`

**Sale canvas**

- `PosPage.tsx` (orchestration only; prefer not to rewrite math)
- `PosProductPanel`, `PosDiscoveryTools`, `PosCustomerPanel`
- `PosCart`, `PosCartRow`, `PosTotals`
- `PosPaymentPanel`, `PaymentMethodGrid`

**Tests / docs**

- Shell / layout / ownership / smoke tests  
- Refresh stale `docs/POS_ARCHITECTURE_AUDIT.md` if still used as SoT

**Usually leave alone:** `packages/domain/**`, `apps/api/src/routes/pos.ts`, `packages/db/.../pos-repository.ts` unless a proven bug.

---

## 21. Files that should be deleted (obsolete only)

**None confirmed.** Optional later: unused CSS selectors in `pos-tokens.css` after a visual pass. Keep aliases and hub pages.

---

## 22. Risks before implementation

1. Default-collapsing ERP sidebar may hide the 26-child IA — Menu must stay obvious.  
2. Renaming terminal nav without route updates breaks bookmarks/tests.  
3. Pure CSS changes can break 1366×768 density.  
4. Merging hold drawer vs page can regress hold management KPIs.  
5. Touching checkout/discount without domain tests risks money integrity.  
6. 5-col payment grid looks empty if methods are not seeded.  
7. Enabling Camera/QR without backends creates fake affordances (already guarded).  
8. Reference HTML uses mock products/cash figures — live must stay real-data only.

---

## PHASE 0 COMPLETE — WAITING FOR APPROVAL

No implementation started. Approve this audit before aligning the live POS UI to `pos-dashboard.html`.
