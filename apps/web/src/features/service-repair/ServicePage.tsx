import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { afterSalesApi } from "@/features/quotations/after-sales-api";

function uuid() {
  return crypto.randomUUID();
}

const NEXT: Record<string, string | undefined> = {
  received: "diagnosis",
  diagnosis: "repairing",
  repairing: "ready",
  ready: "delivered",
};

export function ServicePage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [bill, setBill] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    customerId: "",
    productId: "",
    serialCode: "",
    saleId: "",
    complaint: "",
    technicianUserId: "",
    repairCost: "0",
    serviceCharges: "0",
    warehouseId: "",
  });
  const [part, setPart] = useState({
    jobId: "",
    warehouseId: "",
    productId: "",
    unitId: "",
    qty: "1",
    unitCost: "0",
  });

  async function load() {
    const res = await afterSalesApi.listServiceJobs(branchId ?? undefined);
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
      await afterSalesApi.createServiceJob({
        branchId,
        warehouseId: form.warehouseId || undefined,
        customerId: form.customerId || undefined,
        productId: form.productId || undefined,
        serialCode: form.serialCode || undefined,
        saleId: form.saleId || undefined,
        complaint: form.complaint,
        technicianUserId: form.technicianUserId || undefined,
        repairCost: Number(form.repairCost),
        serviceCharges: Number(form.serviceCharges),
        idempotencyKey: uuid(),
      });
      toast.push({ title: "Job card created", tone: "success" });
      await load();
    } catch (err) {
      toast.push({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function addPart(e: FormEvent) {
    e.preventDefault();
    try {
      await afterSalesApi.addServicePart(part.jobId, {
        warehouseId: part.warehouseId,
        productId: part.productId,
        unitId: part.unitId,
        qty: part.qty,
        unitCost: Number(part.unitCost),
      });
      const b = (await afterSalesApi.getServiceBill(part.jobId)) as Record<string, unknown>;
      setBill(b);
      toast.push({ title: "Part consumed from stock", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Parts failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Service & repair</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Statuses: Received → Diagnosis → Repairing → Ready → Delivered
      </p>

      <Card title="Job card">
        <Form onSubmit={onCreate}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Customer ID" value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))} />
            <Input label="Product ID" value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Serial" value={form.serialCode} onChange={(e) => setForm((p) => ({ ...p, serialCode: e.target.value }))} hint="Validates against warranty / serial master" />
            <Input label="Invoice / sale ID" value={form.saleId} onChange={(e) => setForm((p) => ({ ...p, saleId: e.target.value }))} />
            <Input label="Complaint" required value={form.complaint} onChange={(e) => setForm((p) => ({ ...p, complaint: e.target.value }))} />
            <Input label="Technician user ID" value={form.technicianUserId} onChange={(e) => setForm((p) => ({ ...p, technicianUserId: e.target.value }))} />
            <Input label="Repair cost" value={form.repairCost} onChange={(e) => setForm((p) => ({ ...p, repairCost: e.target.value }))} />
            <Input label="Service charges" value={form.serviceCharges} onChange={(e) => setForm((p) => ({ ...p, serviceCharges: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Create job</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Consume repair parts">
        <Form onSubmit={addPart}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Job ID" required value={part.jobId} onChange={(e) => setPart((p) => ({ ...p, jobId: e.target.value }))} />
            <Input label="Warehouse ID" required value={part.warehouseId} onChange={(e) => setPart((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Part product ID" required value={part.productId} onChange={(e) => setPart((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" required value={part.unitId} onChange={(e) => setPart((p) => ({ ...p, unitId: e.target.value }))} />
            <Input label="Qty" value={part.qty} onChange={(e) => setPart((p) => ({ ...p, qty: e.target.value }))} />
            <Input label="Unit cost" value={part.unitCost} onChange={(e) => setPart((p) => ({ ...p, unitCost: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Consume part</Button>
          </FormActions>
        </Form>
        {bill ? (
          <div className="mt-3 text-sm">
            Parts {String(bill.partsTotal)} · billable {String(bill.billableTotal)} · warranty covered{" "}
            {String(bill.warrantyCovered)}
          </div>
        ) : null}
      </Card>

      <Card title="Jobs">
        <ul className="space-y-2 text-sm">
          {items.map((j) => {
            const status = String(j.status);
            const next = NEXT[status];
            return (
              <li key={String(j.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                <div>
                  <strong>{String(j.job_number)}</strong> · {String(j.complaint).slice(0, 40)}
                  {j.under_warranty ? " · warranty" : ""}
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{status}</Badge>
                  {next ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        void afterSalesApi.advanceServiceJob(String(j.id), next).then(load)
                      }
                    >
                      {next}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
          {!items.length ? <li className="text-[var(--erp-muted)]">No jobs</li> : null}
        </ul>
      </Card>
    </div>
  );
}
