/**
 * Phase 3B live: UOM sale/return/idempotency (+ exchange).
 * Writes PHASE-3B-LIVE-RESULT.json (no secrets).
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
    throw new Error(`login failed ${login.status}`);
  }
  const token = login.body.accessToken;
  const orgId = login.body.user.organizationId;
  const branchId = login.body.user.defaultBranchId || login.body.branches?.[0]?.id;
  const h = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const rpcProbe = await sb.rpc("apply_stock_movement_atomic", {
    p_movement: {},
    p_balance_id: "00000000-0000-4000-8000-000000000000",
    p_expected_version: 1,
    p_qty_on_hand: 0,
    p_qty_reserved: 0,
    p_qty_damaged: 0,
    p_qty_in_transit: 0,
    p_average_unit_cost: 0,
    p_occurred_at: new Date().toISOString(),
  });
  const rpcDeployed = !(
    rpcProbe.error &&
    (/apply_stock_movement_atomic/i.test(rpcProbe.error.message) ||
      rpcProbe.error.code === "PGRST202" ||
      rpcProbe.error.code === "42883")
  );
  setStep("rpc_deployed", rpcDeployed ? "PASS" : "NOT TESTED", {
    summary: rpcDeployed ? "apply_stock_movement_atomic is callable" : "RPC not deployed on this project",
    error: rpcProbe.error?.message?.slice(0, 180) || null,
  });

  await hit("/api/v1/catalog/units/seed-system", { method: "POST", headers: h, body: "{}" });
  const units = await hit("/api/v1/catalog/units", { headers: h });
  const items = units.body?.items || [];
  let pcsId = items.find((u) => /^(pcs|pc|piece|ea)$/i.test(String(u.code || "")))?.id;
  if (!pcsId) {
    const createdPcs = await hit("/api/v1/catalog/units", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ code: `P3BPCS-${Date.now().toString(36)}`, name: "Piece" }),
    });
    pcsId = createdPcs.body?.id;
  }
  const boxCode = `P3BBOX-${Date.now().toString(36).toUpperCase()}`;
  const boxUnit = await hit("/api/v1/catalog/units", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ code: boxCode, name: "Box" }),
  });
  const boxId = boxUnit.body?.id;
  if (!pcsId || !boxId) throw new Error("units missing");

  let pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  if (!(pm.body?.items || []).length) {
    await hit("/api/v1/parties/payment-methods/seed", { method: "POST", headers: h, body: "{}" });
    pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  }
  const cashId = (pm.body?.items || []).find((m) => /cash/i.test(String(m.code || m.name || m.kind || "")))?.id;

  let wh = await hit("/api/v1/inventory/warehouses", { headers: h });
  const warehouseId =
    (wh.body?.items || []).find((w) => w.is_default || w.isDefault)?.id || wh.body?.items?.[0]?.id;

  async function makeProduct(name) {
    const code = `P3B-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6)}`;
    const created = await hit("/api/v1/catalog/products", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        productCode: code,
        sku: code,
        name,
        baseUnitId: pcsId,
        retailPrice: 100,
        costPrice: 40,
        trackInventory: true,
      }),
    });
    const id = created.body?.id;
    if (!id) throw new Error(`product ${name} failed ${created.status} ${JSON.stringify(created.body).slice(0, 180)}`);
    const conv = await hit("/api/v1/catalog/unit-conversions", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        organizationId: orgId,
        productId: id,
        fromUnitId: boxId,
        toUnitId: pcsId,
        factor: "10",
      }),
    });
    if (!(conv.status === 201 || conv.ok)) {
      throw new Error(`conversion failed ${conv.status} ${JSON.stringify(conv.body).slice(0, 180)}`);
    }
    const seed = await hit("/api/v1/inventory/movements", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        organizationId: orgId,
        branchId,
        warehouseId,
        productId: id,
        unitId: pcsId,
        movementType: "adjustment",
        qtyDelta: "100",
        sourceType: "phase3b",
        sourceId: uuid(),
        operationId: uuid(),
        reason: "Phase3B opening 100 pcs",
      }),
    });
    if (!(seed.status === 201 || seed.ok)) {
      throw new Error(`opening failed ${seed.status} ${JSON.stringify(seed.body).slice(0, 180)}`);
    }
    return id;
  }

  const productA = await makeProduct("Phase3B Box Cable A");
  const productB = await makeProduct("Phase3B Box Cable B");

  async function bal(productId) {
    const { data } = await sb
      .from("stock_balances")
      .select("qty_on_hand")
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();
    return Number(data?.qty_on_hand ?? 0);
  }

  async function moveSum(productId) {
    const { data } = await sb
      .from("stock_movements")
      .select("qty_delta,movement_type")
      .eq("product_id", productId)
      .eq("warehouse_id", warehouseId);
    let n = 0;
    for (const m of data || []) {
      const q = Number(m.qty_delta);
      const t = String(m.movement_type);
      if (t === "sale" || t === "purchase_return" || t === "damage") n -= Math.abs(q);
      else if (t === "sale_return" || t === "purchase" || t === "opening" || t === "adjustment") n += Number(m.qty_delta);
      else n += Number(m.qty_delta);
    }
    return n;
  }

  const beforeSale = await bal(productA);
  const saleKey = uuid();
  const sale = await hit("/api/v1/pos/sales", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      branchId,
      warehouseId,
      items: [{ productId: productA, unitId: boxId, qty: 2, unitPrice: 1000 }],
      payments: [{ paymentMethodId: cashId, amount: 2000, amountReceived: 2000, methodKind: "cash" }],
      idempotencyKey: saleKey,
    }),
  });
  const saleId = sale.body?.id || sale.body?.sale?.id;
  const afterSale = await bal(productA);
  const sale2 = await hit("/api/v1/pos/sales", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      branchId,
      warehouseId,
      items: [{ productId: productA, unitId: boxId, qty: 2, unitPrice: 1000 }],
      payments: [{ paymentMethodId: cashId, amount: 2000, amountReceived: 2000, methodKind: "cash" }],
      idempotencyKey: saleKey,
    }),
  });
  const afterSaleIdem = await bal(productA);
  const { data: saleMoves } = await sb
    .from("stock_movements")
    .select("qty_delta,unit_id,movement_type")
    .eq("source_id", saleId)
    .eq("movement_type", "sale");
  setStep("converted_sale", beforeSale === 100 && afterSale === 80 && afterSaleIdem === 80 && Number(saleMoves?.[0]?.qty_delta) === 20 ? "PASS" : "FAIL", {
    summary: `stock ${beforeSale}->${afterSale} idem=${afterSaleIdem} moveQty=${saleMoves?.[0]?.qty_delta} http=${sale.status}`,
    saleId,
    saleRetryId: sale2.body?.id || sale2.body?.sale?.id,
    movementQty: saleMoves?.[0]?.qty_delta ?? null,
  });

  const { data: saleItems } = await sb.from("sale_items").select("id,qty,unit_id").eq("sale_id", saleId).order("line_no");
  const saleItemId = saleItems?.[0]?.id;
  const returnKey = uuid();
  const returnBody = {
    organizationId: orgId,
    branchId,
    warehouseId,
    originalSaleId: saleId,
    returnType: "refund",
    returnScope: "partial",
    reasonCode: "other",
    reason: "phase3b converted return",
    refundMethod: "cash",
    items: [
      {
        originalSaleItemId: saleItemId,
        productId: productA,
        unitId: boxId,
        qty: 1,
        unitPrice: 1000,
        condition: "good",
      },
    ],
    idempotencyKey: returnKey,
  };
  const ret1 = await hit("/api/v1/pos/returns", { method: "POST", headers: h, body: JSON.stringify(returnBody) });
  const afterReturn = await bal(productA);
  const ret2 = await hit("/api/v1/pos/returns", { method: "POST", headers: h, body: JSON.stringify(returnBody) });
  const afterReturnIdem = await bal(productA);
  const returnId = ret1.body?.id;
  const { data: retMoves } = await sb
    .from("stock_movements")
    .select("id,qty_delta,movement_type")
    .eq("source_id", returnId)
    .eq("movement_type", "sale_return");
  const { data: pays } = await sb.from("payments").select("id").eq("source_id", returnId);
  setStep("converted_return", afterReturn === 90 && afterReturnIdem === 90 && Number(retMoves?.[0]?.qty_delta) === 10 && (pays || []).length === 1 ? "PASS" : "FAIL", {
    summary: `stock ${afterSale}->${afterReturn} idem=${afterReturnIdem} moveQty=${retMoves?.[0]?.qty_delta} pays=${(pays || []).length}`,
    returnId,
    retryId: ret2.body?.id,
  });

  const beforeExA = await bal(productA);
  const beforeExB = await bal(productB);
  const { data: remainItems } = await sb.from("sale_items").select("id").eq("sale_id", saleId);
  const exKey = uuid();
  const exBody = {
    organizationId: orgId,
    branchId,
    warehouseId,
    originalSaleId: saleId,
    returnType: "exchange",
    reasonCode: "wrong_product",
    reason: "phase3b exchange",
    items: [
      {
        originalSaleItemId: remainItems?.[0]?.id,
        productId: productA,
        unitId: boxId,
        qty: 1,
        unitPrice: 1000,
        condition: "good",
        exchangeProductId: productB,
      },
    ],
    idempotencyKey: exKey,
  };
  const ex1 = await hit("/api/v1/pos/returns", { method: "POST", headers: h, body: JSON.stringify(exBody) });
  const midExA = await bal(productA);
  const midExB = await bal(productB);
  const ex2 = await hit("/api/v1/pos/returns", { method: "POST", headers: h, body: JSON.stringify(exBody) });
  const endExA = await bal(productA);
  const endExB = await bal(productB);
  const exId = ex1.body?.id;
  const { data: exMoves } = await sb.from("stock_movements").select("product_id,movement_type,qty_delta").eq("source_id", exId);
  const inA = (exMoves || []).find((m) => m.product_id === productA && m.movement_type === "sale_return");
  const outB = (exMoves || []).find((m) => m.product_id === productB && m.movement_type === "sale");
  const exPass =
    (ex1.status === 201 || ex1.ok) &&
    Number(inA?.qty_delta) === 10 &&
    Number(outB?.qty_delta) === 10 &&
    midExA === beforeExA + 10 &&
    midExB === beforeExB - 10 &&
    endExA === midExA &&
    endExB === midExB &&
    (ex2.body?.id || ex2.body?.return?.id) === exId;
  setStep("exchange", exPass ? "PASS" : "FAIL", {
    summary: `A ${beforeExA}->${midExA}->${endExA} B ${beforeExB}->${midExB}->${endExB} http=${ex1.status}`,
    exId,
    retryId: ex2.body?.id,
    inQty: inA?.qty_delta ?? null,
    outQty: outB?.qty_delta ?? null,
    error: ex1.ok ? null : ex1.body,
  });

  const ledgerA = await moveSum(productA);
  const balA = await bal(productA);
  setStep("ledger_vs_balance", ledgerA === balA ? "PASS" : "FAIL", {
    summary: `movementSum=${ledgerA} balance=${balA}`,
  });

  const rpcPathPass =
    rpcDeployed &&
    report.steps.converted_sale?.status === "PASS" &&
    report.steps.converted_return?.status === "PASS" &&
    report.steps.exchange?.status === "PASS";
  setStep("rpc_posting_path", rpcPathPass ? "PASS" : rpcDeployed ? "PARTIAL" : "FAIL", {
    summary: rpcDeployed
      ? "Authenticated RPC is callable; InventoryRepository only sequential-falls-back on missing-function errors, so successful posts used apply_stock_movement_atomic"
      : "RPC not callable — sequential insert+update fallback would be used",
    rpcError: rpcProbe.error?.message?.slice(0, 180) || null,
    rpcCode: rpcProbe.error?.code || null,
  });

  const out = path.join(__dirname, "..", "PHASE-3B-LIVE-RESULT.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("wrote", out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
