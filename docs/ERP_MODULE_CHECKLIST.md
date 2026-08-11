# Electrical Store ERP — Complete Module Inventory & Checklist

**Phase:** 17 — Complete ERP Integration + End-to-End QA  
**Source of Truth:** Master functional specification module tree  
**Status legend:** `[NOT IMPLEMENTED]` · `[PARTIAL]` · `[IMPLEMENTED]` · `[TESTED]`  

**Global codebase status:** Phase 17 QA complete — every module has an explicit status (see below). No unchecked requirements.

For every module below:

- Requirements  
- Dependencies  
- Database entities  
- APIs  
- UI screens  
- Permissions  
- Offline requirements  
- Sync requirements  
- Reports  
- Tests  

---

## Dependency Map (summary)

```text
[58 Master Business] + [57 Security] + [44–46 Users/Roles/Permissions/Audit]
        → [50 Multi-Branch] + [56 Settings] + [59 Device Support]
        → [2–6 Catalog] + [10 Pricing] + [5 Barcode]
        → [21 Suppliers] + [20 Purchases] + [23–26 Inventory/Warehouse/Transfer]
        → [12 Customers] + [13–15 Payments/Credit/Installments] + [38 Loyalty]
        → [7–9 POS] + [11 Discounts] + [16–19 Returns/Invoice/Hold/Salesman]
        → [28 Quotations] + [27 Delivery]
        → [31–33 Accounts/Banking/Expenses] + [60 Auto Transaction Linking]
        → [29–30 Service/Warranty] + [HR]
        → [42–43 Documents/Approvals] + [47 Notifications]
        → [48–49 Offline POS/Sync]
        → [34–37 AI/BI/Reports/CRM] + [39–41 B2B/Store/Mobile]
        → [51 Tax/FBR] + [52–55 Import/Print/Backup/API]
```

---

## 1. Dashboard

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Role-based home: sales today, cash position, stock alerts, credit dues, approvals pending, sync health; branch filter; bilingual labels |
| Dependencies | Auth, Branches, Sales, Inventory, Credit, Notifications, Permissions |
| Database entities | Reads: sales, stock, customer_credit, installment_schedule, approval_requests, sync_metadata (no exclusive table) |
| APIs | `GET /dashboard/summary`, `GET /dashboard/alerts` |
| UI screens | Main Dashboard; widget settings (optional) |
| Permissions | `dashboard.view`, `dashboard.view_finance`, `dashboard.view_all_branches` |
| Offline | Local summary from SQLite (today’s sales, local alerts) |
| Sync | Pull recent aggregates or compute locally |
| Reports | Deep links into report modules |
| Tests | Widget permission filtering; branch scoping |

---

## 2. Product Management

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | CRUD products/variants; SKU; specs; media; tax; tracking flags; active/inactive; search; bulk edit; Urdu name optional |
| Dependencies | Categories, Brands, Companies, Units, Tax, Permissions |
| Database entities | products, product_variants, product_attributes, product_media, product_specifications, product_types |
| APIs | `/products` CRUD, media upload, variant endpoints |
| UI screens | Product list, Product form, Variant manager, Media gallery |
| Permissions | `products.read/write/delete`, `products.manage_media` |
| Offline | Cached catalog read; limited create/update queued |
| Sync | Row sync masters; media lazy |
| Reports | Product master list, inactive items |
| Tests | SKU uniqueness; tracking flags; soft delete |

---

## 3. Units & Quantity Management

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Base/alternate units; conversions; sell in meter/pack; precision rules |
| Dependencies | Products |
| Database entities | units, unit_conversions |
| APIs | `/units`, `/unit-conversions` |
| UI screens | Units setup; conversion matrix on product |
| Permissions | `units.manage` |
| Offline | Full read; admin write online-preferred |
| Sync | Master row sync |
| Reports | Conversion audit |
| Tests | Conversion math; rounding |

---

## 4. Categories / Brands / Companies

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Hierarchical categories + subcategories; brands; companies/manufacturers |
| Dependencies | Organization |
| Database entities | categories, subcategories, brands, companies |
| APIs | `/categories`, `/subcategories`, `/brands`, `/companies` |
| UI screens | Taxonomy managers |
| Permissions | `catalog_taxonomy.manage` |
| Offline | Read cache |
| Sync | Master sync |
| Reports | Products by brand/category |
| Tests | Hierarchy integrity |

---

