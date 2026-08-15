import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { adminApi } from "@/features/users/admin-api";
import { purchasesApi } from "@/features/purchases/purchases-api";

function uuid() {
  return crypto.randomUUID();
}

const STATUS_FLOW: Record<string, string[]> = {
  pending: ["packed", "cancelled"],
  packed: ["dispatched", "cancelled"],
  dispatched: ["in_transit", "delivered", "cancelled"],
  in_transit: ["delivered"],
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  packed: "Packed",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] p-3">
      <div className="text-xs uppercase tracking-wide text-[var(--erp-muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function DeliveriesPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [reports, setReports] = useState<Record<string, unknown> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({
    saleId: "",
    customerId: "",
    address: "",
    mobile: "",
    instructions: "",
    deliveryBoyUserId: "",
    expectedDate: "",
    productId: "",
    unitId: "",
    qty: "1",
    notes: "",
  });

  const load = useCallback(async () => {
    const [list, rep] = await Promise.all([
      purchasesApi.searchDeliveries({
        branchId: branchId ?? undefined,
        status: statusFilter || undefined,
        limit: 50,
        offset: 0,
      }),
      purchasesApi.deliveryReports(branchId ?? undefined),
    ]);
    setItems(list.items);
    setReports(rep);
  }, [branchId, statusFilter]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      toast.push({
        title: "Load failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      }),
    );
    void adminApi.listUsers().then((r) => setUsers(r.items)).catch(() => undefined);
  }, [load, toast]);

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
        instructions: form.instructions || undefined,
        deliveryBoyUserId: form.deliveryBoyUserId || undefined,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        items: [{ productId: form.productId, unitId: form.unitId, qty: form.qty }],
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      toast.push({ title: "Delivery order created", tone: "success" });
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
      toast.push({ title: `Status → ${STATUS_LABELS[status] ?? status}`, tone: "success" });
      if (selectedId === id) await openDetail(id);
      await load();
    } catch (err) {
      toast.push({
        title: "Status update failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function cancel(id: string) {
    const reason = window.prompt("Cancellation reason (optional)") ?? undefined;
    try {
      await purchasesApi.cancelDelivery(id, reason);
      toast.push({ title: "Delivery cancelled", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Cancel failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function assignBoy(id: string, deliveryBoyUserId: string) {
    try {
      await purchasesApi.assignDeliveryBoy(id, deliveryBoyUserId);
      toast.push({ title: "Delivery boy assigned", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Assign failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function openDetail(id: string) {
    setSelectedId(id);
    const [tr, hist] = await Promise.all([
      purchasesApi.getDeliveryTracking(id),
      purchasesApi.getDeliveryHistory(id),
    ]);
    setTracking(tr);
    setHistory(hist.items);
  }

  const summary = (reports?.summary ?? {}) as Record<string, unknown>;
  const byStatus = (summary.byStatus ?? {}) as Record<string, number>;
  const timeAnalysis = (reports?.timeAnalysis ?? {}) as Record<string, unknown>;
  const deliveryBoys = (reports?.deliveryBoy ?? []) as Array<Record<string, unknown>>;

  const trackingSnap = (tracking?.snapshot ?? {}) as Record<string, unknown>;

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: String(u.id),
        label: String(u.full_name ?? u.email ?? u.id),
      })),
    [users],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Delivery Management</h1>
        <p className="text-sm text-[var(--erp-muted)]">
          Create orders, assign riders, track status, and view delivery reports.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total deliveries" value={Number(summary.total ?? 0)} />
        <Kpi label="Pending" value={Number(byStatus.pending ?? 0)} />
        <Kpi label="In transit" value={Number(byStatus.in_transit ?? 0)} />
        <Kpi
          label="Avg dispatch→deliver (hrs)"
          value={Number(timeAnalysis.avgDispatchToDeliveredHours ?? 0)}
        />
      </div>

      <Card title="Create delivery order">
        <Form onSubmit={onCreate}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Input label="Sale / invoice ID" value={form.saleId} onChange={(e) => setForm((p) => ({ ...p, saleId: e.target.value }))} />
            <Input
              label="Customer ID"
              value={form.customerId}
              onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
            />
            <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            <Input label="Mobile" value={form.mobile} onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))} />
            <Input
              label="Instructions"
              value={form.instructions}
              onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
            />
            <Select
              label="Delivery boy"
              value={form.deliveryBoyUserId}
              onChange={(e) => setForm((p) => ({ ...p, deliveryBoyUserId: e.target.value }))}
              options={[{ value: "", label: "Unassigned" }, ...userOptions]}
            />
            <Input label="Expected date" type="date" value={form.expectedDate} onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))} />
            <Input label="Product ID" required value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" required value={form.unitId} onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))} />
            <Input label="Qty" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
            <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Create delivery</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Delivery orders">
        <div className="mb-3 flex flex-wrap gap-2">
          <Select
            label="Filter status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All" },
              ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[var(--erp-muted)]">
                <th className="px-2 py-2">Order</th>
                <th className="px-2 py-2">Address</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const id = String(d.id);
                const status = String(d.status);
                const next = STATUS_FLOW[status] ?? [];
                const customer = d.customers as { name?: string } | null;
                return (
                  <tr key={id} className="border-b border-[var(--erp-border)]/60">
                    <td className="px-2 py-2">
                      <div className="font-medium">{String(d.delivery_number)}</div>
                      <div className="text-xs text-[var(--erp-muted)]">
                        {customer?.name ?? "—"} · {String(d.mobile ?? "")}
                      </div>
                    </td>
                    <td className="px-2 py-2 max-w-xs truncate">
                      {String(d.address ?? "—")}
                      {d.instructions ? (
                        <div className="text-xs text-[var(--erp-muted)]">{String(d.instructions)}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <Badge>{STATUS_LABELS[status] ?? status}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={() => void openDetail(id)}>
                          Track
                        </Button>
                        <Select
                          label=""
                          value={String(d.delivery_boy_user_id ?? "")}
                          onChange={(e) => void assignBoy(id, e.target.value)}
                          options={[{ value: "", label: "Assign…" }, ...userOptions]}
                        />
                        {next.map((s) => (
                          <Button key={s} size="sm" variant="secondary" onClick={() => void advance(id, s)}>
                            {STATUS_LABELS[s] ?? s}
                          </Button>
                        ))}
                        {next.includes("cancelled") ? (
                          <Button size="sm" variant="ghost" onClick={() => void cancel(id)}>
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-[var(--erp-muted)]">
                    No deliveries
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedId && tracking ? (
        <Card title={`Tracking · ${selectedId.slice(0, 8)}`}>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Integration:</strong> {String(trackingSnap.integrationStatus ?? "—")}
            </div>
            <div className="text-[var(--erp-muted)]">{String(trackingSnap.message ?? "")}</div>
            {trackingSnap.provider ? (
              <div>
                Provider: {String(trackingSnap.provider)} · Ref: {String(trackingSnap.reference ?? "—")}
              </div>
            ) : null}
            <div className="mt-3">
              <strong>Status history</strong>
              <ul className="mt-1 space-y-1">
                {history.map((h) => (
                  <li key={String(h.id)} className="text-[var(--erp-muted)]">
                    {String(h.from_status ?? "—")} → {String(h.to_status)} ·{" "}
                    {new Date(String(h.created_at)).toLocaleString()}
                    {h.reason ? ` · ${String(h.reason)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <Card title="Reports">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">By delivery boy</h3>
            <ul className="space-y-1 text-sm">
              {deliveryBoys.map((b) => (
                <li key={String(b.deliveryBoyUserId)}>
                  {String(b.deliveryBoyName ?? b.deliveryBoyUserId)} — assigned {String(b.assigned)}, delivered{" "}
                  {String(b.delivered)}
                </li>
              ))}
              {!deliveryBoys.length ? <li className="text-[var(--erp-muted)]">No assignments yet</li> : null}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-medium">Time analysis</h3>
            <p className="text-sm text-[var(--erp-muted)]">
              Avg {String(timeAnalysis.avgDispatchToDeliveredHours ?? 0)} hrs · samples{" "}
              {String(timeAnalysis.samples ?? 0)} · min {String(timeAnalysis.minHours ?? 0)} · max{" "}
              {String(timeAnalysis.maxHours ?? 0)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
