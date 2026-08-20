import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Badge, Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { afterSalesApi } from "./after-sales-api";

function uuid() {
  return crypto.randomUUID();
}

export function QuotationsPage() {
  const toast = useToast();
  const { pathname } = useLocation();
  const focusOrders = pathname.includes("sales-orders") || pathname === "/orders";
  const { branchId } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    customerId: "",
    productId: "",
    unitId: "",
    qty: "1",
    unitPrice: "0",
    discount: "0",
    tax: "0",
    validityDate: "",
    terms: "",
    notes: "",
  });
  const [invoiceWarehouseId, setInvoiceWarehouseId] = useState("");

  async function load() {
    const [q, o] = await Promise.all([
      afterSalesApi.listQuotations(branchId ?? undefined),
      afterSalesApi.listOrders(branchId ?? undefined),
    ]);
    setItems(q.items);
    setOrders(o.items);
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    try {
      await afterSalesApi.createQuotation({
        branchId,
        customerId: form.customerId || undefined,
        validityDate: form.validityDate || undefined,
        terms: form.terms || undefined,
        notes: form.notes || undefined,
        items: [
          {
            productId: form.productId,
            unitId: form.unitId,
            qty: form.qty,
            unitPrice: Number(form.unitPrice),
            discount: Number(form.discount),
            tax: Number(form.tax),
          },
        ],
        idempotencyKey: uuid(),
      });
      toast.push({ title: "Quotation created", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function convertQuote(id: string) {
    try {
      await afterSalesApi.advanceQuotation(id, "accepted");
      await afterSalesApi.convertQuotationToOrder(id);
      toast.push({ title: "Converted to sales order", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Conversion failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function convertOrder(id: string) {
    if (!invoiceWarehouseId) {
      toast.push({ title: "Warehouse ID required for invoice", tone: "danger" });
      return;
    }
    try {
      const sale = await afterSalesApi.convertOrderToInvoice(id, {
        warehouseId: invoiceWarehouseId,
        paidTotal: 0,
        idempotencyKey: uuid(),
      });
      toast.push({
        title: "Converted to invoice",
        description: `Sale ${(sale as { invoiceNumber?: string }).invoiceNumber ?? ""}`,
        tone: "success",
      });
      await load();
    } catch (err) {
      toast.push({
        title: "Invoice conversion failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{focusOrders ? "Sales Orders" : "Quotations"}</h1>
        <p className="text-sm text-[var(--erp-muted)]">
          Lifecycle: Quotation → Sales Order → Invoice (via central sale transaction). Same engine —
          no second cart.
        </p>
      </div>

      <Card title="New quotation">
        <Form onSubmit={onCreate}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Customer ID" value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))} />
            <Input label="Validity date" value={form.validityDate} onChange={(e) => setForm((p) => ({ ...p, validityDate: e.target.value }))} />
            <Input label="Product ID" required value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" required value={form.unitId} onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))} />
            <Input label="Qty" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
            <Input label="Rate" value={form.unitPrice} onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))} />
            <Input label="Discount" value={form.discount} onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))} />
            <Input label="Tax" value={form.tax} onChange={(e) => setForm((p) => ({ ...p, tax: e.target.value }))} />
            <Input label="Terms" value={form.terms} onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))} />
            <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Save quotation</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Quotations">
        <ul className="space-y-2 text-sm">
          {items.map((q) => (
            <li key={String(q.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <div>
                <strong>{String(q.quotation_number)}</strong> · total {String(q.grand_total)}
              </div>
              <div className="flex items-center gap-2">
                <Badge>{String(q.status)}</Badge>
                {String(q.status) !== "converted_to_order" ? (
                  <Button size="sm" onClick={() => void convertQuote(String(q.id))}>
                    → Order
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {!items.length ? <li className="text-[var(--erp-muted)]">No quotations</li> : null}
        </ul>
      </Card>

      <Card title="Sales orders">
        <Input
          label="Warehouse ID (for invoice conversion)"
          value={invoiceWarehouseId}
          onChange={(e) => setInvoiceWarehouseId(e.target.value)}
        />
        <ul className="mt-3 space-y-2 text-sm">
          {orders.map((o) => (
            <li key={String(o.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
              <div>
                <strong>{String(o.order_number)}</strong> · total {String(o.grand_total)}
                {o.quotation_id ? ` · from quote` : ""}
              </div>
              <div className="flex items-center gap-2">
                <Badge>{String(o.status)}</Badge>
                {String(o.status) !== "converted_to_invoice" ? (
                  <Button size="sm" onClick={() => void convertOrder(String(o.id))}>
                    → Invoice
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {!orders.length ? <li className="text-[var(--erp-muted)]">No orders</li> : null}
        </ul>
      </Card>
    </div>
  );
}