## 5. Barcode & QR

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Multiple barcodes/SKU; QR payload; label print; scan-to-find; duplicate detection |
| Dependencies | Products, Printing, Hardware |
| Database entities | barcodes, qr_codes |
| APIs | `/barcodes`, `/qr-codes`, lookup-by-code |
| UI screens | Barcode assign; label batch print; scanner test |
| Permissions | `barcodes.manage`, `barcodes.print` |
| Offline | Lookup + assign queued |
| Sync | Master sync; unique conflict handling |
| Reports | Missing barcode list |
| Tests | Unique code per org; scanner normalization |

---

## 6. AI Camera Recognition

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Camera capture → suggest product match; assist POS entry; confidence threshold; manual confirm |
| Dependencies | Product media, Hardware camera, Products |
| Database entities | product_media; optional `recognition_events` (helper, not duplicate master) |
| APIs | `POST /ai/recognize-product` (online); local model optional later |
| UI screens | Camera recognize modal in POS/Product entry |
| Permissions | `ai.recognize` |
| Offline | Optional local embeddings later; else disabled with message |
| Sync | N/A for inferences; confirmed product links sync as product ops |
| Reports | Recognition accuracy log |
| Tests | Threshold gating; fallback to search |

---

## 7. POS / Sales

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Fast cart; scan; qty; customer; tax; tender; park; shortcuts; touch; post atomic sale pipeline |
| Dependencies | Products, Pricing, Discounts, Customers, Payments, Stock, Users, Printing, Auto Linking |
| Database entities | sales, sale_items, sale_payments, held_sales |
| APIs | `POST /sales`, `GET /sales`, void endpoints |
| UI screens | POS terminal; sale success/print; void |
| Permissions | `pos.sell`, `pos.void`, `pos.open_drawer` |
| Offline | **Required** full posting |
| Sync | Command sync sale aggregates |
| Reports | Daily POS summary |
| Tests | Atomic post; stock; tender; keyboard flows |

---

## 8. Advanced Product Search

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Fuzzy name/SKU/barcode/brand/spec; filters; recent; keyboard nav |
| Dependencies | Products, Barcodes |
| Database entities | Reads products + FTS indexes |
| APIs | `GET /products/search` |
| UI screens | Search palette in POS and catalog |
| Permissions | `products.read` |
| Offline | Local FTS/SQLite LIKE indexes |
| Sync | Catalog freshness |
| Reports | N/A |
| Tests | Ranking; barcode exact match priority |

---

## 9. POS Product Entry

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Quick-add product from POS ( moderated); capture barcode/photo; draft → approval optional |
| Dependencies | Products, Approvals, AI Camera, Permissions |
| Database entities | products (draft status), approval_requests |
| APIs | `POST /products/quick`, approval hooks |
| UI screens | Quick product modal |
| Permissions | `products.quick_create`, `products.approve` |
| Offline | Create local draft/product; sync |
| Sync | Product create command |
| Reports | Quick-created products |
| Tests | Permission + approval path |

---

## 10. Pricing

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Cost, retail, wholesale, price levels, branch overrides, min price, history |
| Dependencies | Products, Customer types, Branches |
| Database entities | price_levels, product_prices |
| APIs | `/price-levels`, `/product-prices`, bulk update |
| UI screens | Price list editor; matrix |
| Permissions | `pricing.read/write`, `pricing.below_min` |
| Offline | Cached levels; sale stores unit_price snapshot |
| Sync | Master sync; conflicts LWW |
| Reports | Margin list; price change log |
| Tests | Level resolution order |

---

## 11. Discounts

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — discount policy + POS audits; dedicated /discounts UI is placeholder |
| Requirements | Line/cart % or amount; max caps by role; coupon later; reason codes |
| Dependencies | POS, Permissions, Audit |
| Database entities | sale/sale_items discount fields; optional discount_reasons |
| APIs | Validated inside `POST /sales` |
| UI screens | Discount keypad; manager override |
| Permissions | `pos.discount`, `pos.discount_override` |
| Offline | Enforce local permission caps |
| Sync | Embedded in sale command |
| Reports | Discount analysis |
| Tests | Cap enforcement; audit |

---

## 12. Customers

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | CRUD; types; contacts; address; history; walk-in |
| Dependencies | Customer types, Branches |
| Database entities | customers, customer_types |
| APIs | `/customers` CRUD, statement |
| UI screens | Customer list/detail/form; POS selector |
| Permissions | `customers.read/write/merge` |
| Offline | **Required** read/create |
| Sync | Row sync + duplicate phone rules |
| Reports | Customer list; activity |
| Tests | Unique phone/email policies |

---

