# POS REQUIREMENTS MATRIX

**Phase:** 2 â€” Audit only (Parts 2â€“16)
**Date:** 2026-08-14
**Rule:** No UI redesign, no feature delete/add, no schema change, no refactor.
**Phase 1C foundation:** Unchanged (online sale / stock / cash / idempotency / hold / return).
**Companion reports:** `POS-DUPLICATION-REPORT.md`, `POS-GAP-ANALYSIS.md`.

**IMPLEMENTED** only when UI + business logic + data/API + wiring all exist.

**Reference design direction (in-repo, not a screenshot):** `pos-tokens.css` + `POSLayout` â€” navy sidebar, light workspace (`#f4f6f9`), white cards, `--pos-primary` `#3b5bdb`, 10px radius, Segoe UI / IBM Plex, desktop two-column terminal. Recommended structure from prior audit: Products | Cart | Pay/Customer, fullscreen POS (no ERP shell on `/pos`).

---

## Part 2 â€” Codebase scan (how POS actually works)

| Layer | Reality |
|-------|---------|
| Routes | `/pos` and `/held-sales` both render `PosPage`. Also `/returns`, `/invoices`, `/sales-management`, `/salesman`. `/discounts` is a placeholder. `/credit` and `/installments` share `CreditInstallmentsPage`. |
| Pages | Terminal: `PosPage`. Adjacent: `ReturnsPage`, `InvoicesPage`, `SalesManagementPage`, `SalesmanPage`. |
| Components | `PosProductPanel`, `PosCartPanel`, `PosCustomerPanel`, `PosPaymentPanel`, `PosHoldsPanel`, `PosApprovalDialog`, `ReceiptPreview`. Design-system primitives under `design-system/`. |
| Hooks / stores | **No Zustand.** Cart/customer/tax live in `usePosSession`. Auth in `AuthContext`. |
| Services | `posApi`, `partiesApi`, `inventoryApi`, `enterpriseApi`, `purchasesApi`, `catalogApi`, `aiApi`, `posHardware`. |
| Domain | `pos-cart`, `pos-pricing`, `pos-discount`, `pos-tax`, `pos-payment`, `pos-hold`, `pos-return`, `pos-customer`, `pos-commission`, `discount-policy`, `sale-transaction`, `installments`. |
| API | `apps/api/src/routes/pos.ts` â†’ JWT + permission asserts. |
| Repositories | `PosRepository` (Supabase user client). Stock via `InventoryRepository.postMovement`. Payments via `PartiesRepository.postSplitPayment`. |
| Forms / modals | Customer create/edit in `PosCustomerPanel`. Approval `PosApprovalDialog`. Payment is an **inline panel**, not a modal. Holds in `POSDrawer`. |
| Print / invoice | `ReceiptPreview` + `renderSaleInvoiceText`; web printers are **memory** adapters. PDF button downloads **`.txt`**. |
| Delivery | Checkbox on POS writes sale notes + `purchasesApi.createDelivery` after post (can fail independently). |
| Offline | Active path is online-only. `navigator.onLine` gates POS. No Zustand/SQLite in web POS. |

---

## Part 3 â€” Requirements matrix (01. POS Main Screen)

