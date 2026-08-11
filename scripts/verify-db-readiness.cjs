#!/usr/bin/env node
/**
 * Verifies migration set + seed exist for fresh-database path (no live DB required).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const seed = path.join(root, "supabase", "seed.sql");

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const expected = [
  "20260810000001_foundation.sql",
  "20260810000002_product_master.sql",
  "20260810000003_inventory_engine.sql",
  "20260810000004_parties_payments.sql",
  "20260810000005_pos_sales.sql",
  "20260810000006_purchases_warehouse_ops.sql",
  "20260810000007_quotations_service_warranty.sql",
  "20260810000008_accounting_banking_expenses.sql",
  "20260810000009_rbac_approvals_audit.sql",
  "20260810000010_offline_sync_engine.sql",
  "20260810000011_hardware_printing.sql",
  "20260810000012_dashboard_reporting_bi.sql",
  "20260810000013_crm_loyalty_b2b_store.sql",
  "20260810000014_ai_camera_bi.sql",
  "20260810000015_hr_tax_documents_notifications.sql",
  "20260810000016_security_backup_api_import.sql",
  "20260810000017_phase17_performance_indexes.sql",
];

let failed = false;
for (const name of expected) {
  if (!files.includes(name)) {
    console.error(`[db:verify] missing migration: ${name}`);
    failed = true;
  }
}

if (!fs.existsSync(seed)) {
  console.error("[db:verify] missing supabase/seed.sql");
  failed = true;
}

// Spot-check RLS + org isolation helpers in foundation
const foundation = fs.readFileSync(path.join(migrationsDir, expected[0]), "utf8");
for (const needle of ["enable row level security", "current_organization_id", "create policy"]) {
  if (!foundation.includes(needle)) {
    console.error(`[db:verify] foundation missing: ${needle}`);
    failed = true;
  }
}

// Flag obviously unsafe open policies if present in any migration
for (const f of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
  if (/using\s*\(\s*true\s*\)/i.test(sql) && /create policy/i.test(sql)) {
    console.warn(`[db:verify] WARNING: possible open policy in ${f}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`[db:verify] OK — ${expected.length} migrations + seed.sql present`);
console.log("[db:verify] Apply with: npx supabase db reset   (or supabase db push)");