## 13. Payments

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Cash/card/bank/wallet/mixed; change; receipt; link to sale/purchase/installment |
| Dependencies | Payment methods, Cash/Bank accounts, Sales, Auto Linking |
| Database entities | sale_payments, purchase_payments, payment_methods, payment_accounts |
| APIs | Payment subresources; `POST /payments` for stand-alone receipts |
| UI screens | Tender screen; payment history |
| Permissions | `payments.take`, `payments.refund` |
| Offline | **Required** |
| Sync | Command sync; idempotent |
| Reports | Payments by method |
| Tests | Mixed tender; overpay change |

---

## 14. Credit / Udhaar

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Credit limit; block/warn; ledger; recoveries; aging |
| Dependencies | Customers, Sales, Payments, Accounts |
| Database entities | customer_credit, customer_ledger |
| APIs | `/customers/:id/credit`, `/customers/:id/ledger`, receive-on-account |
| UI screens | Credit dashboard; customer ledger; aging |
| Permissions | `credit.view`, `credit.override_limit`, `credit.collect` |
| Offline | **Required** with cached limit + local ledger |
| Sync | Ledger lines command/row; recompute balance |
| Reports | Aging, outstanding udhaar |
| Tests | Limit breach; override audit |

---

## 15. Installments

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Plans on sale; schedule; collections; late fees policy; reminders |
| Dependencies | Sales, Customers, Payments, Notifications |
| Database entities | installments, installment_schedule |
| APIs | `/installments`, collect payment, restructure |
| UI screens | Plan builder; dues list; collection |
| Permissions | `installments.manage`, `installments.collect` |
| Offline | **Required** collect + create with sale |
| Sync | Command sync collections |
| Reports | Dues, delinquency |
| Tests | Schedule generation; partial pay |

---

## 16. Sales Returns / Exchange

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Return by invoice; restock/damage; refund/credit; exchange link |
| Dependencies | Sales, Stock, Payments, Permissions |
| Database entities | sale_returns, sale_return_items, exchanges |
| APIs | `/sale-returns`, `/exchanges` |
| UI screens | Return wizard; exchange wizard |
| Permissions | `sales.return`, `sales.exchange` |
| Offline | **Required** |
| Sync | Command sync |
| Reports | Return reasons; rate |
| Tests | Stock in; payment reverse; serial restore |

---

## 17. Invoice Management

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Numbering; reprint; PDF; email/WhatsApp later; void; search |
| Dependencies | Sales, Printing, Tax documents |
| Database entities | sales (invoice fields), documents |
| APIs | `/invoices`, PDF render |
| UI screens | Invoice list/detail/print preview |
| Permissions | `invoices.view`, `invoices.reprint`, `invoices.void` |
| Offline | **Required** local print |
| Sync | Numbers reserved offline |
| Reports | Invoice register |
| Tests | Number uniqueness; void path |

---

## 18. Hold / Resume Sale

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Park cart; list holds; resume; expire; optional reservation |
| Dependencies | POS, Stock reservations |
| Database entities | held_sales, stock_reservations |
| APIs | `/held-sales` |
| UI screens | Hold list; resume |
| Permissions | `pos.hold`, `pos.resume_any` |
| Offline | Device-local + sync when online |
| Sync | Device-owned until posted |
| Reports | Abandoned holds |
| Tests | Resume integrity; stock reserve |

---

## 19. Salesman / References

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — commission posts with sales; /salesman UI is placeholder |
| Requirements | Assign salesman; outside reference; commissions; targets; performance |
| Dependencies | Users/Employees, Sales, Commissions |
| Database entities | references, commissions, salesman_targets, salesman_performance |
| APIs | `/references`, `/commissions`, `/salesman/targets` |
| UI screens | Assign on POS; commission setup; target board |
| Permissions | `salesman.manage`, `commissions.view/manage` |
| Offline | Assign on sale; commission computed locally |
| Sync | With sale + commission rows |
| Reports | Salesman performance; commission payable |
| Tests | Commission rules |

---

## 20. Purchases

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | PO/bill; receive stock; costs; partial receive; return |
| Dependencies | Suppliers, Products, Inventory, Payments |
| Database entities | purchases, purchase_items, purchase_payments, purchase_returns, purchase_return_items |
| APIs | `/purchases`, receive, payments, returns |
| UI screens | Purchase list/form/receive/return |
| Permissions | `purchases.read/write/receive/return` |
| Offline | **Required** subset |
| Sync | Command sync |
| Reports | Purchase register; GRNI |
| Tests | Costing; stock-in; AP ledger |

---

## 21. Suppliers

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | CRUD; contacts; ledger; payables aging |
| Dependencies | Organization |
| Database entities | suppliers, supplier_ledger |
| APIs | `/suppliers`, ledger |
| UI screens | Supplier list/detail |
| Permissions | `suppliers.read/write` |
| Offline | **Required** read/basic create |
| Sync | Row sync |
| Reports | Supplier balances |
| Tests | Ledger link to purchases |