| Requirement | Current Location | Status | Evidence | Notes |
|-------------|------------------|--------|----------|-------|
| **Search: Product Name** | `PosProductPanel` â†’ `posApi.searchProducts` â†’ `PosRepository.searchProducts` | IMPLEMENTED | `name.ilike` + UI search | Wired end-to-end. |
| **Search: Urdu Name** | Same | IMPLEMENTED | `name_ur.ilike`; locale `en`/`ur`/`en_ur` display | One free-text box, not a dedicated Urdu field. |
| **Search: SKU/ID** | Same | IMPLEMENTED | `sku.ilike`; exact SKU sort | Product UUID not a dedicated search facet. |
| **Search: Barcode** | Same + `UsbKeyboardWedgeScanner` | IMPLEMENTED | `barcodes` table + USB wedge auto-add | Requires window focus. |
| **Search: QR** | `qr_codes` table + Camera QR button | PARTIAL | Text search on `qr_codes.payload` works | Camera QR `capture()` throws â€œnot configuredâ€. |
| **Search: Brand** | `PosRepository` taxonomy | IMPLEMENTED | `brands` name â†’ `brand_id.in` | â€” |
| **Search: Model** | Same `product_models` | IMPLEMENTED | Taxonomy `product_models` | Displayed on card meta, not a separate control. |
| **Search: Category** | Taxonomy browse + `searchProducts` | PARTIAL | Category chips re-query by name | No `categoryId` POS search param. |
| **Voice Search** | â€” | MISSING | No `SpeechRecognition` in `features/pos` | Placeholder text does not mention voice. |
| **Quick: Camera Recognition** | `PosPage.recognizeCamera` â†’ `aiApi` + `NullCameraRecognition` | PARTIAL | Camera button exists | Null adapter; fills search, does not auto-add. |
| **Quick: Barcode Scanner** | `hardware.ts` USB wedge | IMPLEMENTED | `subscribeScanner` + first-hit add | Keyboard-wedge only. |
| **Quick: Camera / QR scan** | `scanQrFromCamera` / `CameraScannerAdapter` | BROKEN | Button wired | `capture` always throws in web host. |
| **Quick: Manual Entry** | `addManualQuick` / `createManualCartLine` | PARTIAL | Manual button + cart â€œ+ Manualâ€ | Needs an existing line `unitId`. |
| **Quick: Recent Products** | localStorage `erp-pos-recent*` | IMPLEMENTED | Recent tab + Recent button | Client-only. Recent **button and tab duplicated**. |
| **Cart: Product List** | `PosCartPanel` + `usePosSession` | IMPLEMENTED | Table of lines | â€” |
| **Cart: Quantity** | `setQty` / `increaseQty` / `decreaseQty` + `pos-cart` | IMPLEMENTED | Domain stock checks | â€” |
| **Cart: Unit Selection** | `changeCartLineUnit` | PARTIAL | Select if `unitOptions.length > 1` | Search usually returns base unit only. |
| **Cart: Price Display** | Cart line rate | IMPLEMENTED | Shown always | Easy mode read-only. |
| **Cart: Discount Application** | Line money input | PARTIAL | Fixed amount only | Item **percentage** UI missing. |
| **Cart: Tax Calculation** | `taxForLineNet` / session tax rate | PARTIAL | Line tax shown | Read-only; no tax picker on terminal. |
| **Cart: Line Total** | `lineTotal` domain | IMPLEMENTED | Cart column | â€” |
| **Summary: Subtotal** | `calculatePosCartTotals` | IMPLEMENTED | `PosPaymentPanel` | â€” |
| **Summary: Total Discount** | Same | IMPLEMENTED | Line + invoice | â€” |
| **Summary: Total Tax** | Same | IMPLEMENTED | â€” | â€” |
| **Summary: Grand Total** | Same + header badge | IMPLEMENTED | `.pos-grand` | â€” |
| **Summary: Item Count** | `totals.items` / cart header | IMPLEMENTED | â€” | â€” |
| **Customer: Walk-in** | `selectWalkIn` | IMPLEMENTED | Forces full pay | â€” |
| **Customer: Existing / Search / Quick Select** | `posCustomerRepository.search` â†’ `partiesApi` | IMPLEMENTED | Typeahead | Needs `customers.read`. |
| **Customer: History** | Ledger drawer | PARTIAL | `partiesApi.customerLedger` | Ledger rows, not sale history UI. |
| **Customer: New + Name/Mobile/Email/Address** | Create modal | IMPLEMENTED | `customers.write` | Wired to parties API. |
| **Customer: CNIC** | Create field + masked display | PARTIAL | Create/edit payload | Edit form does not show existing CNIC. |
| **Customer: Credit Limit** | Customer badges + `evaluatePosCustomerCredit` | IMPLEMENTED | Checkout credit check | Over-limit needs `credit.approve`. |
| **Customer: Outstanding** | Same | IMPLEMENTED | Display + projection | â€” |
| **Customer: Loyalty Points** | Badge via `commerceApi.account` | PARTIAL | Display if loyalty permission | No earn/redeem on sale. |
| **Customer: Price Tier** | Retail/Wholesale/Dealer select | IMPLEMENTED | `priceLevel` â†’ `resolvePosUnitPrice` | Applied at add-time. |
| **Pricing: Retail** | Search `retail_price` | IMPLEMENTED | Repo + UI | â€” |
| **Pricing: Wholesale** | `wholesale_price` + price level | IMPLEMENTED | Repo returns field | â€” |
| **Pricing: Dealer** | `dealer_price` | IMPLEMENTED | Same | â€” |
| **Pricing: Customer Price** | `pos-pricing.ts` `customerPrice` | UNUSED | Domain + session field | `searchProducts` never sets it (`customerId` ignored for price). |
| **Pricing: Quantity Price** | `quantityBreaks` | UNUSED | Domain ready | Search does not return breaks; qty change does not reprice. |
| **Pricing: Promotion Price** | `promotionPrice` | UNUSED | Domain ready | Not in search payload. |
| **Pricing: Manual Override** | Cart price + `PosApprovalDialog` | IMPLEMENTED | RBAC `pos.discount_*` | Local permission, not remote approver. |
| **Discount: Item Percentage** | Cart | MISSING | No % line control | Only fixed money. |
| **Discount: Item Fixed** | `setLineDiscount` | IMPLEMENTED | Cart Disc column | Advanced or discount permission. |
| **Discount: Invoice Percentage / Fixed** | `requestInvoiceDiscount` + `applyDiscount` | IMPLEMENTED | F5; approval ladder | Kind coerced wholesale/fixed. |
| **Discount: Customer Discount** | `DiscountKindSchema` / `pos-discount.ts` | UNUSED | Domain kinds | Not a POS cart tool. |
| **Discount: Promotion Discount** | Same | UNUSED | Domain | Not stacked in UI. |
| **Discount: Bulk Discount** | Same | UNUSED | Domain | Not stacked in UI. |
| **Approval: Auto &lt;5%** | `discount-policy.ts` cashier â‰¤5 | IMPLEMENTED | `evaluateDiscountApproval` on invoice disc | Same-user RBAC. |
| **Approval: Supervisor 5â€“10%** | `DISCOUNT_LIMITS.supervisor = 10` | IMPLEMENTED | Dialog if role insufficient | No other-user PIN/OTP. |
| **Approval: Manager 10â€“20%** | manager = 20 | IMPLEMENTED | Same | â€” |
| **Approval: Owner 20â€“50%** | owner = 50 | IMPLEMENTED | Same | â€” |
| **Approval: Special &gt;50%** | special = âˆž | IMPLEMENTED | Permission `pos.discount_special` | Not a separate workflow inbox. |
| **Tax: Sales Tax** | Session default from `enterpriseApi.listTaxRates` | PARTIAL | Applied to cart | No per-sale selector. |
| **Tax: GST** | Heuristic from rate code/name | PARTIAL | `pos-tax` | Not a distinct GST toggle. |
| **Tax: Tax Exemption** | `is_exempt` mapping | PARTIAL | Domain | Not a POS toggle. |
| **Tax: Tax Invoice** | A4 label + `buildTaxInvoiceSummary` | PARTIAL | `ReceiptPreview` | Not a separate document type. |
| **Pay: Cash** | Seeded methods + splits | IMPLEMENTED | Live Phase 1C cash sale | â€” |
| **Pay: Bank Transfer** | Seeded `kind`/code | IMPLEMENTED | Recorded as split | No bank confirmation API. |
| **Pay: Debit/Credit Card** | Same | PARTIAL | Can be tendered | No card gateway / OTP. |
| **Pay: JazzCash / Easypaisa / SadaPay** | Seeded wallet labels | PARTIAL | Recorded like cash | **No PSP verification** (do not claim). |
| **Pay: Credit/Udhar** | Credit method + remaining | IMPLEMENTED | Named customer only | Walk-in blocked. |
| **Pay: Installment** | `createInstallment` on sale | IMPLEMENTED | Advanced + nonâ€“walk-in | Hidden in Easy mode. |
| **Pay type: Full** | `preparePosPayments` | IMPLEMENTED | â€” | â€” |
| **Pay type: Partial** | Remaining / credit | IMPLEMENTED | â€” | â€” |
| **Pay type: Split** | Multi `PaySplit` | IMPLEMENTED | Advanced UI | Easy mode limited. |
| **Pay type: Advance** | `isAdvance` checkbox | IMPLEMENTED | Flag on payload | â€” |
| **Installment: Down / Count / Frequency / Monthly / Late fee** | `PosPaymentPanel` + `buildInstallmentPlan` | IMPLEMENTED | Posted with sale | Due-date schedule depends on parties port. |
| **Installment: Due Dates** | Plan preview | PARTIAL | Preview in UI | Full schedule UI is Credit/Installments page. |
| **Confirm: Print Receipt** | Auto thermal + `window.print` | PARTIAL | Wired | Web = memory printer / browser print. |
| **Confirm: Digital Receipt** | Preview + toast | PARTIAL | Success state | No hosted digital URL. |
| **Confirm: Payment Verification** | `PaymentAttemptGate` | PARTIAL | Idempotency UX | Not PSP/OTP verification. |
| **Reference: Person select** | `enterpriseApi.listReferences` â†’ `referenceId` | IMPLEMENTED | On `postSale` | â€” |
| **Reference: Name/Mobile/Code/Type on POS** | Select only | PARTIAL | Types on `SalesmanPage` | `referenceName` free text unused. |
| **Salesman: Name / Employee / Rate** | `mapSalesmanEmployees` | IMPLEMENTED | % from employee | â€” |
| **Commission: Amount** | `buildCommissionAccrual` + `sale_commissions` | IMPLEMENTED | Posted after sale | Invoice shows amount. |
| **Commission: Status / Payment** | `SalesmanPage` | PARTIAL | Accrual on sale | Pay/adjust not on main terminal. |
| **Control: Hold Sale** | `holdBill` â†’ `POST /holds` | IMPLEMENTED | Phase 1C verified; F2 | Stock unchanged. |
| **Control: Save Sale** | Same as hold | PARTIAL | No distinct Save vs Hold | â€” |
| **Control: Hold Reason** | `holdReason` / `holdLabel` | PARTIAL | Fields exist | Limited UX. |
| **Control: Resume Later / Pending / Continue** | `PosHoldsPanel` + resume API | IMPLEMENTED | Drawer + `/held-sales` | `/held-sales` **duplicates** `PosPage`. |
| **Control: Discard Hold** | `discardHold` | IMPLEMENTED | API + panel | â€” |
| **Control: Cancel Sale** | F8 `clearSale` | IMPLEMENTED | Clears session | Not a posted-sale void from terminal. |
| **Control: Cancel Reason** | Hold cancel reason | PARTIAL | Hold cancel only | New-sale cancel has no reason. |
| **Control: Authorization / Manager Approval** | `PosApprovalDialog` | PARTIAL | Local RBAC | No remote supervisor workflow. |
| **Control: Audit Log** | Sale/discount audit inserts | PARTIAL | Server rows | No audit viewer on POS. Header Notifications toast: â€œnot connectedâ€. |
| **Control: Price Override** | Same as manual price | IMPLEMENTED | Dialog if no permission | â€” |
| **Control: Duplicate Invoice** | Hold duplicate | PARTIAL | Hold only | No duplicate posted sale on POS. |
| **Control: Recalculate** | Alt+F6 | PARTIAL | Re-applies invoice disc / pay state | Does not re-resolve promo/qty prices. |
| **Control: Clear All** | F7 / cart Clear | IMPLEMENTED | `clearCart` | â€” |
| **Invoice: Number / Date / Branch / User / Customer / Products / Payments** | `getInvoice` + `ReceiptPreview` | IMPLEMENTED | After posted sale | â€” |
| **Invoice: Reference / Salesman / Commission / Warranty / Terms** | Same payload | IMPLEMENTED | Shown on preview | Terms from notes. |
| **Invoice action: A4 / 80mm / 58mm** | Format toggle + `renderSaleInvoiceText` | IMPLEMENTED | Text layouts | â€” |
| **Invoice action: WhatsApp** | `wa.me` | PARTIAL | Deep-link with text | Client-only. |
| **Invoice action: Email** | `mailto:` | PARTIAL | Deep-link | Client-only. |
| **Invoice action: PDF** | Button labeled PDF | BROKEN | Downloads `.txt` | Comment in code: no PDF library. |
| **Invoice action: Save Invoice** | Download text | PARTIAL | Local file | Not server document store. |

