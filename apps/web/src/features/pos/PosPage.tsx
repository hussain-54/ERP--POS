import { useEffect, useMemo, useState } from "react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import { Badge, Button, Card, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";
import { partiesApi } from "@/features/parties/parties-api";
import { inventoryApi } from "@/features/inventory/inventory-api";
import { posHardware } from "./hardware";
import { aiApi } from "@/features/ai/ai-api";

type PriceLevel = "retail" | "wholesale" | "dealer";
type PaySplit = { id: string; paymentMethodId: string; amount: string };

type LocaleMode = "en" | "ur" | "en_ur";
type PosMode = "easy" | "advanced";

interface CartLine {
  key: string;
  productId?: string;
  name: string;
  nameUr?: string | null;
  unitId: string;
  qty: string;
  unitPrice: number;
  discount: number;
  tax: number;
  warrantyDays: number;
  isManual?: boolean;
  stock?: string;
}

const labels = {
  en: {
    title: "Point of Sale",
    search: "Search products",
    cart: "Cart",
    checkout: "Complete sale",
    hold: "Hold bill",
    resume: "Held bills",
    customer: "Customer ID",
    warehouse: "Warehouse ID",
    empty: "Cart is empty",
  },
  ur: {
    title: "پوائنٹ آف سیل",
    search: "مصنوعات تلاش کریں",
    cart: "کارٹ",
    checkout: "فروخت مکمل کریں",
    hold: "بل ہولڈ",
    resume: "ہولڈ بلز",
    customer: "کسٹمر آئی ڈی",
    warehouse: "گودام آئی ڈی",
    empty: "کارٹ خالی ہے",
  },
};

function t(locale: LocaleMode, key: keyof typeof labels.en): string {
  if (locale === "ur") return labels.ur[key];
  if (locale === "en_ur") return `${labels.en[key]} / ${labels.ur[key]}`;
  return labels.en[key];
}

function uuid() {
  return crypto.randomUUID();
}

