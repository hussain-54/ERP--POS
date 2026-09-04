/**
 * Live POS E2E cashier verification against running API (:4000).
 * Reports PASS/FAIL for persistence steps. Does not print secrets.
 */
const API = "http://127.0.0.1:4000";
const EMAIL = process.env.POS_E2E_EMAIL || "hussaindurrani92@gmail.com";
const PASSWORD = process.env.POS_E2E_PASSWORD || "erp@1234";

const results = [];

function report(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

function uuid() {
  return crypto.randomUUID();
}

async function main() {
  console.log("[pos-e2e] starting against", API);

  const login = await req("/api/v1/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!login.res.ok || !login.json?.accessToken) {
    report("Login", false, `status=${login.res.status}`);
    process.exit(1);
  }
  const token = login.json.accessToken;
  const orgId = login.json.user.organizationId;
  const branchId = login.json.user.defaultBranchId || login.json.branches?.[0]?.id;
  report("Login", true, `user=${login.json.user.fullName} branch=${String(branchId).slice(0, 8)}`);

  await req("/api/v1/parties/payment-methods/seed", { method: "POST", token, body: {} });
  const methodsRes = await req("/api/v1/parties/payment-methods", { token });
  const methods = methodsRes.json?.items ?? methodsRes.json ?? [];
  const byKind = Object.fromEntries(
    (Array.isArray(methods) ? methods : []).map((m) => [m.kind, m.id]),
  );
  const cashId = byKind.cash;
  report("Payment methods available", Boolean(cashId), `cash=${cashId ? "yes" : "no"} kinds=${Object.keys(byKind).join(",")}`);

  const warehousesRes = await req("/api/v1/inventory/warehouses", { token });
  const warehouses = warehousesRes.json?.items ?? [];
  const warehouse =
    warehouses.find((w) => w.is_default || w.isDefault) ||
    warehouses.find((w) => (w.branch_id || w.branchId) === branchId) ||
    warehouses[0];
  const warehouseId = warehouse?.id;
  report(
    "Warehouse resolved",
    Boolean(warehouseId),
    warehouseId ? `${warehouse.name || warehouse.code} ${String(warehouseId).slice(0, 8)}` : "none",
  );
  if (!warehouseId) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  const search = await req(
    `/api/v1/pos/products/search?q=a&warehouseId=${encodeURIComponent(warehouseId)}&limit=20`,
    { token },
  );
  const products = search.json?.items ?? [];
  let product =
    products.find((p) => Number(p.stockAvailable ?? 0) > 1) ||
    products.find((p) => p.productId) ||
    null;
  report(
    "Product search / catalog",
    Boolean(product),
    product
      ? `${product.name} stock=${product.stockAvailable} sku=${product.sku}`
      : `status=${search.res.status} count=${products.length}`,
  );
  if (!product) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  // Ensure sellable stock exists for live COMPLETE SALE verification
  let stockBefore = Number(product.stockAvailable ?? 0);
  if (!(stockBefore > 5)) {
    const seed = await req("/api/v1/inventory/movements", {
      method: "POST",
      token,
      body: {
        branchId,
        warehouseId,
        productId: product.productId,
        unitId: product.unitId,
        movementType: "opening",
        qtyDelta: "100",
        unitCost: "100",
        sourceType: "e2e_seed",
        sourceId: uuid(),
        operationId: uuid(),
        reason: "E2E POS stock seed",
      },
    });
    report(
      "Seed opening stock",
      seed.res.status === 201 || seed.res.ok,
      seed.res.ok
        ? `seeded 100 for ${product.sku}`
        : `status=${seed.res.status} ${JSON.stringify(seed.json).slice(0, 200)}`,
    );
    const searchSeeded = await req(
      `/api/v1/pos/products/search?q=${encodeURIComponent(product.sku || "a")}&warehouseId=${encodeURIComponent(warehouseId)}&limit=5`,
      { token },
    );
    product =
      (searchSeeded.json?.items ?? []).find((p) => p.productId === product.productId) || product;
    stockBefore = Number(product.stockAvailable ?? 0);
  } else {
    report("Seed opening stock", true, "already stocked");
  }

  const unitPrice = Number(product.customerPrice ?? product.retailPrice ?? 0) || 1000;
  const qty = 1;
  const lineGross = unitPrice * qty;
  const taxRate = 0.17;
  const tax = Number((lineGross * taxRate).toFixed(2));
  const grand = Number((lineGross + tax).toFixed(2));

  // Find or create customer with phone
  let customerId = null;
  let customerPhone = "03001234999";
  const custSearch = await req(`/api/v1/parties/customers?q=E2E&limit=5`, { token });
  const existing = (custSearch.json?.items ?? []).find((c) =>
    String(c.mobile || c.phone || "").includes("03001234999"),
  );
  if (existing?.id) {
    customerId = existing.id;
    customerPhone = existing.mobile || existing.phone || customerPhone;
    report("Customer with WhatsApp/phone", true, `reuse ${existing.name || existing.id}`);
  } else {
    const created = await req("/api/v1/parties/customers", {
      method: "POST",
      token,
      body: {
        code: `E2E-${Date.now().toString(36).slice(-6).toUpperCase()}`,
        name: "E2E POS Customer",
        mobile: customerPhone,
        email: "e2e-pos@example.com",
        customerType: "retail",
      },
    });
    customerId = created.json?.id || created.json?.customer?.id;
    report(
      "Customer with WhatsApp/phone",
      Boolean(customerId),
      customerId
        ? `created ${customerId.slice(0, 8)}`
        : `status=${created.res.status} ${JSON.stringify(created.json).slice(0, 180)}`,
    );
  }

  function saleItem() {
    return {
      productId: product.productId,
      unitId: product.unitId,
      qty,
      unitPrice,
      discount: 0,
      discountPercent: 0,
      tax,
    };
  }

  const idem = uuid();
  const saleBody = {
    branchId,
    warehouseId,
    customerId,
    idempotencyKey: idem,
    notes: "E2E cashier verification sale",
    items: [saleItem()],
    payments: cashId
      ? [
          {
            paymentMethodId: cashId,
            amount: grand,
            amountReceived: grand + 500,
            methodKind: "cash",
            reference: "E2E-CASH",
          },
        ]
      : [],
    priceLevel: "retail",
  };

  const posted = await req("/api/v1/pos/sales", { method: "POST", token, body: saleBody });
  const saleId = posted.json?.id;
  const invoiceNumber = posted.json?.invoiceNumber;
  report(
    "COMPLETE SALE posts transaction",
    Boolean(saleId),
    saleId
      ? `sale=${saleId.slice(0, 8)} invoice=${invoiceNumber}`
      : `status=${posted.res.status} ${JSON.stringify(posted.json).slice(0, 240)}`,
  );
  if (!saleId) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  const invoice = await req(`/api/v1/pos/sales/${saleId}/invoice`, { token });
  const inv = invoice.json;
  report(
    "Invoice generated",
    Boolean(inv?.invoiceNumber || inv?.sale?.invoiceNumber),
    `inv=${inv?.invoiceNumber || inv?.sale?.invoiceNumber} customer=${inv?.customerName} phone=${inv?.customerMobile}`,
  );
  report(
    "Customer attached to sale",
    Boolean(inv?.customerName) && (inv?.customerMobile || customerPhone),
    `${inv?.customerName} / ${inv?.customerMobile || "no phone on invoice"}`,
  );
  report(
    "Payment method saved on invoice",
    Array.isArray(inv?.payments) && inv.payments.length > 0,
    JSON.stringify(inv?.payments ?? []).slice(0, 160),
  );
  report(
    "Cashier / branch / totals on invoice",
    Boolean(inv?.sale?.grandTotal != null),
    `grand=${inv?.sale?.grandTotal} tax=${inv?.sale?.taxTotal} branch=${inv?.branchName} cashier=${inv?.cashierName}`,
  );

  const salesMgmt = await req(
    `/api/v1/pos/sales/management?branchId=${encodeURIComponent(branchId)}&limit=10&tab=completed`,
    { token },
  );
  const saleRows = salesMgmt.json?.items ?? salesMgmt.json?.sales ?? [];
  const inSales = saleRows.some((r) => r.id === saleId || r.invoiceNumber === invoiceNumber);
  report("Sale appears in Sales register", inSales, `rows=${saleRows.length}`);

  // Stock after
  const searchAfter = await req(
    `/api/v1/pos/products/search?q=${encodeURIComponent(product.sku || product.name)}&warehouseId=${encodeURIComponent(warehouseId)}&limit=5`,
    { token },
  );
  const after = (searchAfter.json?.items ?? []).find((p) => p.productId === product.productId);
  const stockAfter = after ? Number(after.stockAvailable) : NaN;
  const stockOk =
    Number.isFinite(stockBefore) && Number.isFinite(stockAfter)
      ? stockAfter <= stockBefore - qty + 0.001
      : false;
  report(
    "Stock quantity decreases",
    stockOk,
    `before=${stockBefore} after=${stockAfter}`,
  );

  // Credit / Udhaar sale
  if (customerId) {
    const creditSale = await req("/api/v1/pos/sales", {
      method: "POST",
      token,
      body: {
        branchId,
        warehouseId,
        customerId,
        idempotencyKey: uuid(),
        notes: "E2E credit/udhaar",
        items: [saleItem()],
        payments: [],
        priceLevel: "retail",
      },
    });
    report(
      "Credit / Udhaar sale posts",
      Boolean(creditSale.json?.id),
      creditSale.json?.id
        ? `sale=${String(creditSale.json.id).slice(0, 8)} remaining expected`
        : `status=${creditSale.res.status} ${JSON.stringify(creditSale.json).slice(0, 180)}`,
    );
  } else {
    report("Credit / Udhaar sale posts", false, "no customer");
  }

  // Split payment
  if (cashId && (byKind.card || byKind.online || byKind.bank)) {
    const secondId = byKind.card || byKind.online || byKind.bank;
    const half = Number((grand / 2).toFixed(2));
    const rest = Number((grand - half).toFixed(2));
    const splitSale = await req("/api/v1/pos/sales", {
      method: "POST",
      token,
      body: {
        branchId,
        warehouseId,
        customerId,
        idempotencyKey: uuid(),
        notes: "E2E split payment",
        items: [saleItem()],
        payments: [
          { paymentMethodId: cashId, amount: half, amountReceived: half, methodKind: "cash" },
          {
            paymentMethodId: secondId,
            amount: rest,
            amountReceived: rest,
            methodKind: byKind.card ? "card" : "online",
          },
        ],
        priceLevel: "retail",
      },
    });
    report(
      "Split Payment sale posts",
      Boolean(splitSale.json?.id),
      splitSale.json?.id
        ? `sale=${String(splitSale.json.id).slice(0, 8)}`
        : `status=${splitSale.res.status} ${JSON.stringify(splitSale.json).slice(0, 180)}`,
    );
  } else {
    report("Split Payment sale posts", false, "need cash + card/bank methods");
  }

  // Installment (requires installments.manage)
  const inst = await req("/api/v1/pos/sales", {
    method: "POST",
    token,
    body: {
      branchId,
      warehouseId,
      customerId,
      idempotencyKey: uuid(),
      notes: "E2E installment",
      items: [saleItem()],
      payments: cashId
        ? [
            {
              paymentMethodId: cashId,
              amount: Math.min(1000, grand),
              amountReceived: Math.min(1000, grand),
              methodKind: "cash",
              reference: "Down",
            },
          ]
        : [],
      priceLevel: "retail",
      createInstallment: {
        downPayment: String(Math.min(1000, grand)),
        installmentCount: 3,
        startDate: new Date().toISOString().slice(0, 10),
        frequency: "monthly",
      },
    },
  });
  report(
    "Installment sale posts",
    Boolean(inst.json?.id),
    inst.json?.id
      ? `sale=${String(inst.json.id).slice(0, 8)}`
      : `status=${inst.res.status} ${JSON.stringify(inst.json).slice(0, 200)}`,
  );

  // Receipt fields completeness for Print/PDF/WhatsApp generation
  const receiptReady =
    Boolean(inv?.invoiceNumber || inv?.sale?.invoiceNumber) &&
    Array.isArray(inv?.items) &&
    inv.items.length > 0 &&
    inv?.sale?.grandTotal != null;
  report("Receipt data ready (print/pdf/whatsapp)", receiptReady, `items=${inv?.items?.length ?? 0}`);

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(`PASS ${results.length - failed.length} / ${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(` - ${f.step}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