### Cross-cutting / structural

| Requirement | Current Location | Status | Evidence | Notes |
|-------------|------------------|--------|----------|-------|
| Dedicated Hold page | `/held-sales` | DUPLICATED | Same `PosPage` as `/pos` | Sidebar item opens same terminal; holds also in drawer. |
| Invoice register vs Sales Management | `InvoicesPage` vs `SalesManagementPage` | DUPLICATED | Both list/open invoices | Overlap. |
| Credit vs Installments routes | `/credit`, `/installments` | DUPLICATED | Same `CreditInstallmentsPage` | â€” |
| `PosHeader` vs `POSTopbar` | `PosHeader.tsx` | DUPLICATED | Re-export alias | Deprecated wrapper. |
| `POSStepper` | `design-system/POSStepper.tsx` | UNUSED | Exported, never imported by pages | Returns page uses ERP cards, not stepper. |
| `/discounts` module | `ModulePlaceholderPage` | MISSING | `router.tsx` fallback | Discount **engine** exists; admin page does not. |
| Zustand / global POS store | â€” | MISSING | `usePosSession` only | Not a gap vs requirements; scan finding. |
| Wallet PSP verification | Payment methods | NOT VERIFIABLE | No gateway client | Record-only. Do not mark IMPLEMENTED. |
| Live camera hardware | `hardware.ts` | NOT VERIFIABLE | Host must inject MediaDevices | Web throws. |
| FBR tax invoice filing | Enterprise `/tax` | NOT VERIFIABLE | Separate module | Not POS calc. |

---

## Part 4 â€” UI audit (differences only â€” no redesign)

Compared to **in-repo POS design direction** (`pos-tokens.css`, `POSLayout`, `POSSidebar`, `POSTopbar`, recommended 3-zone terminal).

### Layout

| Expected (design direction) | Current | Difference |
|-----------------------------|---------|------------|
| Fullscreen POS, no ERP chrome | `AppShell` skips ERP sidebar on `/pos` and `/held-sales` | Matches for terminal routes. Other sales pages (`/returns`, `/invoices`, `/sales-management`, `/salesman`) still use **ERP AppShell** (white 280px nav, brand purple), not POS navy. |
| Three columns: Products \| Cart \| Pay/Customer | `xl:grid-cols-[1.4fr_0.95fr]` â€” products left; **customer + cart + payment stacked right** | Not three columns. On &lt;xl, **single column** stack: products then customer then cart then pay. |
| Payment as modal | Payment is **always-visible right-column panel** | No payment modal. Crowded on tablet. |
| Dedicated hold screen | Drawer + duplicate route | Holds overlay terminal rather than a distinct layout. |

### Sidebar

| Expected | Current | Difference |
|----------|---------|------------|
| Navy POS nav | `POSSidebar` navy **linear-gradient** | Gradient on `.pos-sidebar` (tokens explicitly use gradient). Collapsed 72px / expanded 240px. Hidden below `lg`. |
| POS-only destinations | Mix of POS + ERP Home, Products, Reports, Settings | Settings route is often a **placeholder**. Hold/Resume nav points at duplicate `PosPage`. |

### Header

| Expected | Current | Difference |
|----------|---------|------------|
| Branch, cashier, clock, shift, holds | `POSTopbar` has these | Clock/title **hidden below `md`**. Menu button `lg:hidden`. |
| Notifications | Bell calls toast | Copy: â€œNotification feed not connected yetâ€. |
| Easy / Advanced + locale | Present | Advanced hides installment/split/notes â€” Easy is denser but incomplete vs full spec. |

### Search / product area / cards

