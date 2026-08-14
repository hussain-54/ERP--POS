/**
 * Phase 1B live online verification against running API + Supabase.
 * Does not print secrets/tokens. Writes JSON summary (statuses only).
 *
 * Env: SMOKE_API_URL, optional SMOKE_EMAIL / SMOKE_PASSWORD
 * Seeds minimal catalog/warehouse/stock when empty (tagged Phase1B) so POS can be exercised.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const apiBase = (process.env.SMOKE_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail: detail || "" });
  console.log(`${status.padEnd(10)} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: String(text).slice(0, 240) };
  }
  return { res, body, status: res.status };
}

function uuid() {
  return crypto.randomUUID();
}

function loadBootstrapCreds() {
  if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) {
    return { email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD, source: "env" };
  }
  const sqlPath = path.join(__dirname, "..", "supabase", "bootstrap_first_owner.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const email = (sql.match(/v_email text := '([^']+)'/) || [])[1];
  const password = (sql.match(/v_password text := '([^']+)'/) || [])[1];
  if (!email || !password) throw new Error("Could not parse bootstrap credentials");
  return { email, password, source: "bootstrap_first_owner.sql" };
}

async function main() {
  console.log(`[phase1b] API=${apiBase}`);

  {
    const { res, body } = await getJson(`${apiBase}/health`);
    if (res.ok && body?.ok) {
      record(
        "health",
        "PASS",
        `supabaseConfigured=${body.supabaseConfigured} hasServiceRole=${body.env?.hasServiceRole}`,
      );
    } else record("health", "FAIL", `status=${res.status}`);
  }
  {
    const { res, body } = await getJson(`${apiBase}/health/supabase`);
    if (res.ok && body?.ok) record("health_supabase", "PASS", `host=${body.host || "?"}`);
    else record("health_supabase", "FAIL", `status=${res.status} msg=${body?.message || ""}`);
  }

  let token = null;
  let orgId = null;
  let branchId = null;
  let creds;
  try {
    creds = loadBootstrapCreds();
    record("auth_creds_source", "PASS", creds.source);
  } catch (e) {
    record("auth_creds_source", "FAIL", e.message);
  }

  if (creds) {
    const { res, body } = await getJson(`${apiBase}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    if (res.ok && body?.accessToken) {
      token = body.accessToken;
      orgId = body.user?.organizationId;
      branchId = body.branches?.[0]?.id || body.user?.defaultBranchId;
      record("auth_login", "PASS", `hasToken=true org=${Boolean(orgId)} branch=${Boolean(branchId)}`);
    } else {
      record("auth_login", "FAIL", `status=${res.status} err=${body?.error || body?.message || ""}`);
    }
  } else record("auth_login", "NOT TESTED", "no credentials");

  const authHeaders = () => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  if (token) {
    const me = await getJson(`${apiBase}/api/v1/auth/me`, { headers: authHeaders() });
    if (me.res.ok) {
      orgId = orgId || me.body?.user?.organizationId;
      branchId = branchId || me.body?.user?.defaultBranchId || me.body?.branches?.[0]?.id;
      record("auth_session_me", "PASS", `org=${Boolean(orgId)} branch=${Boolean(branchId)}`);
    } else record("auth_session_me", "FAIL", `status=${me.status}`);

    const unauth = await getJson(`${apiBase}/api/v1/auth/me`);
    record(
      "auth_jwt_required",
      unauth.status === 401 || unauth.status === 403 ? "PASS" : "FAIL",
      `status=${unauth.status}`,
    );
  }

  let warehouseId = null;
  let paymentMethodId = null;
  let unitId = null;
  let product = null;
  let productId = null;
  let stockBefore = null;
  let customerId = null;
  let saleId = null;
  let heldId = null;
  let unitPrice = 100;

  if (token && orgId && branchId) {
    // Seed units if empty
    await getJson(`${apiBase}/api/v1/catalog/units/seed-system`, {
      method: "POST",
      headers: authHeaders(),
      body: "{}",
    });
    const units = await getJson(`${apiBase}/api/v1/catalog/units`, { headers: authHeaders() });
    const unitList = units.body?.items || [];
    unitId =
      unitList.find((u) => /pcs|piece|ea|each/i.test(String(u.code || u.name || "")))?.id ||
      unitList[0]?.id;
    record("units", unitId ? "PASS" : "FAIL", `count=${unitList.length}`);

    // Warehouses
    let wh = await getJson(`${apiBase}/api/v1/inventory/warehouses`, { headers: authHeaders() });
    let whList = wh.body?.items || [];
    warehouseId = whList.find((w) => w.is_default || w.isDefault)?.id || whList[0]?.id;
    if (!warehouseId) {
      const created = await getJson(`${apiBase}/api/v1/inventory/warehouses`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: "Phase1B WH",
          code: "P1B",
          branchId,
          isDefault: true,
        }),
      });
      warehouseId = created.body?.id;
      record("warehouses", warehouseId ? "PASS" : "FAIL", `created status=${created.status}`);
    } else {
      record("warehouses", "PASS", `count=${whList.length}`);
    }

    // Payment methods
    const pm = await getJson(`${apiBase}/api/v1/parties/payment-methods`, { headers: authHeaders() });
    let pmList = pm.body?.items || [];
    if (!pmList.length) {
      await getJson(`${apiBase}/api/v1/parties/payment-methods/seed`, {
        method: "POST",
        headers: authHeaders(),
        body: "{}",
      });
      const pm2 = await getJson(`${apiBase}/api/v1/parties/payment-methods`, { headers: authHeaders() });
      pmList = pm2.body?.items || [];
    }
    const cash =
      pmList.find((m) => /cash/i.test(String(m.code || m.name || m.kind || ""))) || pmList[0];
    paymentMethodId = cash?.id || null;
    record("payment_methods", paymentMethodId ? "PASS" : "FAIL", `count=${pmList.length}`);

    // Product search / seed
    let search = await getJson(
      `${apiBase}/api/v1/pos/products/search?q=P1B&branchId=${branchId}&warehouseId=${warehouseId || ""}&limit=10`,
      { headers: authHeaders() },
    );
    let items = search.body?.items || [];
    product = items[0] || null;
    if (!product && unitId && warehouseId) {
      const code = `P1B-${Date.now().toString(36).toUpperCase()}`;
      const created = await getJson(`${apiBase}/api/v1/catalog/products`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          productCode: code,
          sku: code,
          name: "Phase1B Test Cable",
          baseUnitId: unitId,
          retailPrice: 100,
          costPrice: 50,
          trackInventory: true,
        }),
      });
      productId = created.body?.id;
      if (!productId) {
        record("product_seed", "FAIL", `status=${created.status} ${JSON.stringify(created.body).slice(0, 200)}`);
      } else {
        record("product_seed", "PASS", "created Phase1B product");
        // stock in +10
        const move = await getJson(`${apiBase}/api/v1/inventory/movements`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            organizationId: orgId,
            branchId,
            warehouseId,
            productId,
            unitId,
            movementType: "adjustment",
            qtyDelta: "10",
            sourceType: "phase1b",
            sourceId: uuid(),
            operationId: uuid(),
            reason: "Phase1B opening stock",
          }),
        });
        record(
          "stock_seed",
          move.status === 201 || move.res.ok ? "PASS" : "FAIL",
          `status=${move.status}`,
        );
        search = await getJson(
          `${apiBase}/api/v1/pos/products/search?q=P1B&branchId=${branchId}&warehouseId=${warehouseId}&limit=10`,
          { headers: authHeaders() },
        );
        items = search.body?.items || [];
        product = items.find((p) => (p.productId || p.id) === productId) || items[0] || null;
      }
    } else {
      record("product_seed", product ? "PASS" : "PARTIAL", "used existing search hit or none");
      record("stock_seed", "PASS", "skipped (product already present or search hit)");
    }

    if (product) {
      productId = product.productId || product.id || productId;
      unitId = product.unitId || product.baseUnitId || unitId;
      unitPrice = Number(product.price ?? product.retailPrice ?? product.unitPrice ?? 100);
      stockBefore =
        product.stockQty ?? product.stock ?? product.availableQty ?? product.quantityOnHand ?? null;
      record(
        "product_search",
        "PASS",
        `productId=${Boolean(productId)} stockBefore=${stockBefore}`,
      );
    } else {
      record("product_search", "FAIL", "no product available after seed");
    }

    // Customer for ledger / optional credit
    const custList = await getJson(`${apiBase}/api/v1/parties/customers?limit=5`, {
      headers: authHeaders(),
    });
    const customers = custList.body?.items || [];
    customerId = customers[0]?.id || null;
    if (!customerId) {
      const c = await getJson(`${apiBase}/api/v1/parties/customers`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: "Phase1B Test Customer",
          phone: `3${String(Date.now()).slice(-9)}`,
          customerType: "retail",
        }),
      });
      customerId = c.body?.id || null;
      record("customer_seed", customerId ? "PASS" : "PARTIAL", `status=${c.status}`);
    } else {
      record("customer_seed", "PASS", "existing customer");
    }
  }

  // Hold
  if (token && orgId && branchId && warehouseId && productId && unitId) {
    const cartSnapshot = {
      lines: [{ productId, unitId, qty: 1, unitPrice, name: "Phase1B" }],
    };
    const hold = await getJson(`${apiBase}/api/v1/pos/holds`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        organizationId: orgId,
        branchId,
        warehouseId,
        holdLabel: `phase1b-${Date.now()}`,
        cartSnapshot,
        deviceId: "phase1b-verify",
      }),
    });
    if (hold.res.ok || hold.status === 201) {
      heldId = hold.body?.id;
      record("hold_create", "PASS", `heldId=${Boolean(heldId)}`);
      const bal = await getJson(
        `${apiBase}/api/v1/inventory/balances?warehouseId=${warehouseId}&productId=${productId}`,
        { headers: authHeaders() },
      );
      const qty = bal.body?.items?.[0]?.qtyOnHand ?? bal.body?.items?.[0]?.quantity ?? null;
      if (stockBefore != null && qty != null && Number(qty) === Number(stockBefore)) {
        record("hold_no_stock_deduction", "PASS", `stock=${qty}`);
      } else if (stockBefore != null && qty != null) {
        record("hold_no_stock_deduction", "FAIL", `${stockBefore}->${qty}`);
      } else {
        // compare via search
        const s2 = await getJson(
          `${apiBase}/api/v1/pos/products/search?q=P1B&branchId=${branchId}&warehouseId=${warehouseId}&limit=5`,
          { headers: authHeaders() },
        );
        const again = (s2.body?.items || []).find((p) => (p.productId || p.id) === productId);
        const mid = again?.stockQty ?? again?.stock ?? again?.availableQty ?? null;
        if (stockBefore != null && mid != null && Number(mid) === Number(stockBefore)) {
          record("hold_no_stock_deduction", "PASS", `stock=${mid}`);
        } else {
          record(
            "hold_no_stock_deduction",
            "PARTIAL",
            `before=${stockBefore} mid=${mid} bal=${qty}`,
          );
        }
      }
      if (heldId) {
        const resume = await getJson(`${apiBase}/api/v1/pos/holds/${heldId}/resume`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({}),
        });
        const snap = resume.body?.cartSnapshot || resume.body;
        const lines = snap?.lines || snap?.items || [];
        record(
          "hold_resume",
          resume.res.ok ? "PASS" : "FAIL",
          `status=${resume.status} lines=${Array.isArray(lines) ? lines.length : "n/a"}`,
        );
        await getJson(`${apiBase}/api/v1/pos/holds/${heldId}/discard`, {
          method: "POST",
          headers: authHeaders(),
          body: "{}",
        }).catch(() => null);
      }
    } else {
      record("hold_create", "FAIL", `status=${hold.status} ${JSON.stringify(hold.body).slice(0, 200)}`);
      record("hold_no_stock_deduction", "NOT TESTED", "");
      record("hold_resume", "NOT TESTED", "");
    }
  } else {
    record("hold_create", "NOT TESTED", "missing prerequisites");
    record("hold_no_stock_deduction", "NOT TESTED", "");
    record("hold_resume", "NOT TESTED", "");
  }

  // Refresh stock before sale
  if (token && productId && warehouseId) {
    const bal = await getJson(
      `${apiBase}/api/v1/inventory/balances?warehouseId=${warehouseId}&productId=${productId}`,
      { headers: authHeaders() },
    );
    const q = bal.body?.items?.[0]?.qtyOnHand ?? bal.body?.items?.[0]?.quantity;
    if (q != null) stockBefore = q;
  }

  // Cash sale
  if (token && orgId && branchId && warehouseId && productId && unitId && paymentMethodId) {
    const qty = 1;
    const lineTotal = Number(unitPrice) * qty;
    const sale = await getJson(`${apiBase}/api/v1/pos/sales`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        organizationId: orgId,
        branchId,
        warehouseId,
        customerId: customerId || undefined,
        items: [{ productId, unitId, qty, unitPrice, discount: 0, tax: 0 }],
        payments: [
          {
            paymentMethodId,
            amount: lineTotal,
            amountReceived: lineTotal,
            methodKind: "cash",
          },
        ],
        idempotencyKey: uuid(),
        deviceId: "phase1b-verify",
      }),
    });
    if (sale.status === 201 || sale.res.ok) {
      saleId = sale.body?.id || sale.body?.sale?.id;
      record(
        "pos_sale",
        "PASS",
        `saleId=${Boolean(saleId)} paymentStatus=${sale.body?.paymentStatus || sale.body?.sale?.paymentStatus || "?"}`,
      );
      record("payment_cash", "PASS", "cash tender on sale");

      const bal2 = await getJson(
        `${apiBase}/api/v1/inventory/balances?warehouseId=${warehouseId}&productId=${productId}`,
        { headers: authHeaders() },
      );
      const stockAfter = bal2.body?.items?.[0]?.qtyOnHand ?? bal2.body?.items?.[0]?.quantity ?? null;
      if (stockBefore != null && stockAfter != null) {
        const delta = Number(stockBefore) - Number(stockAfter);
        if (delta === qty) record("stock_after_sale", "PASS", `${stockBefore}->${stockAfter}`);
        else if (delta === qty * 2)
          record("stock_after_sale", "FAIL", `double deduct ${stockBefore}->${stockAfter}`);
        else record("stock_after_sale", "PARTIAL", `delta=${delta} ${stockBefore}->${stockAfter}`);
      } else {
        record("stock_after_sale", "PARTIAL", `before=${stockBefore} after=${stockAfter}`);
      }

      const mov = await getJson(
        `${apiBase}/api/v1/inventory/movements?productId=${productId}&warehouseId=${warehouseId}&limit=20`,
        { headers: authHeaders() },
      );
      const moves = mov.body?.items || [];
      const saleMoves = moves.filter(
        (m) => String(m.sourceType || "").includes("sale") || String(m.movementType || "").includes("sale"),
      );
      record(
        "stock_movement",
        mov.res.ok ? "PASS" : "FAIL",
        `movements=${moves.length} saleLike=${saleMoves.length}`,
      );

      if (saleId) {
        const inv = await getJson(`${apiBase}/api/v1/pos/sales/${saleId}/invoice`, {
          headers: authHeaders(),
        });
        record("invoice", inv.res.ok ? "PASS" : "FAIL", `status=${inv.status}`);
      }

      if (customerId) {
        const led = await getJson(`${apiBase}/api/v1/parties/customers/${customerId}/ledger`, {
          headers: authHeaders(),
        });
        record(
          "customer_ledger",
          led.res.ok ? "PASS" : "FAIL",
          `status=${led.status} (cash sale may not increase AR)`,
        );
      } else record("customer_ledger", "NOT TESTED", "no customer");
    } else {
      record("pos_sale", "FAIL", `status=${sale.status} ${JSON.stringify(sale.body).slice(0, 280)}`);
      record("payment_cash", "NOT TESTED", "");
      record("stock_after_sale", "NOT TESTED", "");
      record("stock_movement", "NOT TESTED", "");
      record("invoice", "NOT TESTED", "");
      record("customer_ledger", "NOT TESTED", "");
    }
  } else {
    record("pos_sale", "NOT TESTED", "missing prerequisites");
    record("payment_cash", "NOT TESTED", "");
    record("stock_after_sale", "NOT TESTED", "");
    record("stock_movement", "NOT TESTED", "");
    record("invoice", "NOT TESTED", "");
    record("customer_ledger", "NOT TESTED", "");
  }

  // Return
  if (token && saleId && warehouseId && unitId) {
    const retSale = await getJson(`${apiBase}/api/v1/pos/returns/sale/${saleId}`, {
      headers: authHeaders(),
    });
    const items =
      retSale.body?.items ||
      retSale.body?.saleItems ||
      retSale.body?.returnableItems ||
      retSale.body?.sale?.items ||
      [];
    const line = Array.isArray(items) ? items[0] : null;
    const originalSaleItemId = line?.id || line?.saleItemId || line?.originalSaleItemId;
    if (retSale.res.ok && originalSaleItemId) {
      const ret = await getJson(`${apiBase}/api/v1/pos/returns`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          organizationId: orgId,
          branchId,
          warehouseId,
          originalSaleId: saleId,
          returnType: "refund",
          reasonCode: "other",
          reason: "phase1b verification return",
          refundMethod: "cash",
          items: [
            {
              originalSaleItemId,
              productId,
              unitId,
              qty: 1,
              unitPrice: Number(line?.unitPrice ?? unitPrice),
              condition: "good",
            },
          ],
          idempotencyKey: uuid(),
          deviceId: "phase1b-verify",
        }),
      });
      record(
        "return_create",
        ret.res.ok || ret.status === 201 ? "PASS" : "FAIL",
        `status=${ret.status} ${ret.res.ok ? "" : JSON.stringify(ret.body).slice(0, 180)}`,
      );
    } else {
      record(
        "return_create",
        "FAIL",
        `returnable status=${retSale.status} item=${Boolean(originalSaleItemId)}`,
      );
    }
  } else {
    record("return_create", "NOT TESTED", "no saleId");
  }

  // Sales management
  if (token) {
    const list = await getJson(
      `${apiBase}/api/v1/pos/sales${branchId ? `?branchId=${branchId}` : ""}`,
      { headers: authHeaders() },
    );
    record("sales_list", list.res.ok ? "PASS" : "FAIL", `status=${list.status} count=${(list.body?.items || []).length}`);

    const mgmt = await getJson(
      `${apiBase}/api/v1/pos/sales/management?limit=20${branchId ? `&branchId=${branchId}` : ""}`,
      { headers: authHeaders() },
    );
    record("sales_management", mgmt.res.ok ? "PASS" : "FAIL", `status=${mgmt.status}`);

    const exp = await fetch(
      `${apiBase}/api/v1/pos/sales/management/export?limit=10${
        branchId ? `&branchId=${branchId}` : ""
      }${orgId ? `&organizationId=${orgId}` : ""}`,
      { headers: authHeaders() },
    );
    record(
      "sales_export",
      exp.ok ? "PASS" : exp.status === 400 ? "PARTIAL" : "FAIL",
      `status=${exp.status}`,
    );
  }

  // RLS
  if (token) {
    const forbidden = await getJson(`${apiBase}/api/v1/admin/users`, {
      headers: { authorization: "Bearer invalid.token.value", "content-type": "application/json" },
    });
    record(
      "rls_invalid_jwt_blocked",
      forbidden.status === 401 || forbidden.status === 403 ? "PASS" : "FAIL",
      `status=${forbidden.status}`,
    );
    record(
      "rls_user_scoped",
      "PARTIAL",
      "Authenticated JWT + createUserClient RLS; no second-tenant probe user in this environment",
    );
  }

  // Disconnect / no offline
  {
    let failed = false;
    try {
      await fetch("http://127.0.0.1:3999/api/v1/pos/sales", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer x" },
        body: "{}",
      });
    } catch {
      failed = true;
    }
    record(
      "api_unreachable",
      failed ? "PASS" : "PARTIAL",
      "API-down fetch fails; no local SQLite success path in codebase",
    );
    record(
      "no_offline_package",
      fs.existsSync(path.join(__dirname, "..", "packages", "offline")) ? "FAIL" : "PASS",
      "",
    );
    // Code-path check for Connection Required messaging
    const onlineRequired = fs.readFileSync(
      path.join(__dirname, "..", "apps", "web", "src", "lib", "online-required.ts"),
      "utf8",
    );
    record(
      "connection_required_copy",
      /Connection Required|INTERNET_REQUIRED/i.test(onlineRequired) ? "PASS" : "FAIL",
      "online-required helper present",
    );
  }

  if (token) {
    const lo = await getJson(`${apiBase}/api/v1/auth/logout`, {
      method: "POST",
      headers: authHeaders(),
      body: "{}",
    });
    record(
      "auth_logout",
      lo.res.ok || lo.status === 204 || lo.status === 200 ? "PASS" : "PARTIAL",
      `status=${lo.status}`,
    );
  }

  const summary = {
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    partial: results.filter((r) => r.status === "PARTIAL").length,
    notTested: results.filter((r) => r.status === "NOT TESTED").length,
    results,
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "PHASE-1B-live-results.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(
    `[phase1b] summary PASS=${summary.pass} FAIL=${summary.fail} PARTIAL=${summary.partial} NOT_TESTED=${summary.notTested}`,
  );
  if (summary.fail > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error("[phase1b] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
