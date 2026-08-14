# POS DUPLICATION REPORT

**Date:** 2026-08-14
**Rule:** Identify only. Do **not** delete or merge in this phase.

Recommended future source of truth is a **target** for a later phase, not an instruction to change code now.

---

## 1. Duplicate components

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `POSButton` / `POSCard` / `POSInput` (`features/pos/design-system`) | `@electronic-erp/ui` `Button` / `Card` / `Input` on Returns, Invoices, Sales Management, Salesman, ReceiptPreview | POS design-system for all sales-facing screens; ERP UI for non-POS modules |
| `PosHeader.tsx` | Re-export of `POSTopbar` | Keep `POSTopbar` only |
| Recent **button** (quick actions) | Recent **tab** on product panel | One recent entry point |
| `POSToast` / `usePOSToast` | `@electronic-erp/ui` `useToast` (what `PosPage` actually uses) | One toast provider |
| `POSStepper` (exported, unused) | Returns wizard custom step chips | One stepper if returns stay wizard-based |

---

## 2. Duplicate services

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `posApi` (`pos-api.ts`) | `posClientRepository` = same `posApi` (`session/pos-repository.ts`) | Single client: `posApi` |
| `SaleTransactionService.postSale` | UI `preparePosPayments` then API posts same payload | Domain service remains writer; UI only prepares DTO |
| Hardware `posHardware` memory printers | `window.print()` in `ReceiptPreview` | One print adapter per host (web vs Electron) |
| `aiApi` camera | `NullCameraRecognition` in `hardware.ts` | One recognition port |

---

## 3. Duplicate repositories

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `packages/db` `PosRepository` | Web `session/pos-repository.ts` (HTTP alias, not DB) | DB `PosRepository` server-side; web HTTP `posApi` only (drop alias name â€œrepositoryâ€) |
| `PosRepository` stock via `InventoryRepository.postMovement` | Direct `stock_balances` **read** in `searchStockAvailable` | Inventory repo for all stock read/write |
| `PartiesRepository.postSplitPayment` | Return path does **not** post payments (gap, not a second writer) | Parties payment SSoT for sale **and** refund |

---

## 4. Duplicate calculations

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `calculatePosCartTotals` (`pos-cart.ts`) | `calculateSaleTotals` (`sale-totals.ts`) â€” cart already delegates | `calculateSaleTotals` |
| `calcTotals` in `pos-types.ts` | Unused wrapper of cart totals | Delete later; keep domain |
| `taxForLineNet` / `buildTaxInvoiceSummary` | Line `tax_amount` persisted on sale items | Domain tax â†’ persisted columns â†’ invoice reads DB |
| Cart `baseQtyForLine` (UOM factor) | Posted stock `qtyDelta` without conversion | One qty in **base units** at post |
| JS `Number(on_hand) - Number(reserved)` | Decimal helpers elsewhere | Decimal helpers |

---

## 5. Duplicate APIs

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `GET` list sales (`pos.listSales`) used by Invoices | `GET` sales-management filtered list | One list/filter endpoint + UI tabs |
| `GET` invoice by id | Sales management â€œopen invoiceâ€ same `getInvoice` | Keep one `getInvoice` |
| Parties `searchCustomers` | POS customer search wrapper | Parties search; POS maps to `PosCustomerProfile` |
| Catalog product search / pricing pages | POS `searchProducts` (master retail/wholesale/dealer only) | One product search + price resolution service |

---

## 6. Duplicate routes

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `/pos` â†’ `PosPage` | `/held-sales` â†’ **same** `PosPage` | `/pos` + holds drawer **or** a distinct holds page component |
| `/credit` | `/installments` â†’ same `CreditInstallmentsPage` | One route |
| `/invoices` | `/sales-management` (invoice open/print overlap) | Register vs ops: split by job (reprint vs filters/export) without two invoice previews |

---

## 7. Duplicate database access

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `sales` insert in `postSaleRecord` | Invoice reads `sales` + `sale_items` + `payments` | Single sale aggregate query |
| Per-line product/unit selects in `getInvoice` | Product name already known at sale time | Persist line description on `sale_items` (already has manual_name; products refetch) |
| Catalog `product_prices` | Product master `retail_price` / `wholesale_price` / `dealer_price` | One price book POS reads |

---

## 8. Duplicate validation

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| Cart `assertStockAvailable` (UI) | `searchStockAvailable` at `postSale` (server) | Keep **both layers**; same UOM/decimal rules |
| `preparePosPayments` in UI | `preparePosPayments` / `assertPosPaymentPrepared` in `SaleTransactionService` | Domain only; UI calls same function (already shared package) |
| `prepareSaleReturn` in ReturnsPage preview | Same in `PosRepository.postReturn` | Domain only (already shared) |
| Discount `assertDiscountAllowed` API | `PosApprovalDialog` local `canApprove` | Server remains authority; UI mirrors catalog |

---

## 9. Duplicate types

| Current A | Current B | Recommended future SSoT |
|-----------|-----------|-------------------------|
| `CartLine` in `apps/web/.../pos-types.ts` | `PosCartLine` in `packages/domain/src/pos-cart.ts` | Domain `PosCartLine` |
| `InvoicePreview` in `ReceiptPreview.tsx` | `getInvoice` return shape (untyped `as InvoicePreview`) | Contracts `SaleInvoiceDocument` |
| `Sale` in `@electronic-erp/contracts` | Ad-hoc `Record<string, unknown>` on Returns search matches | Contracts throughout UI |

---

## Not duplicates (keep both)

- Domain vs repository: correct layering.
- `sale_returns` header vs `stock_movements`: different tables, one flow.
- Easy vs Advanced POS mode: one UI, two densities.

---

*No files deleted. No code merged.*