| Expected | Current | Difference |
|----------|---------|------------|
| Global search | `POSSearch` in card | Hint lists name/Urdu/SKU/barcode/brand/model â€” **not voice**. |
| Product imagery | Card uses **letter avatar** + muted gradient tile | No product photos. |
| Product cards | Grid of add-cards with SKU, price, stock, Add | Out-of-stock badge when `stock â‰¤ 0`. Retail price only on card (not wholesale/dealer). |
| Quick actions | Camera, Barcode, QR, Manual, Recent | Recent duplicated with tab row (Recent / Favorites / Categories / Search). |

### Cart / customer / payment / actions

| Expected | Current | Difference |
|----------|---------|------------|
| Cart table | `POSTable` | Empty: `POSEmptyState`. Disc/price columns gated by advanced/permissions. |
| Customer panel | Search, walk-in, create, salesman, reference, delivery checkbox | Delivery is a checkbox, not a delivery UI. Advanced-only extras. |
| Payment | Inline totals, method chips, cash received, checkout CTA | First **8** methods. Grand total uses `.pos-grand` (shrinks &lt;1024px). |
| Action bar | Bottom `POSActionBar` shortcuts | Shortcut chips; some labels `hidden sm:inline`. |

### Spacing, type, color, borders, cards

| Token / rule | Current | Difference |
|--------------|---------|------------|
| Workspace `#f4f6f9`, cards white, border `#e2e8f0`, radius 10px | Applied under `.pos-terminal` | Adjacent POS pages use **ERP tokens** (`--erp-*`), not `--pos-*`. |
| Font Segoe UI / IBM Plex / Noto Sans | `.pos-terminal` | ERP shell pages use default ERP typography. |
| Primary `#3b5bdb` | POS buttons/nav-active | ERP brand color differs on non-terminal sales screens. |
| Shadows `--pos-shadow` | Cards/buttons | Dual elevation language across POS vs ERP Card. |

### Responsive

| Breakpoint | Behavior | Difference vs â€œdesktop POS / tablet / mobileâ€ |
|------------|----------|-----------------------------------------------|
| `xl` | Two columns | Tablet/laptop &lt;xl: vertical stack, long scroll to pay. |
| `lg` | Sidebar visible | Tablet: overlay mobile sidebar (`fixed inset-0 z-40`). |
| `md` | Header center clock | Phone: no clock block. |
| `sm` | Modal `items-end` (sheet) vs center | Payment is not this modal â€” it stays in-page. |
| `md` Invoices/Sales Mgmt | Table vs cards | Those pages are ERP-responsive, not POS-token responsive. |

### States

| State | Where it exists | Gap vs design-system completeness |
|-------|-----------------|-----------------------------------|
| Empty | Product grid, cart, holds (`POSEmptyState`) | Payment/customer empty is weaker (walk-in default). |
| Loading | Product search `POSLoadingState` | Checkout uses `busy` disabling buttons â€” not a full-page POS loader. |
| Error | `lastCartError`, online banner, toast, payment confirmation failure | Mixed: POS tokens for offline banner; ERP `useToast` for most errors (`POSToast` is a re-export, unused by PosPage). |
| Success | Last-invoice badge, payment confirmation, receipt preview | Receipt uses **ERP `Card`**, not `POSCard`. |

### Screens that do **not** follow POS design system

- `ReturnsPage`, `InvoicesPage`, `SalesManagementPage`, `SalesmanPage` â€” `@electronic-erp/ui` Card/Button, ERP shell.
- `ReceiptPreview` â€” ERP Card inside terminal after sale.

---

## Honest totals (Part 1 leaf rows)

Approximate (see table): **IMPLEMENTED ~40** Â· **PARTIAL ~35** Â· **MISSING ~3** Â· **BROKEN ~2** Â· **UNUSED ~6** Â· **DUPLICATED ~4** Â· **NOT VERIFIABLE ~3**.

Do not treat wallet/PSP, camera hardware, or PDF as implemented.

---

## Part 5 â€” Functional audit

### Missing workflows

| Workflow | Notes |
|----------|-------|
| Voice search | No SpeechRecognition. |
| Camera QR capture | Adapter throws. |
| Camera product recognition | `NullCameraRecognition` returns empty candidates. |
| Item % discount | Only fixed money on line. |
| Customer/qty/promo price at add-to-cart | Search does not load `product_prices` / promotions. |
| Loyalty earn/redeem on sale | Badge only. |
| Remote discount approval | Session RBAC dialog only (`PosApprovalDialog` comment: no PIN). |
| Notification feed | Bell is a fake success path. |
| `/discounts` admin | Placeholder module. |
| Posted-sale duplicate / void from terminal | Hold duplicate only. |
| Real PDF / hosted digital receipt | Text download / print. |
| Wallet PSP (JazzCash/Easypaisa/SadaPay) | Tender recorded like cash. |
| Card gateway | Same. |
| Bank transfer confirmation | No txn/account required. |

### Incomplete workflows

| Workflow | What works | Whatâ€™s incomplete |
|----------|------------|-------------------|
| Delivery from POS | Checkbox â†’ `createDelivery` after sale | Independent failure; toast â€œcreate manuallyâ€; no GPS. |
| Invoice share | wa.me / mailto | Client deep-links. |
| Installment | Plan fields + `createInstallment` | Easy mode hidden; schedule mgmt on `/installments`. |
| Hold edit | API exists | `window.prompt` for some edits. |
| Tax | Default org rate applied | GST vs sales_tax is string heuristic; silent fail if rates API fails. |
| Shift open/close | API + sidebar | Not a full cash-up workflow. |
| Return refund payment | Return row + restock | Separate cash refund `payments` row not always present (Phase 1C). |

### Fake / placeholder / mock

| Item | Location | Behavior |
|------|----------|----------|
| Notifications | `POSTopbar` / `PosPage` | Toast: â€œnot connected yetâ€. |
| Camera | `NullCameraRecognition` | Empty candidates. |
| QR | `CameraScannerAdapter.capture` | Throws â€œnot configuredâ€. |
| Thermal/A4 print (web) | `MemoryThermalPrinter` / `MemoryA4Printer` | Succeeds in memory; no device. |
| PDF button | `ReceiptPreview` | Saves `.txt`. |
| `POSStepper` | design-system | Unused. |
| Memory cash drawer | `MemoryCashDrawer` | Local audit in localStorage only. |

### Hardcoded values (POS-relevant)

| Value | Where | Risk |
|-------|-------|------|
| `methods.slice(0, 8)` | `PosPaymentPanel` | 9th method (Installment seed) may be hidden from chips. |
| Tax kind `'gst'` if code/name includes `"gst"` else `'sales_tax'` | `PosPage` tax load | Mis-labels rates. |
| Journal `paidCash: paidTotal` | `sale-transaction.ts` | **All** tender (bank/card/wallet) booked as Cash GL. |
| `RCV-${Date.now()}` | `postSplitPayment` | Receipt numbers not sequential. |
| `HOLD-${Date.now()}` | hold insert | Same. |
| Favorites/recent cap `40` | `PosPage` localStorage | Client-only. |
| Default installment count `"3"` | `PosPage` state | UX default, not a business rule. |

