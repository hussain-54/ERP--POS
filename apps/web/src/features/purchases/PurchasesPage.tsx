import { useEffect, useState, type FormEvent } from "react";
import { Breadcrumb, Button, Card, DataTable, Form, FormActions, Input, KpiCard, PageHeader, Select, useToast } from "@electronic-erp/ui";
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
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
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
    } catch (err) {
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
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
        title: "Purchase posted successfully",
        description: `Invoice ${result.invoiceNumber} recorded. Stock increased & supplier payable updated.`,
        tone: "success",
      });
      setForm((p) => ({
        ...p,
        invoiceNumber: "",
        productId: "",
        qty: "1",
        unitCost: "0",
        discount: "0",
        tax: "0",
        paidTotal: "0",
      }));
      await load();
    } catch (err) {
      toast.push({
        title: "Purchase failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  const totalPurchasesAmount = items.reduce((acc, it) => acc + Number(it.total_amount || 0), 0);
  const totalRemainingPayable = items.reduce((acc, it) => acc + Number(it.remaining_total || 0), 0);

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Home", href: "/command-center" },
          { label: "Purchases & Inbound", href: "/purchases" },
          { label: "Purchase Invoices" },
        ]}
      />

      <PageHeader
        moduleNumber="09"
        title="Purchase Invoices & Inbound Stock"
        description="Central purchasing ledger: Automatically updates stock counts, supplier accounts, payables, landed costs, and accounting general ledger."
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total Purchase Orders"
          value={items.length.toLocaleString()}
          tone="brand"
          icon={<i className="fa-solid fa-file-invoice" />}
        />
        <KpiCard
          label="Total Purchases Value"
          value={`Rs. ${totalPurchasesAmount.toLocaleString()}`}
          icon={<i className="fa-solid fa-cart-shopping" />}
        />
        <KpiCard
          label="Outstanding Payables"
          value={`Rs. ${totalRemainingPayable.toLocaleString()}`}
          tone={totalRemainingPayable > 0 ? "warning" : "success"}
          icon={<i className="fa-solid fa-hand-holding-dollar" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Purchase Entry Form */}
        <Card title="Record New Purchase Invoice" description="Inbound stock receipt and supplier invoice." divided className="lg:col-span-1">
          <Form onSubmit={onSubmit} className="space-y-3">
            <Select
              label="Destination Warehouse"
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: `${String(w.name)} (${String(w.warehouse_type ?? "branch")})`,
              }))}
              value={form.warehouseId}
              onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                label="Supplier ID"
                value={form.supplierId}
                onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
                placeholder="Supplier UUID"
                required
              />
              <Input
                label="Supplier Inv #"
                value={form.invoiceNumber}
                onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
                placeholder="e.g. INV-9821"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                label="Invoice Date"
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))}
                required
              />
              <Input
                label="Due Date"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
              <p className="text-[11px] font-bold uppercase text-slate-500">Item Line Details</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Product ID"
                  value={form.productId}
                  onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))}
                  placeholder="Product UUID"
                  required
                />
                <Input
                  label="Unit ID"
                  value={form.unitId}
                  onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))}
                  placeholder="Unit UUID"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Quantity"
                  type="number"
                  value={form.qty}
                  onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))}
                  placeholder="1"
                  required
                />
                <Input
                  label="Unit Cost (Rs.)"
                  type="number"
                  value={form.unitCost}
                  onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Discount (Rs.)"
                  type="number"
                  value={form.discount}
                  onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
                  placeholder="0.00"
                />
                <Input
                  label="Tax (Rs.)"
                  type="number"
                  value={form.tax}
                  onChange={(e) => setForm((p) => ({ ...p, tax: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Input
              label="Paid Amount Today (Rs.)"
              type="number"
              value={form.paidTotal}
              onChange={(e) => setForm((p) => ({ ...p, paidTotal: e.target.value }))}
              placeholder="0.00"
            />

            <FormActions>
              <Button type="submit" className="w-full">
                Post Purchase Invoice
              </Button>
            </FormActions>
          </Form>
        </Card>

        {/* Purchase History & Supplier Prices */}
        <div className="space-y-4 lg:col-span-2">
          <Card title={`Purchase Invoices History (${items.length})`} description="Invoices posted in active branch." divided>
            <DataTable
              rows={items}
              rowKey={(r) => String(r.id)}
              searchable
              searchPlaceholder="Filter invoice #, supplier…"
              pageSize={10}
              loading={loading}
              emptyTitle="No purchase invoices recorded yet"
              emptyDescription="Use the form on the left to record incoming supplier goods."
              columns={[
                {
                  key: "inv",
                  header: "Invoice #",
                  sortValue: (r) => String(r.invoice_number ?? ""),
                  cell: (r) => <span className="font-bold text-slate-900">{String(r.invoice_number ?? "—")}</span>,
                },
                {
                  key: "date",
                  header: "Date",
                  sortValue: (r) => String(r.invoice_date ?? ""),
                  cell: (r) => <span className="text-xs text-slate-600">{String(r.invoice_date ?? "").slice(0, 10)}</span>,
                },
                {
                  key: "total",
                  header: "Total (Rs.)",
                  align: "right",
                  sortValue: (r) => Number(r.total_amount ?? 0),
                  cell: (r) => <span className="font-mono font-bold text-slate-900">{Number(r.total_amount ?? 0).toLocaleString()}</span>,
                },
                {
                  key: "paid",
                  header: "Paid (Rs.)",
                  align: "right",
                  sortValue: (r) => Number(r.paid_total ?? 0),
                  cell: (r) => <span className="font-mono text-emerald-700">{Number(r.paid_total ?? 0).toLocaleString()}</span>,
                },
                {
                  key: "remaining",
                  header: "Balance Due",
                  align: "right",
                  sortValue: (r) => Number(r.remaining_total ?? 0),
                  cell: (r) => (
                    <span className={`font-mono font-black ${Number(r.remaining_total ?? 0) > 0 ? "text-amber-700" : "text-slate-400"}`}>
                      {Number(r.remaining_total ?? 0).toLocaleString()}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          {prices.length ? (
            <Card title="Contracted Supplier Prices" description="Active negotiated rates by supplier." divided>
              <DataTable
                rows={prices.slice(0, 10)}
                rowKey={(p) => String(p.id)}
                columns={[
                  {
                    key: "supp",
                    header: "Supplier",
                    cell: (p) => <span className="font-mono text-xs">{String(p.supplier_id).slice(0, 8)}…</span>,
                  },
                  {
                    key: "prod",
                    header: "Product",
                    cell: (p) => <span className="font-mono text-xs">{String(p.product_id).slice(0, 8)}…</span>,
                  },
                  {
                    key: "price",
                    header: "Agreed Unit Price",
                    align: "right",
                    cell: (p) => <span className="font-mono font-bold text-slate-900">Rs. {Number(p.purchase_price).toLocaleString()}</span>,
                  },
                ]}
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