export function PosPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [mode, setMode] = useState<PosMode>("advanced");
  const [locale, setLocale] = useState<LocaleMode>("en");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [splits, setSplits] = useState<PaySplit[]>([]);
  const [priceLevel, setPriceLevel] = useState<PriceLevel>("retail");
  const [salesmanUserId, setSalesmanUserId] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [useInstallment, setUseInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("3");
  const [downPayment, setDownPayment] = useState("0");
  const [methods, setMethods] = useState<Array<Record<string, unknown>>>([]);
  const [holds, setHolds] = useState<Array<Record<string, unknown>>>([]);
  const [manual, setManual] = useState({
    name: "",
    itemCode: "",
    description: "",
    qty: "1",
    unitId: "",
    rate: "0",
    discount: "0",
    tax: "0",
  });
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const [deviceId] = useState(() => {
    const key = "erp-pos-device-id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  });

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = Number(invoiceDiscount || 0);
    let tax = 0;
    for (const line of cart) {
      const qty = Number(line.qty);
      subtotal += qty * line.unitPrice;
      discount += line.discount;
      tax += line.tax;
    }
    const grand = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100);
    return { subtotal, discount, tax, grand };
  }, [cart, invoiceDiscount]);

  useEffect(() => {
    void partiesApi.seedPaymentMethods().then((r) => {
      setMethods(r.items);
      const cash = r.items.find((m) => m.kind === "cash");
      if (cash) {
        setPaymentMethodId(String(cash.id));
        setSplits([{ id: uuid(), paymentMethodId: String(cash.id), amount: "" }]);
      }
    });
    void inventoryApi.listWarehouses().then((r) => {
      if (r.items[0]) setWarehouseId(String(r.items[0].id));
    });
    return posHardware.subscribeScanner((event) => {
      setQ(event.code);
      void posApi
        .searchProducts({ q: event.code, warehouseId: warehouseId || undefined })
        .then((res) => {
          setResults(res.items);
          if (res.items[0]) addProduct(res.items[0]);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    if (!q.trim()) return;
    try {
      const res = await posApi.searchProducts({ q, warehouseId: warehouseId || undefined });
      setResults(res.items);
    } catch (err) {
      toast.push({
        title: "Search failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  function pickPrice(p: ProductSearchResult): number {
    if (priceLevel === "wholesale") return p.wholesalePrice;
    if (priceLevel === "dealer") return p.dealerPrice;
    return p.retailPrice;
  }

  function addProduct(p: ProductSearchResult) {
    const price = pickPrice(p);
    setCart((prev) => [
      ...prev,
      {
        key: uuid(),
        productId: p.productId,
        name: p.name,
        nameUr: p.nameUr,
        unitId: p.unitId,
        qty: "1",
        unitPrice: price,
        discount: 0,
        tax: 0,
        warrantyDays: p.warrantyDays,
        stock: p.stockAvailable,
      },
    ]);
  }

  function addManual() {
    if (!manual.name || !manual.unitId) {
      toast.push({ title: "Manual item needs name and unit", tone: "danger" });
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        key: uuid(),
        name: manual.name,
        unitId: manual.unitId,
        qty: manual.qty,
        unitPrice: Number(manual.rate),
        discount: Number(manual.discount),
        tax: Number(manual.tax),
        warrantyDays: 0,
        isManual: true,
      },
    ]);
  }

  async function recognizeCamera() {
    // Hardware capture stays local; matching runs in the AI service layer (never in React).
    const hw = await posHardware.recognizeFromCamera();
    const hwHint = hw.ok
      ? (hw.data?.candidates[0]?.label ?? hw.data?.candidates[0]?.productIdHint)
      : undefined;
    try {
      const res = await aiApi.recognize({
        warehouseId: warehouseId || undefined,
        branchId: branchId || undefined,
        hintText: hwHint || q || undefined,
        source: "pos",
        signals: { freeText: hwHint || q || undefined },
      });
      const decision = res.decision;
      if (decision.status === "exact" && decision.bestMatch) {
        setQ(decision.bestMatch.product.name);
        await search();
        toast.push({
          title: "AI match (confirm before sell)",
          description: `${decision.bestMatch.product.name} · conf ${decision.topConfidence.toFixed(2)} — not auto-added`,
          tone: "success",
        });
        return;
      }
      const similar = decision.similar[0] ?? decision.candidates[0];
      if (similar) {
        setQ(similar.product.name);
        await search();
      }
      toast.push({
        title: `AI ${decision.status}`,
        description: decision.explanations[0] ?? "Select manually from search results",
        tone: "info",
      });
    } catch (err) {
      if (hwHint) {
        setQ(hwHint);
        await search();
      }
      toast.push({
        title: "AI recognition unavailable",
        description: err instanceof Error ? err.message : hw.error ?? "Fallback search",
        tone: "info",
      });
    }
  }

  async function checkout() {
    if (!branchId || !warehouseId || !cart.length) {
      toast.push({ title: "Branch, warehouse and cart required", tone: "danger" });
      return;
    }
    try {
      const paymentLines =
        mode === "advanced" && splits.length
          ? splits
              .filter((s) => s.paymentMethodId && Number(s.amount) > 0)
              .map((s) => ({ paymentMethodId: s.paymentMethodId, amount: Number(s.amount) }))
          : paymentMethodId
            ? [{ paymentMethodId, amount: totals.grand }]
            : [];

      const result = await posApi.postSale({
        branchId,
        warehouseId,
        customerId: customerId || undefined,
        salesmanUserId: salesmanUserId || undefined,
        referenceName: referenceName || undefined,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
        posMode: mode,
        localeMode: locale,
        items: cart.map((c) => ({
          productId: c.productId,
          unitId: c.unitId,
          qty: c.qty,
          unitPrice: c.unitPrice,
          discount: c.discount,
          tax: c.tax,
          warrantyDays: c.warrantyDays,
          isManual: Boolean(c.isManual),
          manualName: c.isManual ? c.name : undefined,
          manualItemCode: c.isManual ? manual.itemCode || undefined : undefined,
          manualDescription: c.isManual ? manual.description || undefined : undefined,
        })),
        payments: paymentLines,
        discountTotal: Number(invoiceDiscount || 0),
        discounts:
          Number(invoiceDiscount || 0) > 0
            ? [
                {
                  scope: "invoice",
                  kind: priceLevel === "wholesale" ? "wholesale" : "fixed",
                  amount: Number(invoiceDiscount),
                  approverRole: "cashier",
                  reason: "POS invoice discount",
                },
              ]
            : [],
        createInstallment:
          useInstallment && customerId
            ? {
                downPayment: downPayment || "0",
                installmentCount: Number(installmentCount || 1),
                startDate: new Date().toISOString().slice(0, 10),
              }
            : undefined,
        deviceId,
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      setLastInvoice(result.invoiceNumber);
      setCart([]);
      // Hardware optional — never crash sale path when devices unavailable
      void posHardware.openDrawer({ reason: `sale ${result.invoiceNumber}` });
      void posHardware.printThermal({
        type: "receipt_80",
        payload: `INV ${result.invoiceNumber}\nTotal ${result.totals.grandTotal}`,
        documentType: "sales_invoice",
      });
      toast.push({
        title: "Sale posted",
        description: `${result.invoiceNumber} · paid ${result.paidTotal} · due ${result.remainingTotal}`,
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Sale failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function holdBill() {
    if (!branchId || !warehouseId) return;
    try {
      await posApi.hold({
        branchId,
        warehouseId,
        holdLabel: `Hold ${new Date().toLocaleTimeString()}`,
        cartSnapshot: { cart, customerId, invoiceDiscount, locale, mode, splits, notes },
        deviceId,
      });
      setCart([]);
      toast.push({ title: "Bill held", tone: "success" });
      if (branchId) {
        const res = await posApi.listHolds(branchId);
        setHolds(res.items);
      }
    } catch (err) {
      toast.push({
        title: "Hold failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function loadHolds() {
    if (!branchId) return;
    const res = await posApi.listHolds(branchId);
    setHolds(res.items);
  }

  async function resume(id: string) {
    const held = await posApi.resumeHold(id);
    const snap = (held as { cart_snapshot?: Record<string, unknown> }).cart_snapshot;
    if (snap?.cart && Array.isArray(snap.cart)) {
      setCart(snap.cart as CartLine[]);
      if (typeof snap.customerId === "string") setCustomerId(snap.customerId);
      if (typeof snap.invoiceDiscount === "string") setInvoiceDiscount(snap.invoiceDiscount);
    }
    toast.push({ title: "Bill resumed", tone: "success" });
    await loadHolds();
  }

  return (
    <div className="space-y-4" dir={locale === "ur" ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t(locale, "title")}</h1>
          <p className="text-sm text-[var(--erp-muted)]">
            Real engines: products · inventory · customers · payments · ledger · accounting
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            label="Mode"
            options={[
              { value: "easy", label: "Easy Mode" },
              { value: "advanced", label: "Advanced Mode" },
            ]}
            value={mode}
            onChange={(e) => setMode(e.target.value as PosMode)}
          />
          <Select
            label="Language"
            options={[
              { value: "en", label: "English" },
              { value: "ur", label: "Urdu" },
              { value: "en_ur", label: "Urdu + English" },
            ]}
            value={locale}
            onChange={(e) => setLocale(e.target.value as LocaleMode)}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label={t(locale, "warehouse")} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} />
              <Input label={t(locale, "customer")} value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Select
                label="Price level"
                options={[
                  { value: "retail", label: "Retail / sale rate" },
                  { value: "wholesale", label: "Wholesale" },
                  { value: "dealer", label: "Dealer" },
                ]}
                value={priceLevel}
                onChange={(e) => setPriceLevel(e.target.value as PriceLevel)}
              />
              <Input
                label="Salesman user ID"
                value={salesmanUserId}
                onChange={(e) => setSalesmanUserId(e.target.value)}
              />
              <Input
                label="Reference"
                value={referenceName}
                onChange={(e) => setReferenceName(e.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                label={t(locale, "search")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void search();
                }}
                hint="Name, Urdu, SKU, barcode, QR, brand, company, category, model, size, color, watt…"
              />
              <Button className="mt-6" onClick={() => void search()}>
                Search
              </Button>
              <Button className="mt-6" variant="secondary" onClick={() => void recognizeCamera()}>
                Camera
              </Button>
            </div>
            <ul className="mt-3 max-h-72 space-y-2 overflow-auto text-sm">
              {results.map((p) => (
                <li key={p.productId} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div>
                    <div className="font-medium">
                      {locale === "ur" && p.nameUr ? p.nameUr : p.name}
                      {locale === "en_ur" && p.nameUr ? ` / ${p.nameUr}` : ""}
                    </div>
                    <div className="text-[var(--erp-muted)]">
                      {[p.brand, p.size, p.color, p.unitName].filter(Boolean).join(" · ")} · stock{" "}
                      {p.stockAvailable}
                    </div>
                    <div className="text-xs">
                      Retail {p.retailPrice} · Wholesale {p.wholesalePrice} · Dealer {p.dealerPrice}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => addProduct(p)}>
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          </Card>

          {mode === "advanced" ? (
            <Card title="Manual item">
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Name" value={manual.name} onChange={(e) => setManual((p) => ({ ...p, name: e.target.value }))} />
                <Input label="Item ID" value={manual.itemCode} onChange={(e) => setManual((p) => ({ ...p, itemCode: e.target.value }))} />
                <Input label="Description" value={manual.description} onChange={(e) => setManual((p) => ({ ...p, description: e.target.value }))} />
                <Input label="Unit ID" value={manual.unitId} onChange={(e) => setManual((p) => ({ ...p, unitId: e.target.value }))} />
                <Input label="Qty" value={manual.qty} onChange={(e) => setManual((p) => ({ ...p, qty: e.target.value }))} />
                <Input label="Rate" value={manual.rate} onChange={(e) => setManual((p) => ({ ...p, rate: e.target.value }))} />
                <Input label="Discount" value={manual.discount} onChange={(e) => setManual((p) => ({ ...p, discount: e.target.value }))} />
                <Input label="Tax" value={manual.tax} onChange={(e) => setManual((p) => ({ ...p, tax: e.target.value }))} />
              </div>
              <Button className="mt-3" variant="secondary" onClick={addManual}>
                Add manual line
              </Button>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title={t(locale, "cart")}>
            <ul className="space-y-2 text-sm">
              {cart.map((line) => (
                <li key={line.key} className="rounded-lg border px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <strong>
                      {locale === "ur" && line.nameUr ? line.nameUr : line.name}
                    </strong>
                    <button
                      type="button"
                      className="text-[var(--erp-danger)]"
                      onClick={() => setCart((prev) => prev.filter((x) => x.key !== line.key))}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Input
                      label="Qty"
                      value={line.qty}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((x) => (x.key === line.key ? { ...x, qty: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      label="Rate"
                      value={String(line.unitPrice)}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((x) =>
                            x.key === line.key ? { ...x, unitPrice: Number(e.target.value || 0) } : x,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Disc"
                      value={String(line.discount)}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((x) =>
                            x.key === line.key ? { ...x, discount: Number(e.target.value || 0) } : x,
                          ),
                        )
                      }
                    />
                  </div>
                  {line.stock != null ? (
                    <div className="mt-1 text-xs text-[var(--erp-muted)]">Stock {line.stock}</div>
                  ) : null}
                </li>
              ))}
              {!cart.length ? <li className="text-[var(--erp-muted)]">{t(locale, "empty")}</li> : null}
            </ul>

            {mode === "advanced" ? (
              <div className="mt-3">
                <Input
                  label="Invoice discount"
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(e.target.value)}
                  hint="Cashier max 5% equivalent — enforced server-side with audit"
                />
              </div>
            ) : null}

            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>{totals.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{totals.grand.toFixed(2)}</span>
              </div>
            </div>

            {mode === "easy" ? (
              <div className="mt-3">
                <Select
                  label="Payment method"
                  options={methods.map((m) => ({ value: String(m.id), label: String(m.name) }))}
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="text-sm font-medium">Split payments / credit</div>
                {splits.map((s) => (
                  <div key={s.id} className="grid grid-cols-2 gap-2">
                    <Select
                      label="Method"
                      options={methods.map((m) => ({ value: String(m.id), label: String(m.name) }))}
                      value={s.paymentMethodId}
                      onChange={(e) =>
                        setSplits((prev) =>
                          prev.map((x) =>
                            x.id === s.id ? { ...x, paymentMethodId: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Amount"
                      value={s.amount}
                      onChange={(e) =>
                        setSplits((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, amount: e.target.value } : x)),
                        )
                      }
                      hint="Leave unpaid remainder as customer credit"
                    />
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setSplits((prev) => [
                      ...prev,
                      { id: uuid(), paymentMethodId: paymentMethodId, amount: "" },
                    ])
                  }
                >
                  Add payment split
                </Button>
                <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Input
                  label="Due date (credit)"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  hint="YYYY-MM-DD"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useInstallment}
                    onChange={(e) => setUseInstallment(e.target.checked)}
                  />
                  Create installment plan
                </label>
                {useInstallment ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Down payment"
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value)}
                    />
                    <Input
                      label="Installments"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void checkout()}>{t(locale, "checkout")}</Button>
              <Button variant="secondary" onClick={() => void holdBill()}>
                {t(locale, "hold")}
              </Button>
              <Button variant="ghost" onClick={() => void loadHolds()}>
                {t(locale, "resume")}
              </Button>
            </div>
            {lastInvoice ? (
              <div className="mt-3">
                <Badge tone="success">Invoice {lastInvoice}</Badge>
              </div>
            ) : null}
          </Card>

          <Card title="Held bills">
            <ul className="space-y-2 text-sm">
              {holds.map((h) => (
                <li key={String(h.id)} className="flex justify-between gap-2 border-b py-2">
                  <span>{String(h.hold_label ?? h.id)}</span>
                  <Button size="sm" onClick={() => void resume(String(h.id))}>
                    Resume
                  </Button>
                </li>
              ))}
              {!holds.length ? <li className="text-[var(--erp-muted)]">No held bills loaded</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