### Mock data

No in-memory product catalog mock on POS. Hardware printers are **memory mocks**. Camera is a **null stub**. Seeded payment **labels** are real DB rows after seed, not UI mocks.

### Duplicated logic / screens / APIs / repos / components

| Kind | Duplication |
|------|-------------|
| Screens | `/pos` â‰¡ `/held-sales`; `/credit` â‰¡ `/installments`; Invoices vs Sales Management invoice open. |
| Components | `PosHeader` re-exports `POSTopbar`. Recent button + Recent tab. |
| Totals | `calcTotals` in `pos-types.ts` wraps `calculatePosCartTotals` and is **never called** (dead). Session uses `calculatePosCartTotals` directly. Posting uses `calculateSaleTotals` inside `SaleTransactionService`. Cart totals **delegate** to `calculateSaleTotals` â€” aligned for money, but `taxInvoice` is a **second** tax summary from `taxForLineNet`. |
| Pricing | Catalog `/pricing` writes `product_prices`; POS search reads product master retail/wholesale/dealer only. Two price stores, POS uses one. |
| Discount | `applyDiscount` (domain) vs line `capLineDiscount` vs `assertDiscountAllowed` â€” complementary, not forked engines. Stacking helpers in `pos-discount.ts` **not called** from cart. |
| Repositories | Single `PosRepository` for POS; payments go through `PartiesRepository.postSplitPayment`. Not duplicated. |
| APIs | One `/api/v1/pos/sales`. Parties payment-methods seed separate from POS. |

### Dead / unused

| Item | Status |
|------|--------|
| `calcTotals` | Defined, unused. |
| `POSStepper` | Unused. |
| `usePOSToast` | PosPage uses `@electronic-erp/ui` `useToast`. |
| `applyCustomerDiscount` / `applyBulkDiscount` / `computeStackedLineDiscount` | Domain only; POS UI does not call. |
| `paidBank` on `buildSaleJournalLines` | Supported in domain; sale poster never passes it. |
| Silent `.catch(() => undefined)` | Tax, taxonomy, references, invoice preview load â€” failures swallowed. |

### Inconsistent calculations / validation

| Issue | Detail |
|-------|--------|
| Journal vs tender kind | Settlement journal always `paidCash: paidTotal` â€” JazzCash/card/bank still debit Cash (1000), not Bank (1010). |
| Cart tax vs posted tax | UI line tax from `taxForLineNet(session rate)`. Posted sale uses item `tax` fields through `calculateSaleTotals`. Same pipeline **if** lines were built with that rate; invoice discount does not re-split tax in `calculateSaleTotals` (tax is sum of line taxes, not recomputed after invoice disc). |
| Discount approval | UI `evaluateDiscountApproval` + `applyDiscount`; server `assertDiscountAllowed` in `SaleTransactionService`. Aligned ladder. **Not** a second-user approval record. |
| Credit | UI `evaluatePosCustomerCredit`; server `evaluateCredit` in `postSplitPayment` only if credit **portion** on splits. POS credit button posts amount `"0"` on credit method (does not reduce paid) â€” remaining is sale AR. Split-payment credit-portion check may **not** run for â€œcharge to creditâ€ because no credit split amount. Relies on `validatePosCheckout` + remaining + customer ledger. |
| Walk-in remaining | Enforced in `preparePosPayments`. |

### Missing error handling

- Tax/reference/category bootstrap: silent catch.
- Delivery after sale: toast only; sale already posted.
- Post-commit journal/commission/audit: sale stays posted if they fail (by design); UI may still 500 if audit FK fails (`deviceId`).
- Camera/QR: throw/empty without disabling the button.

---

## Part 6 â€” Payment audit

**Rule:** A chip/dropdown is not â€œsupportedâ€. Support = UI + API + DB row + validation + (ledger/journal as designed) + status + receipt.

Seeded methods (`PartiesRepository.SYSTEM_METHODS`): CASH, BANK, CARD, JAZZCASH, EASYPAISA, SADAPAY, ONLINE, CREDIT, INSTALLMENT.

POS chips: **first 8** methods only (`slice(0, 8)`). INSTALLMENT (sort 9) may be missing from chips; installment is a **checkbox**, not the seed method.

| Method / type | UI? | API? | Database? | Validation? | Accounting / ledger? | Status? | Receipt? | Verdict |
|---------------|-----|------|-----------|-------------|----------------------|---------|----------|---------|
| **Cash** | Yes â€” chip, amount received, change | `POST /pos/sales` splits `kind: cash` | `payments` + `payment_splits` + `payment_receipts` | `preparePosPayments` / `resolveCashTender`; walk-in full pay | Walk-in: **no** party ledger. Named customer: sale AR + payment ledger if paid. Journal: Cash 1000 (correct for cash) | `payments.status=posted`; sale `paid`/`partial` | Payment receipt # + sale invoice | **IMPLEMENTED** (live Phase 1C). |
| **Bank Transfer** | Chip if seeded | Same sale payload; optional `reference` not required in UI | Same tables; method `kind=bank` | Amount only â€” **no** bank account / slip # required | Party payment ledger if customer. Journal still **`paidCash`** (wrong GL vs `paidBank`) | posted | Same receipt tables | **PARTIAL** â€” recorded, not verified, journal mis-typed. |
| **Card** | Chip | Same | `kind=card` | Amount only â€” **no** PAN/OTP/gateway | Same as bank | posted | Same | **PARTIAL** â€” record-only. |
| **JazzCash** | Chip | Same | `kind=jazzcash` | Amount only â€” **no** MSISDN/OTP/PSP | Same; journal as cash | posted | Same | **PARTIAL** â€” **not** JazzCash integration. |
| **Easypaisa** | Chip | Same | `kind=easypaisa` | Same | Same | posted | Same | **PARTIAL** â€” record-only. |
| **SadaPay** | Chip | Same | `kind=sadapay` | Same | Same | posted | Same | **PARTIAL** â€” record-only. |
| **Credit / Udhar** | â€œCharge to creditâ€ (named customer) | Remaining on sale; credit method amount 0 (not a paid split) | `sales.remaining_total`, `payment_status`; customer ledger **sale** entry if `customerId` | Walk-in blocked; `evaluatePosCustomerCredit`; blocked customer | AR via `postCustomerSaleLedger` (full grand). Payment ledger only for cash portions | `unpaid`/`partial` | Sale invoice shows remaining | **IMPLEMENTED** for record AR; approval ID rarely wired from POS. |
| **Installment** | Advanced: down, count, freq, late fee, preview | `createInstallment` on sale | Installment tables via parties port | `buildInstallmentPlan` | Sale AR + installment rows; down payment as normal splits | posted sale + plan | Sale invoice; not a separate installment receipt on POS | **PARTIAL** (Easy mode hidden). |
| **Partial** | Remaining allowed if customer + credit due | `paymentStatus: partial` | sale paid/remaining | `preparePosPayments` | AR leftover | partial | Invoice remaining | **IMPLEMENTED**. |
| **Split** | Advanced extra split rows | Multiple `payment_splits` | Same payment header | `assertSplitMatchesBill` on paid total | One payment + N splits | posted | One receipt for combined payment | **IMPLEMENTED**. |
| **Advance** | Checkbox `isAdvance` | Flag on sale payload | Sale field if mapped | Classification only | Same posting as other tenders | posted | Invoice | **PARTIAL** â€” flag/UX; not a distinct advance-allocation ledger. |
| **Online** (seeded) | May appear in first 8 | Same as bank | `kind=online` | None beyond amount | Record-only | posted | Same | **PARTIAL**. |