---

## 22. Supplier Purchase Automation

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — purchase/reorder domain paths; /purchase-automation UI is placeholder |
| Requirements | Reorder suggestions from min stock; price lists; last price; draft PO generation |
| Dependencies | Inventory, Supplier prices, Purchases |
| Database entities | supplier_prices, supplier_price_history; uses stock.reorder |
| APIs | `GET /purchasing/suggestions`, `POST /purchases/from-suggestions` |
| UI screens | Reorder workspace |
| Permissions | `purchases.automate` |
| Offline | Suggestions from local stock; create draft PO |
| Sync | Draft PO + price lists |
| Reports | Suggested vs purchased |
| Tests | Suggestion math |

---

## 23. Inventory

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | On-hand/reserved; movements; adjustments; valuation; low stock |
| Dependencies | Warehouses, Products, Purchases, Sales |
| Database entities | stock, stock_movements, stock_adjustments, stock_counts, stock_audits, stock_reservations |
| APIs | `/stock`, `/stock/movements`, adjustments, counts |
| UI screens | Stock overview; movement history; adjust; count |
| Permissions | `inventory.view`, `inventory.adjust`, `inventory.count` |
| Offline | **Required** |
| Sync | Movements authoritative |
| Reports | Stock valuation; movement; low stock |
| Tests | No negative (policy); projection rebuild |

---

## 24. Batch / Serial / Warranty / Expiry

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Batch/lot/expiry; serial lifecycle; warranty start on sale |
| Dependencies | Products, Sales, Purchases, Warranty |
| Database entities | batches, serial_numbers, warranties |
| APIs | Batch/serial lookup; assign on receive/sale |
| UI screens | Serial/batch pickers; expiry alerts |
| Permissions | `inventory.serial`, `inventory.batch` |
| Offline | Enforce uniqueness locally |
| Sync | Strict unique serial conflicts |
| Reports | Expiry calendar; serial trace |
| Tests | Double-sell serial prevention |

---

## 25. Warehouse

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Multi-warehouse per branch; locations/bins; default POS warehouse |
| Dependencies | Branches |
| Database entities | warehouses, warehouse_locations |
| APIs | `/warehouses`, `/warehouse-locations` |
| UI screens | Warehouse admin; location tree |
| Permissions | `warehouses.manage` |
| Offline | Home branch warehouses |
| Sync | Master sync |
| Reports | Stock by warehouse |
| Tests | Default warehouse resolution |

---

## 26. Stock Transfer

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Transfer doc; ship/receive; in-transit; inter-branch permission |
| Dependencies | Warehouses, Inventory, Approvals (optional) |
| Database entities | stock_transfers (+ items), stock_movements |
| APIs | `/stock-transfers` |
| UI screens | Transfer create/receive list |
| Permissions | `inventory.transfer`, `inventory.transfer_interbranch` |
| Offline | Intra-device warehouses only |
| Sync | Transfer commands |
| Reports | Transfer register |
| Tests | Balanced in/out movements |

---

## 27. Delivery

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Delivery notes from sale/order; status; driver notes; proof later |
| Dependencies | Sales, Sales orders, Customers |
| Database entities | deliveries |
| APIs | `/deliveries` |
| UI screens | Delivery board; note print |
| Permissions | `deliveries.manage` |
| Offline | Create/update local deliveries |
| Sync | Row/command sync |
| Reports | Pending deliveries |
| Tests | Status transitions |

---

## 28. Quotations

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Quote; validity; convert to sale/order; print |
| Dependencies | Products, Customers, Pricing |
| Database entities | quotations, quotation_items, sales_orders |
| APIs | `/quotations`, convert endpoints |
| UI screens | Quote editor; list; convert |
| Permissions | `quotations.manage`, `quotations.convert` |
| Offline | Create/convert locally |
| Sync | Row sync |
| Reports | Quote conversion rate |
| Tests | Price snapshot; convert integrity |

---

## 29. Service & Repair

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Job cards; diagnosis; parts; labor; status; customer updates |
| Dependencies | Customers, Products, Technicians, Inventory, Invoicing |
| Database entities | job_cards, repairs, repair_parts, technicians |
| APIs | `/job-cards`, `/repairs` |
| UI screens | Service desk; job detail; parts issue |
| Permissions | `service.manage`, `service.close` |
| Offline | Basic job create/update |
| Sync | Row sync; parts as stock movements |
| Reports | Turnaround; technician load |
| Tests | Parts stock issue |

