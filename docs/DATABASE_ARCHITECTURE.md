# Electrical Store ERP — Database Architecture

**Phase:** 0  
**Canonical store (online):** Supabase PostgreSQL  
**Operational mirror (offline):** SQLite (subset)  
**Principle:** One master business data model; dual persistence  

---

## 1. Design Rules

### 1.1 Identity & tenancy

| Field | Rule |
|-------|------|
| Primary key | `id UUID` (generate client- or server-side; offline-safe) |
| Tenancy | `organization_id UUID NOT NULL` on all business tables |
| Branch scope | `branch_id UUID` on operational/transactional tables |
| Audit actors | `created_by`, `updated_by` (user UUID, nullable for system) |
| Timestamps | `created_at`, `updated_at` timestamptz |
| Soft delete | `deleted_at` where legal/history retention requires it |
| Concurrency | `version INT NOT NULL DEFAULT 1` on mutable masters & open docs |
| Sync | See §6 sync columns |

### 1.2 No duplicate entities

- Do not create parallel “online_products” / “offline_products”.
- Do not store independent stock balances without movement ledger.
- Customer/supplier **balances** are projections of ledger lines.
- `branches` appears once (listed twice in prompt = same entity).

### 1.3 Money & quantity

- Money: `NUMERIC(18,2)` (or `NUMERIC(18,4)` for unit costs if needed)
- Quantity: `NUMERIC(18,4)` to support fractional units (meters, kg)
- Currency: organization default PKR; multi-currency later via explicit fields

### 1.4 Referential integrity

- Hard FKs online (Postgres)
- SQLite mirrors FKs with `PRAGMA foreign_keys = ON`
- Cross-org references forbidden

---

## 2. Base Mixins (logical)

```text
OrgScoped     = organization_id
BranchScoped  = organization_id + branch_id
Audited       = created_at, updated_at, created_by, updated_by
SoftDelete    = deleted_at
Versioned     = version
Syncable      = origin_device_id, last_synced_at, sync_status (optional cache)
```

Transactional docs typically: `BranchScoped + Audited + SoftDelete + Versioned + Syncable`.

---

## 3. Entity Map by Domain

### 3.1 Organization & structure

| Entity | Purpose | Key relationships |
|--------|---------|-------------------|
| `organizations` | Tenant root | — |
| `branches` | Store / location | → organizations |
| `warehouses` | Stock holding | → branches |
| `warehouse_locations` | Bin/rack/shelf | → warehouses |
| `device_registry` | POS/devices | → organizations, branches |

### 3.2 Identity & access

| Entity | Purpose |
|--------|---------|
| `users` | Profile linked to auth.users |
| `roles` | Named role templates |
| `permissions` | `module.action` catalog |
| `role_permissions` | M2M |
| `user_roles` | User↔role (optionally branch-scoped) |
| `user_permissions` | Explicit grants/denies |
| `branch_memberships` | User access to branches |
| `login_attempts` | Failed login protection (optional table) |
| `sessions_meta` | Device session metadata (optional) |

> Prompt name `user_permissions` retained. Role M2M tables are required additions (not duplicates of business entities).

### 3.3 Product master

| Entity | Purpose |
|--------|---------|
| `categories` | Top-level category |
| `subcategories` | Child of category (or self-ref on categories — choose **subcategories** table to match SoT) |
| `brands` | Brand master |
| `companies` | Manufacturer / company |
| `product_types` | Cable, breaker, fan, tool, etc. |
| `products` | Sellable/purchasable item |
| `product_variants` | Size/color/gauge variants |
| `product_attributes` | Spec attributes |
| `units` | Piece, meter, pack, dozen… |
| `unit_conversions` | Factor between units |
| `barcodes` | One product/variant → many barcodes |
| `qr_codes` | QR payloads / codes |
| `product_media` | Images/files (Storage paths) |
| `product_specifications` | Structured specs |
| `price_levels` | Retail, wholesale, VIP… |
| `product_prices` | Price per level/branch/unit |