**Do not claim:** JazzCash, Easypaisa, SadaPay, or card **PSP verification**. There is no gateway client, webhook, or OTP.

---

## Part 7 â€” Pricing / discount / tax audit

### Single source of truth (intended)

| Concern | Authority | File |
|---------|-----------|------|
| Unit price resolution order | Domain | `packages/domain/src/pos-pricing.ts` â€” **manual â†’ promotion â†’ qty break â†’ customer â†’ retail/wholesale/dealer** |
| Line/invoice discount math | Domain | `pos-discount.ts` `applyDiscount` + `capLineDiscount` |
| Approval ladder | Domain | `discount-policy.ts` `DISCOUNT_LIMITS` (5 / 10 / 20 / 50 / special) |
| Line tax | Domain | `pos-tax.ts` `computeLineTax` / `taxForLineNet` |
| Posted sale money totals | Domain | `sale-totals.ts` `calculateSaleTotals` (used by `SaleTransactionService` **and** `calculatePosCartTotals`) |
| Cart orchestration | Domain + hook | `pos-cart.ts` + `usePosSession.ts` |

**Catalog `/pricing` (`product_prices`, price levels, customer overrides) is a second store.** POS search **does not read it**. That is the main conflict: master/list prices exist in catalog; POS sells off `products.retail_price` / `wholesale_price` / `dealer_price`.

### Price tiers

| Tier | POS UI | Search payload | Wired? |
|------|--------|----------------|--------|
| Retail | Default / select | `retailPrice` | Yes |
| Wholesale | Select | `wholesalePrice` | Yes |
| Dealer | Select | `dealerPrice` | Yes |
| Customer contract | â€” | `customerPrice` optional on contract | **No data** from `searchProducts` |
| Qty breaks | â€” | `quantityBreaks` | **No data**; qty change does not re-resolve |
| Promotion | â€” | `promotionPrice` | **No data** |
| Manual | Advanced price edit + approval | Override in session | Yes (RBAC) |

### Discounts

| Kind | Domain | POS UI | Posted |
|------|--------|--------|--------|
| Item fixed | `capLineDiscount` | Cart Disc column | `items[].discount` |
| Item % | `applyDiscount` percentage | **Missing** | â€” |
| Invoice fixed/% | `applyDiscount` + approval | F5 invoice field | `discountTotal` + audit row kind wholesale/fixed |
| Customer / promo / bulk stack | `computeStackedLineDiscount` | **Unused** | â€” |

Approval: UI and `SaleTransactionService.assertDiscountAllowed` share `discount-policy.ts`. Not duplicated engines. Gap is **workflow** (no second actor), not two formulas.

### Tax / GST / exemption

| Piece | Behavior |
|-------|----------|
| Rate source | First default active row from `enterpriseApi.listTaxRates` |
| GST vs sales tax | If code/name contains `"gst"` â†’ `gst`, else `sales_tax` |
| Exempt | `is_exempt` on that row â†’ zero tax |
| Per-sale selector | None |
| Tax invoice | `buildTaxInvoiceSummary`; A4 label only |
| FBR filing | `/tax` enterprise module â€” **not** POS |

**Inconsistency:** `calculateSaleTotals` **sums line.tax** and does **not** recompute tax after invoice discount. `taxInvoice` helper recomputes from net using session rate. Display `totals.tax` follows **saleTotals.taxTotal** (line sum), not `taxInvoice.taxTotal`. If those ever diverge, UI grand follows line-sum path (same as server post).

### Conflicting / duplicated pricing logic â€” conclusion

There are **not** two competing POS calculators for posted totals. There **are**:

1. **Unused domain branches** (promo/qty/customer/stacking) vs **wired** tier + manual + line/invoice discount.
2. **Catalog price lists** vs **product master columns** â€” POS uses master columns only.
3. **Journal cash vs bank** â€” settlement GL ignores method kind.
4. Dead wrapper `calcTotals`.

---

## Part 8 â€” Inventory integration audit

**Do not change anything.** Evidence from `SaleTransactionService`, `PosRepository` ports, `InventoryRepository.postMovement`, `effectForMovement` / `applyMovementToBalance`, `prepareSaleReturn` / `restockDecision`. Live Phase 1C: sell 2 â†’ 10â†’8; return 1 â†’ 8â†’9.

POS UI **never** writes `stock_balances`. Web POS has no direct stock updates.

### Intended chain

```
SALE (posted)
  SaleTransactionService (skip manual lines)
    â†’ postStockSale
      â†’ InventoryRepository.postMovement({ type: "sale", qtyDelta: +qty })
        â†’ effectForMovement("sale") decreases qty_on_hand
        â†’ insert stock_movements (qty_before / qty_after)
        â†’ update stock_balances (version check)

RETURN (posted, restock=true)
  PosRepository.postReturn
    â†’ postMovement({ type: "sale_return", qtyDelta: +qty })  // on-hand IN
    â†’ if damaged target: postMovement({ type: "damage", qtyDelta: +qty })  // on-hand OUT, damaged IN

HOLD
  snapshot only â€” holdMustNotReduceInventory()
```

### Sale â†’ movement â†’ balance

| Check | Result |
|-------|--------|
| Movement created | Yes â€” `movementType: "sale"`, `sourceType: "sale"`, `sourceId: saleId` |
| Balance updated | Yes â€” same `postMovement` after domain `applyMovementToBalance` |
| Duplicate sale stock | **No** if same idempotency key (early return, no `postStockSale`). Per-line `operation_id` unique; retry of same op returns existing movement |
| Duplicate lines | Two cart lines for same product â†’ **two** movements (by `lineIndex`) â€” intended, not a double-post of one line |
| Missing sale stock | **Manual / no productId** lines skip stock. **Compensate failure** (best-effort catch) can leave deduction with voided sale |
| Live verify | 10 âˆ’ 2 = 8 (PCS) |

