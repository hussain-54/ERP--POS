import { useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, useToast } from "@electronic-erp/ui";
import { inventoryApi } from "./inventory-api";

export function BatchSerialPage() {
  const toast = useToast();
  const [batch, setBatch] = useState({
    productId: "",
    batchNumber: "",
    manufacturingDate: "",
    expiryDate: "",
    warrantyStart: "",
    warrantyEnd: "",
  });
  const [serial, setSerial] = useState({
    productId: "",
    batchId: "",
    serialNumber: "",
    warehouseId: "",
    manufacturingDate: "",
    expiryDate: "",
    warrantyStart: "",
    warrantyEnd: "",
  });

  async function createBatch(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await inventoryApi.createBatch({
        ...batch,
        manufacturingDate: batch.manufacturingDate || undefined,
        expiryDate: batch.expiryDate || undefined,
        warrantyStart: batch.warrantyStart || undefined,
        warrantyEnd: batch.warrantyEnd || undefined,
      });
      toast.push({
        title: "Batch created",
        description: String((res as { id?: string }).id ?? ""),
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: "Batch failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  async function createSerial(e: FormEvent) {
    e.preventDefault();
    try {
      await inventoryApi.createSerial({
        ...serial,
        batchId: serial.batchId || undefined,
        warehouseId: serial.warehouseId || undefined,
        manufacturingDate: serial.manufacturingDate || undefined,
        expiryDate: serial.expiryDate || undefined,
        warrantyStart: serial.warrantyStart || undefined,
        warrantyEnd: serial.warrantyEnd || undefined,
      });
      toast.push({ title: "Serial created", tone: "success" });
    } catch (err) {
      toast.push({
        title: "Serial failed",
        description: err instanceof Error ? err.message : "Error",
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Batch / Serial</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Batch and serial tracking with manufacturing, expiry, and warranty dates. Serial history is
        written with every ledger movement.
      </p>

      <Card title="Create batch">
        <Form onSubmit={createBatch}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Product ID" required value={batch.productId} onChange={(e) => setBatch((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Batch number" required value={batch.batchNumber} onChange={(e) => setBatch((p) => ({ ...p, batchNumber: e.target.value }))} />
            <Input label="Manufacturing date" type="date" value={batch.manufacturingDate} onChange={(e) => setBatch((p) => ({ ...p, manufacturingDate: e.target.value }))} />
            <Input label="Expiry" type="date" value={batch.expiryDate} onChange={(e) => setBatch((p) => ({ ...p, expiryDate: e.target.value }))} />
            <Input label="Warranty start" type="date" value={batch.warrantyStart} onChange={(e) => setBatch((p) => ({ ...p, warrantyStart: e.target.value }))} />
            <Input label="Warranty end" type="date" value={batch.warrantyEnd} onChange={(e) => setBatch((p) => ({ ...p, warrantyEnd: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Create batch</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Create serial">
        <Form onSubmit={createSerial}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Product ID" required value={serial.productId} onChange={(e) => setSerial((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Serial number" required value={serial.serialNumber} onChange={(e) => setSerial((p) => ({ ...p, serialNumber: e.target.value }))} />
            <Input label="Batch ID" value={serial.batchId} onChange={(e) => setSerial((p) => ({ ...p, batchId: e.target.value }))} />
            <Input label="Warehouse ID" value={serial.warehouseId} onChange={(e) => setSerial((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Manufacturing date" type="date" value={serial.manufacturingDate} onChange={(e) => setSerial((p) => ({ ...p, manufacturingDate: e.target.value }))} />
            <Input label="Expiry" type="date" value={serial.expiryDate} onChange={(e) => setSerial((p) => ({ ...p, expiryDate: e.target.value }))} />
            <Input label="Warranty start" type="date" value={serial.warrantyStart} onChange={(e) => setSerial((p) => ({ ...p, warrantyStart: e.target.value }))} />
            <Input label="Warranty end" type="date" value={serial.warrantyEnd} onChange={(e) => setSerial((p) => ({ ...p, warrantyEnd: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Create serial</Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