### 3.4 Parties

| Entity | Purpose |
|--------|---------|
| `customer_types` | Retail, wholesale, contractor |
| `customers` | Customer master |
| `customer_credit` | Limit, status, terms |
| `customer_ledger` | AR movements |
| `suppliers` | Supplier master |
| `supplier_ledger` | AP movements |
| `supplier_prices` | Current supplier price list |
| `supplier_price_history` | Historical prices |

### 3.5 Sales & POS

| Entity | Purpose |
|--------|---------|
| `sales` | Sale header / invoice |
| `sale_items` | Lines |
| `sale_payments` | Tender lines |
| `sale_returns` | Return header |
| `sale_return_items` | Return lines |
| `exchanges` | Exchange header linking return + new sale |
| `held_sales` | Parked carts |
| `quotations` | Quote header |
| `quotation_items` | Quote lines |
| `sales_orders` | Confirmed order (optional bridge quote→sale) |
| `deliveries` | Delivery notes |
| `references` | Outside references / agents |
| `commissions` | Commission entries |
| `salesman_targets` | Targets |
| `salesman_performance` | Performance snapshots / facts |

### 3.6 Purchases

| Entity | Purpose |
|--------|---------|
| `purchases` | PO / purchase invoice |
| `purchase_items` | Lines |
| `purchase_payments` | Payments to supplier |
| `purchase_returns` | Debit notes |
| `purchase_return_items` | Lines |

### 3.7 Inventory

| Entity | Purpose |
|--------|---------|
| `stock` | Projection: on_hand, reserved per warehouse/product/variant |
| `stock_movements` | Immutable qty delta ledger |
| `stock_adjustments` | Adjustment documents |
| `stock_counts` | Cycle count sessions |
| `stock_audits` | Audit sessions / results |
| `stock_reservations` | Reservations |
| `batches` | Batch / lot / expiry |
| `serial_numbers` | Serial tracking |
| `stock_transfers` | Transfer documents (required; implied by Stock Transfer module) |

### 3.8 Warranty & service

| Entity | Purpose |
|--------|---------|
| `warranties` | Warranty entitlement |
| `warranty_claims` | Claims |
| `warranty_replacements` | Replacement outcomes |
| `technicians` | Technician profiles |
| `job_cards` | Service intake |
| `repairs` | Repair jobs |
| `repair_parts` | Parts consumed |

### 3.9 Credit plans & payments

| Entity | Purpose |
|--------|---------|
| `installments` | Installment plan header |
| `installment_schedule` | Due schedule / payments |
| `payment_methods` | Cash, card, bank, jazzcash, etc. |
| `payment_accounts` | Logical tender accounts |
| `cash_accounts` | Petty/cash drawers |
| `bank_accounts` | Bank accounts |
| `bank_transactions` | Bank movements |
| `bank_reconciliation` | Reconciliation sessions |

### 3.10 Expenses & accounting

| Entity | Purpose |
|--------|---------|
| `expense_categories` | Categories |
| `expenses` | Expense documents |
| `accounting_accounts` | COA |
| `journal_entries` | Journal header |
| `journal_entry_lines` | Debit/credit lines |
| `receipt_vouchers` | Receipt vouchers |
| `payment_vouchers` | Payment vouchers |
| `transfer_vouchers` | Transfer vouchers |

### 3.11 Loyalty & CRM

| Entity | Purpose |
|--------|---------|
| `loyalty_accounts` | Points balance account |
| `loyalty_transactions` | Earn/burn |
| `campaigns` | Marketing campaigns |
| `customer_segments` | Segments |

### 3.12 HR

| Entity | Purpose |
|--------|---------|
| `employees` | Employee master (may link `users`) |
| `attendance` | Attendance records |
| `salaries` | Salary runs / slips |
| `incentives` | Incentive payouts |

### 3.13 Tax (Pakistan / FBR readiness)