---

## 30. Warranty

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Auto create on sale; claims; replacements; supplier RMA link |
| Dependencies | Sales, Serials, Service |
| Database entities | warranties, warranty_claims, warranty_replacements |
| APIs | `/warranties`, `/warranty-claims` |
| UI screens | Warranty lookup; claim workflow |
| Permissions | `warranty.manage`, `warranty.claim` |
| Offline | Lookup + claim draft |
| Sync | Claims sync |
| Reports | Claim rates; expiry |
| Tests | Entitlement window |

---

## 31. Accounts & Finance

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | COA; auto journals from ops; manual journals; P&amp;L; BS; period lock |
| Dependencies | Auto Linking, Sales, Purchases, Expenses, Banking |
| Database entities | accounting_accounts, journal_entries, journal_entry_lines, vouchers |
| APIs | `/accounts`, `/journals`, financial statements |
| UI screens | COA; journal; trial balance; P&amp;L; BS |
| Permissions | `accounts.view`, `accounts.post`, `accounts.lock_period` |
| Offline | Simplified local journals for ops; full statements online |
| Sync | Journal commands from postings |
| Reports | TB, P&amp;L, BS, day book |
| Tests | Double-entry balance; period lock |

---

## 32. Banking

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Bank accounts; deposits/withdrawals; transfer; reconciliation |
| Dependencies | Payments, Accounts |
| Database entities | bank_accounts, bank_transactions, bank_reconciliation, transfer_vouchers |
| APIs | `/bank-accounts`, `/bank-transactions`, reconcile |
| UI screens | Bank book; reconcile UI |
| Permissions | `banking.manage`, `banking.reconcile` |
| Offline | Record transfers locally |
| Sync | Transaction sync |
| Reports | Bank book; unreconciled |
| Tests | Reconcile matching |

---

## 33. Expenses

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Categories; claim; attach receipt; pay from cash/bank; approval thresholds |
| Dependencies | Expense categories, Accounts, Approvals, Documents |
| Database entities | expenses, expense_categories |
| APIs | `/expenses` |
| UI screens | Expense entry/list |
| Permissions | `expenses.manage`, `expenses.approve` |
| Offline | **Required** |
| Sync | Command sync |
| Reports | Expenses by category |
| Tests | Approval threshold; GL post |

---

## 34. AI Smart Business

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Insights: slow movers, reorder, credit risk, anomaly sales; natural language Q&amp;A later |
| Dependencies | BI data, Inventory, Credit, Sales |
| Database entities | Read models / optional insight_cache |
| APIs | `/ai/insights` |
| UI screens | Insights panel |
| Permissions | `ai.insights` |
| Offline | Cached last insights only |
| Sync | Online compute |
| Reports | Insight exports |
| Tests | Deterministic insight fixtures |

---

## 35. Business Intelligence

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | KPIs; trends; branch compare; product affinity basics |
| Dependencies | Sales, Inventory, Accounts |
| Database entities | Warehouses of facts optional; or live SQL views |
| APIs | `/bi/kpis`, `/bi/series` |
| UI screens | BI dashboards |
| Permissions | `bi.view`, `bi.view_all_branches` |
| Offline | No full BI |
| Sync | Online |
| Reports | Embedded charts |
| Tests | KPI formulas |

---

## 36. Complete Reporting

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Sales, purchase, stock, tax, AR/AP, cash, salesman, warranty, service — filterable export |
| Dependencies | All transactional modules |
| Database entities | Read-only over canonical tables/views |
| APIs | `/reports/:key` + export |
| UI screens | Report gallery; param form; export |
| Permissions | per-report permissions |
| Offline | Limited local day reports |
| Sync | Online for historical |
| Reports | (this module) |
| Tests | Totals reconcile to ledgers |

---

## 37. CRM & Marketing

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Segments; campaigns; follow-ups; notes |
| Dependencies | Customers, Notifications |
| Database entities | campaigns, customer_segments |
| APIs | `/campaigns`, `/segments` |
| UI screens | Segment builder; campaign list |
| Permissions | `crm.manage` |
| Offline | No campaign send |
| Sync | Online |
| Reports | Campaign performance |
| Tests | Segment query correctness |

---

## 38. Loyalty

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Points earn/burn; tiers; redeem at POS |
| Dependencies | Customers, POS, Payments |
| Database entities | loyalty_accounts, loyalty_transactions |
| APIs | `/loyalty` |
| UI screens | Loyalty setup; customer points; POS redeem |
| Permissions | `loyalty.manage`, `loyalty.redeem` |
| Offline | Earn/burn with sale; sync careful idempotency |
| Sync | Ledger-like transactions |
| Reports | Points liability |
| Tests | Earn rules; redeem caps |

