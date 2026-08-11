import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { inventoryApi } from "@/features/inventory/inventory-api";
import { purchasesApi } from "./purchases-api";

function uuid() {
  return crypto.randomUUID();
}

export function PurchasesPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [prices, setPrices] = useState<Array<Record<string, unknown>>>([]);
  const [warehouses, setWarehouses] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    warehouseId: "",
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    productId: "",
    unitId: "",
    qty: "1",
    unitCost: "0",
    discount: "0",
    tax: "0",
    paidTotal: "0",
    dueDate: "",
  });

  async function load() {
    const [purchases, wh, priceRows] = await Promise.all([
      purchasesApi.listPurchases(branchId ?? undefined),
      inventoryApi.listWarehouses(),
      purchasesApi.listSupplierPrices(),
    ]);
    setItems(purchases.items);
    setWarehouses(wh.items);
    setPrices(priceRows.items);
    if (!form.warehouseId && wh.items[0]) {
      setForm((p) => ({ ...p, warehouseId: String(wh.items[0]!.id) }));
    }
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) {
      toast.push({ title: "Select a branch first", tone: "danger" });
      return;
    }
    try {
      const result = await purchasesApi.postPurchase({
        branchId,
        warehouseId: form.warehouseId,
        supplierId: form.supplierId,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate,
        items: [
          {
            productId: form.productId,
            unitId: form.unitId,
            qty: form.qty,
            unitCost: Number(form.unitCost),
            discount: Number(form.discount),
            tax: Number(form.tax),
          },
        ],
        paidTotal: Number(form.paidTotal || 0),
        dueDate: form.dueDate || undefined,
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      toast.push({
        title: "Purchase posted",
        description: `${result.invoiceNumber} · stock increased · payable ${result.remainingTotal}`,
        tone: "success",
      });
      await load();
    } catch (err) {
      toast.push({
        title: "Purchase failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Purchases</h1>
        <p className="text-sm text-[var(--erp-muted)]">
          Central purchase service updates stock, supplier ledger, payable, price engine, and accounts.
        </p>
      </div>

      <Card title="New purchase invoice">
        <Form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Warehouse"
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: `${String(w.name)} (${String(w.warehouse_type ?? "branch")})`,
              }))}
              value={form.warehouseId}
              onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
            />
            <Input
              label="Supplier ID"
              required
              value={form.supplierId}
              onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
            />
            <Input
              label="Invoice number"
              required
              value={form.invoiceNumber}
              onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
            />
            <Input
              label="Date"
              value={form.invoiceDate}
              onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))}
            />
            <Input
              label="Product ID"
              required
              value={form.productId}
              onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
            />
            <Input
              label="Unit ID"
              required
              value={form.unitId}
              onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))}
            />
            <Input label="Qty" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
            <Input
              label="Purchase rate"
              value={form.unitCost}
              onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
            />
            <Input
              label="Discount"
              value={form.discount}
              onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
            />
            <Input label="Tax" value={form.tax} onChange={(e) => setForm((p) => ({ ...p, tax: e.target.value }))} />
            <Input
              label="Paid"
              value={form.paidTotal}
              onChange={(e) => setForm((p) => ({ ...p, paidTotal: e.target.value }))}
            />
            <Input
              label="Due date"
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              hint="Remaining = credit payable"
            />
          </div>
          <FormActions>
            <Button type="submit">Save purchase</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Recent purchases">
        <ul className="space-y-2 text-sm">
          {items.map((p) => (
            <li key={String(p.id)} className="flex justify-between border-b py-2">
              <span>
                {String(p.invoice_number)} · supplier {String(p.supplier_id).slice(0, 8)}…
              </span>
              <span>
                {String(p.grand_total)} · paid {String(p.paid_total)} · due {String(p.remaining_total)}
              </span>
            </li>
          ))}
          {!items.length ? <li className="text-[var(--erp-muted)]">No purchases yet</li> : null}
        </ul>
      </Card>

      <Card title="Supplier price comparison">
        <ul className="space-y-2 text-sm">
          {prices.map((p) => (
            <li key={String(p.id)} className="flex justify-between border-b py-2">
              <span>
                Product {String(p.product_id).slice(0, 8)}… · supplier {String(p.supplier_id).slice(0, 8)}…
              </span>
              <span>
                last {String(p.last_purchase_rate)} · avg {String(p.average_purchase_rate)} · price{" "}
                {String(p.supplier_price)}
              </span>
            </li>
          ))}
          {!prices.length ? <li className="text-[var(--erp-muted)]">No supplier prices yet</li> : null}
        </ul>
      </Card>
    </div>
  );
}
