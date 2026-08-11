import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("supabase foundation migration", () => {
  it("migration file exists and defines foundation tables", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000001_foundation.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "organizations",
      "branches",
      "user_profiles",
      "roles",
      "permissions",
      "user_roles",
      "role_permissions",
      "devices",
      "audit_logs",
      "sync_metadata",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("enable row level security");
  });

  it("product master migration defines catalog entities and storage policies", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000002_product_master.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "categories",
      "subcategories",
      "brands",
      "companies",
      "product_types",
      "product_models",
      "units",
      "unit_conversions",
      "attribute_definitions",
      "products",
      "product_variants",
      "product_attributes",
      "product_prices",
      "barcodes",
      "qr_codes",
      "product_media",
      "product_specifications",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("numeric(18,4)");
    expect(sql).toContain("product-media");
    expect(sql).toContain("unique (organization_id, sku)");
  });

  it("inventory engine migration defines ledger and related entities", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000003_inventory_engine.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "warehouses",
      "inventory_costing_settings",
      "stock_movements",
      "stock_balances",
      "stock_batches",
      "stock_serials",
      "stock_serial_movements",
      "stock_adjustment_requests",
      "stock_count_sessions",
      "stock_count_lines",
      "stock_reservations",
      "inventory_cost_layers",
    ]) {
      expect(sql).toContain(table);
    }
    for (const movement of [
      "opening",
      "purchase",
      "sale",
      "sale_return",
      "purchase_return",
      "damage",
      "adjustment",
      "transfer_out",
      "transfer_in",
      "stock_count",
      "reservation",
      "release_reservation",
      "warranty_replacement",
      "repair_consumption",
    ]) {
      expect(sql).toContain(`'${movement}'`);
    }
    expect(sql).toContain("allow_negative_stock");
    expect(sql).toContain("costing_method");
    expect(sql).toContain("operation_id");
  });

  it("parties/payments migration defines customers, suppliers, ledgers, credit, installments", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000004_parties_payments.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "customers",
      "suppliers",
      "payment_methods",
      "payments",
      "payment_splits",
      "party_ledger_entries",
      "credit_approvals",
      "credit_reminders",
      "installment_plans",
      "installment_schedule",
      "payment_receipts",
    ]) {
      expect(sql).toContain(table);
    }
    for (const kind of [
      "cash",
      "bank",
      "card",
      "jazzcash",
      "easypaisa",
      "sadapay",
      "online",
      "credit",
      "installment",
    ]) {
      expect(sql).toContain(`'${kind}'`);
    }
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("credit_limit");
  });

  it("POS sales migration defines sales, holds, returns, discount audits, accounting", () => {
    const migration = path.join(root, "supabase/migrations/20260810000005_pos_sales.sql");
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "sales",
      "sale_items",
      "sale_discount_audits",
      "held_sales",
      "sale_returns",
      "sale_return_items",
      "sale_commissions",
      "sale_warranties",
      "accounts",
      "journal_entries",
      "journal_entry_lines",
      "sales_analytics_events",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("pos_mode");
    expect(sql).toContain("approver_role");
    expect(sql).toContain("cart_snapshot");
  });

  it("purchases/warehouse ops migration defines purchases, locations, transfers, deliveries", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000006_purchases_warehouse_ops.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "warehouse_racks",
      "warehouse_shelves",
      "warehouse_bins",
      "purchases",
      "purchase_items",
      "supplier_product_prices",
      "supplier_price_history",
      "purchase_returns",
      "purchase_return_items",
      "stock_transfers",
      "stock_transfer_items",
      "deliveries",
      "delivery_items",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("warehouse_type");
    expect(sql).toContain("'requested'");
    expect(sql).toContain("'in_transit'");
    expect(sql).toContain("'packed'");
  });

  it("quotations/service/warranty migration defines conversion and job cards", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000007_quotations_service_warranty.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "quotations",
      "quotation_items",
      "sales_orders",
      "sales_order_items",
      "service_jobs",
      "service_job_parts",
      "warranty_claims",
      "warranty_replacements",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("converted_to_order");
    expect(sql).toContain("converted_to_invoice");
    expect(sql).toContain("'diagnosis'");
    expect(sql).toContain("sale_warranty_id");
  });

  it("accounting/banking/expenses migration defines vouchers, banks, expenses", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000008_accounting_banking_expenses.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of [
      "vouchers",
      "voucher_lines",
      "bank_accounts",
      "bank_statement_imports",
      "bank_statement_lines",
      "bank_reconciliations",
      "expense_categories",
      "expenses",
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("system_role");
    expect(sql).toContain("'receipt'");
    expect(sql).toContain("'transfer'");
    expect(sql).toContain("match_status");
  });

  it("RBAC/approvals/audit migration defines roles matrix, approvals, append-only audit", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000009_rbac_approvals_audit.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of ["user_permissions", "approval_requests", "approval_actions"]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("'discount'");
    expect(sql).toContain("'purchase'");
    expect(sql).toContain("'expense'");
    expect(sql).toContain("prevent_audit_mutation");
    expect(sql).toContain("get_user_permission_keys_for_branch");
    expect(sql).toContain("actor_kind");
  });

  it("offline sync engine migration defines acks, conflicts, change log", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000010_offline_sync_engine.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    for (const table of ["sync_operation_acks", "sync_conflicts", "sync_change_log"]) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("transaction_reconcile");
  });

  it("hardware/printing migration defines print jobs and hardware events", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000011_hardware_printing.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("print_jobs");
    expect(sql).toContain("hardware_events");
    expect(sql).toContain("cash_drawer.open");
    expect(sql).toContain("printing.manage");
  });

  it("dashboard/reporting/BI migration defines report permissions and indexes", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000012_dashboard_reporting_bi.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("dashboard.view");
    expect(sql).toContain("reports.sales");
    expect(sql).toContain("reports.purchases");
    expect(sql).toContain("reports.stock");
    expect(sql).toContain("reports.profit");
    expect(sql).toContain("bi.view");
    expect(sql).toContain("sales_posted_at_idx");
  });

  it("CRM/loyalty/B2B/store migration defines commerce tables and permissions", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000013_crm_loyalty_b2b_store.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("crm.manage");
    expect(sql).toContain("loyalty.manage");
    expect(sql).toContain("b2b.manage");
    expect(sql).toContain("store.manage");
    expect(sql).toContain("loyalty_tiers");
    expect(sql).toContain("b2b_portal_users");
    expect(sql).toContain("store_settings");
    expect(sql).toContain("crm_campaigns");
  });

  it("AI camera/BI migration defines recognition events and permissions", () => {
    const migration = path.join(root, "supabase/migrations/20260810000014_ai_camera_bi.sql");
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("ai.recognize");
    expect(sql).toContain("ai.insights");
    expect(sql).toContain("ai_recognition_events");
    expect(sql).toContain("ai_insight_cache");
    expect(sql).toContain("ai_settings");
    expect(sql).toContain("confidence_threshold");
  });

  it("HR/tax/documents/notifications migration defines enterprise tables", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000015_hr_tax_documents_notifications.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("hr.manage");
    expect(sql).toContain("tax.manage");
    expect(sql).toContain("documents.manage");
    expect(sql).toContain("notifications.view");
    expect(sql).toContain("employees");
    expect(sql).toContain("tax_rates");
    expect(sql).toContain("managed_documents");
    expect(sql).toContain("app_notifications");
    expect(sql).toContain("fbr_integration_enabled");
  });

  it("security/backup/api/import migration defines infrastructure tables", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000016_security_backup_api_import.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("security.view");
    expect(sql).toContain("backup.manage");
    expect(sql).toContain("integrations.manage");
    expect(sql).toContain("import.execute");
    expect(sql).toContain("export.execute");
    expect(sql).toContain("security_settings");
    expect(sql).toContain("login_history");
    expect(sql).toContain("backup_jobs");
    expect(sql).toContain("integration_clients");
    expect(sql).toContain("price_change_audits");
    expect(sql).toContain("disaster_recovery_claimed");
  });

  it("phase 17 performance indexes target high-volume report paths", () => {
    const migration = path.join(
      root,
      "supabase/migrations/20260810000017_phase17_performance_indexes.sql",
    );
    expect(existsSync(migration)).toBe(true);
    const sql = readFileSync(migration, "utf8");
    expect(sql).toContain("sale_items_org_product_idx");
    expect(sql).toContain("customers_org_name_idx");
    expect(sql).toContain("stock_movements_org_occurred_idx");
    expect(sql).toContain("purchase_items_org_product_idx");
    expect(sql).toContain("installment_schedule_due_idx");
  });
});

describe("Phase 17 security — web must not ship service role", () => {
  it("web env typings expose only anon + api URL (no service role)", () => {
    const viteEnv = readFileSync(path.join(root, "apps/web/src/vite-env.d.ts"), "utf8");
    expect(viteEnv).toContain("VITE_SUPABASE_ANON_KEY");
    expect(viteEnv).not.toMatch(/SERVICE_ROLE/i);
    const webEnv = readFileSync(path.join(root, "apps/web/src/lib/env.ts"), "utf8");
    expect(webEnv).not.toMatch(/SERVICE_ROLE/i);
  });
});