---

## 39. B2B Wholesale Portal

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | External wholesale login; price levels; MOQ; order → sales_order |
| Dependencies | Customers, Pricing, Sales orders, Auth |
| Database entities | sales_orders; portal user links |
| APIs | Portal-scoped `/b2b/*` |
| UI screens | Portal catalog/cart/orders (web) |
| Permissions | Portal role `b2b.*` |
| Offline | N/A (online channel) |
| Sync | Orders into core ERP |
| Reports | B2B order book |
| Tests | Price level isolation |

---

## 40. Online Store

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Public/storefront API; stock reservation; order capture |
| Dependencies | Products, Stock, Sales orders, Payments |
| Database entities | sales_orders; store config in settings |
| APIs | `/store/*` |
| UI screens | Storefront (later app) + admin config |
| Permissions | `store.manage` |
| Offline | N/A |
| Sync | Orders into ERP |
| Reports | Online sales |
| Tests | OverSell prevention |

---

## 41. Mobile Apps

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — /api/v1 ready for mobile clients; native mobile apps not shipped; /mobile UI placeholder |
| Requirements | Mobile clients for approvals, stock view, light sales later; same API |
| Dependencies | API, Auth, Notifications |
| Database entities | Same canonical |
| APIs | Existing REST |
| UI screens | Mobile apps (future packages) |
| Permissions | Same RBAC |
| Offline | Limited offline later |
| Sync | Reuse engine concepts |
| Reports | N/A |
| Tests | Authz parity |

---

## 42. Document Management

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Attachments on entities; versioning metadata; Storage backed |
| Dependencies | Supabase Storage, Authz |
| Database entities | documents |
| APIs | `/documents` upload/link |
| UI screens | Attachments panel |
| Permissions | `documents.manage` |
| Offline | Queue file upload |
| Sync | Metadata sync; blob upload when online |
| Reports | Document register |
| Tests | Path isolation per org |

---

## 43. Approval Workflow

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Configurable approvals: discount, expense, transfer, credit override, void |
| Dependencies | Users, Notifications, Audit |
| Database entities | approval_requests, approval_actions |
| APIs | `/approvals` |
| UI screens | Inbox; request detail |
| Permissions | `approvals.act`, per-type submit |
| Offline | Queue request; block completion until approved if policy requires online |
| Sync | Priority pull/push |
| Reports | Approval SLA |
| Tests | Multi-step chain |

---

## 44. Users & Roles

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Invite/disable users; assign roles; branch membership; link employees |
| Dependencies | Auth, Permissions, Branches |
| Database entities | users, roles, user_roles, branch_memberships, employees (link) |
| APIs | `/users`, `/roles` |
| UI screens | User admin; role admin |
| Permissions | `users.manage`, `roles.manage` |
| Offline | Cached users for POS login |
| Sync | Masters; revocation must pull ASAP |
| Reports | User access matrix |
| Tests | Disable user blocks API |

---

## 45. Permissions

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Permission catalog; role matrix; user overrides; enforce server-side |
| Dependencies | Roles |
| Database entities | permissions, role_permissions, user_permissions |
| APIs | `/permissions`, matrix update |
| UI screens | Permission matrix UI |
| Permissions | `permissions.manage` |
| Offline | Cached effective permissions |
| Sync | Critical pull |
| Reports | Effective access report |
| Tests | Deny-by-default; override |

---

## 46. Audit Trail

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Immutable logs for sensitive actions; search; export |
| Dependencies | All modules |
| Database entities | audit_logs |
| APIs | `/audit-logs` |
| UI screens | Audit viewer |
| Permissions | `audit.view` |
| Offline | Local audit table; push |
| Sync | Append-only push |
| Reports | Audit export |
| Tests | No update/delete path |

---

## 47. Notifications

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | In-app feed; triggers; read state; later email/SMS |
| Dependencies | Users, Realtime |
| Database entities | notifications |
| APIs | `/notifications` |
| UI screens | Bell + list |
| Permissions | self-read; `notifications.broadcast` |
| Offline | Local device notifications for dues/sync fail |
| Sync | Online feed; local alerts merge |
| Reports | Delivery stats later |
| Tests | Trigger creation |

---

## 48. Offline POS

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Electron POS works offline for required ops; hardware; local DB |
| Dependencies | Sync, Device registry, Domain services, Hardware |
| Database entities | SQLite subset (see OFFLINE_ARCHITECTURE) |
| APIs | IPC + later sync API |
| UI screens | POS offline indicators; device activation |
| Permissions | Device-bound cashier roles |
| Offline | **Core module** |
| Sync | Full engine |
| Reports | Offline sales pending sync |
| Tests | Airplane-mode sale E2E |

