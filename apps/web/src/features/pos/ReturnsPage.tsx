import { useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { posApi } from "./pos-api";

function uuid() {
  return crypto.randomUUID();
}

export function ReturnsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [form, setForm] = useState({
    warehouseId: "",
    originalSaleId: "",
    returnType: "refund",
    reason: "",
    productId: "",
    unitId: "",
    qty: "1",
    unitPrice: "0",
    exchangeProductId: "",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    try {
      await posApi.postReturn({
        branchId,
        warehouseId: form.warehouseId,
        originalSaleId: form.originalSaleId,
        returnType: form.returnType,
        reason: form.reason,
        items: [
          {
            productId: form.productId || undefined,
            unitId: form.unitId,
            qty: form.qty,
            unitPrice: Number(form.unitPrice),
            exchangeProductId:
              form.returnType === "exchange" ? form.exchangeProductId || undefined : undefined,
          },
        ],
        idempotencyKey: uuid(),
        operationId: uuid(),
      });
      toast.push({ title: "Return posted", tone: "success" });
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
      <h1 className="text-2xl font-semibold">Returns / Exchange</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Updates stock, customer ledger, accounts, and original invoice status via the POS return
        service.
      </p>
      <Card>
        <Form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Warehouse ID" required value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Original invoice / sale ID" required value={form.originalSaleId} onChange={(e) => setForm((p) => ({ ...p, originalSaleId: e.target.value }))} />
            <Select
              label="Type"
              options={[
                { value: "refund", label: "Refund" },
                { value: "credit", label: "Customer credit" },
                { value: "exchange", label: "Exchange" },
              ]}
              value={form.returnType}
              onChange={(e) => setForm((p) => ({ ...p, returnType: e.target.value }))}
            />
            <Input label="Reason" required value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
            <Input label="Product ID" value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" required value={form.unitId} onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))} />
            <Input label="Qty" required value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
            <Input label="Unit price" required value={form.unitPrice} onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))} />
            {form.returnType === "exchange" ? (
              <Input
                label="Exchange product ID"
                value={form.exchangeProductId}
                onChange={(e) => setForm((p) => ({ ...p, exchangeProductId: e.target.value }))}
              />
            ) : null}
          </div>
          <FormActions>
            <Button type="submit">Post return</Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