### Return â†’ movement â†’ balance

| Check | Result |
|-------|--------|
| Movement created | Yes when `item.restock` â€” type `sale_return` |
| Balance updated | Same `postMovement` path |
| Damaged returns | **Two** movements: `sale_return` then `damage` â€” net on-hand unchanged, `qty_damaged` up. Not a duplicate sale_return |
| Exchange | Extra `sale` movement for **exchange product** (out) â€” separate SKU |
| Missing return stock | `restock: false` (incomplete / missing accessories) â€” **no** movement by policy |
| Over-qty | Domain `maxReturnableQty` â€” HTTP 400 (verified) |
| Live verify | Partial return 1: 8 â†’ 9 |

### Duplicate stock updates?

| Scenario | Duplicate? |
|----------|------------|
| Double-click same sale key | No â€” sale idempotency + movement `operation_id` |
| Compensate + later successful sale | Reverse is `sale_return` with **different** op id; new sale has new ops |
| Return retry same idempotency | `sale_returns` idempotency returns existing row **before** restock loop â€” if first attempt inserted return then failed mid-restock, retry **skips restock** (missing stock) |
| UI + API both posting | No â€” UI only calls `posApi.postSale` / `postReturn` |

### Unsafe direct stock writes?

| Writer | Safe? |
|--------|-------|
| POS React | Does not update `stock_balances` |
| `PosRepository.searchStockAvailable` | **Read only** |
| `InventoryRepository.postMovement` | **Only** POS sale/return writer; uses domain effect then versioned update |
| Split write | Movement **insert** then balance **update** are **not one DB transaction**. If insert succeeds and update fails: retry sees existing `operation_id` and **returns without fixing balance** â€” movement exists, balance stale |
| Concurrent sales | `version` optimistic lock; loser throws conflict â€” not a silent double decrement of one movement |

### Inconsistent stock calculations

| Issue | Detail |
|-------|--------|
| Float vs decimal | Checkout `searchStockAvailable` uses `Number(qty_on_hand) - Number(qty_reserved)`. Ledger uses `addDecimal` / `subtractDecimal`. Cart UI uses decimal `baseQtyForLine` |
| Unit of measure | Cart stock check converts with `factorToBase`. **Posted `qtyDelta` is sale-unit qty, not converted to base.** PCS (factor 1) matches live test. Box/dozen would under/over-move |
| Available vs on-hand | Sale checks available (on-hand âˆ’ reserved). Movement decreases **on-hand** only, not reserved. Reserved qty is not released on sale |
| Invoice vs warehouse | Search stock is warehouse-scoped; sale uses POS `warehouseId` |

### Hold

No stock movement. Phase 1C: 8â†’8â†’8.

### Verdict

| Path | Status |
|------|--------|
| Sale â†’ movement â†’ on-hand (tracked SKU, base unit 1) | **IMPLEMENTED** (live) |
| Return restock â†’ movement â†’ on-hand | **IMPLEMENTED** (live, good condition) |
| Duplicate POS stock posts | **Not found** on happy path |
| Missing updates | Manual lines; non-restock returns; failed compensate; failed return retry after header insert |
| Unsafe | Non-transactional movement/balance; idempotent retry can skip balance repair |
| Inconsistent math | Float availability check; **no UOM conversion on post** |

---

---

## Part 9 â€” Customer audit (what exists)

| Topic | What exists | Status |
|-------|-------------|--------|
| Walk-in | `selectWalkIn` / `walkIn=true`. No `customerId` on `postSale`. `preparePosPayments` forces full pay (`allowCreditDue` false). | IMPLEMENTED |
| Existing customers | Typeahead `posCustomerRepository.search` â†’ `partiesApi.searchCustomers`. Select loads profile. | IMPLEMENTED |
| New customers | Create modal: name, mobile, email, address, CNIC, type. `partiesApi.createCustomer` (`customers.write`). | IMPLEMENTED |
| Customer search | Debounced query on POS; needs `customers.read`. | IMPLEMENTED |
| Customer history | Drawer: `partiesApi.customerLedger` recent rows. **Not** a sale-history list. | PARTIAL |
| Credit | `evaluatePosCustomerCredit` / `evaluateCredit`. Limit + blocked flags. Over-limit needs `credit.approve`. | IMPLEMENTED |
| Outstanding | Shown as Due badge; projected into credit check with remaining of current sale. | IMPLEMENTED |
| Loyalty | `commerceApi.account` balance if `loyalty.view`/`loyalty.manage`. Display only. **No earn/redeem on checkout.** | PARTIAL |
| Price tier | Retail / Wholesale / Dealer select + `priceLevelForCustomerType`. Applied at **add-to-cart** via `resolvePosUnitPrice`. | IMPLEMENTED |
| Ledger | Customer ledger entries on sale (AR), payment, and some returns (`postCustomerLedger`). Walk-in: no ledger (Phase 1C). | IMPLEMENTED (named customers) |
| Edit customer | Edit modal on POS; CNIC not shown on edit form. | PARTIAL |
| Blocked customer | Domain check at checkout. | IMPLEMENTED |

---

## Part 10 â€” Invoice audit (implemented vs missing)

| Item | Status | Evidence |
|------|--------|----------|
| Invoice generation | IMPLEMENTED | Posted sale creates `sales` + `getInvoice` payload |
| Invoice number | PARTIAL | `INV-{idempotency hex 10}-{Date.now base36}` â€” unique, **not sequential** |
| Customer data | IMPLEMENTED | Name, mobile, email, address on preview when named customer |
| Product lines | IMPLEMENTED | Qty, rate, discount, tax, total, warranty days; N+1 product/unit lookups |
| Tax | PARTIAL | Line tax + A4 tax-invoice label; not a separate FBR document |
| Discount | IMPLEMENTED | Line + invoice amounts on preview |
| Payment | IMPLEMENTED | Splits from `payments` where `source_type=sale` |
| Balance | IMPLEMENTED | `paidTotal` / `remainingTotal` / due date |
| Salesman | IMPLEMENTED | Name + commission %/amount if `salesman_user_id` |
| Reference | IMPLEMENTED | `referenceName` on document |
| Warranty | PARTIAL | Line `warrantyDays` + sale `warrantyNotes`; claims live on `/warranty` (separate) |
| Terms | PARTIAL | `terms` mapped from **sale notes**, not a terms catalog |
| PDF | BROKEN | Button downloads `.txt` then `window.print` |
| A4 | PARTIAL | Text layout + memory A4 printer + browser print |
| 80mm / 58mm | PARTIAL | Text layouts + memory thermal printer |
| WhatsApp | PARTIAL | `wa.me` client deep-link with truncated text |
| Email | PARTIAL | `mailto:` client deep-link |
| Logo | MISSING | `logoUrl: null` always |

Also: `/invoices` list + `/sales-management` both open the same preview (duplicated screens).