---

## 49. Advanced Offline Sync

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Bidirectional; conflicts; retries; partial; cursors; idempotency |
| Dependencies | Offline POS, API, device_registry |
| Database entities | sync_metadata, sync_queue, sync_conflicts, device_registry |
| APIs | `/sync/push`, `/sync/pull`, `/sync/conflicts` |
| UI screens | Sync center; conflict resolver |
| Permissions | `sync.manage`, `sync.resolve` |
| Offline | Engine runs locally |
| Sync | (this module) |
| Reports | Sync health |
| Tests | Chaos/idempotency/conflicts |

---

## 50. Multi-Branch

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Branches; membership; consolidated vs branch reports; transfer rules |
| Dependencies | Organizations, Users, Warehouses |
| Database entities | branches, branch_memberships |
| APIs | `/branches` |
| UI screens | Branch switcher; branch admin |
| Permissions | `branches.manage`, `branches.view_all` |
| Offline | Home branch scope |
| Sync | Scope-filtered pull |
| Reports | Branch comparison |
| Tests | Cross-branch authz |

---

## 51. Pakistan Tax / FBR Readiness

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — tax rates/architecture ready; live FBR filing not connected |
| Requirements | Tax rates/rules; invoice tax breakdown; NTN/STRN fields; exportable tax documents; FBR integration hooks (adapter) |
| Dependencies | Sales, Purchases, Organizations, Settings |
| Database entities | tax_rates, tax_rules, tax_documents |
| APIs | `/tax/*`, document export |
| UI screens | Tax setup; tax invoice view; export |
| Permissions | `tax.manage`, `tax.export` |
| Offline | Compute tax on sale locally |
| Sync | Tax docs online submission when integrated |
| Reports | Tax summary |
| Tests | Tax calculation matrix |

---

## 52. Import / Export

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | CSV/Excel import products/customers/opening stock; export registers; validation errors |
| Dependencies | Products, Customers, Inventory, Permissions |
| Database entities | Uses targets; import_jobs helper optional |
| APIs | `/import`, `/export` |
| UI screens | Import wizard; export center |
| Permissions | `import.execute`, `export.execute` |
| Offline | Export local CSV; import queue |
| Sync | Imported rows sync as masters/movements |
| Reports | Import error reports |
| Tests | Dry-run validation |

---

## 53. Printing

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Templates for 58/80mm, A4, labels; preview; reprint |
| Dependencies | Hardware adapters, Invoices, Barcodes |
| Database entities | settings templates; documents PDFs |
| APIs | Render endpoints; local print IPC |
| UI screens | Template settings; print preview |
| Permissions | `printing.manage` |
| Offline | **Required** local print |
| Sync | Template master sync |
| Reports | N/A |
| Tests | Template render; ESC/POS encoding fakes |

---

## 54. Backup / Disaster Recovery

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — backup jobs/architecture; disaster_recovery_claimed=false until verified restore |
| Requirements | DB backup policy; offline DB backup; restore runbooks; RPO/RTO targets |
| Dependencies | Supabase, Storage, Offline DB |
| Database entities | backup metadata optional |
| APIs | Admin trigger backup upload |
| UI screens | Backup settings/status |
| Permissions | `backup.manage` |
| Offline | Local scheduled backup |
| Sync | Backup blob upload |
| Reports | Backup success log |
| Tests | Restore drill in staging |

---

## 55. API Integration

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | API keys/OAuth apps; webhooks; rate limits; OpenAPI |
| Dependencies | Security, Auth |
| Database entities | integration_clients / webhook_endpoints (platform helpers) |
| APIs | `/integrations/*` + public API |
| UI screens | Developer settings |
| Permissions | `integrations.manage` |
| Offline | N/A |
| Sync | Outbound webhooks online |
| Reports | Webhook delivery log |
| Tests | Signature verification |

---

## 56. Advanced Settings

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — org foundation settings exist; /settings UI is placeholder |
| Requirements | Org/branch settings; receipt header; sequences; locale; currency; POS policies |
| Dependencies | Organizations, Branches |
| Database entities | settings jsonb on org/branch; dedicated settings tables as needed |
| APIs | `/settings` |
| UI screens | Settings sections |
| Permissions | `settings.manage` |
| Offline | Cached settings pack |
| Sync | Master sync |
| Reports | N/A |
| Tests | Defaults; policy enforcement |

---

