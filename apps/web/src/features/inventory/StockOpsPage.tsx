import { useState, type FormEvent } from "react";
import { Button, Card, Form, FormActions, Input, Select, useToast } from "@electronic-erp/ui";
import { inventoryApi } from "./inventory-api";
import { useAuth } from "@/features/auth/AuthContext";
import {
  formatOnlineFailure,
  requireInternetConnection,
} from "@/lib/online-required";

const MOVEMENT_TYPES = [
  "opening",
  "purchase",
  "sale",
  "sale_return",
  "purchase_return",
  "damage",
  "adjustment",
  "transfer_out",
  "transfer_in",
  "stock_count",
  "reservation",
  "release_reservation",
  "warranty_replacement",
  "repair_consumption",
].map((v) => ({ value: v, label: v }));

function uuid() {
  return crypto.randomUUID();
}

export function StockOpsPage() {
  const toast = useToast();
  const { branchId } = useAuth();
  const [movement, setMovement] = useState({
    warehouseId: "",
    productId: "",
    unitId: "",
    movementType: "opening",
    qtyDelta: "1",
    reason: "",
  });
  const [adjustment, setAdjustment] = useState({
    warehouseId: "",
    productId: "",
    unitId: "",
    qtyAfter: "0",
    reason: "",
    requiresApproval: true,
    adjustmentId: "",
  });
  const [count, setCount] = useState({
    warehouseId: "",
    code: "",
    sessionId: "",
    productId: "",
    unitId: "",
    expectedQty: "0",
    countedQty: "0",
    barcodeScanned: "",
  });
  const [reservation, setReservation] = useState({
    warehouseId: "",
    productId: "",
    unitId: "",
    qty: "1",
    sourceType: "sale",
    sourceId: "",
    reservationId: "",
  });

  async function postMovement(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    if (!requireInternetConnection(toast.push)) return;
    try {
      await inventoryApi.postMovement({
        branchId,
        warehouseId: movement.warehouseId,
        productId: movement.productId,
        unitId: movement.unitId,
        movementType: movement.movementType,
        qtyDelta: movement.qtyDelta,
        sourceType: "manual",
        sourceId: uuid(),
        operationId: uuid(),
        reason: movement.reason || undefined,
      });
      toast.push({ title: "Movement posted", tone: "success" });
    } catch (err) {
      const failed = formatOnlineFailure(err, "stock");
      toast.push({
        title: failed.title,
        description: failed.description,
        tone: "danger",
      });
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Stock operations</h1>
      <p className="text-sm text-[var(--erp-muted)]">
        Adjustments, counts, reservations, and direct ledger postings.
      </p>

      <Card title="Post ledger movement">
        <Form onSubmit={postMovement}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Warehouse ID" required value={movement.warehouseId} onChange={(e) => setMovement((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Product ID" required value={movement.productId} onChange={(e) => setMovement((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" required value={movement.unitId} onChange={(e) => setMovement((p) => ({ ...p, unitId: e.target.value }))} />
            <Select label="Movement type" options={MOVEMENT_TYPES} value={movement.movementType} onChange={(e) => setMovement((p) => ({ ...p, movementType: e.target.value }))} />
            <Input label="Qty delta" required value={movement.qtyDelta} onChange={(e) => setMovement((p) => ({ ...p, qtyDelta: e.target.value }))} />
            <Input label="Reason" value={movement.reason} onChange={(e) => setMovement((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Post movement</Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Adjustment request">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (!branchId) return;
            void inventoryApi
              .createAdjustment({
                branchId,
                warehouseId: adjustment.warehouseId,
                productId: adjustment.productId,
                unitId: adjustment.unitId,
                qtyAfter: adjustment.qtyAfter,
                reason: adjustment.reason,
                requiresApproval: adjustment.requiresApproval,
                idempotencyKey: uuid(),
              })
              .then((res) => {
                setAdjustment((p) => ({ ...p, adjustmentId: String((res as { id?: string }).id ?? "") }));
                toast.push({ title: "Adjustment created", tone: "success" });
              })
              .catch((err: unknown) =>
                toast.push({
                  title: "Adjustment failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Warehouse ID" required value={adjustment.warehouseId} onChange={(e) => setAdjustment((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Product ID" required value={adjustment.productId} onChange={(e) => setAdjustment((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" required value={adjustment.unitId} onChange={(e) => setAdjustment((p) => ({ ...p, unitId: e.target.value }))} />
            <Input label="Quantity after" required value={adjustment.qtyAfter} onChange={(e) => setAdjustment((p) => ({ ...p, qtyAfter: e.target.value }))} />
            <Input label="Reason" required value={adjustment.reason} onChange={(e) => setAdjustment((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={adjustment.requiresApproval}
              onChange={(e) => setAdjustment((p) => ({ ...p, requiresApproval: e.target.checked }))}
            />
            Requires approval
          </label>
          <FormActions>
            <Button type="submit">Create adjustment</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void inventoryApi
                  .approveAdjustment(adjustment.adjustmentId)
                  .then(() => toast.push({ title: "Adjustment approved & posted", tone: "success" }))
                  .catch((err: unknown) =>
                    toast.push({
                      title: "Approve failed",
                      description: err instanceof Error ? err.message : "Error",
                      tone: "danger",
                    }),
                  )
              }
            >
              Approve / post
            </Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Stock count">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (!branchId) return;
            void inventoryApi
              .createCount({
                branchId,
                warehouseId: count.warehouseId,
                code: count.code || `CNT-${Date.now()}`,
              })
              .then((res) => {
                setCount((p) => ({ ...p, sessionId: String((res as { id?: string }).id ?? "") }));
                toast.push({ title: "Count session started", tone: "success" });
              })
              .catch((err: unknown) =>
                toast.push({
                  title: "Count failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Warehouse ID" required value={count.warehouseId} onChange={(e) => setCount((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Session code" value={count.code} onChange={(e) => setCount((p) => ({ ...p, code: e.target.value }))} />
            <Input label="Session ID" value={count.sessionId} onChange={(e) => setCount((p) => ({ ...p, sessionId: e.target.value }))} />
            <Input label="Barcode scanned" value={count.barcodeScanned} onChange={(e) => setCount((p) => ({ ...p, barcodeScanned: e.target.value }))} />
            <Input label="Product ID" value={count.productId} onChange={(e) => setCount((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" value={count.unitId} onChange={(e) => setCount((p) => ({ ...p, unitId: e.target.value }))} />
            <Input label="Expected qty" value={count.expectedQty} onChange={(e) => setCount((p) => ({ ...p, expectedQty: e.target.value }))} />
            <Input label="Counted qty" value={count.countedQty} onChange={(e) => setCount((p) => ({ ...p, countedQty: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Start session</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void inventoryApi
                  .addCountLine(count.sessionId, {
                    productId: count.productId,
                    unitId: count.unitId,
                    expectedQty: count.expectedQty,
                    countedQty: count.countedQty,
                    barcodeScanned: count.barcodeScanned || undefined,
                  })
                  .then(() => toast.push({ title: "Count line saved", tone: "success" }))
                  .catch((err: unknown) =>
                    toast.push({
                      title: "Line failed",
                      description: err instanceof Error ? err.message : "Error",
                      tone: "danger",
                    }),
                  )
              }
            >
              Add scanned line
            </Button>
            <Button
              type="button"
              onClick={() =>
                void inventoryApi
                  .approveCount(count.sessionId)
                  .then(() => toast.push({ title: "Count approved; adjustments posted", tone: "success" }))
                  .catch((err: unknown) =>
                    toast.push({
                      title: "Approve count failed",
                      description: err instanceof Error ? err.message : "Error",
                      tone: "danger",
                    }),
                  )
              }
            >
              Approve & generate adjustments
            </Button>
          </FormActions>
        </Form>
      </Card>

      <Card title="Reservation">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (!branchId) return;
            const sourceId = reservation.sourceId || uuid();
            void inventoryApi
              .createReservation({
                branchId,
                warehouseId: reservation.warehouseId,
                productId: reservation.productId,
                unitId: reservation.unitId,
                qty: reservation.qty,
                sourceType: reservation.sourceType,
                sourceId,
                operationId: uuid(),
              })
              .then((res) => {
                setReservation((p) => ({
                  ...p,
                  sourceId,
                  reservationId: String((res as { id?: string }).id ?? ""),
                }));
                toast.push({ title: "Stock reserved", tone: "success" });
              })
              .catch((err: unknown) =>
                toast.push({
                  title: "Reserve failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              );
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Warehouse ID" required value={reservation.warehouseId} onChange={(e) => setReservation((p) => ({ ...p, warehouseId: e.target.value }))} />
            <Input label="Product ID" required value={reservation.productId} onChange={(e) => setReservation((p) => ({ ...p, productId: e.target.value }))} />
            <Input label="Unit ID" required value={reservation.unitId} onChange={(e) => setReservation((p) => ({ ...p, unitId: e.target.value }))} />
            <Input label="Qty" required value={reservation.qty} onChange={(e) => setReservation((p) => ({ ...p, qty: e.target.value }))} />
            <Select
              label="Source type"
              options={["sale", "order", "quotation", "delivery", "b2b_order"].map((v) => ({ value: v, label: v }))}
              value={reservation.sourceType}
              onChange={(e) => setReservation((p) => ({ ...p, sourceType: e.target.value }))}
            />
            <Input label="Reservation ID" value={reservation.reservationId} onChange={(e) => setReservation((p) => ({ ...p, reservationId: e.target.value }))} />
          </div>
          <FormActions>
            <Button type="submit">Reserve</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void inventoryApi
                  .releaseReservation(reservation.reservationId, uuid())
                  .then(() => toast.push({ title: "Reservation released", tone: "success" }))
                  .catch((err: unknown) =>
                    toast.push({
                      title: "Release failed",
                      description: err instanceof Error ? err.message : "Error",
                      tone: "danger",
                    }),
                  )
              }
            >
              Release
            </Button>
          </FormActions>
        </Form>
      </Card>
    </div>
  );
}