| Entity | Purpose |
|--------|---------|
| `tax_rates` | GST/VAT rates |
| `tax_rules` | Applicability rules |
| `tax_documents` | Invoices/exports for authority readiness |

### 3.14 Governance & platform

| Entity | Purpose |
|--------|---------|
| `notifications` | User notifications |
| `approval_requests` | Workflow requests |
| `approval_actions` | Approve/reject steps |
| `audit_logs` | Immutable audit |
| `documents` | DMS metadata (Storage objects) |

### 3.15 Sync

| Entity | Purpose |
|--------|---------|
| `sync_metadata` | Cursors / versions per device-table |
| `sync_queue` | Outbound/inbound queue records |
| `sync_conflicts` | Conflict workspace |
| `device_registry` | Devices (also §3.1) |

---

## 4. Core Table Sketches (canonical fields)

> Sketches are architectural contracts for Phase 2 migrations — not yet applied SQL.

### 4.1 `organizations`

- id, name, legal_name, ntn, strn, phone, email, address  
- default_currency, timezone, settings jsonb  
- Audited, SoftDelete  

### 4.2 `branches`

- id, organization_id, code, name, address, phone  
- is_active, settings jsonb  
- Audited, SoftDelete  

### 4.3 `products`

- id, organization_id  
- sku, name, name_ur (nullable), description  
- category_id, subcategory_id, brand_id, company_id, product_type_id  
- base_unit_id, track_inventory, track_serial, track_batch  
- warranty_days, reorder_level, is_active  
- tax_rate_id  
- Versioned, Audited, SoftDelete, Syncable  

### 4.4 `sales`

- id, organization_id, branch_id, warehouse_id  
- invoice_number, status (`draft|held|posted|void`)  
- customer_id (nullable walk-in), salesman_user_id, reference_id  
- subtotal, discount_total, tax_total, grand_total  
- payment_status (`unpaid|partial|paid`)  
- price_level_id, held_sale_id, quotation_id  
- posted_at, idempotency_key UNIQUE(organization_id, idempotency_key)  
- Versioned, Audited, SoftDelete, Syncable  

### 4.5 `sale_items`

- id, organization_id, branch_id, sale_id  
- product_id, variant_id, unit_id  
- qty, unit_price, discount, tax, line_total  
- batch_id, serial_number_id  
- cost_at_sale (for profit)  

### 4.6 `stock_movements`

- id, organization_id, branch_id, warehouse_id  
- product_id, variant_id, batch_id, serial_number_id  
- qty_delta (+/−), unit_id  
- movement_type, source_type, source_id  
- occurred_at  
- Audited (no soft delete; reverse via opposite movement)  

### 4.7 `customer_ledger`

- id, organization_id, branch_id, customer_id  
- entry_type, amount, balance_after (optional cache)  
- source_type, source_id  
- occurred_at, notes  
- Audited  

### 4.8 `journal_entries` / `journal_entry_lines`

- Header: number, date, memo, source_type, source_id, status  
- Lines: account_id, debit, credit, branch_id, partner refs  
- Constraint: sum(debit)=sum(credit)  

### 4.9 `installments` / `installment_schedule`

- Plan linked to sale_id, customer_id, principal, interest, count  
- Schedule: due_date, amount_due, amount_paid, status  

### 4.10 Sync tables

**`sync_metadata`**

- id, organization_id, device_id, table_name  
- last_pulled_at, last_pushed_at, server_cursor, client_cursor  

**`sync_queue`**

- id, organization_id, device_id  
- direction (`push|pull`), entity_type, entity_id  
- payload jsonb, idempotency_key  
- status (`pending|processing|done|failed`), attempts, last_error  

**`sync_conflicts`**

- id, organization_id, device_id  
- entity_type, entity_id  
- server_version, client_version  
- server_payload, client_payload  
- resolution (`pending|server_wins|client_wins|merged|manual`)  
- resolved_by, resolved_at  