## 57. Security

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — RBAC/sessions/lockout/API keys [TESTED]; full authenticator 2FA not wired |
| Requirements | Auth, session, lockout, device approval, secrets, RLS, least privilege |
| Dependencies | Supabase Auth, RBAC, Audit, Devices |
| Database entities | users, login_attempts, device_registry, permissions… |
| APIs | Auth + admin security endpoints |
| UI screens | Security settings; sessions; devices |
| Permissions | `security.manage` |
| Offline | Hardened local vault |
| Sync | Revocation propagation |
| Reports | Security events |
| Tests | Lockout; key non-exposure |

---

## 58. Master Business Architecture

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Single domain model; shared validation; shared posting services; no dual ERPs |
| Dependencies | All |
| Database entities | Entire canonical model |
| APIs | Contract package governance |
| UI screens | Architecture docs (this phase) |
| Permissions | N/A |
| Offline | Shared domain package |
| Sync | Shared commands |
| Reports | N/A |
| Tests | Contract tests across runtimes |
| Notes | Documented in ERP_ARCHITECTURE / DATABASE / OFFLINE |

---

## 59. Device Support

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Register devices; hardware capability profile; printer/scanner config |
| Dependencies | Hardware adapters, Security |
| Database entities | device_registry |
| APIs | `/devices` |
| UI screens | Device admin; local device setup |
| Permissions | `devices.manage` |
| Offline | Device must be pre-approved |
| Sync | Device status pull |
| Reports | Device inventory |
| Tests | Revoked device cannot sync |

---

## 60. Automatic Transaction Linking

| Field | Detail |
|-------|--------|
| Status | [PARTIAL] — sale/purchase/accounting linking in domain; /transaction-linking UI placeholder |
| Requirements | One business event fans out to stock, ledgers, GL, warranty, commissions, etc.; source_type/source_id everywhere |
| Dependencies | Domain services, Accounts, Inventory, Payments |
| Database entities | Cross-cutting columns on movements/ledgers/journals |
| APIs | Embedded in command endpoints |
| UI screens | “Related documents” panel on sale/purchase |
| Permissions | Implicit via source docs |
| Offline | Same domain pipeline locally |
| Sync | Sync posted aggregates, not manual fan-out |
| Reports | Traceability |
| Tests | Pipeline integration tests |

---

## 61. HR & Employees

| Field | Detail |
|-------|--------|
| Status | [IMPLEMENTED] [TESTED] |
| Requirements | Employees; attendance; salaries; incentives; link to users/salesmen |
| Dependencies | Users, Branches, Accounts (salary payment) |
| Database entities | employees, attendance, salaries, incentives |
| APIs | `/employees`, `/attendance`, `/salaries`, `/incentives` |
| UI screens | Employee directory; attendance; payroll run |
| Permissions | `hr.manage`, `hr.payroll` |
| Offline | Attendance capture optional |
| Sync | Row sync |
| Reports | Attendance; payroll summary |
| Tests | Salary posting to GL |

---

## Cross-Module Traceability Matrix (transactions)

| Business event | Stock | Customer ledger | Supplier ledger | Cash/Bank | GL | Warranty | Installment | Commission | Audit |
|----------------|-------|-----------------|-----------------|-----------|----|----------|-------------|------------|-------|
| Sale (cash) | ✓ | | | ✓ | ✓ | ✓ | opt | ✓ | ✓ |
| Sale (credit) | ✓ | ✓ | | opt | ✓ | ✓ | opt | ✓ | ✓ |
| Sale return | ✓ | ✓ | | ✓ | ✓ | adj | | adj | ✓ |
| Purchase receive | ✓ | | ✓ | | ✓ | | | | ✓ |
| Supplier pay | | | ✓ | ✓ | ✓ | | | | ✓ |
| Expense | | | | ✓ | ✓ | | | | ✓ |
| Installment collect | | ✓ | | ✓ | ✓ | | ✓ | | ✓ |
| Stock adjust | ✓ | | | | ✓ | | | | ✓ |

---

## Phase Gate

| Gate | Status |
|------|--------|
| All 61 modules have explicit status | ✅ |
| Master sale / purchase / return / installment / warranty / warehouse chains tested | ✅ Domain Phase 17 |
| Offline + multi-device sync tested | ✅ Offline package |
| Permission isolation (backend) tested | ✅ |
| Accounting + report reconciliation tested | ✅ |
| Performance indexes (justified) | ✅ Migration 000017 |
| Quality gate (typecheck / tests / build) | See FINAL_ERP_STATUS.md |
| Final QA report | `docs/FINAL_ERP_STATUS.md` |

