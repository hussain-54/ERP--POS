import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { purchasesApi } from "./purchases-api";

function uuid() {
  return crypto.randomUUID();
}

const NEXT: Record<string, string | undefined> = {
  pending: "packed",
  packed: "dispatched",
  dispatched: "delivered",
};

export function DeliveriesPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    saleId: "",
    customerId: "",
    address: "",
    mobile: "",
    deliveryBoyUserId: "",
    expectedDate: "",
    productId: "",
    unitId: "",
    qty: "1",
  });

  async function load() {
    const res = await purchasesApi.listDeliveries(branchId ?? undefined);
    setItems(res.items);
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
      await purchasesApi.createDelivery({
        branchId,
        saleId: form.saleId || undefined,
        customerId: form.customerId || undefined,
        address: form.address || undefined,
        mobile: form.mobile || undefined,
        deliveryBoyUserId: form.deliveryBoyUserId || undefined,
        expectedDate: form.expectedDate || undefined,
        items: [
          {
            productId: form.productId,
            unitId: form.unitId,
            qty: form.qty,
          },
        ],
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      toast.push({ title: "Delivery created", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function advance(id: string, status: string) {
    try {
      await purchasesApi.advanceDelivery(id, status);
      toast.push({ title: `Delivery → ${status}`, tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Advance failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Deliveries</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Statuses: Pending → Packed → Dispatched → Delivered (also Cancelled / Returned)
      </p>

      <Card title="Delivery order">
        <Form onSubmit={onCreate}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Invoice / sale ID"
              value={form.saleId}
              onChange={(e) => setForm((p) => ({ ...p, saleId: e.target.value }))}
            />
            <Input
              label="Customer ID"
              value={form.customerId}
              onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
            />
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
            <Input
              label="Mobile"
              value={form.mobile}
              onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
            />
            <Input
              label="Delivery boy user ID"
              value={form.deliveryBoyUserId}
              onChange={(e) => setForm((p) => ({ ...p, deliveryBoyUserId: e.target.value }))}
            />
            <Input
              label="Expected date"
              value={form.expectedDate}
              onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))}
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
          </div>
          <FormActions>
            <Button type="submit">Create delivery</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Delivery list">
        <ul className="space-y-3 text-sm">
          {items.map((d) => {
            const status = String(d.status);
            const next = NEXT[status];
            return (
              <li key={String(d.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                <div>
                  <div className="font-medium">{String(d.delivery_number)}</div>
                  <div className="text-[var(--erp-muted)]">
                    {String(d.address ?? "—")} · {String(d.mobile ?? "")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{status}</Badge>
                  {next ? (
                    <Button size="sm" onClick={() => void advance(String(d.id), next)}>
                      {next}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {!items.length ? <li className="text-[var(--erp-muted)]">No deliveries</li> : null}
        </ul>
      </Card>
    </div>
  );
}
