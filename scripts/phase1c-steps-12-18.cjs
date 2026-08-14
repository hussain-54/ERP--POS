/**
 * Phase 1C Steps 12–18 live verification.
 * Writes PHASE-1C-STEPS-12-18.json (no secrets).
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
  console.log(`${status.padEnd(10)} ${id}${detail?.summary ? ` — ${detail.summary}` : ""}`);
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
  const userId = login.body.user.id;
  const h = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  await hit("/api/v1/catalog/units/seed-system", { method: "POST", headers: h, body: "{}" });
  const units = await hit("/api/v1/catalog/units", { headers: h });
  let unitId =
    (units.body?.items || []).find((u) => /pcs|piece|ea|each/i.test(String(u.code || u.name || "")))?.id ||
    units.body?.items?.[0]?.id;

  let wh = await hit("/api/v1/inventory/warehouses", { headers: h });
  let warehouseId =
    (wh.body?.items || []).find((w) => /P1B|P1C|Phase1/i.test(String(w.name || w.code || "")))?.id ||
    (wh.body?.items || []).find((w) => w.is_default || w.isDefault)?.id ||
    wh.body?.items?.[0]?.id;

  let pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  if (!(pm.body?.items || []).length) {
    await hit("/api/v1/parties/payment-methods/seed", { method: "POST", headers: h, body: "{}" });
    pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  }
  const cash = (pm.body?.items || []).find((m) => /cash/i.test(String(m.code || m.name || m.kind || "")));
  const paymentMethodId = cash?.id;

  // Dedicated product for exact stock math (Steps 12–16)
  const code = `P1C-V-${Date.now().toString(36).toUpperCase()}`;
  const created = await hit("/api/v1/catalog/products", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      productCode: code,
      sku: code,
      name: "Phase1C Verify Cable",
      baseUnitId: unitId,
      retailPrice: 100,
      costPrice: 50,
      trackInventory: true,
    }),
  });
  const productId = created.body?.id;
  if (!productId) throw new Error(`product create failed ${created.status} ${JSON.stringify(created.body).slice(0, 200)}`);

  const OPENING = 10;
  const SELL_QTY = 2;
  const EXPECTED_AFTER_SALE = 8;

  const seed = await hit("/api/v1/inventory/movements", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      organizationId: orgId,
      branchId,
      warehouseId,
      productId,
      unitId,
      movementType: "adjustment",
      qtyDelta: String(OPENING),
      sourceType: "phase1c",
      sourceId: uuid(),
      operationId: uuid(),
      reason: "Phase1C Step12 opening stock",
    }),
  });
  if (!(seed.status === 201 || seed.ok)) {
    throw new Error(`stock seed failed ${seed.status} ${JSON.stringify(seed.body).slice(0, 200)}`);
  }

  async function bal() {
    const r = await hit(`/api/v1/inventory/balances?warehouseId=${warehouseId}&productId=${productId}`, {
      headers: h,
    });
    const q = r.body?.items?.[0]?.qtyOnHand ?? r.body?.items?.[0]?.quantity;
    return q == null ? null : Number(q);
  }

  const before = await bal();
  // ========== STEP 12 + 13: sale + exact stock + cash payment ==========
  const idempotencyKey = uuid();
  const unitPrice = 100;
  const lineTotal = unitPrice * SELL_QTY;
  const salePayload = {
    organizationId: orgId,
    branchId,
    warehouseId,
    items: [{ productId, unitId, qty: SELL_QTY, unitPrice, discount: 0, tax: 0 }],
    payments: [
      {
        paymentMethodId,
        amount: lineTotal,
        amountReceived: lineTotal,
        methodKind: "cash",
      },
    ],
    idempotencyKey,
  };

  const sale1 = await hit("/api/v1/pos/sales", {
    method: "POST",
    headers: h,
    body: JSON.stringify(salePayload),
  });
  const saleBody = sale1.body?.sale || sale1.body;
  const saleId = saleBody?.id;
  const afterSale = await bal();

  const stockExact =
    before === OPENING && afterSale === EXPECTED_AFTER_SALE && OPENING - SELL_QTY === EXPECTED_AFTER_SALE;
  setStep("step12_stock", stockExact ? "PASS" : "FAIL", {
    summary: `before=${before} sell=${SELL_QTY} after=${afterSale} expected=${EXPECTED_AFTER_SALE}`,
    before,
    sell: SELL_QTY,
    after: afterSale,
    expected: EXPECTED_AFTER_SALE,
    openingSeed: OPENING,
    saleHttp: sale1.status,
    saleId,
  });

  // Payment verify via Supabase
  const { data: payments } = await sb
    .from("payments")
    .select("*, payment_splits(*, payment_methods(code,kind,name))")
    .eq("source_id", saleId);
  const { data: saleRow } = await sb.from("sales").select("*").eq("id", saleId).maybeSingle();
  const cashSplit = (payments || []).flatMap((p) => p.payment_splits || []).find((s) => {
    const m = s.payment_methods;
    return /cash/i.test(String(m?.code || m?.kind || m?.name || ""));
  });
  const paymentPass =
    (sale1.status === 201 || sale1.ok) &&
    String(saleRow?.status).toLowerCase() === "posted" &&
    String(saleRow?.payment_status).toLowerCase() === "paid" &&
    (payments || []).length === 1 &&
    !!cashSplit &&
    Number(cashSplit.amount) === lineTotal;
  setStep("step13_payment_cash", paymentPass ? "PASS" : "FAIL", {
    summary: `payments=${(payments || []).length} cashAmount=${cashSplit?.amount ?? null} salePayment=${saleRow?.payment_status}`,
    paymentId: payments?.[0]?.id ?? null,
    cashAmount: cashSplit?.amount ?? null,
    expectedAmount: lineTotal,
    pspClaimed: false,
  });

  // ========== STEP 14: idempotency ==========
  const sale2 = await hit("/api/v1/pos/sales", {
    method: "POST",
    headers: h,
    body: JSON.stringify(salePayload),
  });
  const sale2Body = sale2.body?.sale || sale2.body;
  const afterIdem = await bal();
  const { data: salesSameKey } = await sb
    .from("sales")
    .select("id,status,idempotency_key")
    .eq("organization_id", orgId)
    .eq("idempotency_key", idempotencyKey);
  const { data: movesForSale } = await sb
    .from("stock_movements")
    .select("id,operation_id,qty_delta,movement_type")
    .eq("source_id", saleId);
  const { data: paysForSale } = await sb.from("payments").select("id").eq("source_id", saleId);

  const sameSaleReturned = sale2Body?.id === saleId || sale2.status === 200 || sale2.status === 201;
  const noExtraStock = afterIdem === EXPECTED_AFTER_SALE && afterIdem === afterSale;
  const onePosted =
    (salesSameKey || []).filter((s) => String(s.status).toLowerCase() === "posted").length === 1;
  const oneMove = (movesForSale || []).length === 1;
  const onePay = (paysForSale || []).length === 1;
  const idemPass = sameSaleReturned && noExtraStock && onePosted && oneMove && onePay;
  setStep("step14_idempotency", idemPass ? "PASS" : "FAIL", {
    summary: `http2=${sale2.status} stock=${afterIdem} salesWithKey=${(salesSameKey || []).length} moves=${(movesForSale || []).length} pays=${(paysForSale || []).length}`,
    secondSaleId: sale2Body?.id ?? null,
    stockUnchanged: noExtraStock,
    postedCountForKey: (salesSameKey || []).filter((s) => String(s.status).toLowerCase() === "posted")
      .length,
    movementCount: (movesForSale || []).length,
    paymentCount: (paysForSale || []).length,
  });

  // ========== STEP 15: hold/resume ==========
  const holdBefore = await bal();
  const hold = await hit("/api/v1/pos/holds", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      organizationId: orgId,
      branchId,
      warehouseId,
      holdLabel: `phase1c-hold-${Date.now()}`,
      cartSnapshot: {
        cart: [{ productId, unitId, qty: 1, unitPrice, name: "Phase1C Verify Cable" }],
      },
      deviceId: undefined,
    }),
  });
  const heldId = hold.body?.held?.id || hold.body?.id;
  const holdMid = await bal();
  const resume = heldId
    ? await hit(`/api/v1/pos/holds/${heldId}/resume`, { method: "POST", headers: h, body: "{}" })
    : { status: 0, ok: false, body: null };
  const snap = resume.body?.cartSnapshot || resume.body?.held?.cartSnapshot || resume.body;
  const lines = snap?.cart || snap?.lines || snap?.items || [];
  const holdAfter = await bal();
  if (heldId) {
    await hit(`/api/v1/pos/holds/${heldId}/discard`, { method: "POST", headers: h, body: "{}" }).catch(
      () => null,
    );
  }
  const holdPass =
    (hold.status === 201 || hold.ok) &&
    holdBefore === holdMid &&
    holdMid === holdAfter &&
    holdBefore === EXPECTED_AFTER_SALE &&
    resume.ok &&
    Array.isArray(lines) &&
    lines.length >= 1;
  setStep("step15_hold_resume", holdPass ? "PASS" : "FAIL", {
    summary: `hold=${hold.status} resume=${resume.status} stock ${holdBefore}->${holdMid}->${holdAfter} lines=${Array.isArray(lines) ? lines.length : "n/a"}`,
    heldId: heldId || null,
    stockUnchanged: holdBefore === holdMid && holdMid === holdAfter,
  });

  // ========== STEP 16: partial return qty 1 ==========
  const stockBeforeReturn = await bal();
  let returnIds = [];
  const { data: saleItems } = await sb
    .from("sale_items")
    .select("id,product_id,unit_id,qty,unit_price,line_no")
    .eq("sale_id", saleId)
    .order("line_no");
  const saleItemId = saleItems?.[0]?.id;
  if (!saleItemId) {
    setStep("step16_return", "FAIL", { summary: "missing sale_items for return", saleId });
  } else {
    const overReturn = await hit("/api/v1/pos/returns", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        organizationId: orgId,
        branchId,
        warehouseId,
        originalSaleId: saleId,
        returnType: "refund",
        returnScope: "partial",
        reasonCode: "other",
        reason: "phase1c over-return test",
        refundMethod: "cash",
        items: [
          {
            originalSaleItemId: saleItemId,
            productId,
            unitId,
            qty: SELL_QTY + 1,
            unitPrice,
            condition: "good",
          },
        ],
        idempotencyKey: uuid(),
      }),
    });
    const overBlocked = !(overReturn.ok || overReturn.status === 201);

    const ret = await hit("/api/v1/pos/returns", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        organizationId: orgId,
        branchId,
        warehouseId,
        originalSaleId: saleId,
        returnType: "refund",
        returnScope: "partial",
        reasonCode: "other",
        reason: "phase1c partial return",
        refundMethod: "cash",
        items: [
          {
            originalSaleItemId: saleItemId,
            productId,
            unitId,
            qty: 1,
            unitPrice,
            condition: "good",
          },
        ],
        idempotencyKey: uuid(),
      }),
    });
    const returnId = ret.body?.id || ret.body?.return?.id;
    const stockAfterReturn = await bal();
    const expectedAfterReturn = EXPECTED_AFTER_SALE + 1; // 9

    const { data: returnsBySale } = await sb
      .from("sale_returns")
      .select("*")
      .eq("original_sale_id", saleId);

    returnIds = (returnsBySale || []).map((r) => r.id);
    let returnMoveCount = 0;
    if (returnIds.length) {
      const { data: rMoves } = await sb
        .from("stock_movements")
        .select("id,source_id,movement_type,qty_delta,source_type")
        .in("source_id", returnIds);
      returnMoveCount = (rMoves || []).length;
    }
    const { data: returnMovesAlt } = await sb
      .from("stock_movements")
      .select("id,source_id,source_type,movement_type,qty_delta,product_id")
      .eq("organization_id", orgId)
      .eq("product_id", productId)
      .neq("source_id", saleId);

    const returnRecordOk = (returnsBySale || []).length >= 1 || !!returnId;
    const returnStockOk = stockAfterReturn === expectedAfterReturn;
    const returnMoveOk =
      returnMoveCount > 0 ||
      (returnMovesAlt || []).some((m) =>
        /return|sale_return|in/i.test(String(m.movement_type || m.source_type || "")),
      );

    const { data: refundPays } = await sb
      .from("payments")
      .select("id,direction,source_id,source_type")
      .eq("organization_id", orgId)
      .in(
        "source_id",
        returnIds.length ? returnIds : ["00000000-0000-0000-0000-000000000000"],
      );

    const returnPass =
      (ret.status === 201 || ret.ok) && returnRecordOk && returnStockOk && returnMoveOk && overBlocked;
    setStep("step16_return", returnPass ? "PASS" : "FAIL", {
      summary: `http=${ret.status} overBlocked=${overBlocked} stock ${stockBeforeReturn}->${stockAfterReturn} expected=${expectedAfterReturn} returns=${(returnsBySale || []).length} moves=${returnMoveCount || (returnMovesAlt || []).length}`,
      returnId: returnId || returnsBySale?.[0]?.id || null,
      overReturnHttp: overReturn.status,
      overReturnBlocked: overBlocked,
      overReturnError: overBlocked
        ? overReturn.body?.error || overReturn.body?.message || null
        : null,
      stockBeforeReturn,
      stockAfterReturn,
      expectedAfterReturn,
      refundPayments: (refundPays || []).length,
      refundNote:
        (refundPays || []).length > 0
          ? "cash refund payment row present"
          : "no separate refund payment row observed",
      returnHttpError: ret.ok
        ? null
        : ret.body?.error || ret.body?.message || JSON.stringify(ret.body).slice(0, 250),
    });
  }

  // ========== STEP 17: customer ledger ==========
  // This verification sale had no customerId (cash walk-in)
  setStep("step17_customer_ledger", "NOT APPLICABLE", {
    summary: "Cash walk-in sale (no customerId) — customer ledger not applicable",
    customerId: null,
    ledgerChecked: false,
  });

  // Optional: confirm no ledger rows for this sale
  const { data: ledgerRows } = await sb
    .from("party_ledger_entries")
    .select("id")
    .eq("source_id", saleId);
  report.notes.push({
    step17: "no customer on sale",
    ledgerRowsForSale: (ledgerRows || []).length,
  });

  // ========== STEP 18: identify test residue (document; cleanup only if safe) ==========
  const { data: testProducts } = await sb
    .from("products")
    .select("id,product_code,sku,name")
    .or("name.ilike.%Phase1B%,name.ilike.%Phase1C%,product_code.ilike.P1B%,product_code.ilike.P1C%");
  const { data: testWh } = await sb
    .from("warehouses")
    .select("id,code,name")
    .or("name.ilike.%Phase1%,code.ilike.P1B%,code.ilike.P1C%");
  const { data: testHolds } = await sb
    .from("held_sales")
    .select("id,hold_label,status")
    .or("hold_label.ilike.%phase1%,hold_label.ilike.%p1b%,hold_label.ilike.%p1c%");
  const { data: voidSales } = await sb
    .from("sales")
    .select("id,invoice_number,status,device_id")
    .eq("organization_id", orgId)
    .eq("status", "void")
    .or("device_id.ilike.%phase1%,invoice_number.ilike.INV-%");
  // Narrow void list: recent voids from phase1 failures
  const { data: recentVoids } = await sb
    .from("sales")
    .select("id,invoice_number,status,created_at,device_id")
    .eq("organization_id", orgId)
    .eq("status", "void")
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: testCustomers } = await sb
    .from("customers")
    .select("id,name,phone")
    .or("name.ilike.%Phase1B%,name.ilike.%Phase1C%");
  const { data: testReturns } = await sb
    .from("sale_returns")
    .select("id,original_sale_id,reason,created_at")
    .or("reason.ilike.%phase1%");

  // Cleanup policy: unsafe to delete products/warehouses with movements/sales FKs via anon client.
  // Discard leftover phase1 holds only (safe, supported).
  let discardedHolds = 0;
  for (const holdRow of testHolds || []) {
    if (String(holdRow.status) === "held") {
      const d = await hit(`/api/v1/pos/holds/${holdRow.id}/discard`, {
        method: "POST",
        headers: h,
        body: "{}",
      });
      if (d.ok || d.status === 200 || d.status === 204) discardedHolds += 1;
    }
  }

  setStep("step18_cleanup", "PARTIAL", {
    summary: `Documented residue; discarded ${discardedHolds} phase1 holds. Products/warehouses/void sales NOT deleted (FK/history unsafe).`,
    discardedHolds,
    identified: {
      products: (testProducts || []).map((p) => ({ id: p.id, code: p.product_code, name: p.name })),
      warehouses: (testWh || []).map((w) => ({ id: w.id, code: w.code, name: w.name })),
      holds: (testHolds || []).map((x) => ({ id: x.id, label: x.hold_label, status: x.status })),
      recentVoidSales: (recentVoids || []).slice(0, 10).map((s) => ({
        id: s.id,
        invoice: s.invoice_number,
        created: s.created_at,
      })),
      customers: (testCustomers || []).map((c) => ({ id: c.id, name: c.name })),
      returns: (testReturns || []).map((r) => ({ id: r.id, reason: r.reason, sale: r.original_sale_id })),
      verifyProductThisRun: { id: productId, code, saleId, returnIds },
    },
    deletedProductionData: false,
  });

  const outPath = path.join(__dirname, "..", "PHASE-1C-STEPS-12-18.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  report.fatal = String(e?.message || e);
  fs.writeFileSync(path.join(__dirname, "..", "PHASE-1C-STEPS-12-18.json"), JSON.stringify(report, null, 2));
  process.exit(1);
});
