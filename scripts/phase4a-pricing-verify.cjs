/**
 * Phase 4A live: retail/wholesale/dealer, customer price, 10% line discount,
 * malicious client price, invoice % , idempotency.
 * Quantity-break and promotion persistence are not in the schema — reported MISSING.
 * Writes PHASE-4A-LIVE-RESULT.json (no secrets).
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

  await hit("/api/v1/catalog/units/seed-system", { method: "POST", headers: h, body: "{}" });
  const units = await hit("/api/v1/catalog/units", { headers: h });
  const unitId =
    (units.body?.items || []).find((u) => /pcs|piece|ea|each/i.test(String(u.code || u.name || "")))?.id ||
    units.body?.items?.[0]?.id;

  let wh = await hit("/api/v1/inventory/warehouses", { headers: h });
  const warehouseId =
    (wh.body?.items || []).find((w) => /P1B|P1C|P3A|P4A|Phase/i.test(String(w.name || w.code || "")))?.id ||
    (wh.body?.items || []).find((w) => w.is_default || w.isDefault)?.id ||
    wh.body?.items?.[0]?.id;

  let pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  if (!(pm.body?.items || []).length) {
    await hit("/api/v1/parties/payment-methods/seed", { method: "POST", headers: h, body: "{}" });
    pm = await hit("/api/v1/parties/payment-methods", { headers: h });
  }
  const cashId = (pm.body?.items || []).find((m) => m.kind === "cash" || /cash/i.test(m.code || m.name))?.id;

  const code = `P4A-${Date.now().toString(36).toUpperCase()}`;
  const created = await hit("/api/v1/catalog/products", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      productCode: code,
      sku: code,
      name: "Phase4A Pricing Cable",
      baseUnitId: unitId,
      retailPrice: 1000,
      wholesalePrice: 900,
      dealerPrice: 800,
      costPrice: 500,
      trackInventory: true,
    }),
  });
  const productId = created.body?.id;
  if (!productId) throw new Error(`product create failed ${created.status} ${JSON.stringify(created.body).slice(0, 240)}`);

  await hit("/api/v1/inventory/movements", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      organizationId: orgId,
      branchId,
      warehouseId,
      productId,
      unitId,
      movementType: "adjustment",
      qtyDelta: "50",
      sourceType: "phase4a",
      sourceId: uuid(),
      operationId: uuid(),
      reason: "Phase4A opening stock",
    }),
  });

  async function postSale(label, body) {
    const res = await hit("/api/v1/pos/sales", {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setStep(label, "FAIL", { summary: `${res.status}`, body: res.body });
      return null;
    }
    const { data: sale } = await sb.from("sales").select("id,grand_total,discount_total,subtotal").eq("id", res.body.id).maybeSingle();
    const { data: items } = await sb.from("sale_items").select("unit_price,discount_amount,discount_percent,line_total,qty").eq("sale_id", res.body.id);
    setStep(label, "PASS", {
      summary: `grand=${sale?.grand_total} unit=${items?.[0]?.unit_price}`,
      sale,
      items,
      api: { grandTotal: res.body?.totals?.grandTotal, invoice: res.body?.invoiceNumber },
    });
    return { api: res.body, sale, items };
  }

  const retail = await postSale("retail", {
    branchId,
    warehouseId,
    priceLevel: "retail",
    items: [{ productId, unitId, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
    payments: [{ paymentMethodId: cashId, amount: 1000, methodKind: "cash" }],
    discountTotal: 0,
    discounts: [],
    idempotencyKey: uuid(),
  });
  if (retail && Number(retail.items?.[0]?.unit_price) !== 1000) {
    report.steps.retail.status = "FAIL";
    report.steps.retail.summary = `expected unit 1000 got ${retail.items?.[0]?.unit_price}`;
  }

  const wholesale = await postSale("wholesale", {
    branchId,
    warehouseId,
    priceLevel: "wholesale",
    items: [{ productId, unitId, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
    payments: [{ paymentMethodId: cashId, amount: 900, methodKind: "cash" }],
    discountTotal: 0,
    discounts: [],
    idempotencyKey: uuid(),
  });
  if (wholesale && Number(wholesale.items?.[0]?.unit_price) !== 900) {
    report.steps.wholesale.status = "FAIL";
  }

  const dealer = await postSale("dealer", {
    branchId,
    warehouseId,
    priceLevel: "dealer",
    items: [{ productId, unitId, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
    payments: [{ paymentMethodId: cashId, amount: 800, methodKind: "cash" }],
    discountTotal: 0,
    discounts: [],
    idempotencyKey: uuid(),
  });
  if (dealer && Number(dealer.items?.[0]?.unit_price) !== 800) {
    report.steps.dealer.status = "FAIL";
  }

  const cust = await hit("/api/v1/parties/customers", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      code: `C4A-${Date.now().toString(36).toUpperCase()}`,
      name: "Phase4A Named Customer",
      customerType: "retail",
    }),
  });
  const customerId = cust.body?.id;
  if (customerId) {
    const priceRow = await hit(`/api/v1/catalog/products/${productId}/prices`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ unitId, amount: 850, customerId }),
    });
    if (!priceRow.ok) {
      setStep("customer_price_row", "FAIL", { summary: String(priceRow.status), body: priceRow.body });
    } else {
      setStep("customer_price_row", "PASS", { summary: "product_prices 850" });
      const named = await postSale("customer_price", {
        branchId,
        warehouseId,
        customerId,
        priceLevel: "retail",
        items: [{ productId, unitId, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
        payments: [{ paymentMethodId: cashId, amount: 850, methodKind: "cash" }],
        discountTotal: 0,
        discounts: [],
        idempotencyKey: uuid(),
      });
      if (named && Number(named.items?.[0]?.unit_price) !== 850) {
        report.steps.customer_price.status = "FAIL";
        report.steps.customer_price.summary = `expected 850 got ${named.items?.[0]?.unit_price}`;
      }
    }
  } else {
    setStep("customer_price", "NOT TESTED", { summary: "customer create failed", body: cust.body });
  }

  setStep("quantity_price", "MISSING", {
    summary: "product_prices has no min_qty; quantity breaks are domain-only",
  });
  setStep("promotion_price", "MISSING", {
    summary: "PROMOTION PRICING — NOT IMPLEMENTED (no promotions table)",
  });

  const pct = await postSale("line_percent_10", {
    branchId,
    warehouseId,
    priceLevel: "retail",
    items: [{ productId, unitId, qty: 1, unitPrice: 1, discountPercent: 10, discount: 0, tax: 0 }],
    payments: [{ paymentMethodId: cashId, amount: 900, methodKind: "cash" }],
    discountTotal: 0,
    discounts: [
      { scope: "item", kind: "percentage", percent: 10, amount: 100, approverRole: "owner", reason: "phase4a" },
    ],
    idempotencyKey: uuid(),
  });
  if (pct) {
    const disc = Number(pct.items?.[0]?.discount_amount);
    const grand = Number(pct.sale?.grand_total);
    if (disc !== 100 || grand !== 900) {
      report.steps.line_percent_10.status = "FAIL";
      report.steps.line_percent_10.summary = `discount=${disc} grand=${grand} expected 100/900`;
    }
  }

  const inv = await postSale("invoice_percent_10", {
    branchId,
    warehouseId,
    priceLevel: "retail",
    items: [{ productId, unitId, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
    payments: [{ paymentMethodId: cashId, amount: 900, methodKind: "cash" }],
    discountTotal: 10,
    invoiceDiscountKind: "percentage",
    discounts: [
      { scope: "invoice", kind: "percentage", percent: 10, amount: 100, approverRole: "owner", reason: "phase4a" },
    ],
    idempotencyKey: uuid(),
  });
  if (inv && Number(inv.sale?.grand_total) !== 900) {
    report.steps.invoice_percent_10.status = "FAIL";
    report.steps.invoice_percent_10.summary = `grand=${inv.sale?.grand_total} expected 900`;
  }

  const key = uuid();
  const first = await postSale("idempotency_first", {
    branchId,
    warehouseId,
    priceLevel: "retail",
    items: [{ productId, unitId, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
    payments: [{ paymentMethodId: cashId, amount: 1000, methodKind: "cash" }],
    discountTotal: 0,
    discounts: [],
    idempotencyKey: key,
  });
  const second = await hit("/api/v1/pos/sales", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      branchId,
      warehouseId,
      priceLevel: "retail",
      items: [{ productId, unitId, qty: 1, unitPrice: 1, discount: 0, tax: 0 }],
      payments: [{ paymentMethodId: cashId, amount: 1000, methodKind: "cash" }],
      discountTotal: 0,
      discounts: [],
      idempotencyKey: key,
    }),
  });
  if (first && second.ok && second.body?.id === first.api.id) {
    setStep("idempotency_retry", "PASS", { summary: "same sale id returned" });
  } else {
    setStep("idempotency_retry", second.ok ? "FAIL" : "FAIL", {
      summary: `status=${second.status} id=${second.body?.id}`,
    });
  }

  const out = path.join(__dirname, "..", "PHASE-4A-LIVE-RESULT.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("wrote", out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
