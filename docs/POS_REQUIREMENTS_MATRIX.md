# POS Requirements Matrix (Phase 1 Audit)

Full narrative audit: [`POS_PHASE1_AUDIT.md`](./POS_PHASE1_AUDIT.md)

**Status:** E = Existing · P = Partial · M = Missing · B = Broken/unsafe

| # | Requirement | Existing | Partial | Missing | Broken | File/Location |
|---|-------------|:--------:|:-------:|:-------:|:------:|---------------|
| 1 | POS Main Screen | ✓ | | | | `apps/web/src/features/pos/PosPage.tsx` |
| 2 | Global product search | ✓ | | | | `packages/db/.../pos-repository.ts` searchProducts; PosProductPanel |
| 3 | Product name search | ✓ | | | | searchProducts |
| 4 | Urdu name search | ✓ | | | | searchProducts `name_ur` |
| 5 | SKU/ID search | ✓ | | | | searchProducts |
| 6 | Barcode/QR search | ✓ | | | | searchProducts + barcodes |
| 7 | Brand/model search | ✓ | | | | searchProducts |
| 8 | Category search | | ✓ | | | Taxonomy chips; weak N+1 name search |
| 9 | Voice search | | | ✓ | | — |
| 10 | Camera recognition | | ✓ | | | AI + hardware camera; often unconfigured |
| 11 | Barcode scanner | | ✓ | | | USB wedge memory adapter |
| 12 | QR scanner | | ✓ | | | Host/camera dependent |
| 13 | Manual entry | ✓ | | | | PosCartPanel |
| 14 | Recent products | ✓ | | | | localStorage |
| 15 | Favorites | ✓ | | | | localStorage |
| 16 | Categories | | ✓ | | | Category chips |
| 17 | Cart | ✓ | | | | PosCartPanel |
| 18 | Quantity management | ✓ | | | | PosCartPanel |
| 19 | Unit selection | | ✓ | | | Unit from product only |
| 20 | Price display | ✓ | | | | Grid + cart |
| 21 | Item discount | ✓ | | | | Cart + discount-policy + API RBAC |
| 22 | Invoice discount | ✓ | | | | PosPaymentPanel |
| 23 | Customer discount | | | ✓ | | — |
| 24 | Promotion discount | | ✓ | | | Schema kind only |
| 25 | Bulk discount | | | ✓ | | — |
| 26 | Tax calculation | | ✓ | | | Default tax_rates on cart |
| 27 | Customer selection | ✓ | | | | PosCustomerPanel |
| 28 | Walk-in customer | ✓ | | | | PosPage + sale-transaction |
| 29 | Existing customer | ✓ | | | | parties API |
| 30 | New customer | | | ✓ | | Use /customers |
| 31 | Customer history | | | ✓ | | Not on POS |
| 32 | Credit limit | | ✓ | | | Displayed; soft UI |
| 33 | Outstanding | | ✓ | | | Displayed |
| 34 | Loyalty points | | | ✓ | | Module not POS-wired |
| 35 | Price tier | ✓ | | | | retail/wholesale/dealer |
| 36 | Retail price | ✓ | | | | pickPrice |
| 37 | Wholesale price | ✓ | | | | pickPrice |
| 38 | Dealer price | ✓ | | | | pickPrice |
| 39 | Customer-specific price | | ✓ | | | DB yes; POS no |
| 40 | Quantity pricing | | | ✓ | | — |
| 41 | Promotion pricing | | | ✓ | | — |
| 42 | Manual price override | ✓ | | | | Cart + approval |
| 43 | Discount approval | | ✓ | | | Session RBAC; no PIN |
| 44 | Tax exemption | | ✓ | | | Rate flag only |
| 45 | Tax invoice | | ✓ | | | Layouts; FBR not live |
| 46 | Cash payment | ✓ | | | | payment_methods |
| 47 | Bank transfer | ✓ | | | | bank |
| 48 | Card payment | ✓ | | | | card |
| 49 | JazzCash | ✓ | | | | jazzcash |
| 50 | Easypaisa | ✓ | | | | easypaisa |
| 51 | SadaPay | ✓ | | | | sadapay |
| 52 | Credit/Udhar | ✓ | | | | allowCreditDue |
| 53 | Installment | ✓ | | | | createInstallment |
| 54 | Full payment | ✓ | | | | PosPaymentPanel |
| 55 | Partial payment | ✓ | | | | with customer |
| 56 | Split payment | ✓ | | | | PosPaymentPanel |
| 57 | Advance payment | | ✓ | | | Down payment only |
| 58 | Installment schedule | | ✓ | | | Domain creates; no POS preview |
| 59 | Down payment | ✓ | | | | Payment panel |
| 60 | Installment count | ✓ | | | | Payment panel |
| 61 | Frequency | | | ✓ | | Not on POS |
| 62 | Due dates | | ✓ | | | Domain startDate |
| 63 | Monthly amount | | | ✓ | | — |
| 64 | Late fee | | | ✓ | | — |
| 65 | Payment confirmation | | ✓ | | | Toast + receipt |
| 66 | Receipt printing | | ✓ | | | Memory/Null adapters |
| 67 | Digital receipt | ✓ | | | | ReceiptPreview |
| 68 | Payment verification | | | ✓ | | — |
| 69 | Reference person | | ✓ | | | Thin / notes |
| 70 | Salesman | ✓ | | | | HR salesmen |
| 71 | Commission | ✓ | | | | commissionPercent |
| 72 | Hold sale | ✓ | | | | posApi.hold |
| 73 | Resume sale | ✓ | | | | resumeHold |
| 74 | Cancel sale | ✓ | | | | Pre-post clear only |
| 75 | Manager approval | | ✓ | | | PosApprovalDialog |
| 76 | Price override | ✓ | | | | Cart |
| 77 | Duplicate invoice | | ✓ | | | Idempotent re-post |
| 78 | Recalculate | | ✓ | | | Live cart only |
| 79 | Clear cart | ✓ | | | | F7 |
| 80 | Invoice generation | ✓ | | | | postSale |
| 81 | A4 invoice | ✓ | | | | ReceiptPreview |
| 82 | 80mm receipt | ✓ | | | | receipt_80 |
| 83 | 58mm receipt | ✓ | | | | receipt_58 |
| 84 | WhatsApp invoice | ✓ | | | | wa.me |
| 85 | Email invoice | ✓ | | | | mailto |
| 86 | PDF invoice | | ✓ | | | Text + print-to-PDF |
| 87 | Save invoice | ✓ | | | | sales table |
| 88 | Sales history | ✓ | | | | InvoicesPage |
| 89 | Sales search | ✓ | | | | Invoice # filter |
| 90 | Sales reports | ✓ | | | | Reports hub |
| 91 | Sales return | ✓ | | | | ReturnsPage |
| 92 | Sales exchange | ✓ | | | | returnType exchange |
| 93 | Return stock update | ✓ | | | | postReturn |
| 94 | Hold/resume management | | ✓ | | | In-POS list only |
| 95 | Salesman/reference mgmt | | ✓ | | | SalesmanPage + HR |
| 96 | Commission management | | ✓ | | | HR commissions summary |
| 97 | Delivery management | | ✓ | | | POS create + /deliveries; no GPS |

**Rough totals:** Existing ~52 · Partial ~32 · Missing ~12 · Broken (systemic): non-atomic sale chain + ops (migration/sync config).

**TypeScript:** `apps/web` + `apps/api` `tsc --noEmit` clean in this audit pass.