---

## Part 11 â€” Returns audit

| Item | Status | Evidence |
|------|--------|----------|
| Full return | IMPLEMENTED | Domain `inferReturnScope` / `scope: full` â†’ sale `status` returned/exchanged, `payment_status` refunded when refund/credit |
| Partial return | IMPLEMENTED | Live Phase 1C qty 1 of 2; sale stays posted |
| Return reason | IMPLEMENTED | `RETURN_REASON_CODES` + detail on wizard |
| Quantity validation | IMPLEMENTED | `maxReturnableQty` in domain + UI qty |
| Over-return prevention | IMPLEMENTED | Live HTTP 400 |
| Refund | **PARTIAL â€” NOT COMPLETE** | `sale_returns.refund_amount` + journal. **No `payments` insert in `PosRepository.postReturn`.** Phase 1C: `refundPayments=0`. **Do not mark complete.** |
| Customer credit | PARTIAL | Ledger `entryType: return` when named customer + credit disposition or customer_credit method. Walk-in cash refund: **no ledger and no payment row** |
| Exchange | PARTIAL | Wizard + `postMovement("sale")` on exchange SKU; exchange `operationId` is `crypto.randomUUID()` (not idempotent) |
| Stock restoration | IMPLEMENTED (good restock) | Live 8â†’9; incomplete condition skips restock by policy |
| Warehouse | IMPLEMENTED | Wizard warehouse select; first warehouse default |
| Batch | PARTIAL | `batchId` passed on lines if present; no dedicated batch picker UI |
| Return reports | PARTIAL | `posApi.returnReport` + last 20 returns on `ReturnsPage` |

**Known issue (Phase 1C â€” still open):** separate cash/bank refund **`payments` row was not observed**. Code path writes ledger (named customer only) and journal; it **never inserts** into `payments`. Cash drawer / payment register will understate refunds.

---

## Part 12 â€” Security / RBAC audit (gaps only â€” no security changes)

| Control | What exists | Gap |
|---------|-------------|-----|
| Roles | `rbac-catalog.ts` owner/manager/cashier/technician/etc. | â€” |
| Permissions | API `authz.assert` on POS routes (`pos.sell`, `pos.hold`, `pos.return`, `pos.view_invoices`, `pos.shift`) | UI also gates buttons; mismatch possible if UI shows and API denies |
| Manager approval | `PosApprovalDialog` â€” **current session permissions only** | Comment: no PIN. No second user. `APPROVAL_CHAINS` unused by POS dialog |
| Discount approval | `evaluateDiscountApproval` + `pos.discount_*` | Same-user; no inbox `/approvals` wiring for POS discounts |
| Price override | Same dialog + discount perms | Same-user |
| Cancellation authorization | `clearSale` (F8) has **no** manager gate. Hold cancel uses `pos.hold` | Posted sale void **not** on terminal |
| Branch isolation | API `assertBranch(branchId)` on POS; list filters `branch_id` | **RLS on `sales` is org-only** (`sales_org`: `organization_id = current_organization_id()`). No `branch_id` RLS. Cross-branch possible if a client bypasses API with user JWT |
| Organization isolation | RLS `organization_id = current_organization_id()` on sales/items/holds | Relies on JWT claim helper |
| RLS | Enabled on POS tables | Branch not in policy |

---

## Part 13 â€” Performance / architecture (report only)

| Issue | Evidence |
|-------|----------|
| Unnecessary / repeated API | Mount: `seedPaymentMethods`, `listWarehouses`, tax rates, taxonomy, references, `expireHolds`+`listHolds`, shift. Debounced product **and** customer search. Scanner effect can call `searchProducts` again |
| Duplicate queries | `getInvoice` N+1: per-line `products` + `units`. Cashier and salesman profiles queried separately. `/invoices` and sales management both list sales |
| Duplicated state | Cart in `usePosSession`; payment splits in `PosPage`; customer query in `PosPage`; product search in `PosPage` + panel local filter |
| Re-renders | `PosPage` (~1600 lines) owns almost all handlers; panels are not `React.memo`. Any cart tick re-renders product grid + customer + payment |
| Large components | `PosPage.tsx`, `ReturnsPage.tsx`, `SalesManagementPage.tsx` are page-god objects |
| Tight coupling | `PosPage` imports hardware, AI, purchases delivery, commerce loyalty, enterprise tax/references, parties, inventory |
| Duplicated business logic | See `POS-DUPLICATION-REPORT.md` |
| UI / domain / data | Domain is used for cart/pay/return. Adjacent pages (`ReturnsPage`, invoices) mix ERP UI + API. Web `pos-repository.ts` is only `export { posApi }` |

---

## Part 14 â€” Responsive UI audit

| Check | Finding |
|-------|---------|
| Desktop (`xl+`) | Two columns: products \| (customer+cart+pay). Usable for cashier if tall viewport |
| Tablet (`<xl`) | **Single column stack** â€” pay is below fold. Sidebar overlay at `<lg` |
| Mobile | Product grid 2 cols; cart table `overflow-auto`; payment always in-page (not sheet). Long scroll |
| Horizontal overflow | Cart `POSTable` wraps overflow-x; Sales Management table `overflow-x-auto` hidden on phone (cards instead) |
| Unusable cart | Narrow width: name `max-w-[9rem]`; qty/price/disc columns cramped; Easy mode hides some cols |
| Tiny buttons | Default `POSButton` `h-9` (36px); `sm` `h-8` (32px). Below 44px touch target. Qty Â± are small |
| Modal problems | Approval/customer modals: `items-end` on phone (sheet). Payment is **not** a modal â€” stays in column |
| Table overflow | Cart and invoice lists scroll; ERP invoice list `hidden md:block` + mobile cards |
| Keyboard | Shortcuts F2â€“F8, Alt+F6. Search/cart have some `aria-label`. No documented focus trap on all dialogs. Scanner requires window focus |
| Touch targets | Icon buttons and `sm` chips undersized for glove/POS glass |
| Breakpoints | `sm` / `md` / `lg` / `xl` / `2xl`. Two-column POS only at `xl` |

---

---

## Part 18 â€” Final check (audit did not change app code)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run test` | **FAIL** â€” 2 tests in `packages/domain/src/pos-hold.test.ts` (`enforces hold actions and ownership`, `supports edit, duplicate, transfer, cancel action gates`). Cause: `base.expiresAt` is `"2026-08-13T08:00:00.000Z"`; `assertHoldActionAllowed` uses **clock now** (2026-08-14) so the fixture is expired. **Pre-existing date-sensitive tests. Not introduced by this audit.** Other foundation tests passed until that file aborted the chain (web tests not reached). |
| `npm run build` | **PASS** (packages + API + Vite web) |

No application, schema, or route files were modified in Parts 9â€“17.

---

*End of Phase 2 audit reports.*
