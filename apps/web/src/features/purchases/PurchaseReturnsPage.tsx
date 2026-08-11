import { useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { purchasesApi } from "./purchases-api";

function uuid() {
  return crypto.randomUUID();
}

export function PurchaseReturnsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [form, setForm] = useState({
    warehouseId: "",
    originalPurchaseId: "",
    reason: "",
    productId: "",
    unitId: "",
    qty: "1",
    unitCost: "0",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    try {
      await purchasesApi.postReturn({
        branchId,
        warehouseId: form.warehouseId,
        originalPurchaseId: form.originalPurchaseId,
        reason: form.reason,
        items: [
          {
            productId: form.productId,
            unitId: form.unitId,
            qty: form.qty,
            unitCost: Number(form.unitCost),
          },
        ],
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      toast.push({
        title: "Purchase return posted",
        description: "Stock decreased · supplier ledger & payable updated",
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Return failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Purchase returns</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Lifecycle updates stock, supplier ledger, payable, accounts, and audit via the purchase return
        service.
      </p>
      <Card>
        <Form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Warehouse ID"
              required
              value={form.warehouseId}
              onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
            />
            <Input
              label="Original purchase ID"
              required
              value={form.originalPurchaseId}
              onChange={(e) => setForm((p) => ({ ...p, originalPurchaseId: e.target.value }))}
            />
            <Input
              label="Reason"
              required
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
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
              label="Unit cost"
              value={form.unitCost}
              onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
            />
          </div>
          <FormActions>
            <Button type="submit">Post return</Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
