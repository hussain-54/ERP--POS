import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@electronic-erp/ui";
import { enterpriseApi } from "@/features/system/enterprise-api";

export function NotificationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [title, setTitle] = useState("Daily sales summary");
  const [body, setBody] = useState("Review today’s POS totals in the dashboard.");
  const [type, setType] = useState("daily_sales");

  async function reload() {
    setItems((await enterpriseApi.listNotifications()).items);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <p className="text-sm opacity-70">
        In-app feed for low/out/overstock, dues, online orders, quotations, warranty, repairs,
        approvals, daily sales, sync failure. External email/SMS/push use channel adapters (null by
        default).
      </p>

      <Card title="Scan triggers">
        <Input
          label="Warehouse id (optional)"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        />
        <Button
          className="mt-2"
          type="button"
          onClick={() =>
            void enterpriseApi
              .scanNotifications({ warehouseId: warehouseId || undefined })
              .then((r) => {
                toast.push({
                  title: "Scan complete",
                  description: JSON.stringify(r).slice(0, 160),
                  tone: "success",
                });
                return reload();
              })
          }
        >
          Scan stock / installments / online orders / approvals
        </Button>
      </Card>

      <Card title="Broadcast (in-app)">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">Type</span>
            <select
              className="rounded border border-[var(--erp-border)] bg-transparent px-2 py-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {[
                "low_stock",
                "out_of_stock",
                "overstock",
                "installment_due",
                "payment_due",
                "supplier_payment_due",
                "customer_outstanding",
                "stock_received",
                "online_order",
                "quotation",
                "warranty_expiry",
                "repair_ready",
                "approval_request",
                "daily_sales",
                "sync_failure",
                "general",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="md:col-span-2"
          />
        </div>
        <Button
          className="mt-2"
          type="button"
          onClick={() =>
            void enterpriseApi
              .createNotification({
                type,
                title,
                body,
                channels: ["in_app", "email"],
                severity: "info",
              })
              .then(() => reload())
              .then(() =>
                toast.push({
                  title: "Notification created",
                  description: "Email adapter skipped unless configured",
                  tone: "success",
                }),
              )
          }
        >
          Create notification
        </Button>
      </Card>

      <Card title="Inbox">
        <ul className="space-y-2 text-sm">
          {items.map((n) => (
            <li
              key={String(n.id)}
              className="flex items-start justify-between gap-2 rounded border border-[var(--erp-border)] px-3 py-2"
            >
              <div>
                <div className="font-medium">
                  {String(n.title)}{" "}
                  <span className="opacity-60">({String(n.type)} · {String(n.severity)})</span>
                </div>
                <div className="opacity-70">{String(n.body)}</div>
                <div className="text-xs opacity-50">
                  {n.is_read ? "Read" : "Unread"} · {String(n.created_at)}
                </div>
              </div>
              {!n.is_read && (
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => void enterpriseApi.markRead(String(n.id)).then(() => reload())}
                >
                  Mark read
                </Button>
              )}
            </li>
          ))}
          {!items.length && <li className="opacity-70">No notifications yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
