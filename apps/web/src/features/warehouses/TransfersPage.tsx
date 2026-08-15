import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { inventoryApi } from "@/features/inventory/inventory-api";
import { purchasesApi } from "@/features/purchases/purchases-api";

function uuid() {
  return crypto.randomUUID();
}

const NEXT: Record<string, string | undefined> = {
  requested: "approved",
  approved: "dispatched",
  in_transit: "received",
};

export function TransfersPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [warehouses, setWarehouses] = useState<Array<Record<string, unknown>>>([]);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    productId: "",
    unitId: "",
    qty: "1",
  });

  async function load() {
    const [wh, transfers] = await Promise.all([
      inventoryApi.listWarehouses(),
      purchasesApi.listTransfers(branchId ?? undefined),
    ]);
    setWarehouses(wh.items);
    setItems(transfers.items);
    if (!form.sourceWarehouseId && wh.items[0]) {
      setForm((p) => ({
        ...p,
        sourceWarehouseId: String(wh.items[0]!.id),
        destinationWarehouseId: String(wh.items[1]?.id ?? wh.items[0]!.id),
      }));
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    try {
      await purchasesApi.createTransfer({
        branchId,
        sourceWarehouseId: form.sourceWarehouseId,
        destinationWarehouseId: form.destinationWarehouseId,
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
      toast.push({ title: "Transfer requested", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Transfer failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function advance(id: string, status: string) {
    try {
      await purchasesApi.advanceTransfer(id, status);
      toast.push({ title: `Transfer → ${status}`, tone: "success" });
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
      <h1 className="text-2xl font-semibold">Stock transfers</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Lifecycle: Request → Approval → Dispatch → In Transit → Receiving
      </p>

      <Card title="Request transfer">
        <Form onSubmit={onCreate}>
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Source"
              options={warehouses.map((w) => ({ value: String(w.id), label: String(w.name) }))}
              value={form.sourceWarehouseId}
              onChange={(e) => setForm((p) => ({ ...p, sourceWarehouseId: e.target.value }))}
            />
            <Select
              label="Destination"
              options={warehouses.map((w) => ({ value: String(w.id), label: String(w.name) }))}
              value={form.destinationWarehouseId}
              onChange={(e) => setForm((p) => ({ ...p, destinationWarehouseId: e.target.value }))}
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
            <Button type="submit">Request</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Transfers">
        <ul className="space-y-3 text-sm">
          {items.map((t) => {
            const status = String(t.status);
            const next = NEXT[status];
            return (
              <li key={String(t.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                <div>
                  <div className="font-medium">{String(t.transfer_number)}</div>
                  <div className="text-[var(--erp-muted)]">
                    {String(t.source_warehouse_id).slice(0, 8)}… →{" "}
                    {String(t.destination_warehouse_id).slice(0, 8)}…
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{status}</Badge>
                  {next ? (
                    <Button size="sm" onClick={() => void advance(String(t.id), next)}>
                      {next}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {!items.length ? <li className="text-[var(--erp-muted)]">No transfers</li> : null}
        </ul>
      </Card>
    </div>
  );
}
