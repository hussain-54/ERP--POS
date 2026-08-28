# POS Add-To-Cart & Cart Experience — Deep Audit Report

**Audit Target:** Point of Sale (POS) Add-to-Cart Subsystem, Cart State Management, Pricing, and Viewport Usability  
**Auditors:** Senior POS Product Architect, Senior React/TypeScript Engineer, Senior UI/UX Designer  
**Scope:** Phase 1 — Add-to-Cart & In-Store Cart Ledger Modernization

---

## 1. Executive Summary & Inventory

### POS Assets & State Flow
- **Primary Viewport / Terminal Page:** `apps/web/src/features/pos/terminal/PosTerminalPage.tsx`
- **Cart Management Hook:** `apps/web/src/features/pos/hooks/usePosSale.ts`
- **Cart Ledger Zone:** `apps/web/src/features/pos/terminal/CartZone.tsx`
- **Product Discovery Zone:** `apps/web/src/features/pos/terminal/ProductDiscovery.tsx`
- **Checkout & Tender Zone:** `apps/web/src/features/pos/terminal/CheckoutZone.tsx`
- **Layout & Tokens:** `apps/web/src/features/pos/terminal/terminal-layout.css` and `tokens.css`
- **Domain Services:** `packages/domain/src/pos-cart.ts`, `packages/domain/src/pos-pricing.ts`, `packages/domain/src/pos-tax.ts`, `packages/domain/src/sale-transaction.ts`
- **Contracts / Schemas:** `packages/contracts/src/sale.ts` (`ProductSearchResultSchema`, `CartLine`, `InvoiceViewSchema`)

---

## 2. 20-Point Technical & Usability Audit

| # | Area | Current Status & Findings | Architecture Improvement |
|---|------|---------------------------|-------------------------|
| **1** | **Product Search** | Searches with 250ms debounce against `posApi.searchProducts`. Works via SKU, barcode, and product name. | Ensure instant keyboard focus (F2 / shortcut) and autofocus on clear so cashiers never need to reach for a mouse. |
| **2** | **Product Selection** | Single click on card or pressing `Enter` in search input selects the product. | Add keyboard navigation (arrow keys + Enter) and preserve active highlight. |
| **3** | **Add to Cart** | `addProduct(p)` appends or updates line in `usePosSale`. | Ensure pure zero-re-render overhead, instantaneous state update, and audio/haptic feedback trigger capability if needed. |
| **4** | **Cart State Management** | Monolithic state in `usePosSale`. When one item changes, totals are recomputed via `useMemo`. | Totals math is clean and memoized; ensure line item references don't trigger unnecessary DOM re-renders of unaffected lines. |
| **5** | **Quantity Changes** | Stepper buttons `[-]` / `[+]` and inline `<input type="number">` allow direct quantity typing. | When quantity exceeds base stock, show warning pill without crashing or corrupting line math. |
| **6** | **Product Removal** | Dedicated `xmark` delete button per row; `Delete`/`Backspace` key on selected line. | Provide immediate visual removal with instant total recalculation. |
| **7** | **Price Handling** | Line rate holds active selling price. List price holds original rate. | Automatically detect customer price contract (`customerPrice`), promotion rate (`promotionPrice`), or tiered wholesale/retail rate. |
| **8** | **Original vs. Selling Price** | `listPrice` vs `rate` distinction is supported in `CartLine`. | Display struck-through `Rs. [listPrice]` with bold `Rs. [rate]` ONLY when prices differ. |
| **9** | **Item Discount** | `setLineDiscount` evaluates against `evaluateDiscountApproval` with RBAC tier limits. | Instant line subtraction with real-time recalculation of taxable base and tax. |
| **10** | **Invoice Discount** | Invoice discount applies proportionally or fixed, capped to bill total. | Prevents negative grand totals while respecting acting manager discount role. |
| **11** | **Tax Calculation** | `lineTax` applies GST (17% default) on net taxable amount `max(0, rate * qty - discount)`. | Consistent with backend `packages/domain/src/pos-tax.ts` rounding to 2 decimals. |
| **12** | **Stock Validation** | `stockAvailable` is tracked per item. Zero stock disables Add button; overstock displays badge. | Frontend prevents accidental overselling while backend domain service enforces transactional locking. |
| **13** | **Cart Persistence** | Local draft storage (`erp-pos-drafts`) and hold snapshots (`buildSnapshot`) preserve cart lines and discounts. | Preserves product metadata across hold/resume and drafts without loss of price overrides. |
| **14** | **Customer Association** | Supports Walk-in customer or attached customer with price tier, credit limit, and loyalty points. | Changing customer triggers automatic pricing tier re-evaluation for all eligible cart items. |
| **15** | **Hold / Resume Compatibility** | `restoreFromHold` uses domain `restoreHoldTransaction` to faithfully rebuild cart state. | Perfectly compatible with server-side held sales register. |
| **16** | **Checkout Transition** | Pinned 3rd column ensures Grand Total and Tender remain visible without tab jumping on desktop. | Seamless transition to Payment Drawer or direct cash tender. |
| **17** | **Payment Compatibility** | Direct inline cash tender with instant change calculation, plus multi-tender drawer. | Supports all 12 payment tender kinds (Cash, Cards, QR, Wallets, Credit, Installments). |
| **18** | **Invoice Generation** | Constructs `InvoiceView` with complete line items, tax, discounts, and payments. | Formatted for immediate thermal ESC/POS or A4 tax invoices. |
| **19** | **Receipt Printing** | `printInvoiceReceipt` formats standard 80mm roll and A4 invoice with dedicated `@media print` rules. | Styled for thermal receipt printers with zero UI clutter. |
| **20** | **Performance & Viewport** | Strict 100% viewport fit with independent column scrolling. | Zero window-level vertical scrollbars; blazing fast item addition and search. |

---

## 3. High-Priority Add-to-Cart Enhancements (Phase 1)

1. **Dual Price Visibility in Cart Rows**:
   - Struck-through `listPrice` when `listPrice > rate` (e.g., `Rs. 1,200` struck through next to `Rs. 950`).
   - If `listPrice === rate`, display single clean rate.

2. **Compact Ledger Dimensions**:
   - Each cart item rendered with thumbnail image/icon, SKU, unit name, numeric stepper `[-] [qty] [+]`, rate, discount, and line total.
   - Fixed height ~38-42px per row to accommodate 10-15 cart items on standard 768p/900p screens without scrolling.

3. **Instant Quantity & Keyboard Ergonomics**:
   - Typing quantity directly in the numeric box selects the text for fast overwriting.
   - Arrow up / down / plus / minus adjusts quantity.
   - Enter on search adds product; Delete on cart line deletes.

4. **Preserve Domain Integrity**:
   - Rely on domain precision arithmetic (`roundMoney`, `finiteMoney`, `lineTotal`).
   - Retain complete compatibility with Hold/Resume, drafts, and customer price tiers.