**`device_registry`**

- id, organization_id, branch_id  
- device_key, name, platform (`electron|web|mobile`)  
- public_key / secret hash, status (`pending|active|revoked`)  
- last_seen_at  

---

## 5. Transactional Integrity Patterns

### 5.1 Sale posting (DB level)

Within one DB transaction:

1. Insert/update `sales` + `sale_items` (status → posted)  
2. Insert `stock_movements`; update `stock` projection; mark serials sold  
3. Insert `sale_payments`; update cash/bank  
4. Insert `customer_ledger` if credit  
5. Insert `journal_entries` + lines  
6. Create `warranties` / `installments` as applicable  
7. Insert `commissions`  
8. Insert `audit_logs`  
9. Enqueue analytics/notification outbox  

Failure → ROLLBACK all.

### 5.2 Stock absolute values

- Never accept synced absolute `stock.on_hand` as authoritative across devices.  
- Apply movements idempotently; rebuild projection.

### 5.3 Soft delete vs void

- Master data: soft delete  
- Posted financial documents: **void** with reversing movements/journals (keep row)  

---

## 6. Sync Metadata on Rows

Recommended columns on syncable tables:

```text
origin_device_id UUID NULL
last_synced_at TIMESTAMPTZ NULL
```

Plus existing `updated_at` + `version` for conflict detection.

Tombstones: soft-deleted rows sync with `deleted_at` set; hard delete only for purge jobs after retention.

---

## 7. Indexes (essential)

- `(organization_id, branch_id, created_at)` on transactions  
- Unique `(organization_id, sku)` on products  
- Unique barcodes per org  
- `(customer_id, occurred_at)` ledger  
- `(warehouse_id, product_id, variant_id)` stock  
- `(source_type, source_id)` on movements/ledgers/journals  
- Partial indexes on `deleted_at IS NULL`  

---

## 8. RLS Strategy (Supabase)

- Enable RLS on all tenant tables  
- Policy: `organization_id` in `auth` JWT claims / `user_organization_members`  
- Branch-restricted roles: additional `branch_id IN (user_branches)`  
- Service role used only by API for privileged sync/admin  
- `audit_logs`: insert allowed for authenticated service paths; no update/delete  

---

## 9. Storage Buckets

| Bucket | Contents |
|--------|----------|
| `product-media` | Images |
| `documents` | PDFs, attachments |
| `tax-documents` | Authority packs |
| `backups` | Encrypted offline backup blobs (restricted) |

Paths prefixed by `organization_id/`.

---

## 10. Offline SQLite Coverage

Full detail in `OFFLINE_ARCHITECTURE.md`. Offline includes operational subset of entities above; excludes heavy HQ-only aggregates until synced views are required.

---

## 11. Entity Relationship Overview

```text
organizations
  ├── branches
  │     ├── warehouses → warehouse_locations
  │     ├── device_registry
  │     ├── sales → sale_items → sale_payments
  │     ├── purchases → purchase_items
  │     ├── expenses
  │     └── stock_movements → stock
  ├── users / roles / permissions
  ├── products → variants / barcodes / prices
  ├── customers → credit / ledger / loyalty
  ├── suppliers → ledger / prices
  ├── accounting_accounts → journal_entries
  └── sync_* / audit_logs / documents / approvals
```

---

## 12. Migrations Plan (Phase 2+)

1. Extensions (`pgcrypto`, etc.)  
2. Org/branch/warehouse  
3. Auth profile + RBAC  
4. Product masters + units + prices  
5. Parties (customers/suppliers)  
6. Inventory movements + stock  
7. Purchases  
8. Sales / returns / hold  
9. Payments / cash / bank  
10. Accounting  
11. Installments / warranty / service  
12. HR  
13. CRM/loyalty  
14. Tax  
15. Approvals / notifications / documents / audit  
16. Sync tables + RLS policies + seeds  

**No migrations applied in Phase 0.**  
