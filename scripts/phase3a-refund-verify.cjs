/**
 * Phase 3A live: sale 2 units, return 1, refund payment, idempotent retry.
 * Writes PHASE-3A-LIVE-RESULT.json (no secrets).
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const { createClient } = require("@supabase/supabase-js");

const apiBase = (process.env.SMOKE_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const report = { steps: {}, notes: [] };

function uuid() {
  return crypto.randomUUID();
}

function loadCreds() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "bootstrap_first_owner.sql"), "utf8");
  return {
    email: (sql.match(/v_email text := '([^']+)'/) || [])[1],
    password: (sql.match(/v_password text := '([^']+)'/) || [])[1],
  };
}

async function hit(p, init = {}) {
  const res = await fetch(apiBase + p, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: String(text).slice(0, 400) };
  }
  return { status: res.status, ok: res.ok, body };
}

function setStep(id, status, detail) {
  report.steps[id] = { status, ...detail };
  console.log(`${status.padEnd(12)} ${id}${detail?.summary ? ` — ${detail.summary}` : ""}`);
}

async function main() {
  const creds = loadCreds();
  const login = await hit("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!login.ok || !login.body?.accessToken) {
    throw new Error(`login failed ${login.status} ${JSON.stringify(login.body).slice(0, 200)}`);
  }
  const token = login.body.accessToken;
  const orgId = login.body.user.organizationId;
  const branchId = login.body.user.defaultBranchId || login.body.branches?.[0]?.id;
  const h = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  await hit("/api/v1/catalog/units/seed-system", { method: "POST", headers: h, body: "{}" });
  const units = await hit("/api/v1/catalog/units", { headers: h });
  const unitId =
    (units.body?.items || []).find((u) => /pcs|piece|ea|each/i.test(String(u.code || u.name || "")))?.id ||
    units.body?.items?.[0]?.id;

  let wh = await hit("/api/v1/inventory/warehouses", { headers: h });
  let warehouseId =
    (wh.body?.items || []).find((w) => /P1B|P1C|P3A|Phase/i.test(String(w.name || w.code || "")))?.id ||
    (wh.body?.items || []).find((w) => w.is_default || w.isDefault)?.id ||
    wh.body?.items?.[0]?.id;

  let pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  if (!(pm.body?.items || []).length) {
    await hit("/api/v1/parties/payment-methods/seed", { method: "POST", headers: h, body: "{}" });
    pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  }
  const cashId = (pm.body?.items || []).find((m) => m.kind === "cash" || /cash/i.test(m.code || m.name))?.id;

  const code = `P3A-${Date.now().toString(36).toUpperCase()}`;
  const created = await hit("/api/v1/catalog/products", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      productCode: code,
      sku: code,
      name: "Phase3A Refund Cable",
      baseUnitId: unitId,
      retailPrice: 100,
      costPrice: 40,
      trackInventory: true,
    }),
  });
  const productId = created.body?.id;
  if (!productId) throw new Error(`product create failed ${created.status} ${JSON.stringify(created.body).slice(0, 200)}`);

  const opening = await hit("/api/v1/inventory/movements", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      organizationId: orgId,
      branchId,
      warehouseId,
      productId,
      unitId,
      movementType: "adjustment",
      qtyDelta: "10",
      sourceType: "phase3a",
      sourceId: uuid(),
      operationId: uuid(),
      reason: "Phase3A opening stock",
    }),
  });
  if (!(opening.status === 201 || opening.ok)) {
    throw new Error(`stock seed failed ${opening.status} ${JSON.stringify(opening.body).slice(0, 200)}`);
  }

  async function bal() {
    const { data } = await sb
      .from("stock_balances")
      .select("qty_on_hand")
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();
    return Number(data?.qty_on_hand ?? 0);
  }

  const stockBeforeSale = await bal();
  const saleKey = uuid();
  const sale = await hit("/api/v1/pos/sales", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      branchId,
      warehouseId,
      items: [{ productId, unitId, qty: 2, unitPrice: 100 }],
      payments: [{ paymentMethodId: cashId, amount: 200, amountReceived: 200, methodKind: "cash" }],
      idempotencyKey: saleKey,
    }),
  });
  const saleId = sale.body?.id;
  const stockAfterSale = await bal();
  const salePass = (sale.status === 201 || sale.ok) && saleId && stockAfterSale === stockBeforeSale - 2;
  setStep("sale", salePass ? "PASS" : "FAIL", {
    summary: `http=${sale.status} stock ${stockBeforeSale}->${stockAfterSale}`,
    saleId,
    invoiceNumber: sale.body?.invoiceNumber,
  });

  const { data: saleItems } = await sb
    .from("sale_items")
    .select("id,qty,unit_price")
    .eq("sale_id", saleId)
    .order("line_no");
  const saleItemId = saleItems?.[0]?.id;

  const over = await hit("/api/v1/pos/returns", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      organizationId: orgId,
      branchId,
      warehouseId,
      originalSaleId: saleId,
      returnType: "refund",
      reasonCode: "other",
      reason: "phase3a over-return",
      refundMethod: "cash",
      items: [{ originalSaleItemId: saleItemId, productId, unitId, qty: 3, unitPrice: 100, condition: "good" }],
      idempotencyKey: uuid(),
    }),
  });
  setStep("over_return", over.ok ? "FAIL" : "PASS", {
    summary: `http=${over.status} blocked=${!over.ok}`,
    http: over.status,
  });

  const returnKey = uuid();
  const returnBody = {
    organizationId: orgId,
    branchId,
    warehouseId,
    originalSaleId: saleId,
    returnType: "refund",
    returnScope: "partial",
    reasonCode: "other",
    reason: "phase3a partial cash refund",
    refundMethod: "cash",
    items: [{ originalSaleItemId: saleItemId, productId, unitId, qty: 1, unitPrice: 100, condition: "good" }],
    idempotencyKey: returnKey,
  };
  const ret1 = await hit("/api/v1/pos/returns", {
    method: "POST",
    headers: h,
    body: JSON.stringify(returnBody),
  });
  const returnId = ret1.body?.id;
  const stockAfterReturn = await bal();

  const { data: retRows } = await sb.from("sale_returns").select("*").eq("id", returnId || "00000000-0000-0000-0000-000000000000");
  const { data: retItems } = await sb.from("sale_return_items").select("*").eq("sale_return_id", returnId || "00000000-0000-0000-0000-000000000000");
  const { data: pays1 } = await sb
    .from("payments")
    .select("id,direction,total_amount,source_type,source_id,idempotency_key")
    .eq("organization_id", orgId)
    .eq("source_type", "sale_return")
    .eq("source_id", returnId || "00000000-0000-0000-0000-000000000000");
  const { data: splits1 } = pays1?.[0]
    ? await sb.from("payment_splits").select("id,amount,payment_id").eq("payment_id", pays1[0].id)
    : { data: [] };
  const { data: moves1 } = await sb
    .from("stock_movements")
    .select("id")
    .eq("source_type", "sale_return")
    .eq("source_id", returnId || "00000000-0000-0000-0000-000000000000");
  const { data: journals1 } = await sb
    .from("journal_entries")
    .select("id")
    .eq("source_type", "sale_return")
    .eq("source_id", returnId || "00000000-0000-0000-0000-000000000000");
  const { data: ledger1 } = await sb
    .from("party_ledger_entries")
    .select("id")
    .eq("source_type", "sale_return")
    .eq("source_id", returnId || "00000000-0000-0000-0000-000000000000");

  const refundAmt = Number(retRows?.[0]?.refund_amount ?? 0);
  const payAmt = Number(pays1?.[0]?.total_amount ?? 0);
  const firstPass =
    (ret1.status === 201 || ret1.ok) &&
    !!returnId &&
    (retItems || []).length === 1 &&
    stockAfterReturn === stockAfterSale + 1 &&
    (pays1 || []).length === 1 &&
    pays1[0].direction === "pay" &&
    payAmt === 100 &&
    refundAmt === 100 &&
    (splits1 || []).length >= 1 &&
    (moves1 || []).length >= 1;
  setStep("return_and_refund", firstPass ? "PASS" : "FAIL", {
    summary: `http=${ret1.status} stock ${stockAfterSale}->${stockAfterReturn} refund=${refundAmt} pays=${(pays1 || []).length} dir=${pays1?.[0]?.direction} payAmt=${payAmt}`,
    returnId,
    refundAmount: refundAmt,
    payments: (pays1 || []).length,
    paymentDirection: pays1?.[0]?.direction || null,
    ledgerRows: (ledger1 || []).length,
    journals: (journals1 || []).length,
    movements: (moves1 || []).length,
    error: ret1.ok ? null : ret1.body,
  });

  const ret2 = await hit("/api/v1/pos/returns", {
    method: "POST",
    headers: h,
    body: JSON.stringify(returnBody),
  });
  const stockAfterRetry = await bal();
  const { data: pays2 } = await sb
    .from("payments")
    .select("id")
    .eq("source_type", "sale_return")
    .eq("source_id", returnId || "00000000-0000-0000-0000-000000000000");
  const { data: moves2 } = await sb
    .from("stock_movements")
    .select("id")
    .eq("source_type", "sale_return")
    .eq("source_id", returnId || "00000000-0000-0000-0000-000000000000");
  const { data: journals2 } = await sb
    .from("journal_entries")
    .select("id")
    .eq("source_type", "sale_return")
    .eq("source_id", returnId || "00000000-0000-0000-0000-000000000000");
  const sameId = (ret2.body?.id || ret2.body?.return?.id) === returnId;
  const retryPass =
    sameId &&
    stockAfterRetry === stockAfterReturn &&
    (pays2 || []).length === (pays1 || []).length &&
    (moves2 || []).length === (moves1 || []).length &&
    (journals2 || []).length === (journals1 || []).length;
  setStep("idempotent_retry", retryPass ? "PASS" : "FAIL", {
    summary: `sameId=${sameId} stock=${stockAfterRetry} pays=${(pays2 || []).length} moves=${(moves2 || []).length} journals=${(journals2 || []).length}`,
    retryHttp: ret2.status,
    retryId: ret2.body?.id,
  });

  const out = path.join(__dirname, "..", "PHASE-3A-LIVE-RESULT.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("wrote", out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
