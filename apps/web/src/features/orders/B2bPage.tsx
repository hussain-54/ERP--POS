import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { commerceApi } from "@/features/crm/commerce-api";

export function B2bPage() {
  const toast = useToast();
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [customerId, setCustomerId] = useState("");
  const [email, setEmail] = useState("");
  const [portal, setPortal] = useState<unknown>(null);
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [orderId, setOrderId] = useState("");

  async function reload() {
    setUsers((await commerceApi.listB2bUsers()).items);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">B2B wholesale portal</h1>
      <p className="text-sm opacity-70">
        Wholesale/dealer login users, wholesale & dealer pricing, bulk orders, credit account, order
        approval, quotations, invoice/payment history, outstanding, reorder.
      </p>

      <Card title="Portal users">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            label="Wholesale/dealer customer id"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
          <Input label="Login email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button
          className="mt-2"
          type="button"
          onClick={() =>
            void commerceApi
              .createB2bUser({ customerId, email, displayName: email })
              .then(() => reload())
              .then(() => toast.push({ title: "B2B user created", tone: "success" }))
              .catch((err) =>
                toast.push({
                  title: "Failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              )
          }
        >
          Create portal user
        </Button>
        <ul className="mt-3 text-sm">
          {users.map((u) => (
            <li key={String(u.id)}>
              {String(u.email)} → customer {String(u.customer_id)}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Customer portal snapshot">
        <Button
          type="button"
          onClick={() =>
            void commerceApi
              .portal(customerId)
              .then(setPortal)
              .catch((err) =>
                toast.push({
                  title: "Portal failed",
                  description: err instanceof Error ? err.message : "Error",
                  tone: "danger",
                }),
              )
          }
        >
          Load portal (credit, orders, payments, reorder)
        </Button>
        <pre className="mt-3 max-h-72 overflow-auto text-xs">
          {portal ? JSON.stringify(portal, null, 2) : "Load a B2B customer portal view."}
        </pre>
      </Card>

      <Card title="Bulk order + approval">
        <div className="grid gap-2 md:grid-cols-2">
          <Input label="Branch id" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
          <Input
            label="Warehouse id"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          />
          <Input
            label="Product id"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          />
          <Input label="Unit id" value={unitId} onChange={(e) => setUnitId(e.target.value)} />
          <Input
            label="Order id (approve)"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              void commerceApi
                .createB2bOrder({
                  branchId,
                  warehouseId,
                  customerId,
                  items: [{ productId, unitId, qty: "10" }],
                  requireApproval: true,
                  idempotencyKey: crypto.randomUUID(),
                })
                .then((r) => {
                  const id = String((r as { item?: { id?: string } }).item?.id ?? "");
                  setOrderId(id);
                  toast.push({ title: "B2B order created (pending approval)", tone: "success" });
                })
                .catch((err) =>
                  toast.push({
                    title: "Order failed",
                    description: err instanceof Error ? err.message : "Error",
                    tone: "danger",
                  }),
                )
            }
          >
            Place bulk order
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void commerceApi
                .approveB2bOrder(orderId, true)
                .then(() => toast.push({ title: "Order approved", tone: "success" }))
            }
          >
            Approve order
          </Button>
        </div>
      </Card>
    </div>
  );
}
